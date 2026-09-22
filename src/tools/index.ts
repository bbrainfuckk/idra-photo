import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Ctx } from '../core/context.js';
import { toErrorPayload } from '../core/errors.js';
import { createBatch, controlBatch, extendBatch, reconcile, reportProblem, status, step } from '../core/queue.js';
import { constraintsSchema } from '../core/constraints.js';

const id = z.string().min(3).max(64).regex(/^[A-Za-z0-9_-]+$/);
const key = z.string().min(1).max(128);
const filePath = z.string().min(1).max(1024);
const shortText = z.string().max(2000);
const refSchema = z
  .object({
    path: filePath,
    role: z.enum(['style', 'product', 'person', 'composition', 'edit_target', 'design']).default('style'),
    label: z.string().max(80).optional(),
  })
  .strict();
const conceptsSchema = z
  .array(z.union([shortText, z.object({ text: shortText.min(1), references: z.array(refSchema).max(4).optional() }).strict()]))
  .max(500)
  .optional();

function reply(fn: () => unknown) {
  try {
    return { content: [{ type: 'text' as const, text: JSON.stringify(fn()) }] };
  } catch (err) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(toErrorPayload(err)) }], isError: true };
  }
}

export const TOOL_NAMES = ['idra_create_batch', 'idra_step', 'idra_status', 'idra_report_problem', 'idra_control_batch', 'idra_extend', 'idra_reconcile'] as const;

export function registerTools(server: McpServer, ctx: Ctx): void {
  server.registerTool(
    'idra_create_batch',
    {
      title: 'Create image batch',
      description:
        'Save a finite batch request (count, prompt or concepts, reference images, constraints) and return its batch_id. Generates nothing. Pass a fresh idempotency_key; repeating the same call returns the same batch.',
      inputSchema: {
        idempotency_key: key,
        request: z.string().min(1).max(8000).describe("The user's request, verbatim"),
        count: z.number().int().min(1).max(500),
        planning_mode: z.enum(['variations', 'diversified', 'explicit']).default('variations'),
        base_prompt: shortText.optional().describe('Required for variations: the prompt every image follows'),
        concepts: conceptsSchema.describe(
          'diversified/explicit: exactly count entries. variations: one short hint per image that YOU brainstorm (pose, framing, angle, moment, background) inside the brief; Idra fills any you skip. An entry may be {text, references} to give that image its own reference, e.g. one source character each',
        ),
        variety: z.enum(['subtle', 'balanced', 'bold']).optional().describe('variations only: subtle = near-identical, balanced = default, bold = also light and setting. Strict constraints stay locked'),
        references: z.array(refSchema).max(8).optional().describe('Shared by every image'),
        constraints: constraintsSchema.optional().describe('Levels off/high/strict for product, identity, text, composition, style. style_details describes the look only (palette, light, texture), never objects or scenery'),
        target_aspect: z.string().max(7).optional().describe('e.g. 4:5'),
        name: z.string().max(60).optional().describe('Short folder name'),
        max_retries: z.number().int().min(0).max(5).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => reply(() => createBatch(ctx, args)),
  );

  server.registerTool(
    'idra_step',
    {
      title: 'Next job / report finished image',
      description:
        'Normal loop call. Without completed: claims and returns one job. With completed: validates and saves that image, then returns the next job in the same reply. Invalid images are rejected and no new job is issued.',
      inputSchema: {
        batch_id: id,
        completed: z
          .object({
            job_id: id,
            attempt_token: z.string().min(8).max(64),
            artifact_path: filePath.optional().describe('Absolute path of the generated image. Omit if you saved it to save_to'),
            review: z.object({ performed: z.boolean(), passed: z.boolean().optional(), notes: z.string().max(500).optional() }).strict().optional(),
          })
          .strict()
          .optional(),
        request_id: key.optional().describe('Optional; reuse only when retrying the identical call'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => reply(() => step(ctx, args)),
  );

  server.registerTool(
    'idra_status',
    {
      title: 'Batch status',
      description: 'Read-only. No batch_id: list recent batches. With batch_id: compact counts, problems, and a short resume card. detail=true pages through jobs.',
      inputSchema: {
        batch_id: id.optional(),
        detail: z.boolean().optional(),
        offset: z.number().int().min(0).max(100000).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => reply(() => status(ctx, args)),
  );

  server.registerTool(
    'idra_report_problem',
    {
      title: 'Report a failed generation',
      description:
        'Record what went wrong with the current job. classification: transient (retried later, bounded), usage_limit / tool_unavailable / permission_denied (pause), safety_refusal (fail + pause, prompt never reworded), invalid_output, unknown (use when unsure).',
      inputSchema: {
        batch_id: id,
        job_id: id,
        attempt_token: z.string().min(8).max(64),
        classification: z.enum(['transient', 'usage_limit', 'tool_unavailable', 'permission_denied', 'safety_refusal', 'invalid_output', 'unknown']),
        message: z.string().min(1).max(1000).describe('What the tool actually said'),
        retryable: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => reply(() => reportProblem(ctx, args)),
  );

  server.registerTool(
    'idra_control_batch',
    {
      title: 'Pause, resume, cancel, retry',
      description:
        'pause | resume | cancel | retry_failed. Resume only makes jobs eligible; it does not generate. Cancel stops new jobs and keeps saved images. retry_failed re-queues eligible failures (not safety refusals).',
      inputSchema: { batch_id: id, action: z.enum(['pause', 'resume', 'cancel', 'retry_failed']) },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args) => reply(() => controlBatch(ctx, args.batch_id, args.action)),
  );

  server.registerTool(
    'idra_extend',
    {
      title: 'Add more images',
      description: 'Append count more jobs to a batch, keeping numbering, style, references, and constraints. Needs a fresh idempotency_key; repeating it adds nothing.',
      inputSchema: {
        batch_id: id,
        idempotency_key: key,
        count: z.number().int().min(1).max(500),
        concepts: conceptsSchema.describe('diversified/explicit: exactly count new concepts. variations: optional hints you brainstorm; Idra fills the rest. Entries may be {text, references}'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => reply(() => extendBatch(ctx, args)),
  );

  server.registerTool(
    'idra_reconcile',
    {
      title: 'Resolve an interrupted job',
      description:
        'For a job whose outcome is unknown. check: adopt a valid image found in its save_to folder. adopt: use artifact_path. confirm_failed: no image was made. authorize_retry: generate it again (user accepts a possible duplicate).',
      inputSchema: {
        batch_id: id,
        job_id: id,
        action: z.enum(['check', 'adopt', 'confirm_failed', 'authorize_retry']),
        artifact_path: filePath.optional(),
        note: z.string().max(500).optional(),
        accept_duplicate: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => reply(() => reconcile(ctx, args)),
  );
}
