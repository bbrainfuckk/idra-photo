import { constraintLines, type Constraints } from './constraints.js';
import { AUTO_PREFIX, type PlanningMode } from './planning.js';

export interface PromptReference {
  label: string;
  role: string;
}

export interface PromptInput {
  mode: PlanningMode;
  concept: string;
  basePrompt: string | null;
  constraints: Constraints;
  references: PromptReference[];
  targetAspect: string | null;
}

/**
 * Assemble one self-contained prompt. Every job carries its own essential constraints; nothing
 * relies on "same as above". Explicit mode uses the supplied prompt verbatim and only appends
 * the constraint requirements the user asked for.
 */
export function assemblePrompt(input: PromptInput): string {
  const parts: string[] = [];
  if (input.mode === 'variations' && input.basePrompt) {
    parts.push(input.basePrompt.trim());
    parts.push(`Variation for this image: ${variationText(input.concept)}`);
  } else {
    parts.push(input.concept.trim());
  }
  const lines = constraintLines(input.constraints, input.references);
  if (lines.length > 0) parts.push(lines.join('\n'));
  const refs = referenceLines(input.references);
  if (refs.length > 0) parts.push(refs.join('\n'));
  if (input.targetAspect) parts.push(`Target aspect ratio ${input.targetAspect}.`);
  return parts.join('\n\n');
}

function variationText(concept: string): string {
  return concept.startsWith(AUTO_PREFIX) ? concept.replace(/^Auto variation \d+:\s*/, '') : concept.trim();
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')}, or ${items[items.length - 1]}`;
}

/**
 * Say exactly what each reference is for. A style reference lends its look only: copying its
 * sitter, pose, or layout is the failure the first real smoke test showed.
 */
export function referenceLines(refs: PromptReference[]): string[] {
  const hasPerson = refs.some((r) => r.role === 'person');
  const hasProduct = refs.some((r) => r.role === 'product');
  const hasComposition = refs.some((r) => r.role === 'composition');
  return refs.map((r) => {
    switch (r.role) {
      case 'style': {
        const avoid = [hasPerson ? null : 'people or faces', 'pose', hasProduct ? null : 'objects', hasComposition ? null : 'composition or layout'].filter(
          (x): x is string => x !== null,
        );
        return `Reference "${r.label}": use it only for its look (palette, lighting, texture, mood, finish). Do not copy its ${list(avoid)}.`;
      }
      case 'product':
        return `Reference "${r.label}": the exact product to show.`;
      case 'person':
        return `Reference "${r.label}": the person to feature.`;
      case 'composition':
        return `Reference "${r.label}": follow only its placement and framing, not its subject or style.`;
      case 'edit_target':
        return `Reference "${r.label}": the image to edit; keep everything not mentioned unchanged.`;
      case 'design':
        return `Reference "${r.label}": the design to adapt. Keep its theme, costume, colors, motifs, and background color so the two read as a matching pair; change only what this prompt asks.`;
      default:
        return `Reference "${r.label}" (${r.role}).`;
    }
  });
}
