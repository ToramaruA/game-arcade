// Only the Cloudflare Workers AI daily free allocation (3036) is deferred.
// HTTP 429 alone is ambiguous: 3040 is temporary capacity exhaustion.
export const DAILY_FREE_ALLOCATION_CODE = 3036;

export function quotaDeferral(httpStatus, body, now = new Date()) {
  if (httpStatus !== 429 || !Array.isArray(body?.errors)) return null;
  if (!body.errors.some(e => Number(e?.code) === DAILY_FREE_ALLOCATION_CODE)) return null;
  const utcDay = now.toISOString().slice(0, 10);
  const nextUtcMidnight = new Date(Date.parse(utcDay + 'T00:00:00Z') + 86400000).toISOString();
  return {
    status: 'deferred',
    reason: 'Cloudflare Workers AI daily free allocation exhausted (error code 3036). Retry after UTC reset.',
    retry_after: nextUtcMidnight,
  };
}
