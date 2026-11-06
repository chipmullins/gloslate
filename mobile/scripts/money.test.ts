import assert from 'node:assert/strict';
import test from 'node:test';

import { formatCents, parseCents } from '../src/lib/money.ts';
import { effectFor, equalSplit } from '../src/lib/split.ts';

test('formatCents uses integer math', () => {
  assert.equal(formatCents(86460), '$864.60');
  assert.equal(formatCents(-2560), '−$25.60');
  assert.equal(formatCents(123456789), '$1,234,567.89');
  assert.equal(formatCents(5, { sign: true }), '+$0.05');
  assert.throws(() => formatCents(1.5));
});

test('parseCents never uses floats', () => {
  assert.equal(parseCents('32.4'), 3240);
  assert.equal(parseCents('$1,200'), 120000);
  assert.equal(parseCents('0.07'), 7);
  assert.equal(parseCents('.5'), 50);
  assert.equal(parseCents('12.345'), null);
  assert.equal(parseCents('abc'), null);
});

test('equal split matches the server rule: odd cents to the payer', () => {
  assert.deepEqual(equalSplit(1001, 'chip', ['chip', 'alex']), { chip: 501, alex: 500 });
  assert.deepEqual(equalSplit(1000, 'b', ['a', 'b', 'c']), { a: 333, b: 334, c: 333 });
  assert.deepEqual(equalSplit(1000, 'z', ['a', 'b', 'c']), { a: 334, b: 333, c: 333 });
  assert.equal(effectFor('chip', 'chip', equalSplit(3240, 'chip', ['chip', 'alex'])), 1620);
  assert.equal(effectFor('chip', 'alex', equalSplit(3240, 'alex', ['chip', 'alex'])), -1620);
});

test('equal split: randomized, always sums and non-payers never pay extra', () => {
  for (let n = 0; n < 2000; n++) {
    const ids = ['a', 'b', 'c', 'd', 'e'].slice(0, 1 + (n % 5));
    const payer = ['a', 'b', 'c', 'd', 'e', 'x'][n % 6];
    const amt = 1 + ((n * 104729) % 1_000_000);
    const s = equalSplit(amt, payer, ids);
    assert.equal(Object.values(s).reduce((x, y) => x + y, 0), amt);
    const floor = Math.floor(amt / ids.length);
    if (ids.includes(payer)) for (const id of ids) if (id !== payer) assert.equal(s[id], floor);
  }
});

test('cash-register entry fills from the cents', async () => {
  const { centsFirst } = await import('../src/lib/money.ts');
  assert.equal(centsFirst('5'), '0.05');
  assert.equal(centsFirst('512'), '5.12');
  assert.equal(centsFirst('0.051'), '0.51'); // the field already showed 0.05, then "1" typed
  assert.equal(centsFirst('5.1'), '0.51'); // backspace from 5.12
  assert.equal(centsFirst('180000'), '1800.00');
  assert.equal(centsFirst(''), '');
  assert.equal(centsFirst('0.0'), '');
  assert.equal(parseCents(centsFirst('123456789999')), 12345678);
});
