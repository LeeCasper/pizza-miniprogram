const { test } = require('node:test');
const assert = require('node:assert');
const { eligiblePrizes, pickWeightedPrize, computeAwardText } = require('../src/services/luckyWheel.logic');

test('eligiblePrizes drops inactive and sold-out prizes', () => {
  const prizes = [
    { id: 1, is_active: 1, stock: null, awarded_count: 0 },   // unlimited → keep
    { id: 2, is_active: 1, stock: 5, awarded_count: 5 },       // sold out → drop
    { id: 3, is_active: 1, stock: 5, awarded_count: 4 },       // has stock → keep
    { id: 4, is_active: 0, stock: null, awarded_count: 0 },    // inactive → drop
  ];
  assert.deepStrictEqual(eligiblePrizes(prizes).map(p => p.id), [1, 3]);
});

test('pickWeightedPrize returns null on empty or zero-weight', () => {
  assert.strictEqual(pickWeightedPrize([]), null);
  assert.strictEqual(pickWeightedPrize([{ id: 1, weight: 0 }]), null);
});

test('pickWeightedPrize respects weights deterministically via injected rand', () => {
  const prizes = [{ id: 'a', weight: 1 }, { id: 'b', weight: 3 }]; // total 4
  // r = rand()*4 ; a covers [0,1), b covers [1,4)
  assert.strictEqual(pickWeightedPrize(prizes, () => 0.0).id, 'a');   // r=0   -> a
  assert.strictEqual(pickWeightedPrize(prizes, () => 0.2).id, 'a');   // r=0.8 -> a
  assert.strictEqual(pickWeightedPrize(prizes, () => 0.25).id, 'b');  // r=1.0 -> b
  assert.strictEqual(pickWeightedPrize(prizes, () => 0.99).id, 'b');  // r~3.96-> b
});

test('pickWeightedPrize ignores negative/NaN weights', () => {
  const prizes = [{ id: 'a', weight: -5 }, { id: 'b', weight: 2 }];
  assert.strictEqual(pickWeightedPrize(prizes, () => 0.0).id, 'b');
});

test('computeAwardText renders each prize type', () => {
  assert.strictEqual(computeAwardText({ type: 'coupon', name: '5元券' }), '获得优惠券：5元券');
  assert.strictEqual(computeAwardText({ type: 'points', points_amount: 30 }), '获得 30 积分');
  assert.strictEqual(computeAwardText({ type: 'balance', balance_amount: 2 }), '获得余额 ¥2.00');
  assert.strictEqual(computeAwardText({ type: 'again' }), '再来一次！');
  assert.strictEqual(computeAwardText({ type: 'thanks' }), '谢谢参与');
});
