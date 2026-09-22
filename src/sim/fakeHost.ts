import fs from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { makePng } from './fixtures.js';

/**
 * SIMULATED HOST. It talks to the real Idra MCP server over stdio and plays the role of Codex,
 * but it "generates" deterministic fixture PNGs. Nothing here touches a real image model.
 */

export interface CallMetrics {
  calls: Record<string, number>;
  requestBytes: number;
  responseBytes: number;
  stepResponseBytes: number[];
}

export interface CallResult<T = Record<string, unknown>> {
  isError: boolean;
  data: T;
  bytes: number;
}

export class FakeHost {
  readonly metrics: CallMetrics = { calls: {}, requestBytes: 0, responseBytes: 0, stepResponseBytes: [] };
  stderr = '';

  private constructor(
    readonly client: Client,
    private readonly transport: StdioClientTransport,
  ) {}

  static async connect(opts: {
    cliPath: string;
    workspace?: string;
    extraArgs?: string[];
    nodeArgs?: string[];
    env?: Record<string, string>;
    /** Start something other than `node <cliPath> serve`, e.g. the idra-photo.cmd launcher. */
    command?: string;
    args?: string[];
  }): Promise<FakeHost> {
    const transport = new StdioClientTransport({
      command: opts.command ?? process.execPath,
      args: opts.args ?? [...(opts.nodeArgs ?? []), opts.cliPath, 'serve', ...(opts.workspace ? ['--workspace', opts.workspace] : []), ...(opts.extraArgs ?? [])],
      env: { ...(process.env as Record<string, string>), ...(opts.env ?? {}) },
      stderr: 'pipe',
    });
    const client = new Client({ name: 'idra-fake-host', version: '0.0.0' });
    await client.connect(transport);
    const host = new FakeHost(client, transport);
    transport.stderr?.on('data', (d: Buffer) => (host.stderr += d.toString()));
    return host;
  }

  get instructions(): string {
    return this.client.getInstructions() ?? '';
  }

  async call<T = Record<string, unknown>>(name: string, args: Record<string, unknown>): Promise<CallResult<T>> {
    const req = JSON.stringify(args);
    this.metrics.calls[name] = (this.metrics.calls[name] ?? 0) + 1;
    this.metrics.requestBytes += Buffer.byteLength(req);
    const res = (await this.client.callTool({ name, arguments: args })) as { content: { type: string; text?: string }[]; isError?: boolean };
    const text = res.content.map((c) => c.text ?? '').join('');
    const bytes = Buffer.byteLength(text);
    this.metrics.responseBytes += bytes;
    if (name === 'idra_step') this.metrics.stepResponseBytes.push(bytes);
    return { isError: res.isError === true, data: JSON.parse(text) as T, bytes };
  }

  /** Close stdin and kill the server process, like a host session ending abruptly. */
  async close(): Promise<void> {
    await this.transport.close();
  }

  get pid(): number | null {
    return this.transport.pid;
  }
}

export interface Job {
  job_id: string;
  seq: number;
  attempt_token: string;
  prompt: string;
  references: { label: string; role: string; path: string }[];
  save_to: string;
}

export interface Step {
  status: string;
  job?: Job;
  saved?: { seq: number; file: string };
  progress: string;
  counts: Record<string, number>;
  reason?: string;
}

export interface SimOptions {
  cliPath: string;
  workspace: string;
  count: number;
  referencePath?: string;
  /** Stop abruptly after writing this many images to staging, before reporting the last one. */
  interruptAfter?: number;
  /** Synthetic chatty baseline: also fetch full-detail status after every image. */
  chatty?: boolean;
  idempotencyKey?: string;
  width?: number;
  height?: number;
  /** Override how the server is started (launcher tests). */
  launch?: { command: string; args: string[]; env?: Record<string, string> };
}

export interface SimResult {
  batchId: string;
  final: Step;
  generated: number;
  interrupted: boolean;
  metrics: CallMetrics;
  instructionsBytes: number;
  promptBytes: number;
}

export async function runSimulatedBatch(opts: SimOptions): Promise<SimResult> {
  const host = opts.launch
    ? await FakeHost.connect({ cliPath: opts.cliPath, command: opts.launch.command, args: [...opts.launch.args, '--simulation'], env: opts.launch.env ?? {} })
    : await FakeHost.connect({ cliPath: opts.cliPath, workspace: opts.workspace, extraArgs: ['--simulation'] });
  const w = opts.width ?? 64;
  const h = opts.height ?? 80;
  try {
    const refs = opts.referencePath ? [{ path: opts.referencePath, role: 'style', label: 'style-ref' }] : [];
    const created = await host.call<{ batch_id: string }>('idra_create_batch', {
      idempotency_key: opts.idempotencyKey ?? `sim-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      request: `Simulated request: ${opts.count} photos in the same style`,
      count: opts.count,
      planning_mode: 'variations',
      base_prompt: 'Premium skincare bottle on a marble counter, soft morning light',
      references: refs,
      constraints: refs.length ? { style: 'strict', product: 'high' } : { product: 'high' },
      target_aspect: '4:5',
    });
    if (created.isError) throw new Error(`create failed: ${JSON.stringify(created.data)}`);
    const batchId = created.data.batch_id;
    let r = (await host.call<Step>('idra_step', { batch_id: batchId })).data;
    let generated = 0;
    let promptBytes = 0;
    while (r.status === 'job' && r.job) {
      const job = r.job;
      promptBytes += Buffer.byteLength(job.prompt);
      for (const ref of job.references) if (!fs.existsSync(ref.path)) throw new Error(`reference missing: ${ref.path}`);
      fs.mkdirSync(path.dirname(job.save_to), { recursive: true });
      fs.writeFileSync(job.save_to, makePng(w, h, job.seq * 7919 + 13));
      generated++;
      if (opts.interruptAfter && generated === opts.interruptAfter) {
        await host.close();
        return { batchId, final: r, generated, interrupted: true, metrics: host.metrics, instructionsBytes: Buffer.byteLength(host.instructions), promptBytes };
      }
      if (opts.chatty) await host.call('idra_status', { batch_id: batchId, detail: true, limit: 100 });
      const next = await host.call<Step>('idra_step', { batch_id: batchId, completed: { job_id: job.job_id, attempt_token: job.attempt_token } });
      if (next.isError) throw new Error(`step failed: ${JSON.stringify(next.data)}`);
      r = next.data;
    }
    const result = { batchId, final: r, generated, interrupted: false, metrics: host.metrics, instructionsBytes: Buffer.byteLength(host.instructions), promptBytes };
    await host.close();
    return result;
  } catch (err) {
    await host.close().catch(() => undefined);
    throw err;
  }
}
