import assert from 'node:assert/strict';
import test from 'node:test';

import { checkReturn, GloflyError, returnParams } from '../src/lib/glofly-return.ts';

const pending = { state: 'st8', flow: 'sealed' };

test('reads code, state and iss from the return address', () => {
  assert.deepEqual(returnParams('tabitat://auth/glofly?code=gfc_1&state=st8&iss=https%3A%2F%2Fapi.glofly.app'),
    { code: 'gfc_1', state: 'st8', iss: 'https://api.glofly.app' });
  assert.deepEqual(checkReturn('https://app.gloslate.app/auth/glofly/callback?code=gfc_1&state=st8', pending),
    { code: 'gfc_1', flow: 'sealed', state: 'st8', iss: undefined });
});

test('cancel is not an error', () => {
  assert.equal(checkReturn('tabitat://auth/glofly?error=access_denied&state=st8', pending), null);
});

test('refuses a mismatched or missing state, missing code, other errors', () => {
  assert.throws(() => checkReturn('tabitat://auth/glofly?code=c&state=other', pending), GloflyError);
  assert.throws(() => checkReturn('tabitat://auth/glofly?code=c', pending), GloflyError);
  assert.throws(() => checkReturn('tabitat://auth/glofly?state=st8', pending), GloflyError);
  assert.throws(() => checkReturn('tabitat://auth/glofly?error=server_error&state=st8', pending), GloflyError);
});
