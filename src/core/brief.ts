import { z } from 'zod';
import { normalizeConstraints } from './constraints.js';
import { consistencySchema, normalizeConsistency, variationAxis } from './consistency.js';
import { IdraError } from './errors.js';
import { newId } from './ids.js';

export const briefSchema = z.object({
  request: z.string().trim().min(1).max(2000),
  count: z.number().int().min(1).max(500).optional(),
  output_type: z.enum(['photo', 'ui', 'illustration']).optional(),
  target_aspect: z.string().regex(/^[1-9]\d?:[1-9]\d?$/).optional(),
  design_rules: consistencySchema.shape.rules.max(19).optional().describe('Use concrete rules extracted from any user-specified look or reference; defaults are only for an unspecified direction. One slot is reserved for checking requested content'),
  allowed_changes: z.array(variationAxis).max(9).optional(),
}).strict();

export type BriefInput = z.input<typeof briefSchema>;

/** Build a complete starter request without an API call. The host interprets user-specific art direction. */
export function designBrief(input: BriefInput): Record<string, unknown> {
  const parsed = briefSchema.safeParse(input);
  if (!parsed.success) throw new IdraError('INVALID_INPUT', 'brief input is invalid', { issues: parsed.error.issues });
  const p = parsed.data;
  const match = /\b(?:make|create|generate)\s+(\d+)\b/i.exec(p.request);
  const count = p.count ?? (match ? Number(match[1]) : 3);
  if (count < 1 || count > 500) throw new IdraError('INVALID_INPUT', 'request count must be between 1 and 500');
  const type = p.output_type ?? (/\b(ui|dashboard|interface|app screens?|website)\b/i.test(p.request) ? 'ui' : /\b(illustration|drawings?|cartoon)\b/i.test(p.request) ? 'illustration' : 'photo');
  const aspect = p.target_aspect ?? /\b([1-9]\d?:[1-9]\d?)\b/.exec(p.request)?.[1] ?? (/\bportrait\b/i.test(p.request) ? '2:3' : /\blandscape\b/i.test(p.request) ? '3:2' : '1:1');
  const defaults = {
    photo: [
      { id: 'palette', instruction: 'Use a warm cream backdrop and restrained neutral colors. Keep the same color grading across the set; retain any supplied product colors.' },
      { id: 'lighting', instruction: 'Soft diffused window light from the upper left, gentle contact shadows, and natural exposure throughout the set.' },
      { id: 'finish', instruction: 'Editorial product photography with realistic materials and a matte finish. No glossy CGI, decorative gradients, or floating objects.' },
      { id: 'layout', instruction: 'One clear focal subject, clean background, and generous breathing room. Keep the same visual density across the set.' },
      { id: 'exclusions', instruction: 'Do not invent a real brand, logo, product claims, label text, or watermark. A supplied real product must retain its actual packaging.' },
    ],
    ui: [
      { id: 'palette', instruction: 'Use a white canvas, charcoal primary text, muted gray borders, and a single blue accent. Keep identical color roles across screens.' },
      { id: 'typography', instruction: 'Use one neutral sans-serif family with regular body text and semibold headings. Keep the same heading/body/caption hierarchy.' },
      { id: 'components', instruction: 'Reuse button, input, icon, corner-radius, and spacing treatments. Keep the same sidebar width and navigation treatment across screens.' },
      { id: 'layout', instruction: 'Use a desktop app layout with a left sidebar, page title, aligned content edges, and restrained density. Avoid nested card stacks, heavy shadows, and decorative gradients.' },
      { id: 'legibility', instruction: 'Use short readable UI labels and clear hierarchy. No invented brand logo or watermarks. This is a visual concept, not a claim of functional code.' },
    ],
    illustration: [
      { id: 'palette', instruction: 'Use a restrained warm neutral palette with one muted blue accent. Preserve the same palette roles across the series.' },
      { id: 'medium', instruction: 'Use flat editorial illustration with matte fills, clean consistent outlines, and minimal shading throughout the series.' },
      { id: 'composition', instruction: 'Use one clear focal subject and generous negative space. Keep the same detail density and visual scale.' },
      { id: 'exclusions', instruction: 'No photorealism, 3D rendering, invented logos, extra text, or watermarks.' },
    ],
  };
  const changes = p.allowed_changes ?? (type === 'ui' ? ['subject', 'text'] : type === 'photo' ? ['angle'] : ['subject', 'pose']);
  const rules = p.design_rules ?? defaults[type];
  const briefRule = { id: 'brief', instruction: "Verify the requested subject and this job's specific content or variation are actually present. Matching the style alone is insufficient; reject the result if it misses the requested content, screen, product, or change." };
  const consistency = normalizeConsistency({ name: `${type} starter design`, rules: rules.some((r) => r.id === 'brief') ? rules : [...rules, briefRule], allowed_changes: changes }, normalizeConstraints({}));
  return {
    user_prompt: p.request,
    assumptions: [
      ...(!p.output_type ? [`Interpreted as ${type} output.`] : []),
      ...(!p.design_rules ? ['Starter visual direction chosen because no custom design_rules were supplied. Replace it when the user or reference specifies a different look.'] : []),
      `Aspect ${aspect}; ${count} images.`,
    ],
    create_batch: {
      idempotency_key: newId('brief'), request: p.request, count, planning_mode: 'variations',
      base_prompt: `Create one standalone image for this brief: ${p.request}\nThis is one output in the requested set; do not combine the set into a collage or grid.`,
      target_aspect: aspect, variety: 'subtle', consistency, max_retries: 2,
    },
    next: 'Preserve all user requirements. Adjust any conflicting defaults before creation; add supplied references with their correct roles. Check that this host has image generation AND visual inspection tools, then pass create_batch to idra_create_batch. If no generator is connected, return the brief and explain setup; do not claim images were generated.',
  };
}
