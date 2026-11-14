// The analysis link: a finished game encoded in the URL hash (docs/plans/analysis/05, docs/table.md).
// The data is external input: it is validated with zod and replayed by the engine before use.

import { validateInput, type AnalysisInput } from '../../table';
import { AnalysisInputSchema } from './inputSchema';

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

/** JSON → UTF-8 → base64url without padding. Names may contain any Unicode. */
export function encodeAnalysis(input: AnalysisInput): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(input)));
}

/** The inverse of `encodeAnalysis`; null for anything that is not a valid, replayable analysis. */
export function decodeAnalysis(text: string): AnalysisInput | null {
  try {
    const json = new TextDecoder('utf-8', { fatal: true }).decode(fromBase64Url(text));
    const parsed = AnalysisInputSchema.safeParse(JSON.parse(json));
    if (!parsed.success) return null;
    return validateInput(parsed.data).ok ? parsed.data : null;
  } catch {
    return null;
  }
}

export function analysisHash(input: AnalysisInput): string {
  return `#/analysis?g=${encodeAnalysis(input)}`;
}

/** Absolute URL of the analysis in the current app (same origin and path, new hash). */
export function analysisUrl(input: AnalysisInput, location: Pick<Location, 'origin' | 'pathname'>): string {
  return `${location.origin}${location.pathname}${analysisHash(input)}`;
}

/** Opens the analysis of `input` in a new tab. */
export function openAnalysis(input: AnalysisInput): void {
  window.open(analysisUrl(input, window.location), '_blank', 'noopener');
}
