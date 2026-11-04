import assert from 'node:assert/strict';
import test from 'node:test';

import { itemize, parseReceipt } from '../src/lib/receipt.ts';

test('parses a restaurant receipt', () => {
  const r = parseReceipt([
    'TONY\'S PIZZA', '123 Main St', 'Tel 859-555-0100', 'Server: Sam  Table 4',
    '1 Large Pepperoni   18.99', '2 Garlic Knots   7.50', 'Wings 12pc 15.25',
    'Subtotal 41.74', 'Sales Tax 2.50', 'Tip 8.00', 'TOTAL $52.24', 'VISA ****1234 52.24', 'Thank you!',
  ]);
  assert.deepEqual(r.items.map((i) => [i.name, i.cents]), [['Large Pepperoni', 1899], ['Garlic Knots', 750], ['Wings 12pc', 1525]]);
  assert.equal(r.subtotalCents, 4174);
  assert.equal(r.taxCents, 250);
  assert.equal(r.tipCents, 800);
  assert.equal(r.totalCents, 5224);
});

test('largest total wins over "total savings"; commas and trailing tax codes', () => {
  const r = parseReceipt(['Milk 3.49 F', 'TV 1,299.00 T', 'TOTAL SAVINGS 5.00', 'TOTAL 1,302.49']);
  assert.equal(r.totalCents, 130249);
  assert.equal(r.items.length, 2);
});

test('itemize: proportional tax and tip, odd cents to the payer, sums exactly', () => {
  const split = itemize(
    [
      { name: 'Pizza', cents: 3000, memberIds: ['a', 'b', 'c'] },
      { name: 'Wine', cents: 2001, memberIds: ['a', 'b'] },
    ],
    380, 1000, 'a',
  );
  const total = Object.values(split).reduce((s, c) => s + c, 0);
  assert.equal(total, 3000 + 2001 + 380 + 1000);
  assert.ok(split.a >= split.b, 'payer absorbs leftovers');
  assert.equal(split.c, 1000 + Math.floor((1380 * 1000) / 5001));
});

test('itemize: payer not on any item still sums exactly', () => {
  const split = itemize([{ name: 'Salad', cents: 1001, memberIds: ['b', 'c'] }], 99, 0, 'a');
  assert.equal(Object.values(split).reduce((s, c) => s + c, 0), 1100);
  assert.equal(split.a, undefined);
});

test('itemize: randomized sums always match', () => {
  for (let n = 0; n < 500; n++) {
    const ids = ['a', 'b', 'c', 'd', 'e'].slice(0, 2 + (n % 4));
    const items = Array.from({ length: 1 + (n % 6) }, (_, i) => ({ name: `i${i}`, cents: 1 + ((n * 7919 + i * 104729) % 9000), memberIds: ids.filter((_, j) => (n + i + j) % 3 !== 0) }))
      .filter((i) => i.memberIds.length);
    const tax = (n * 31) % 900;
    const tip = (n * 17) % 1500;
    const s = itemize(items, tax, tip, ids[n % ids.length]);
    assert.equal(Object.values(s).reduce((a, b) => a + b, 0), items.reduce((a, i) => a + i.cents, 0) + (items.length ? tax + tip : 0));
    assert.ok(Object.values(s).every((c) => Number.isInteger(c) && c >= 0));
  }
});
