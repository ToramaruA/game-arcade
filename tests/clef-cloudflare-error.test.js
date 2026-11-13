import test from 'node:test';
import assert from 'node:assert/strict';
import {quotaDeferral,DAILY_FREE_ALLOCATION_CODE} from '../scripts/clef-cloudflare-error.mjs';

const now = new Date('2026-11-13T08:58:00Z');
test('Workers AI daily free allocation (3036) defers until next UTC midnight', () => {
  assert.equal(DAILY_FREE_ALLOCATION_CODE, 3036);
  assert.deepEqual(quotaDeferral(429,{errors:[{code:3036,message:'Account limited'}]},now),{
    status:'deferred',
    reason:'Cloudflare Workers AI daily free allocation exhausted (error code 3036). Retry after UTC reset.',
    retry_after:'2026-11-14T00:00:00.000Z',
  });
});
test('quota codes supplied as numeric strings are recognized', () => {
  assert.equal(quotaDeferral(429,{errors:[{code:'3036'}]},now)?.status,'deferred');
});
test('temporary capacity error 3040 must not be postponed until tomorrow', () => {
  assert.equal(quotaDeferral(429,{errors:[{code:3040}]},now),null);
});
test('other rate limits, malformed errors, and success do not count as daily quota', () => {
  for(const [status,body] of [
    [429,{errors:[{code:2003}]}],
    [429,{errors:[]}],
    [429,{}],
    [429,null],
    [500,{errors:[{code:3036}]}],
    [200,{errors:[{code:3036}]}],
  ]) assert.equal(quotaDeferral(status,body,now),null);
});
test('UTC reset is 09:00 JST, not local midnight', () => {
  assert.equal(quotaDeferral(429,{errors:[{code:3036}]},new Date('2026-11-13T23:59:59Z')).retry_after,'2026-11-14T00:00:00.000Z');
  assert.equal(quotaDeferral(429,{errors:[{code:3036}]},new Date('2026-11-14T00:00:01Z')).retry_after,'2026-11-15T00:00:00.000Z');
});
