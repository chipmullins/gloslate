// Pure checks on what Glofly sends back (no React Native imports, so it's unit-tested in scripts/).

export type GloflyReturn = { code: string; flow: string; state: string; iss?: string };

export class GloflyError extends Error {}

/** Query and fragment params, without relying on URL/URLSearchParams (partial in React Native). */
export function returnParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const rest = url.includes('?') ? url.slice(url.indexOf('?') + 1) : url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  for (const part of rest.split(/[&#]/)) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const key = decodeURIComponent((eq < 0 ? part : part.slice(0, eq)).replace(/\+/g, ' '));
    out[key] = eq < 0 ? '' : decodeURIComponent(part.slice(eq + 1).replace(/\+/g, ' '));
  }
  return out;
}

/** Checks what Glofly sent back. null = the person tapped Cancel. */
export function checkReturn(url: string, pending: { state: string; flow: string }): GloflyReturn | null {
  const p = returnParams(url);
  if (p.error === 'access_denied') return null;
  if (p.error) throw new GloflyError("Glofly couldn't sign you in. Try again.");
  if (!p.state || p.state !== pending.state) throw new GloflyError("That sign-in didn't match. Try again.");
  if (!p.code) throw new GloflyError("Glofly didn't send a sign-in code. Try again.");
  return { code: p.code, flow: pending.flow, state: p.state, iss: p.iss };
}

