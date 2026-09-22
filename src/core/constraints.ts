import { z } from 'zod';
import { IdraError } from './errors.js';

export const constraintLevel = z.enum(['off', 'high', 'strict']);
export type ConstraintLevel = z.infer<typeof constraintLevel>;

const shortText = z.string().max(400);

export const constraintsSchema = z
  .object({
    product: constraintLevel.default('off'),
    identity: constraintLevel.default('off'),
    text: constraintLevel.default('off'),
    composition: constraintLevel.default('off'),
    style: constraintLevel.default('off'),
    product_details: z.array(shortText).max(20).default([]),
    identity_details: shortText.optional(),
    text_content: z.array(shortText).max(20).default([]),
    composition_details: shortText.optional(),
    style_details: shortText.optional(),
    avoid: z.array(shortText).max(20).default([]),
  })
  .strict();

export type Constraints = z.infer<typeof constraintsSchema>;

export const DEFAULT_CONSTRAINTS: Constraints = {
  product: 'off',
  identity: 'off',
  text: 'off',
  composition: 'off',
  style: 'off',
  product_details: [],
  text_content: [],
  avoid: [],
};

export function normalizeConstraints(input: unknown): Constraints {
  const parsed = constraintsSchema.safeParse(input ?? {});
  if (!parsed.success) {
    throw new IdraError('INVALID_INPUT', 'constraints are invalid', { issues: parsed.error.issues });
  }
  return parsed.data;
}

/**
 * Turn constraint levels into explicit prompt requirements. These are prompt requirements and
 * review criteria, never a guarantee of pixel-exact preservation.
 */
export function constraintLines(c: Constraints, referenceLabels: { role: string; label: string }[]): string[] {
  const lines: string[] = [];
  const productRefs = referenceLabels.filter((r) => r.role === 'product').map((r) => r.label);
  const personRefs = referenceLabels.filter((r) => r.role === 'person').map((r) => r.label);
  const compRefs = referenceLabels.filter((r) => r.role === 'composition').map((r) => r.label);
  const styleRefs = referenceLabels.filter((r) => r.role === 'style').map((r) => r.label);

  if (c.product !== 'off') {
    const details = c.product_details.length > 0 ? c.product_details.join(', ') : 'shape, packaging, label, cap, branding, proportions, and colors';
    const refNote = productRefs.length > 0 ? ` exactly as shown in reference "${productRefs.join('", "')}"` : '';
    lines.push(
      c.product === 'strict'
        ? `PRODUCT (strict): reproduce the product${refNote}; keep ${details} unchanged. Do not redesign, restyle, or add features to the product.`
        : `PRODUCT (high): keep the product${refNote} recognizable; preserve ${details}.`,
    );
  }
  if (c.identity !== 'off') {
    const refNote = personRefs.length > 0 ? ` from reference "${personRefs.join('", "')}"` : '';
    const details = c.identity_details ? ` (${c.identity_details})` : '';
    lines.push(
      c.identity === 'strict'
        ? `IDENTITY (strict): preserve the recognizable facial identity and specified appearance of the person${refNote}${details}; no changes to face structure, skin tone, or age.`
        : `IDENTITY (high): keep the person${refNote} recognizable${details}.`,
    );
  }
  if (c.text !== 'off') {
    const words = c.text_content.length > 0 ? c.text_content.map((t) => `"${t}"`).join(', ') : 'the supplied wording';
    lines.push(
      c.text === 'strict'
        ? `TEXT (strict): render exactly this text, spelled verbatim: ${words}. No other words or letters anywhere in the image.`
        : `TEXT (high): include this text, spelled correctly: ${words}.`,
    );
  }
  if (c.composition !== 'off') {
    const refNote = compRefs.length > 0 ? ` of reference "${compRefs.join('", "')}"` : '';
    const details = c.composition_details ? ` ${c.composition_details}.` : '';
    lines.push(
      c.composition === 'strict'
        ? `COMPOSITION (strict): keep the placement, framing, crop, and camera angle${refNote} unchanged.${details}`
        : `COMPOSITION (high): keep the requested placement and framing${refNote}.${details}`,
    );
  }
  if (c.style !== 'off') {
    const refNote = styleRefs.length > 0 ? ` of reference "${styleRefs.join('", "')}"` : '';
    const details = c.style_details ? ` ${c.style_details}.` : '';
    lines.push(
      c.style === 'strict'
        ? `STYLE (strict): match the visual style${refNote} exactly: color grading, lighting quality, lens and camera look, texture, mood, and finish. Only the content described above changes.${details}`
        : `STYLE (high): follow the visual style${refNote} closely: palette, lighting, and mood.${details}`,
    );
  }
  if (c.avoid.length > 0) {
    lines.push(`AVOID: ${c.avoid.join('; ')}.`);
  }
  return lines;
}

export interface ConstraintWarning {
  code: string;
  message: string;
}

/**
 * Resolve conflicts between constraints and the planning mode. Strict composition never yields a
 * plan that deliberately changes framing; variety must come from other axes. Nothing is dropped.
 */
export function constraintWarnings(c: Constraints, planningMode: string): ConstraintWarning[] {
  const warnings: ConstraintWarning[] = [];
  if (c.composition === 'strict' && planningMode === 'diversified') {
    warnings.push({
      code: 'composition_strict_limits_diversity',
      message:
        'composition=strict keeps framing fixed; diversified concepts may only vary environment, lighting, props, and styling. Concepts that change framing were kept but the constraint line overrides them.',
    });
  }
  if (c.text === 'strict' && c.text_content.length === 0) {
    warnings.push({ code: 'text_strict_without_content', message: 'text=strict but no text_content supplied; the requirement is limited to "no other text".' });
  }
  if (c.identity !== 'off' && c.product === 'strict') {
    warnings.push({ code: 'identity_and_product', message: 'identity and strict product constraints are both active; review both in every output.' });
  }
  return warnings;
}
