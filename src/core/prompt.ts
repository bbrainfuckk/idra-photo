import { constraintLines, type Constraints } from './constraints.js';
import type { PlanningMode } from './planning.js';

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
    parts.push(input.concept.trim());
  } else {
    parts.push(input.concept.trim());
  }

  const lines = constraintLines(input.constraints, input.references);
  if (lines.length > 0) parts.push(lines.join('\n'));

  if (input.references.length > 0) {
    const refs = input.references.map((r) => `"${r.label}" (${roleWord(r.role)})`).join(', ');
    parts.push(`Reference images supplied: ${refs}.`);
  }
  if (input.targetAspect) {
    parts.push(`Target aspect ratio ${input.targetAspect}.`);
  }
  return parts.join('\n\n');
}

function roleWord(role: string): string {
  switch (role) {
    case 'product':
      return 'product to preserve';
    case 'person':
      return 'person whose identity to preserve';
    case 'composition':
      return 'composition/framing reference';
    case 'style':
      return 'style reference only';
    case 'edit_target':
      return 'image to edit';
    default:
      return role;
  }
}
