# 幸运转盘 (Lucky Wheel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-authoritative weighted-lottery "幸运转盘" feature — daily free draw + points-paid extra draws — that awards coupons / points / balance / thanks / "再来一次", reusing the existing coupon lifecycle for physical-prize redemption, with admin-managed prizes & rules and a CSS-conic-gradient wheel in the mini program.

**Architecture:** The server owns the outcome. `pickWeightedPrize` does weighted random selection inside a DB transaction with CAS stock decrement (`UPDATE ... SET awarded_count=awarded_count+1 WHERE id=? AND awarded_count<stock`, `affectedRows===1` wins, loser is filtered out and re-picked); the prize is awarded (coupon minted / points credited / balance credited) in the *same* transaction; the response returns `prizeId` and the front-end animation merely lands the pointer on the matching segment (`findIndex(s => s.id === prizeId)`). The front-end is pure presentation — it cannot influence the outcome. A `lucky_wheel_draws` ledger gates daily entitlements (`DATE(created_at)=CURDATE()`, no reset cron). Config lives in `system_config` (4 keys), read per-draw via a cheap indexed query — no 5th systemConfigService sync triplet (YAGNI).

**Tech Stack:** Express.js + MySQL (mysql2 pool, `getConnection`+`FOR UPDATE` transactions) · Joi validation · Node built-in `node --test` for pure logic · Vue3 + NaiveUI (Soybean Admin) · WeChat Mini Program (WXML/WXSS/JS, CSS `conic-gradient`).

## Global Constraints

- **Version:** All commits in this feature are **v1.2.0**. Commit message convention: `feat(lucky-wheel): vX.Y.Z <desc>` / `feat(miniprogram): v1.2.0 …` / `feat(admin): v1.2.0 …`.
- **COMMIT ONLY — DO NOT PUSH, DO NOT DEPLOY.** "先不推送" is in effect for the whole implementation. Push & deploy are a separate, user-authorized step. Every "Commit" step is `git add <specific paths>` + `git commit` and **stops there**.
- **Do NOT stage the 8 untracked root PNGs** (`未命名的设计222.png`, `余额 (1).png`, `积分.png`, `生日蛋糕.png`, `王姐的店.png`, `注意.png`, `联系电话 (1).png`, `领卷中心.png`). Stage only the specific sub-project paths named in each task.
- **Never weaken TLS.** No `-k`/`--insecure`/`http.sslVerify false`/`GIT_SSL_NO_VERIFY`. (Only relevant at the separate push step.)
- **Node ≥ v22.13 for pnpm/admin builds:** `$env:PATH = "C:\Program Files\nodejs;" + $env:PATH` before `pnpm` anything.
- **Production MySQL does NOT support `ADD COLUMN IF NOT EXISTS`.** Use plain `CREATE TABLE IF NOT EXISTS`, plain `ALTER TABLE ... MODIFY`, `INSERT IGNORE`. (No `ADD COLUMN IF NOT EXISTS`.)
- **deploy.py migration list is hardcoded** — appending the new migration file path is part of T1 (consumed only at the separate deploy step).
- **API envelope:** success → `res.json({ code: 0, data })`; expected business failure → `res.status(400).json({ code: 400, message, reason })`; unexpected → `next(err)`.
- **Mini program rules:** no `backdrop-filter`; rpx units; new page needs a `.json` with `"navigationStyle":"custom"` + title; `utils/api.js` **self-toasts on non-2xx and on failure** → callers must NOT double-toast (`.catch()` silently).
- **elegant-router:** custom route `name` fields must be **all-lowercase** matching the auto-generated name; after editing `routes/index.ts` run `pnpm gen-route` (regenerates `imports.ts`/`transform.ts`/`routes.ts`/typings — do not hand-edit those).
- **Lucky-wheel prize stock** lives on `lucky_wheel_prizes.stock` with its own CAS — it is NOT the coupon template's `claimed_count`. A coupon-template is only the "shape" used to mint a coupon.

---

## File Structure

**pizza-server (Backend)**
| File | Responsibility |
|---|---|
| `db/migrate_lucky_wheel.sql` | **Create** — idempotent migration: 2 tables + balance_history ENUM modify + 4 config seeds |
| `db/schema.sql` | **Modify** — mirror the 2 new tables + change §17 balance_history ENUM to include `'reward'` |
| `src/services/luckyWheel.logic.js` | **Create** — pure functions: `eligiblePrizes`, `pickWeightedPrize`, `computeAwardText` (no DB, unit-tested) |
| `src/services/luckyWheelService.js` | **Create** — DB layer: config read, transactional `draw`, `getWheelConfig`, `myRecords` + admin CRUD/records/saveConfig |
| `src/controllers/luckyWheelController.js` | **Create** — thin user controllers: `config`, `draw`, `records` |
| `src/controllers/adminApiController.js` | **Modify** — require luckyWheelService; add 9 admin methods to the object literal |
| `src/routes/luckyWheel.js` | **Create** — user Router (`/config` GET, `/draw` POST, `/records` GET), all `auth` |
| `src/routes/adminApi.js` | **Modify** — add lucky-wheel admin routes (config GET/PUT, records GET, prizes CRUD+toggle) |
| `src/middleware/validation.js` | **Modify** — add `luckyDraw`, `luckyPrize`, `luckyPrizeUpdate`, `luckyConfig` schemas |
| `src/app.js` | **Modify** — mount `app.use('/api/v1/lucky-wheel', luckyWheelRoutes)` |
| `package.json` | **Modify** — add `"test": "node --test test/"` |
| `test/luckyWheel.logic.test.js` | **Create** — node:test coverage of the pure logic |
| `soybean-admin-temp/deploy.py` | **Modify** — append migration path to the hardcoded list |

**soybean-admin-temp (Admin SPA)**
| File | Responsibility |
|---|---|
| `src/service/api/luckyWheel.ts` | **Create** — fetch fns + `LuckyPrize`/`LuckyRecord`/`LuckyConfig` interfaces |
| `src/service/api/index.ts` | **Modify** — `export * from './luckyWheel';` |
| `src/views/luckywheel/prizes/list/index.vue` | **Create** — prize table + embedded 抽奖规则 config card |
| `src/views/luckywheel/prizes/form/index.vue` | **Create** — prize create/edit form (conditional fields by type) |
| `src/views/luckywheel/records/list/index.vue` | **Create** — paginated draw records |
| `src/router/routes/index.ts` | **Modify** — add `luckywheel` custom route (parent + 4 children) |
| `src/locales/langs/zh-cn.ts` + `en-us.ts` | **Modify** — add `luckywheel*` route i18n keys |
| (generated) `imports.ts`/`transform.ts`/`routes.ts`/`elegant-router.d.ts` | **Regenerated** by `pnpm gen-route` — do NOT hand-edit |

**miniprogram**
| File | Responsibility |
|---|---|
| `pages/lucky-wheel/lucky-wheel.{js,json,wxml,wxss}` | **Create** — conic-gradient wheel page |
| `app.json` | **Modify** — register `"pages/lucky-wheel/lucky-wheel"` |
| `pages/main/main.js` | **Modify** — L684 route `lucky` to the page; remove from `msgs` |
| `pages/profile/profile.js` | **Modify** — L68 route `lucky` to the page; remove from `messages` |

---

# Phase 1 — Backend (pizza-server)

## Task 1: Database schema & migration

**Files:**
- Create: `pizza-server/db/migrate_lucky_wheel.sql`
- Modify: `pizza-server/db/schema.sql`
- Modify: `soybean-admin-temp/deploy.py` (append migration path)

**Interfaces:**
- Produces: tables `lucky_wheel_prizes` (id, type, name, weight, stock, awarded_count, coupon_template_id, points_amount, balance_amount, color, icon, sort_order, is_active, timestamps) and `lucky_wheel_draws` (id, user_id, prize_id, prize_type, prize_name, source, cost_points, coupon_id, points_amount, balance_amount, created_at); `balance_history.type` ENUM gains `'reward'`; `system_config` keys `lucky_enabled`/`lucky_free_per_day`/`lucky_points_cost`/`lucky_max_per_day`.

- [ ] **Step 1: Create the migration file**

Create `pizza-server/db/migrate_lucky_wheel.sql`:

```sql
-- 幸运转盘 (Lucky Wheel) — v1.2.0
-- Idempotent. Production MySQL: NO "ADD COLUMN IF NOT EXISTS"; use CREATE TABLE IF NOT EXISTS / plain MODIFY / INSERT IGNORE.

CREATE TABLE IF NOT EXISTS lucky_wheel_prizes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type ENUM('coupon','points','balance','thanks','again') NOT NULL,
  name VARCHAR(50) NOT NULL,
  weight INT UNSIGNED NOT NULL DEFAULT 1,
  stock INT UNSIGNED NULL,
  awarded_count INT UNSIGNED NOT NULL DEFAULT 0,
  coupon_template_id INT UNSIGNED NULL,
  points_amount INT UNSIGNED NULL,
  balance_amount DECIMAL(10,2) NULL,
  color VARCHAR(16) DEFAULT '#F5C518',
  icon VARCHAR(255) DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (coupon_template_id) REFERENCES coupon_templates(id) ON DELETE SET NULL,
  INDEX idx_active_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lucky_wheel_draws (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  prize_id INT UNSIGNED NULL,
  prize_type ENUM('coupon','points','balance','thanks','again') NOT NULL,
  prize_name VARCHAR(50) NOT NULL,
  source ENUM('free','points','again') NOT NULL,
  cost_points INT UNSIGNED NOT NULL DEFAULT 0,
  coupon_id INT UNSIGNED NULL,
  points_amount INT UNSIGNED NULL,
  balance_amount DECIMAL(10,2) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (prize_id) REFERENCES lucky_wheel_prizes(id) ON DELETE SET NULL,
  INDEX idx_user_date (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- balance_history.type currently ENUM('recharge','deduct','refund'); add 'reward' for lucky-wheel balance awards.
ALTER TABLE balance_history MODIFY COLUMN type ENUM('recharge','deduct','refund','reward') DEFAULT 'recharge';

INSERT IGNORE INTO system_config (config_key, config_value, description) VALUES
('lucky_enabled', '1', '幸运转盘开关(1开/0关)'),
('lucky_free_per_day', '1', '每日免费抽奖次数'),
('lucky_points_cost', '50', '免费次数用完后每次加抽消耗积分'),
('lucky_max_per_day', '10', '每日抽奖硬上限(含再来一次)');
```

- [ ] **Step 2: Mirror the two tables into `schema.sql`**

Append the two `CREATE TABLE` statements (verbatim from Step 1, the `IF NOT EXISTS` form is fine in schema.sql too) to the end of `pizza-server/db/schema.sql`, under a `-- §N 幸运转盘` section comment. Then locate the existing `balance_history` table definition (§17) and change its `type` column to `type ENUM('recharge','deduct','refund','reward') DEFAULT 'recharge'` so a fresh schema matches the migrated one.

- [ ] **Step 3: Append the migration path to deploy.py**

In `soybean-admin-temp/deploy.py`, the `migrations` list ends with `'pizza-server/db/migrate_coupon_claimable.sql',` (L59). Add a line after it:

```python
        'pizza-server/db/migrate_coupon_claimable.sql',
        'pizza-server/db/migrate_lucky_wheel.sql',
    ]
```

- [ ] **Step 4: Syntax-check the SQL locally (optional, no DB write)**

Run: `node -e "const fs=require('fs');const s=fs.readFileSync('pizza-server/db/migrate_lucky_wheel.sql','utf8');if(!/CREATE TABLE IF NOT EXISTS lucky_wheel_prizes/.test(s)||!/lucky_wheel_draws/.test(s)||!/balance_history MODIFY/.test(s)){throw new Error('migration content missing')}console.log('migration OK')"`
Expected: `migration OK`

- [ ] **Step 5: Commit**

```bash
git add pizza-server/db/migrate_lucky_wheel.sql pizza-server/db/schema.sql soybean-admin-temp/deploy.py
git commit -m "feat(lucky-wheel): v1.2.0 数据库 — 转盘奖品/抽奖记录表 + balance_history reward 类型 + 4项配置种子 + deploy迁移清单"
```
(Commit only. Do NOT push. Do NOT run the migration against any DB.)

---

## Task 2: Pure lottery logic + node:test

**Files:**
- Create: `pizza-server/src/services/luckyWheel.logic.js`
- Create: `pizza-server/test/luckyWheel.logic.test.js`
- Modify: `pizza-server/package.json` (add `test` script)

**Interfaces:**
- Produces:
  - `eligiblePrizes(prizes) -> prize[]` — keeps `is_active` truthy AND (`stock == null` OR `awarded_count < stock`).
  - `pickWeightedPrize(prizes, rand = Math.random) -> prize | null` — weighted pick by `weight`; `null` if empty or total weight ≤ 0.
  - `computeAwardText(prize) -> string` — human text from `{ type, name, points_amount, balance_amount }`.
- Consumed by: `luckyWheelService.draw` (Task 3).

- [ ] **Step 1: Write the failing test**

Create `pizza-server/test/luckyWheel.logic.test.js`:

```js
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
```

- [ ] **Step 2: Add the test script to package.json, run, verify it FAILS**

In `pizza-server/package.json` `"scripts"`, add: `"test": "node --test test/"`.

Run (from `pizza-server/`): `node --test test/`
Expected: FAIL — `Cannot find module '../src/services/luckyWheel.logic'`.

- [ ] **Step 3: Write the implementation**

Create `pizza-server/src/services/luckyWheel.logic.js`:

```js
'use strict';

/**
 * Pure lottery logic — no DB, no side effects. Unit-tested via node:test.
 * Prize shape here uses snake_case DB column names (rows from lucky_wheel_prizes).
 */

/** Keep only active prizes that still have stock (null stock = unlimited). */
function eligiblePrizes(prizes) {
  return prizes.filter(p => p.is_active && (p.stock == null || p.awarded_count < p.stock));
}

/** Weighted random pick. rand() injectable for tests. Returns null if no positive weight. */
function pickWeightedPrize(prizes, rand = Math.random) {
  if (!prizes.length) return null;
  const w = p => Math.max(0, Number(p.weight) || 0);
  const total = prizes.reduce((s, p) => s + w(p), 0);
  if (total <= 0) return null;
  let r = rand() * total;
  for (const p of prizes) {
    r -= w(p);
    if (r < 0) return p;
  }
  return prizes[prizes.length - 1]; // float-rounding guard
}

/** Human-readable award text. type may be downgraded to 'thanks' by the caller. */
function computeAwardText(prize) {
  switch (prize.type) {
    case 'coupon':  return `获得优惠券：${prize.name}`;
    case 'points':  return `获得 ${prize.points_amount || 0} 积分`;
    case 'balance': return `获得余额 ¥${Number(prize.balance_amount || 0).toFixed(2)}`;
    case 'again':   return '再来一次！';
    default:        return '谢谢参与';
  }
}

module.exports = { eligiblePrizes, pickWeightedPrize, computeAwardText };
```

- [ ] **Step 4: Run the test, verify it PASSES**

Run (from `pizza-server/`): `node --test test/`
Expected: PASS — all tests pass (5 tests).

- [ ] **Step 5: Commit**

```bash
git add pizza-server/src/services/luckyWheel.logic.js pizza-server/test/luckyWheel.logic.test.js pizza-server/package.json
git commit -m "feat(lucky-wheel): v1.2.0 纯抽奖逻辑(加权随机/筛选/文案) + node:test 单测 + test 脚本"
```

---

## Task 3: Draw service (transactional) + user-facing API

**Files:**
- Create: `pizza-server/src/services/luckyWheelService.js`
- Create: `pizza-server/src/controllers/luckyWheelController.js`
- Create: `pizza-server/src/routes/luckyWheel.js`
- Modify: `pizza-server/src/middleware/validation.js` (add `luckyDraw` schema)
- Modify: `pizza-server/src/app.js` (mount route)

**Interfaces:**
- Consumes: `luckyWheel.logic` (`eligiblePrizes`, `pickWeightedPrize`, `computeAwardText`); `couponTemplateService.findById(id)` (camelCase tpl); `couponClaimService.mintCouponFromTemplate(conn, tpl, userId, source) -> insertId`; `config/database` pool.
- Produces (used by controller + Task 4 admin + miniprogram):
  - `getLuckyConfig() -> { enabled, freePerDay, pointsCost, maxPerDay }`
  - `getWheelConfig(userId) -> { enabled, pointsCost, freeRemaining, drawsRemaining, userPoints, segments:[{id,type,name,color,icon}] }`
  - `draw(userId, source) -> { prizeId, type, name, awardText, bonusSpin, userPoints, balanceText, freeRemaining, drawsRemaining }` OR `{ error, reason }`
  - `myRecords(userId, page, limit) -> { list, total }`

- [ ] **Step 1: Write the service**

Create `pizza-server/src/services/luckyWheelService.js`:

```js
'use strict';

const pool = require('../config/database');
const couponTemplateService = require('./couponTemplateService');
const { mintCouponFromTemplate } = require('./couponClaimService');
const { eligiblePrizes, pickWeightedPrize, computeAwardText } = require('./luckyWheel.logic');
const { createLogger } = require('../utils/logger');

const log = createLogger('LuckyWheel');

const CONFIG_KEYS = ['lucky_enabled', 'lucky_free_per_day', 'lucky_points_cost', 'lucky_max_per_day'];
const CONFIG_DEFAULTS = { enabled: true, freePerDay: 1, pointsCost: 50, maxPerDay: 10 };

/** Read the 4 lucky_* config keys straight from system_config (cheap indexed read, per-draw). */
async function getLuckyConfig() {
  const [rows] = await pool.query(
    'SELECT config_key, config_value FROM system_config WHERE config_key IN (?, ?, ?, ?)',
    CONFIG_KEYS
  );
  const map = {};
  for (const r of rows) map[r.config_key] = r.config_value;
  return {
    enabled: map.lucky_enabled != null ? map.lucky_enabled === '1' : CONFIG_DEFAULTS.enabled,
    freePerDay: map.lucky_free_per_day != null ? parseInt(map.lucky_free_per_day, 10) : CONFIG_DEFAULTS.freePerDay,
    pointsCost: map.lucky_points_cost != null ? parseInt(map.lucky_points_cost, 10) : CONFIG_DEFAULTS.pointsCost,
    maxPerDay: map.lucky_max_per_day != null ? parseInt(map.lucky_max_per_day, 10) : CONFIG_DEFAULTS.maxPerDay,
  };
}

/** Today's draw counts for a user: total rows + free-source rows (gates entitlements). */
async function todayCounts(conn, userId) {
  const [[row]] = await conn.query(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(source = 'free'), 0) AS freeCnt
       FROM lucky_wheel_draws
      WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
    [userId]
  );
  return { total: Number(row.total), freeCnt: Number(row.freeCnt) };
}

/** Wheel config for the front-end. NEVER exposes weight/stock. */
async function getWheelConfig(userId) {
  const cfg = await getLuckyConfig();
  const [prizes] = await pool.query(
    'SELECT id, type, name, color, icon FROM lucky_wheel_prizes WHERE is_active = 1 ORDER BY sort_order, id'
  );
  const [[counts]] = await pool.query(
    `SELECT COUNT(*) AS total, COALESCE(SUM(source = 'free'), 0) AS freeCnt
       FROM lucky_wheel_draws WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
    [userId]
  );
  const [[u]] = await pool.query('SELECT points FROM users WHERE id = ?', [userId]);
  const total = Number(counts.total);
  const freeCnt = Number(counts.freeCnt);
  const freeRemaining = Math.max(0, cfg.freePerDay - freeCnt);
  const drawsRemaining = Math.max(0, cfg.maxPerDay - total);
  return {
    enabled: cfg.enabled,
    pointsCost: cfg.pointsCost,
    freeRemaining,
    drawsRemaining,
    userPoints: u ? Number(u.points) : 0,
    segments: prizes.map(p => ({ id: p.id, type: p.type, name: p.name, color: p.color, icon: p.icon })),
  };
}

/**
 * Perform one draw. source ∈ {'free','points'}.
 * Returns the award descriptor, OR { error, reason } for expected business failures.
 * The outcome AND the award are decided/applied inside one transaction.
 */
async function draw(userId, source) {
  const cfg = await getLuckyConfig();
  if (!cfg.enabled) return { error: '幸运转盘暂未开放', reason: 'disabled' };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock the user row (points balance) for the whole draw.
    const [[u]] = await conn.query('SELECT id, points FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (!u) { await conn.rollback(); return { error: '用户不存在', reason: 'no_user' }; }

    // Daily ledger gates.
    const { total, freeCnt } = await todayCounts(conn, userId);
    if (total >= cfg.maxPerDay) { await conn.rollback(); return { error: '今日抽奖次数已达上限', reason: 'reach_max' }; }

    let cost = 0;
    if (source === 'free') {
      if (freeCnt >= cfg.freePerDay) { await conn.rollback(); return { error: '今日免费次数已用完', reason: 'no_free' }; }
    } else { // 'points'
      cost = cfg.pointsCost;
      if (Number(u.points) < cost) { await conn.rollback(); return { error: '积分不足', reason: 'no_points' }; }
    }

    // Load active prizes locked, then weighted-pick with CAS stock decrement.
    const [allPrizes] = await conn.query(
      'SELECT * FROM lucky_wheel_prizes WHERE is_active = 1 ORDER BY sort_order, id FOR UPDATE'
    );
    let pool2 = eligiblePrizes(allPrizes);
    let prize = null;
    while (pool2.length) {
      const pick = pickWeightedPrize(pool2);
      if (!pick) break;
      if (pick.stock == null) { prize = pick; break; } // unlimited → take
      const [upd] = await conn.query(
        'UPDATE lucky_wheel_prizes SET awarded_count = awarded_count + 1 WHERE id = ? AND awarded_count < stock',
        [pick.id]
      );
      if (upd.affectedRows === 1) { prize = pick; break; } // won the stock race
      pool2 = pool2.filter(p => p.id !== pick.id);          // lost / sold out → drop & repick
    }
    if (!prize) { await conn.rollback(); return { error: '今日奖品已抽完', reason: 'no_prize' }; }

    // "再来一次" refunds the entitlement: recorded as 'again', costs nothing,
    // does NOT consume the free sub-quota but DOES count toward the hard daily ceiling.
    const isAgain = prize.type === 'again';
    const recordedSource = isAgain ? 'again' : source;
    const effectiveCost = isAgain ? 0 : cost;

    // Deduct points if this was a paid (non-again) draw.
    let userPoints = Number(u.points);
    if (effectiveCost > 0) {
      userPoints -= effectiveCost;
      await conn.query('UPDATE users SET points = ? WHERE id = ?', [userPoints, userId]);
      await conn.query(
        'INSERT INTO points_history (user_id, points_change, balance_after, reason, reference_id) VALUES (?, ?, ?, ?, ?)',
        [userId, -effectiveCost, userPoints, '幸运转盘加抽', '']
      );
    }

    // Award branch. resultType may be downgraded coupon→thanks if template is gone.
    let resultType = prize.type;
    let couponId = null;
    let pointsAwarded = null;
    let balanceAmount = null;

    if (prize.type === 'coupon') {
      const tpl = await couponTemplateService.findById(prize.coupon_template_id);
      if (!tpl || !tpl.isActive) {
        resultType = 'thanks'; // graceful degrade — never fail the draw on a misconfigured prize
        log.warn({ prizeId: prize.id, tplId: prize.coupon_template_id }, 'coupon prize template missing/inactive — degraded to thanks');
      } else {
        couponId = await mintCouponFromTemplate(conn, tpl, userId, 'lucky_wheel');
      }
    } else if (prize.type === 'points') {
      pointsAwarded = Number(prize.points_amount || 0);
      if (pointsAwarded > 0) {
        userPoints += pointsAwarded;
        await conn.query('UPDATE users SET points = ? WHERE id = ?', [userPoints, userId]);
        await conn.query(
          'INSERT INTO points_history (user_id, points_change, balance_after, reason, reference_id) VALUES (?, ?, ?, ?, ?)',
          [userId, pointsAwarded, userPoints, '幸运转盘中奖', '']
        );
      }
    } else if (prize.type === 'balance') {
      balanceAmount = Number(prize.balance_amount || 0);
      if (balanceAmount > 0) {
        const [[bRow]] = await conn.query('SELECT balance FROM users WHERE id = ? FOR UPDATE', [userId]);
        const newBalance = Number(bRow.balance) + balanceAmount;
        await conn.query('UPDATE users SET balance = ? WHERE id = ?', [newBalance, userId]);
        await conn.query(
          'INSERT INTO balance_history (user_id, amount, balance_after, type, remark) VALUES (?, ?, ?, ?, ?)',
          [userId, balanceAmount, newBalance, 'reward', '幸运转盘中奖']
        );
      }
    }
    // 'thanks' and 'again' award nothing material.

    // Snapshot the draw into the ledger.
    await conn.query(
      `INSERT INTO lucky_wheel_draws
         (user_id, prize_id, prize_type, prize_name, source, cost_points, coupon_id, points_amount, balance_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, prize.id, resultType, prize.name, recordedSource, effectiveCost, couponId, pointsAwarded, balanceAmount]
    );

    await conn.commit();

    // Post-commit: recompute remaining for the response.
    const cfg2 = cfg; // unchanged within request
    const newTotal = total + 1;
    const newFree = recordedSource === 'free' ? freeCnt + 1 : freeCnt;
    return {
      prizeId: prize.id,
      type: resultType,
      name: prize.name,
      awardText: computeAwardText({ type: resultType, name: prize.name, points_amount: pointsAwarded, balance_amount: balanceAmount }),
      bonusSpin: isAgain,
      userPoints,
      balanceText: balanceAmount != null ? `¥${balanceAmount.toFixed(2)}` : null,
      freeRemaining: Math.max(0, cfg2.freePerDay - newFree),
      drawsRemaining: Math.max(0, cfg2.maxPerDay - newTotal),
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Paginated draw records for the current user. */
async function myRecords(userId, page = 1, limit = 20) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (p - 1) * l;
  const [[c]] = await pool.query('SELECT COUNT(*) AS total FROM lucky_wheel_draws WHERE user_id = ?', [userId]);
  const [rows] = await pool.query(
    `SELECT id, prize_type, prize_name, source, cost_points, points_amount, balance_amount, created_at
       FROM lucky_wheel_draws WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
    [userId, l, offset]
  );
  return {
    total: Number(c.total),
    list: rows.map(r => ({
      id: r.id,
      prizeType: r.prize_type,
      prizeName: r.prize_name,
      source: r.source,
      costPoints: r.cost_points,
      pointsAmount: r.points_amount,
      balanceAmount: r.balance_amount,
      createdAt: r.created_at,
    })),
  };
}

module.exports = { getLuckyConfig, getWheelConfig, draw, myRecords };
```

> Note: `module.exports` is re-opened in Task 4 to also export the admin functions. In Task 4 you will REPLACE this final `module.exports` line with the combined export — the admin functions are appended to the same file.

- [ ] **Step 2: Write the user controller**

Create `pizza-server/src/controllers/luckyWheelController.js`:

```js
'use strict';

const luckyWheelService = require('../services/luckyWheelService');

module.exports = {
  async config(req, res, next) {
    try {
      const data = await luckyWheelService.getWheelConfig(req.user.id);
      res.json({ code: 0, data });
    } catch (err) { next(err); }
  },

  async draw(req, res, next) {
    try {
      const result = await luckyWheelService.draw(req.user.id, req.body.source);
      if (result && result.error) {
        return res.status(400).json({ code: 400, message: result.error, reason: result.reason });
      }
      res.json({ code: 0, data: result });
    } catch (err) { next(err); }
  },

  async records(req, res, next) {
    try {
      const { page, limit } = req.query;
      const data = await luckyWheelService.myRecords(req.user.id, page, limit);
      res.json({ code: 0, data });
    } catch (err) { next(err); }
  },
};
```

- [ ] **Step 3: Add the `luckyDraw` validation schema**

In `pizza-server/src/middleware/validation.js`, inside the `schemas` object, add:

```js
  luckyDraw: Joi.object({
    source: Joi.string().valid('free', 'points').required(),
  }),
```

- [ ] **Step 4: Write the user route**

Create `pizza-server/src/routes/luckyWheel.js`:

```js
'use strict';

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const ctrl = require('../controllers/luckyWheelController');

router.get('/config', auth, ctrl.config);
router.post('/draw', auth, validate('luckyDraw'), ctrl.draw);
router.get('/records', auth, ctrl.records);

module.exports = router;
```

- [ ] **Step 5: Mount the route in app.js**

In `pizza-server/src/app.js`, after the last user route mount (`app.use('/api/v1/config', ...)` ~L166), add:

```js
const luckyWheelRoutes = require('./routes/luckyWheel');
app.use('/api/v1/lucky-wheel', luckyWheelRoutes);
```

- [ ] **Step 6: Syntax-check all new/modified backend files**

Run (from `pizza-server/`):
```bash
node --check src/services/luckyWheelService.js && node --check src/controllers/luckyWheelController.js && node --check src/routes/luckyWheel.js && node --check src/middleware/validation.js && node --check src/app.js && echo "syntax OK"
```
Expected: `syntax OK`

- [ ] **Step 7: Smoke-test boot (no DB writes)**

Run (from `pizza-server/`): `npm run dev` — confirm the server starts without throwing (lucky-wheel route mounted). Ctrl-C to stop. (Full request smoke is done at the user-authorized deploy/verify step against a DB.)
Expected: server logs "listening" with no module-load or route-mount errors.

- [ ] **Step 8: Commit**

```bash
git add pizza-server/src/services/luckyWheelService.js pizza-server/src/controllers/luckyWheelController.js pizza-server/src/routes/luckyWheel.js pizza-server/src/middleware/validation.js pizza-server/src/app.js
git commit -m "feat(lucky-wheel): v1.2.0 抽奖服务(事务+CAS库存+加权发奖) + 用户接口(/config /draw /records) + 校验 + 路由挂载"
```

---

## Task 4: Admin API (prizes CRUD + records + rules config)

**Files:**
- Modify: `pizza-server/src/services/luckyWheelService.js` (append admin fns; combine exports)
- Modify: `pizza-server/src/controllers/adminApiController.js` (require service; add 9 methods)
- Modify: `pizza-server/src/routes/adminApi.js` (add lucky-wheel routes)
- Modify: `pizza-server/src/middleware/validation.js` (add `luckyPrize`, `luckyPrizeUpdate`, `luckyConfig`)

**Interfaces:**
- Consumes: `getLuckyConfig` (Task 3), `pool` from `config/database`.
- Produces (used by admin controller + admin SPA):
  - `adminListPrizes() -> prize[]` (camelCase, incl. `awardedCount`)
  - `adminGetPrize(id) -> prize | null`
  - `adminCreatePrize(data) -> { id }`
  - `adminUpdatePrize(id, data) -> bool`
  - `adminDeletePrize(id) -> bool`
  - `adminTogglePrize(id) -> { isActive }`
  - `adminListRecords(page, limit) -> { list, total }` (LEFT JOIN users for userName)
  - `adminGetLuckyConfig() -> { enabled, freePerDay, pointsCost, maxPerDay }`
  - `saveLuckyConfig(data) -> { enabled, freePerDay, pointsCost, maxPerDay }`

- [ ] **Step 1: Append the admin functions to the service**

In `pizza-server/src/services/luckyWheelService.js`, **delete** the final line `module.exports = { getLuckyConfig, getWheelConfig, draw, myRecords };` and in its place insert the admin functions followed by a combined export:

```js
// ───────────────────────── Admin ─────────────────────────

function formatPrize(r) {
  return {
    id: r.id,
    type: r.type,
    name: r.name,
    weight: r.weight,
    stock: r.stock,
    awardedCount: r.awarded_count,
    couponTemplateId: r.coupon_template_id,
    pointsAmount: r.points_amount,
    balanceAmount: r.balance_amount,
    color: r.color,
    icon: r.icon,
    sortOrder: r.sort_order,
    isActive: !!r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function adminListPrizes() {
  const [rows] = await pool.query('SELECT * FROM lucky_wheel_prizes ORDER BY sort_order, id');
  return rows.map(formatPrize);
}

async function adminGetPrize(id) {
  const [[row]] = await pool.query('SELECT * FROM lucky_wheel_prizes WHERE id = ?', [id]);
  return row ? formatPrize(row) : null;
}

async function adminCreatePrize(d) {
  const [r] = await pool.query(
    `INSERT INTO lucky_wheel_prizes
       (type, name, weight, stock, coupon_template_id, points_amount, balance_amount, color, icon, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      d.type, d.name, d.weight ?? 1, d.stock ?? null,
      d.couponTemplateId ?? null, d.pointsAmount ?? null, d.balanceAmount ?? null,
      d.color ?? '#F5C518', d.icon ?? '', d.sortOrder ?? 0,
      d.isActive === false ? 0 : 1,
    ]
  );
  return { id: r.insertId };
}

async function adminUpdatePrize(id, d) {
  const fields = [];
  const vals = [];
  const map = {
    type: 'type', name: 'name', weight: 'weight', stock: 'stock',
    couponTemplateId: 'coupon_template_id', pointsAmount: 'points_amount',
    balanceAmount: 'balance_amount', color: 'color', icon: 'icon', sortOrder: 'sort_order',
  };
  for (const [k, col] of Object.entries(map)) {
    if (d[k] !== undefined) { fields.push(`${col} = ?`); vals.push(d[k]); }
  }
  if (d.isActive !== undefined) { fields.push('is_active = ?'); vals.push(d.isActive ? 1 : 0); }
  if (!fields.length) return false;
  vals.push(id);
  const [r] = await pool.query(`UPDATE lucky_wheel_prizes SET ${fields.join(', ')} WHERE id = ?`, vals);
  return r.affectedRows > 0;
}

async function adminDeletePrize(id) {
  // draws.prize_id is ON DELETE SET NULL → hard delete is safe (no errno 1451).
  const [r] = await pool.query('DELETE FROM lucky_wheel_prizes WHERE id = ?', [id]);
  return r.affectedRows > 0;
}

async function adminTogglePrize(id) {
  await pool.query('UPDATE lucky_wheel_prizes SET is_active = 1 - is_active WHERE id = ?', [id]);
  const [[row]] = await pool.query('SELECT is_active FROM lucky_wheel_prizes WHERE id = ?', [id]);
  return { isActive: row ? !!row.is_active : false };
}

async function adminListRecords(page = 1, limit = 20) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (p - 1) * l;
  const [[c]] = await pool.query('SELECT COUNT(*) AS total FROM lucky_wheel_draws');
  const [rows] = await pool.query(
    `SELECT d.id, d.user_id AS userId, u.name AS userName, d.prize_type AS prizeType,
            d.prize_name AS prizeName, d.source, d.cost_points AS costPoints,
            d.coupon_id AS couponId, d.points_amount AS pointsAmount,
            d.balance_amount AS balanceAmount, d.created_at AS createdAt
       FROM lucky_wheel_draws d
       LEFT JOIN users u ON u.id = d.user_id
      ORDER BY d.id DESC LIMIT ? OFFSET ?`,
    [l, offset]
  );
  return { total: Number(c.total), list: rows };
}

async function adminGetLuckyConfig() {
  return getLuckyConfig();
}

async function saveLuckyConfig(d) {
  const entries = [
    ['lucky_enabled', d.enabled ? '1' : '0'],
    ['lucky_free_per_day', String(d.freePerDay)],
    ['lucky_points_cost', String(d.pointsCost)],
    ['lucky_max_per_day', String(d.maxPerDay)],
  ];
  for (const [key, val] of entries) {
    await pool.query(
      'INSERT INTO system_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = ?',
      [key, val, val]
    );
  }
  return getLuckyConfig();
}

module.exports = {
  getLuckyConfig, getWheelConfig, draw, myRecords,
  adminListPrizes, adminGetPrize, adminCreatePrize, adminUpdatePrize,
  adminDeletePrize, adminTogglePrize, adminListRecords,
  adminGetLuckyConfig, saveLuckyConfig,
};
```

- [ ] **Step 2: Add the admin methods to adminApiController**

In `pizza-server/src/controllers/adminApiController.js`, after the last `require` near the top (the `reconciliationService` require ~L22), add:

```js
const luckyWheelService = require('../services/luckyWheelService');
```

Then inside the `adminApiController` object literal, add these 9 methods (place them together as a 幸运转盘 block):

```js
  // ── 幸运转盘 ──
  async getLuckyConfig(req, res, next) {
    try { res.json({ code: 0, data: await luckyWheelService.adminGetLuckyConfig() }); }
    catch (err) { next(err); }
  },
  async updateLuckyConfig(req, res, next) {
    try { res.json({ code: 0, data: await luckyWheelService.saveLuckyConfig(req.body) }); }
    catch (err) { next(err); }
  },
  async listLuckyPrizes(req, res, next) {
    try { res.json({ code: 0, data: await luckyWheelService.adminListPrizes() }); }
    catch (err) { next(err); }
  },
  async getLuckyPrize(req, res, next) {
    try {
      const data = await luckyWheelService.adminGetPrize(req.params.id);
      if (!data) return res.status(404).json({ code: 404, message: '奖品不存在' });
      res.json({ code: 0, data });
    } catch (err) { next(err); }
  },
  async createLuckyPrize(req, res, next) {
    try { res.json({ code: 0, data: await luckyWheelService.adminCreatePrize(req.body) }); }
    catch (err) { next(err); }
  },
  async updateLuckyPrize(req, res, next) {
    try {
      const ok = await luckyWheelService.adminUpdatePrize(req.params.id, req.body);
      if (!ok) return res.status(404).json({ code: 404, message: '奖品不存在或无变更' });
      res.json({ code: 0, data: { updated: true } });
    } catch (err) { next(err); }
  },
  async deleteLuckyPrize(req, res, next) {
    try {
      const ok = await luckyWheelService.adminDeletePrize(req.params.id);
      if (!ok) return res.status(404).json({ code: 404, message: '奖品不存在' });
      res.json({ code: 0, data: { deleted: true } });
    } catch (err) { next(err); }
  },
  async toggleLuckyPrize(req, res, next) {
    try { res.json({ code: 0, data: await luckyWheelService.adminTogglePrize(req.params.id) }); }
    catch (err) { next(err); }
  },
  async listLuckyRecords(req, res, next) {
    try {
      const { page, limit } = req.query;
      res.json({ code: 0, data: await luckyWheelService.adminListRecords(page, limit) });
    } catch (err) { next(err); }
  },
```

> If the controller object uses trailing commas between methods (it does), ensure the method placed just before this block ends with a comma and this block ends with a comma too.

- [ ] **Step 3: Add the admin validation schemas**

In `pizza-server/src/middleware/validation.js` `schemas` object, add:

```js
  luckyPrize: Joi.object({
    type: Joi.string().valid('coupon', 'points', 'balance', 'thanks', 'again').required(),
    name: Joi.string().max(50).required(),
    weight: Joi.number().integer().min(0).default(1),
    stock: Joi.number().integer().min(0).allow(null),
    couponTemplateId: Joi.number().integer().allow(null),
    pointsAmount: Joi.number().integer().min(0).allow(null),
    balanceAmount: Joi.number().min(0).allow(null),
    color: Joi.string().max(16).allow(''),
    icon: Joi.string().max(255).allow(''),
    sortOrder: Joi.number().integer().default(0),
    isActive: Joi.boolean().default(true),
  }),
  luckyPrizeUpdate: Joi.object({
    type: Joi.string().valid('coupon', 'points', 'balance', 'thanks', 'again'),
    name: Joi.string().max(50),
    weight: Joi.number().integer().min(0),
    stock: Joi.number().integer().min(0).allow(null),
    couponTemplateId: Joi.number().integer().allow(null),
    pointsAmount: Joi.number().integer().min(0).allow(null),
    balanceAmount: Joi.number().min(0).allow(null),
    color: Joi.string().max(16).allow(''),
    icon: Joi.string().max(255).allow(''),
    sortOrder: Joi.number().integer(),
    isActive: Joi.boolean(),
  }).min(1),
  luckyConfig: Joi.object({
    enabled: Joi.boolean().required(),
    freePerDay: Joi.number().integer().min(0).required(),
    pointsCost: Joi.number().integer().min(0).required(),
    maxPerDay: Joi.number().integer().min(1).required(),
  }),
```

- [ ] **Step 4: Add the admin routes**

In `pizza-server/src/routes/adminApi.js` (single Router with `router.use(auth, adminOnly)` already applied), add a lucky-wheel block alongside the coupon-template block (uses `ctrl.<method>` and inline `validate('schema')`):

```js
// ── 幸运转盘 ──
router.get('/lucky-wheel/config', ctrl.getLuckyConfig);
router.put('/lucky-wheel/config', validate('luckyConfig'), ctrl.updateLuckyConfig);
router.get('/lucky-wheel/records', ctrl.listLuckyRecords);
router.get('/lucky-wheel/prizes', ctrl.listLuckyPrizes);
router.get('/lucky-wheel/prizes/:id', ctrl.getLuckyPrize);
router.post('/lucky-wheel/prizes', validate('luckyPrize'), ctrl.createLuckyPrize);
router.put('/lucky-wheel/prizes/:id', validate('luckyPrizeUpdate'), ctrl.updateLuckyPrize);
router.delete('/lucky-wheel/prizes/:id', ctrl.deleteLuckyPrize);
router.put('/lucky-wheel/prizes/:id/toggle', ctrl.toggleLuckyPrize);
```

> Confirm `ctrl` is the name `adminApi.js` already binds the controller to (it uses `ctrl.<method>` throughout). If it imports as a different identifier, match it.

- [ ] **Step 5: Syntax-check**

Run (from `pizza-server/`):
```bash
node --check src/services/luckyWheelService.js && node --check src/controllers/adminApiController.js && node --check src/routes/adminApi.js && node --check src/middleware/validation.js && echo "syntax OK"
```
Expected: `syntax OK`

- [ ] **Step 6: Re-run the pure-logic tests (guard against accidental service break)**

Run (from `pizza-server/`): `node --test test/`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add pizza-server/src/services/luckyWheelService.js pizza-server/src/controllers/adminApiController.js pizza-server/src/routes/adminApi.js pizza-server/src/middleware/validation.js
git commit -m "feat(lucky-wheel): v1.2.0 后台接口 — 奖品CRUD/启停 + 抽奖记录 + 规则配置(UPSERT) + 校验"
```

---

# Phase 2 — Admin SPA (soybean-admin-temp)

> **Node ≥ v22.13 for all pnpm commands:** `$env:PATH = "C:\Program Files\nodejs;" + $env:PATH` first.

## Task 5: Admin scaffold — API module, stub views, routing, i18n, gen-route

**Files:**
- Create: `soybean-admin-temp/src/service/api/luckyWheel.ts`
- Modify: `soybean-admin-temp/src/service/api/index.ts` (barrel export)
- Create: `soybean-admin-temp/src/views/luckywheel/prizes/list/index.vue` (stub)
- Create: `soybean-admin-temp/src/views/luckywheel/prizes/form/index.vue` (stub)
- Create: `soybean-admin-temp/src/views/luckywheel/records/list/index.vue` (stub)
- Modify: `soybean-admin-temp/src/router/routes/index.ts` (custom route)
- Modify: `soybean-admin-temp/src/locales/langs/zh-cn.ts` + `en-us.ts` (i18n)
- Regenerated by `pnpm gen-route`: `imports.ts`, `transform.ts`, `routes.ts`, `typings/elegant-router.d.ts`

**Interfaces:**
- Produces (used by T6/T7/T8): the `luckyWheel.ts` fetch fns + `LuckyPrize`/`LuckyRecord`/`LuckyConfig` interfaces; working `/lucky-wheel/prizes` and `/lucky-wheel/records` routes with menu entries.

- [ ] **Step 1: Create the API module**

Create `soybean-admin-temp/src/service/api/luckyWheel.ts`:

```ts
import { request } from '../request';

export interface LuckyPrize {
  id: number;
  type: 'coupon' | 'points' | 'balance' | 'thanks' | 'again';
  name: string;
  weight: number;
  stock: number | null;
  awardedCount: number;
  couponTemplateId: number | null;
  pointsAmount: number | null;
  balanceAmount: number | null;
  color: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LuckyRecord {
  id: number;
  userId: number;
  userName?: string;
  prizeType: string;
  prizeName: string;
  source: 'free' | 'points' | 'again';
  costPoints: number;
  couponId: number | null;
  pointsAmount: number | null;
  balanceAmount: number | null;
  createdAt: string;
}

export interface LuckyConfig {
  enabled: boolean;
  freePerDay: number;
  pointsCost: number;
  maxPerDay: number;
}

export function fetchLuckyPrizes() {
  return request<LuckyPrize[]>({ url: '/lucky-wheel/prizes' });
}

export function fetchLuckyPrize(id: number) {
  return request<LuckyPrize>({ url: `/lucky-wheel/prizes/${id}` });
}

export function fetchCreateLuckyPrize(payload: Partial<LuckyPrize>) {
  return request<{ id: number }>({ url: '/lucky-wheel/prizes', method: 'post', data: payload });
}

export function fetchUpdateLuckyPrize(id: number, payload: Partial<LuckyPrize>) {
  return request<{ updated: boolean }>({ url: `/lucky-wheel/prizes/${id}`, method: 'put', data: payload });
}

export function fetchDeleteLuckyPrize(id: number) {
  return request<{ deleted: boolean }>({ url: `/lucky-wheel/prizes/${id}`, method: 'delete' });
}

export function fetchToggleLuckyPrize(id: number) {
  return request<{ isActive: boolean }>({ url: `/lucky-wheel/prizes/${id}/toggle`, method: 'put' });
}

export function fetchLuckyRecords(params?: { page?: number; limit?: number }) {
  return request<{ list: LuckyRecord[]; total: number }>({ url: '/lucky-wheel/records', params });
}

export function fetchLuckyConfig() {
  return request<LuckyConfig>({ url: '/lucky-wheel/config' });
}

export function fetchUpdateLuckyConfig(payload: LuckyConfig) {
  return request<LuckyConfig>({ url: '/lucky-wheel/config', method: 'put', data: payload });
}
```

- [ ] **Step 2: Export from the barrel**

In `soybean-admin-temp/src/service/api/index.ts`, add alongside the other `export *` lines:

```ts
export * from './luckyWheel';
```

- [ ] **Step 3: Create the three stub views** (so `gen-route` can wire them)

Create `soybean-admin-temp/src/views/luckywheel/prizes/list/index.vue`:

```vue
<script setup lang="ts">
import { NCard } from 'naive-ui';
defineOptions({ name: 'LuckyWheelPrizesList' });
</script>

<template>
  <NCard title="幸运转盘奖品" :bordered="false" class="card-wrapper">占位 — T6 实现</NCard>
</template>

<style scoped></style>
```

Create `soybean-admin-temp/src/views/luckywheel/prizes/form/index.vue`:

```vue
<script setup lang="ts">
import { NCard } from 'naive-ui';
defineOptions({ name: 'LuckyWheelPrizesForm' });
</script>

<template>
  <NCard title="奖品表单" :bordered="false" class="card-wrapper">占位 — T7 实现</NCard>
</template>

<style scoped></style>
```

Create `soybean-admin-temp/src/views/luckywheel/records/list/index.vue`:

```vue
<script setup lang="ts">
import { NCard } from 'naive-ui';
defineOptions({ name: 'LuckyWheelRecordsList' });
</script>

<template>
  <NCard title="抽奖记录" :bordered="false" class="card-wrapper">占位 — T8 实现</NCard>
</template>

<style scoped></style>
```

- [ ] **Step 4: Add the custom route**

In `soybean-admin-temp/src/router/routes/index.ts`, add this object to the `customRoutes` array (after the `coupons` block, mirroring the `membertiers` shape). All names lowercase:

```ts
  {
    name: 'luckywheel',
    path: '/lucky-wheel',
    component: 'layout.base',
    meta: {
      title: '幸运转盘',
      i18nKey: 'route.luckywheel',
      icon: 'mdi:dharmachakra',
      order: 6.5,
    },
    children: [
      {
        name: 'luckywheel_prizes_list',
        path: '/lucky-wheel/prizes',
        component: 'view.luckywheel_prizes_list',
        meta: {
          title: '奖品管理',
          i18nKey: 'route.luckywheel_prizes_list',
        },
      },
      {
        name: 'luckywheel_prizes_create',
        path: '/lucky-wheel/prizes/create',
        component: 'view.luckywheel_prizes_form',
        meta: {
          title: '新建奖品',
          i18nKey: 'route.luckywheel_prizes_create',
          hideInMenu: true,
        },
      },
      {
        name: 'luckywheel_prizes_edit',
        path: '/lucky-wheel/prizes/:id/edit',
        component: 'view.luckywheel_prizes_form',
        props: true,
        meta: {
          title: '编辑奖品',
          i18nKey: 'route.luckywheel_prizes_edit',
          hideInMenu: true,
        },
      },
      {
        name: 'luckywheel_records_list',
        path: '/lucky-wheel/records',
        component: 'view.luckywheel_records_list',
        meta: {
          title: '抽奖记录',
          i18nKey: 'route.luckywheel_records_list',
        },
      },
    ],
  },
```

- [ ] **Step 5: Add i18n keys**

In `soybean-admin-temp/src/locales/langs/zh-cn.ts`, under the `route` object (alongside `membertiers` keys), add:

```ts
      luckywheel: '幸运转盘',
      luckywheel_prizes_list: '奖品管理',
      luckywheel_prizes_create: '新建奖品',
      luckywheel_prizes_edit: '编辑奖品',
      luckywheel_prizes_form: '奖品表单',
      luckywheel_records_list: '抽奖记录',
```

In `soybean-admin-temp/src/locales/langs/en-us.ts`, under the `route` object, add:

```ts
      luckywheel: 'Lucky Wheel',
      luckywheel_prizes_list: 'Prizes',
      luckywheel_prizes_create: 'New Prize',
      luckywheel_prizes_edit: 'Edit Prize',
      luckywheel_prizes_form: 'Prize Form',
      luckywheel_records_list: 'Draw Records',
```

- [ ] **Step 6: Regenerate route types**

Run (from `soybean-admin-temp/`, with Node ≥22.13 on PATH): `pnpm gen-route`
Expected: regenerates `src/router/elegant/{imports,transform,routes}.ts` and `src/typings/elegant-router.d.ts` to include the `luckywheel_*` views. No errors.

- [ ] **Step 7: Build to verify routing + types compile**

Run (from `soybean-admin-temp/`): `pnpm build`
Expected: build succeeds (`dist/` produced), no TS errors about missing `luckywheel_*` route keys or unresolved `view.luckywheel_*` components.

- [ ] **Step 8: Commit**

```bash
git add soybean-admin-temp/src/service/api/luckyWheel.ts soybean-admin-temp/src/service/api/index.ts soybean-admin-temp/src/views/luckywheel soybean-admin-temp/src/router soybean-admin-temp/src/locales/langs/zh-cn.ts soybean-admin-temp/src/locales/langs/en-us.ts soybean-admin-temp/src/typings/elegant-router.d.ts
git commit -m "feat(admin): v1.2.0 幸运转盘脚手架 — API模块/桩视图/路由/菜单i18n/gen-route"
```

---

## Task 6: Admin prizes list + 抽奖规则 config card

**Files:**
- Modify (overwrite stub): `soybean-admin-temp/src/views/luckywheel/prizes/list/index.vue`

**Interfaces:**
- Consumes: `fetchLuckyPrizes`, `fetchDeleteLuckyPrize`, `fetchToggleLuckyPrize`, `fetchLuckyConfig`, `fetchUpdateLuckyConfig`, types `LuckyPrize`/`LuckyConfig` (Task 5).

- [ ] **Step 1: Write the full list view**

Overwrite `soybean-admin-temp/src/views/luckywheel/prizes/list/index.vue`:

```vue
<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import { useRouter } from 'vue-router';
import { NCard, NDataTable, NButton, NTag, NSpace, NIcon, NSwitch, useDialog, NForm, NFormItem, NInputNumber } from 'naive-ui';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@vicons/antd';
import type { DataTableColumns } from 'naive-ui';
import { fetchLuckyPrizes, fetchDeleteLuckyPrize, fetchToggleLuckyPrize, fetchLuckyConfig, fetchUpdateLuckyConfig } from '@/service/api';
import type { LuckyPrize, LuckyConfig } from '@/service/api';

defineOptions({ name: 'LuckyWheelPrizesList' });

const router = useRouter();
const dialog = useDialog();
const prizes = ref<LuckyPrize[]>([]);
const loading = ref(false);

const typeMap: Record<string, { label: string; type: 'success' | 'info' | 'warning' | 'error' | 'default' }> = {
  coupon: { label: '优惠券', type: 'success' },
  points: { label: '积分', type: 'info' },
  balance: { label: '余额', type: 'warning' },
  thanks: { label: '谢谢参与', type: 'default' },
  again: { label: '再来一次', type: 'error' },
};

function rewardText(row: LuckyPrize): string {
  if (row.type === 'coupon') return row.couponTemplateId ? `券模板#${row.couponTemplateId}` : '(未配置)';
  if (row.type === 'points') return `${row.pointsAmount ?? 0} 积分`;
  if (row.type === 'balance') return `¥${Number(row.balanceAmount ?? 0).toFixed(2)}`;
  return '—';
}

const columns: DataTableColumns<LuckyPrize> = [
  { title: 'ID', key: 'id', width: 60, align: 'center' },
  {
    title: '类型', key: 'type', width: 90,
    render(row) {
      const m = typeMap[row.type] || { label: row.type, type: 'default' as const };
      return h(NTag, { type: m.type, size: 'small', bordered: false }, () => m.label);
    }
  },
  { title: '名称', key: 'name', width: 140 },
  { title: '权重', key: 'weight', width: 70, align: 'center' },
  {
    title: '奖励', key: 'reward', width: 110,
    render(row) { return rewardText(row); }
  },
  {
    title: '已发/库存', key: 'stock', width: 100, align: 'center',
    render(row) {
      const stock = row.stock == null ? '∞' : row.stock;
      return `${row.awardedCount ?? 0}/${stock}`;
    }
  },
  { title: '排序', key: 'sortOrder', width: 70, align: 'center' },
  {
    title: '状态', key: 'isActive', width: 80, align: 'center',
    render(row) {
      return h(NSwitch, {
        value: !!row.isActive,
        onUpdateValue: () => handleToggle(row.id, !row.isActive),
      });
    }
  },
  {
    title: '操作', key: 'actions', width: 120,
    render(row) {
      return h(NSpace, null, {
        default: () => [
          h(NButton, { size: 'small', quaternary: true, onClick: () => router.push(`/lucky-wheel/prizes/${row.id}/edit`) }, { icon: () => h(NIcon, null, () => h(EditOutlined)) }),
          h(NButton, { size: 'small', quaternary: true, type: 'error', onClick: () => handleDelete(row.id, row.name) }, { icon: () => h(NIcon, null, () => h(DeleteOutlined)) }),
        ]
      });
    }
  },
];

async function loadPrizes() {
  loading.value = true;
  const { data, error } = await fetchLuckyPrizes();
  if (!error && data) prizes.value = data;
  loading.value = false;
}

async function handleToggle(id: number, val: boolean) {
  const { error } = await fetchToggleLuckyPrize(id);
  if (error) { window.$message?.error('切换状态失败'); return; }
  window.$message?.success(val ? '已启用' : '已禁用');
  loadPrizes();
}

async function handleDelete(id: number, name: string) {
  dialog.warning({
    title: '确认删除',
    content: `确定删除奖品「${name}」？已抽中的记录会保留（关联置空）。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const { error } = await fetchDeleteLuckyPrize(id);
      if (!error) { window.$message?.success('奖品已删除'); loadPrizes(); }
    },
  });
}

// ── 抽奖规则 config ──
const config = ref<LuckyConfig>({ enabled: true, freePerDay: 1, pointsCost: 50, maxPerDay: 10 });
const savingConfig = ref(false);

async function loadConfig() {
  const { data, error } = await fetchLuckyConfig();
  if (!error && data) config.value = data;
}

async function saveConfig() {
  savingConfig.value = true;
  const { error } = await fetchUpdateLuckyConfig(config.value);
  savingConfig.value = false;
  if (!error) window.$message?.success('规则已保存');
}

onMounted(() => { loadPrizes(); loadConfig(); });
</script>

<template>
  <NSpace vertical :size="16">
    <NCard title="抽奖规则" :bordered="false" class="card-wrapper">
      <NForm inline label-placement="left" label-width="auto">
        <NFormItem label="启用转盘">
          <NSwitch v-model:value="config.enabled" />
        </NFormItem>
        <NFormItem label="每日免费次数">
          <NInputNumber v-model:value="config.freePerDay" :min="0" style="width: 120px" />
        </NFormItem>
        <NFormItem label="加抽消耗积分">
          <NInputNumber v-model:value="config.pointsCost" :min="0" style="width: 120px" />
        </NFormItem>
        <NFormItem label="每日上限">
          <NInputNumber v-model:value="config.maxPerDay" :min="1" style="width: 120px" />
        </NFormItem>
        <NFormItem>
          <NButton type="primary" :loading="savingConfig" @click="saveConfig">保存规则</NButton>
        </NFormItem>
      </NForm>
    </NCard>

    <NCard title="奖品列表" :bordered="false" class="card-wrapper">
      <template #header-extra>
        <NButton type="primary" @click="router.push('/lucky-wheel/prizes/create')">
          <template #icon><NIcon><PlusOutlined /></NIcon></template>
          新建奖品
        </NButton>
      </template>
      <NDataTable :columns="columns" :data="prizes" :loading="loading" :row-key="(r: LuckyPrize) => r.id" />
    </NCard>
  </NSpace>
</template>

<style scoped></style>
```

- [ ] **Step 2: Build to verify the view compiles**

Run (from `soybean-admin-temp/`): `pnpm build`
Expected: build succeeds, no TS/template errors.

- [ ] **Step 3: Commit**

```bash
git add soybean-admin-temp/src/views/luckywheel/prizes/list/index.vue
git commit -m "feat(admin): v1.2.0 幸运转盘奖品列表 + 抽奖规则配置卡片"
```

---

## Task 7: Admin prize form (create/edit, type-conditional fields)

**Files:**
- Modify (overwrite stub): `soybean-admin-temp/src/views/luckywheel/prizes/form/index.vue`

**Interfaces:**
- Consumes: `fetchLuckyPrize`, `fetchCreateLuckyPrize`, `fetchUpdateLuckyPrize`, type `LuckyPrize` (Task 5); `fetchCouponTemplates`, type `CouponTemplate` (existing) for the coupon-template selector.

- [ ] **Step 1: Write the full form view**

Overwrite `soybean-admin-temp/src/views/luckywheel/prizes/form/index.vue`:

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { NButton, NSpace, NCard, NForm, NFormItem, NInput, NInputNumber, NSelect, NColorPicker, NSpin, NSwitch } from 'naive-ui';
import { fetchLuckyPrize, fetchCreateLuckyPrize, fetchUpdateLuckyPrize, fetchCouponTemplates } from '@/service/api';
import type { LuckyPrize, CouponTemplate } from '@/service/api';

defineOptions({ name: 'LuckyWheelPrizesForm' });

const router = useRouter();
const route = useRoute();
const isEdit = ref(false);
const saving = ref(false);
const loading = ref(false);

const form = ref<Partial<LuckyPrize>>({
  type: 'thanks',
  name: '',
  weight: 1,
  stock: null,
  couponTemplateId: null,
  pointsAmount: null,
  balanceAmount: null,
  color: '#F5C518',
  icon: '',
  sortOrder: 0,
  isActive: true,
});

const typeOptions = [
  { label: '优惠券', value: 'coupon' },
  { label: '积分', value: 'points' },
  { label: '余额', value: 'balance' },
  { label: '谢谢参与', value: 'thanks' },
  { label: '再来一次', value: 'again' },
];

const couponOptions = ref<{ label: string; value: number }[]>([]);

async function loadCouponTemplates() {
  const { data, error } = await fetchCouponTemplates();
  if (!error && data) {
    couponOptions.value = data.map((t: CouponTemplate) => ({ label: `${t.name} (#${t.id})`, value: t.id! }));
  }
}

onMounted(async () => {
  loadCouponTemplates();
  const id = route.params.id as string;
  if (id && id !== 'create') {
    isEdit.value = true;
    loading.value = true;
    const { data, error } = await fetchLuckyPrize(Number(id));
    if (!error && data) {
      form.value = {
        type: data.type,
        name: data.name,
        weight: data.weight,
        stock: data.stock,
        couponTemplateId: data.couponTemplateId,
        pointsAmount: data.pointsAmount,
        balanceAmount: data.balanceAmount,
        color: data.color,
        icon: data.icon,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      };
    }
    loading.value = false;
  }
});

async function handleSave() {
  if (!form.value.name) { window.$message?.warning('请填写奖品名称'); return; }
  if (form.value.type === 'coupon' && !form.value.couponTemplateId) {
    window.$message?.warning('优惠券奖品必须选择券模板'); return;
  }
  saving.value = true;
  const id = route.params.id as string;
  const payload = { ...form.value };

  let error: any;
  if (isEdit.value) {
    const res = await fetchUpdateLuckyPrize(Number(id), payload);
    error = res.error;
  } else {
    const res = await fetchCreateLuckyPrize(payload);
    error = res.error;
  }

  saving.value = false;
  if (!error) {
    window.$message?.success(isEdit.value ? '奖品已更新' : '奖品已创建');
    router.push('/lucky-wheel/prizes');
  }
}
</script>

<template>
  <NCard :title="isEdit ? '编辑奖品' : '新建奖品'" :bordered="false" class="card-wrapper">
    <template #header-extra>
      <NSpace>
        <NButton @click="router.push('/lucky-wheel/prizes')">返回</NButton>
        <NButton type="primary" :loading="saving" @click="handleSave">{{ isEdit ? '保存修改' : '创建' }}</NButton>
      </NSpace>
    </template>

    <NSpin :show="loading">
      <NForm label-placement="left" label-width="100" style="max-width: 640px;">
        <NFormItem label="奖品类型" required>
          <NSelect v-model:value="form.type" :options="typeOptions" style="width: 200px" />
        </NFormItem>
        <NFormItem label="名称" required>
          <NInput v-model:value="form.name" placeholder="转盘上显示的奖品名" />
        </NFormItem>
        <NFormItem label="券模板" required v-if="form.type === 'coupon'">
          <NSelect v-model:value="form.couponTemplateId" :options="couponOptions" placeholder="中奖后据此发券" filterable style="width: 280px" />
        </NFormItem>
        <NFormItem label="积分数量" required v-if="form.type === 'points'">
          <NInputNumber v-model:value="form.pointsAmount" :min="0" style="width: 200px" />
        </NFormItem>
        <NFormItem label="余额金额" required v-if="form.type === 'balance'">
          <NInputNumber v-model:value="form.balanceAmount" :min="0" :step="0.01" style="width: 200px" />
        </NFormItem>
        <NFormItem label="权重">
          <NInputNumber v-model:value="form.weight" :min="0" style="width: 160px" />
          <span style="margin-left:8px;color:#999;">越大越易抽中（相对值）</span>
        </NFormItem>
        <NFormItem label="库存">
          <NInputNumber v-model:value="form.stock" :min="0" placeholder="空 = 不限" style="width: 200px" />
        </NFormItem>
        <NFormItem label="颜色">
          <NColorPicker v-model:value="form.color" />
        </NFormItem>
        <NFormItem label="图标URL">
          <NInput v-model:value="form.icon" placeholder="可选，转盘扇区图标" />
        </NFormItem>
        <NFormItem label="排序">
          <NInputNumber v-model:value="form.sortOrder" style="width: 160px" />
        </NFormItem>
        <NFormItem label="启用">
          <NSwitch v-model:value="form.isActive" />
        </NFormItem>
      </NForm>
    </NSpin>
  </NCard>
</template>

<style scoped></style>
```

- [ ] **Step 2: Build to verify**

Run (from `soybean-admin-temp/`): `pnpm build`
Expected: build succeeds, no errors.

- [ ] **Step 3: Commit**

```bash
git add soybean-admin-temp/src/views/luckywheel/prizes/form/index.vue
git commit -m "feat(admin): v1.2.0 幸运转盘奖品表单(按类型条件字段:券模板/积分/余额)"
```

---

## Task 8: Admin draw records (paginated)

**Files:**
- Modify (overwrite stub): `soybean-admin-temp/src/views/luckywheel/records/list/index.vue`

**Interfaces:**
- Consumes: `fetchLuckyRecords`, type `LuckyRecord` (Task 5).

- [ ] **Step 1: Write the full records view**

Overwrite `soybean-admin-temp/src/views/luckywheel/records/list/index.vue`:

```vue
<script setup lang="ts">
import { ref, onMounted, h, reactive } from 'vue';
import { NCard, NDataTable, NTag } from 'naive-ui';
import type { DataTableColumns, PaginationProps } from 'naive-ui';
import { fetchLuckyRecords } from '@/service/api';
import type { LuckyRecord } from '@/service/api';

defineOptions({ name: 'LuckyWheelRecordsList' });

const records = ref<LuckyRecord[]>([]);
const loading = ref(false);

const sourceMap: Record<string, { label: string; type: 'success' | 'info' | 'warning' }> = {
  free: { label: '免费', type: 'success' },
  points: { label: '积分加抽', type: 'info' },
  again: { label: '再来一次', type: 'warning' },
};

const typeMap: Record<string, string> = {
  coupon: '优惠券', points: '积分', balance: '余额', thanks: '谢谢参与', again: '再来一次',
};

function rewardText(row: LuckyRecord): string {
  if (row.prizeType === 'points') return `${row.pointsAmount ?? 0} 积分`;
  if (row.prizeType === 'balance') return `¥${Number(row.balanceAmount ?? 0).toFixed(2)}`;
  if (row.prizeType === 'coupon') return row.couponId ? `券#${row.couponId}` : '—';
  return '—';
}

const columns: DataTableColumns<LuckyRecord> = [
  { title: 'ID', key: 'id', width: 70, align: 'center' },
  { title: '用户', key: 'userName', width: 140, render(row) { return row.userName || `用户#${row.userId}`; } },
  { title: '奖品类型', key: 'prizeType', width: 90, render(row) { return typeMap[row.prizeType] || row.prizeType; } },
  { title: '奖品', key: 'prizeName', width: 140 },
  { title: '奖励', key: 'reward', width: 110, render(row) { return rewardText(row); } },
  {
    title: '来源', key: 'source', width: 90,
    render(row) {
      const m = sourceMap[row.source] || { label: row.source, type: 'info' as const };
      return h(NTag, { type: m.type, size: 'small', bordered: false }, () => m.label);
    }
  },
  { title: '消耗积分', key: 'costPoints', width: 90, align: 'center' },
  { title: '时间', key: 'createdAt', width: 170 },
];

const pagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 20,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [20, 50, 100],
  onChange: (page: number) => { pagination.page = page; load(); },
  onUpdatePageSize: (size: number) => { pagination.pageSize = size; pagination.page = 1; load(); },
});

async function load() {
  loading.value = true;
  const { data, error } = await fetchLuckyRecords({ page: pagination.page, limit: pagination.pageSize });
  if (!error && data) {
    records.value = data.list;
    pagination.itemCount = data.total;
  }
  loading.value = false;
}

onMounted(() => { load(); });
</script>

<template>
  <NCard title="抽奖记录" :bordered="false" class="card-wrapper">
    <NDataTable
      remote
      :columns="columns"
      :data="records"
      :loading="loading"
      :pagination="pagination"
      :row-key="(r: LuckyRecord) => r.id"
    />
  </NCard>
</template>

<style scoped></style>
```

- [ ] **Step 2: Build to verify the whole admin compiles**

Run (from `soybean-admin-temp/`): `pnpm build`
Expected: build succeeds, no errors.

- [ ] **Step 3: Commit**

```bash
git add soybean-admin-temp/src/views/luckywheel/records/list/index.vue
git commit -m "feat(admin): v1.2.0 幸运转盘抽奖记录(分页表格)"
```

---

# Phase 3 — Mini Program (miniprogram)

## Task 9: Lucky-wheel page (conic-gradient wheel)

**Files:**
- Create: `miniprogram/pages/lucky-wheel/lucky-wheel.json`
- Create: `miniprogram/pages/lucky-wheel/lucky-wheel.wxml`
- Create: `miniprogram/pages/lucky-wheel/lucky-wheel.wxss`
- Create: `miniprogram/pages/lucky-wheel/lucky-wheel.js`

**Interfaces:**
- Consumes: `utils/api.js` (`api.get('/lucky-wheel/config')`, `api.post('/lucky-wheel/draw',{source})`, `api.get('/lucky-wheel/records')`); `utils/layout.js` (`getSimpleTopBar`). Server `prizeId` lands the pointer via `findIndex(s => s.id === prizeId)`.

- [ ] **Step 1: Confirm the api.js return shape**

Read `miniprogram/utils/api.js` and one existing consumer (e.g. `miniprogram/pages/recharge/recharge.js`) to confirm: (a) what `api.get/post` resolves to (the full envelope `{ code, data }`, accessed as `res.data` for the payload, vs. an already-unwrapped payload), and (b) that `api.js` self-toasts on non-2xx so this page must NOT toast on API errors. The code below assumes `res.code === 0` and `res.data` is the payload — if api.js already unwraps to the payload, drop the `.data`/`.code` indirection accordingly. Do not add any `wx.showToast` for API-layer failures.

- [ ] **Step 2: Create the page config**

Create `miniprogram/pages/lucky-wheel/lucky-wheel.json`:

```json
{
  "usingComponents": {},
  "navigationStyle": "custom",
  "navigationBarTitleText": "幸运转盘"
}
```

- [ ] **Step 3: Create the WXML**

Create `miniprogram/pages/lucky-wheel/lucky-wheel.wxml`:

```html
<view class="page-container" style="padding-top: {{topBarTotalHeight}}px;">
  <!-- Top bar with back -->
  <view class="top-bar" style="padding-top: {{statusBarHeight}}px;">
    <view class="back-btn" bindtap="onBack">
      <image src="/images/back.png" class="back-icon" mode="aspectFit"></image>
    </view>
    <text class="top-title">幸运转盘</text>
    <view class="top-spacer"></view>
  </view>

  <scroll-view scroll-y enhanced bounces="{{false}}" show-scrollbar="{{false}}" style="height: {{scrollViewHeight}}px;">
    <view class="lw-body">
      <!-- Wheel -->
      <view class="wheel-wrap">
        <view class="pointer"></view>
        <view class="wheel" style="background-image: {{wheelBg}}; transform: rotate({{rotation}}deg); transition-duration: {{spinning ? '4s' : '0s'}};">
          <view wx:for="{{labels}}" wx:key="id" class="seg-label" style="{{item.style}}">
            <text class="seg-name">{{item.name}}</text>
          </view>
        </view>
        <view class="wheel-go {{spinning ? 'disabled' : ''}}" bindtap="onSpin">
          <text class="go-text">{{spinning ? '...' : '抽奖'}}</text>
        </view>
      </view>

      <!-- Status line -->
      <view class="status-line">
        <text wx:if="{{freeRemaining > 0}}">今日免费剩 {{freeRemaining}} 次</text>
        <text wx:elif="{{drawsRemaining > 0}}">加抽 {{pointsCost}} 积分/次 · 当前 {{userPoints}} 积分</text>
        <text wx:else>今日次数已用完，明天再来~</text>
      </view>

      <!-- Records entry -->
      <view class="records-entry" bindtap="onOpenRecords">中奖记录 ›</view>

      <view style="height: calc(120rpx + env(safe-area-inset-bottom))"></view>
    </view>
  </scroll-view>

  <!-- Result modal -->
  <view class="result-overlay {{showResult ? 'show' : ''}}" catchtap="onCloseResult">
    <view class="result-card" catchtap="noop">
      <text class="result-title">{{resultBonus ? '再来一次！' : '恭喜'}}</text>
      <text class="result-text">{{resultText}}</text>
      <button class="result-btn" bindtap="onCloseResult">{{resultBonus ? '继续抽奖' : '知道了'}}</button>
    </view>
  </view>

  <!-- Records modal -->
  <view class="records-overlay {{showRecords ? 'show' : ''}}" catchtap="onCloseRecords">
    <view class="records-drawer {{showRecords ? 'show' : ''}}" catchtap="noop">
      <view class="records-head">
        <text>中奖记录</text>
        <text class="records-close" bindtap="onCloseRecords">✕</text>
      </view>
      <scroll-view scroll-y enhanced show-scrollbar="{{false}}" class="records-scroll">
        <view wx:if="{{records.length === 0}}" class="records-empty">暂无记录</view>
        <view wx:for="{{records}}" wx:key="id" class="record-item">
          <view class="record-main">
            <text class="record-name">{{item.prizeName}}</text>
            <text class="record-time">{{item.createdAt}}</text>
          </view>
          <text class="record-src">{{item.sourceText}}</text>
        </view>
        <view style="height: calc(40rpx + env(safe-area-inset-bottom))"></view>
      </scroll-view>
    </view>
  </view>
</view>
```

- [ ] **Step 4: Create the WXSS**

Create `miniprogram/pages/lucky-wheel/lucky-wheel.wxss`:

```css
.page-container { min-height: 100vh; box-sizing: border-box; }

.top-bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  display: flex; align-items: center; padding: 0 24rpx 16rpx;
  background: var(--glass-bg-nav);
}
.back-btn { width: 64rpx; height: 64rpx; display: flex; align-items: center; }
.back-icon { width: 40rpx; height: 40rpx; }
.top-title { flex: 1; text-align: center; font-size: 34rpx; font-weight: 700; color: var(--color-on-surface); }
.top-spacer { width: 64rpx; }

.lw-body { display: flex; flex-direction: column; align-items: center; padding: 40rpx 32rpx; }

.wheel-wrap { position: relative; width: 600rpx; height: 600rpx; margin-top: 40rpx; }

.pointer {
  position: absolute; top: -10rpx; left: 50%; transform: translateX(-50%);
  width: 0; height: 0; z-index: 3;
  border-left: 28rpx solid transparent;
  border-right: 28rpx solid transparent;
  border-top: 56rpx solid var(--color-primary);
}

.wheel {
  width: 600rpx; height: 600rpx; border-radius: 50%;
  position: relative;
  border: 8rpx solid #FFFFFF;
  box-shadow: var(--glass-shadow-card);
  transition-property: transform;
  transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}

.seg-label {
  position: absolute; top: 50%; left: 50%; width: 0; height: 0;
  display: flex; justify-content: center;
}
.seg-name {
  font-size: 24rpx; font-weight: 600; color: #5A3A1A;
  white-space: nowrap; transform: translateX(-50%);
}

.wheel-go {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: 150rpx; height: 150rpx; border-radius: 50%;
  background: var(--color-primary);
  display: flex; align-items: center; justify-content: center;
  z-index: 2; box-shadow: var(--glass-shadow-button);
}
.wheel-go.disabled { opacity: 0.6; }
.go-text { color: #FFFFFF; font-size: 36rpx; font-weight: 700; }

.status-line { margin-top: 56rpx; font-size: 28rpx; color: var(--color-on-surface); }
.records-entry { margin-top: 32rpx; font-size: 28rpx; color: var(--color-primary); }

/* Result modal */
.result-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  visibility: hidden; opacity: 0; transition: opacity 0.2s;
}
.result-overlay.show { visibility: visible; opacity: 1; }
.result-card {
  width: 560rpx; background: var(--glass-bg-elevated);
  border-radius: var(--radius-card); padding: 56rpx 40rpx;
  display: flex; flex-direction: column; align-items: center;
}
.result-title { font-size: 40rpx; font-weight: 700; color: var(--color-primary); }
.result-text { margin-top: 24rpx; font-size: 30rpx; color: var(--color-on-surface); text-align: center; }
.result-btn {
  margin-top: 48rpx; width: 320rpx; height: 80rpx; line-height: 80rpx;
  background: var(--color-primary); color: #FFFFFF; border-radius: var(--radius-full);
  font-size: 30rpx;
}

/* Records modal */
.records-overlay {
  position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.45);
  visibility: hidden; opacity: 0; transition: opacity 0.2s;
}
.records-overlay.show { visibility: visible; opacity: 1; }
.records-drawer {
  position: absolute; left: 0; right: 0; bottom: 0;
  max-height: 70vh; background: var(--glass-bg-elevated);
  border-radius: var(--radius-card) var(--radius-card) 0 0;
  transform: translateY(100%); transition: transform 0.25s;
  display: flex; flex-direction: column;
}
.records-drawer.show { transform: translateY(0); }
.records-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 32rpx; font-size: 32rpx; font-weight: 700; color: var(--color-on-surface);
}
.records-close { font-size: 36rpx; color: #999; }
.records-scroll { max-height: 56vh; padding: 0 32rpx; }
.records-empty { text-align: center; color: #999; padding: 80rpx 0; font-size: 28rpx; }
.record-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 24rpx 0; border-bottom: 1rpx solid var(--glass-border-subtle);
}
.record-main { display: flex; flex-direction: column; }
.record-name { font-size: 30rpx; color: var(--color-on-surface); font-weight: 600; }
.record-time { font-size: 24rpx; color: #999; margin-top: 8rpx; }
.record-src { font-size: 26rpx; color: var(--color-primary); }
```

- [ ] **Step 5: Create the JS**

Create `miniprogram/pages/lucky-wheel/lucky-wheel.js`:

```js
const { api } = require('../../utils/api');
const { getSimpleTopBar } = require('../../utils/layout');

const SOURCE_TEXT = { free: '免费', points: '积分加抽', again: '再来一次' };
const FALLBACK_COLORS = ['#F5C518', '#FFE08A', '#F7B733', '#FFD75E'];

Page({
  data: {
    statusBarHeight: 0,
    topBarTotalHeight: 0,
    scrollViewHeight: 0,
    segments: [],
    labels: [],
    wheelBg: '',
    rotation: 0,
    spinning: false,
    enabled: true,
    pointsCost: 0,
    userPoints: 0,
    freeRemaining: 0,
    drawsRemaining: 0,
    showResult: false,
    resultText: '',
    resultBonus: false,
    showRecords: false,
    records: [],
  },

  onLoad() {
    const top = getSimpleTopBar();
    const sys = wx.getSystemInfoSync();
    const scrollViewHeight = sys.windowHeight - top.topBarTotalHeight;
    this.setData({ ...top, scrollViewHeight });
    this.loadConfig();
  },

  onBack() { wx.navigateBack({ delta: 1 }); },
  noop() {},

  loadConfig() {
    api.get('/lucky-wheel/config').then(res => {
      if (!res || res.code !== 0 || !res.data) return;
      const d = res.data;
      const segments = d.segments || [];
      const n = segments.length;
      this.setData({
        enabled: d.enabled,
        pointsCost: d.pointsCost,
        userPoints: d.userPoints,
        freeRemaining: d.freeRemaining,
        drawsRemaining: d.drawsRemaining,
        segments,
        wheelBg: this.buildWheelBg(segments),
        labels: this.buildLabels(segments),
      });
      if (!d.enabled) wx.showToast({ title: '转盘暂未开放', icon: 'none' });
    }).catch(() => {});
  },

  buildWheelBg(segments) {
    const n = segments.length;
    if (!n) return '';
    const seg = 360 / n;
    const stops = segments.map((s, i) => {
      const color = s.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length];
      return `${color} ${(i * seg).toFixed(3)}deg ${((i + 1) * seg).toFixed(3)}deg`;
    }).join(', ');
    return `conic-gradient(${stops})`;
  },

  buildLabels(segments) {
    const n = segments.length;
    if (!n) return [];
    const seg = 360 / n;
    return segments.map((s, i) => {
      const center = i * seg + seg / 2;
      return {
        id: s.id,
        name: s.name,
        // rotate to the segment center, push text out toward the rim
        style: `transform: rotate(${center.toFixed(3)}deg) translateY(-200rpx);`,
      };
    });
  },

  onSpin() {
    if (this.data.spinning) return;
    if (!this.data.enabled) { wx.showToast({ title: '转盘暂未开放', icon: 'none' }); return; }
    if (!this.data.segments.length) return;

    if (this.data.freeRemaining > 0) {
      this.doDraw('free');
    } else if (this.data.drawsRemaining <= 0) {
      wx.showToast({ title: '今日次数已用完', icon: 'none' });
    } else if (this.data.userPoints < this.data.pointsCost) {
      wx.showToast({ title: '积分不足', icon: 'none' });
    } else {
      wx.showModal({
        title: '加抽确认',
        content: `本次将消耗 ${this.data.pointsCost} 积分，确定吗？`,
        success: r => { if (r.confirm) this.doDraw('points'); },
      });
    }
  },

  doDraw(source) {
    this.setData({ spinning: true });
    api.post('/lucky-wheel/draw', { source }).then(res => {
      if (!res || res.code !== 0 || !res.data) { this.setData({ spinning: false }); return; }
      const d = res.data;
      const winIndex = this.data.segments.findIndex(s => s.id === d.prizeId);
      if (winIndex < 0) { this.setData({ spinning: false }); return; }
      this.spinTo(winIndex, d);
    }).catch(() => { this.setData({ spinning: false }); });
  },

  spinTo(winIndex, result) {
    const n = this.data.segments.length;
    const seg = 360 / n;
    const center = winIndex * seg + seg / 2;
    const targetMod = (360 - (center % 360) + 360) % 360; // rotation (mod 360) to put center under top pointer
    const current = this.data.rotation;
    const extraSpins = 5;
    let target = Math.floor(current / 360) * 360 + targetMod;
    while (target < current + extraSpins * 360) target += 360;

    this.setData({ rotation: target });
    setTimeout(() => {
      this.setData({
        spinning: false,
        showResult: true,
        resultText: result.awardText,
        resultBonus: !!result.bonusSpin,
        userPoints: result.userPoints,
        freeRemaining: result.freeRemaining,
        drawsRemaining: result.drawsRemaining,
      });
    }, 4100); // matches CSS transition-duration 4s + buffer
  },

  onCloseResult() { this.setData({ showResult: false }); },

  onOpenRecords() {
    this.setData({ showRecords: true });
    api.get('/lucky-wheel/records').then(res => {
      if (!res || res.code !== 0 || !res.data) return;
      const list = (res.data.list || []).map(r => ({
        id: r.id,
        prizeName: r.prizeName,
        createdAt: r.createdAt,
        sourceText: SOURCE_TEXT[r.source] || r.source,
      }));
      this.setData({ records: list });
    }).catch(() => {});
  },

  onCloseRecords() { this.setData({ showRecords: false }); },
});
```

- [ ] **Step 6: Verify in WeChat DevTools**

Open `miniprogram/` in WeChat Developer Tools. Confirm the page compiles (no WXSS/WXML/JS errors in the console). The wheel renders as a colored disc with labels (the `conic-gradient` may not render in DevTools but works on a real device — acceptable; the structure must compile). Tapping 抽奖 should call the API (will require a logged-in token + the backend running; visual/animation verification happens at the end-to-end QA step).

- [ ] **Step 7: Commit**

```bash
git add miniprogram/pages/lucky-wheel
git commit -m "feat(miniprogram): v1.2.0 幸运转盘页面 — conic-gradient转盘+服务端落点动画+加抽确认+中奖记录"
```

---

## Task 10: Wire the entry points

**Files:**
- Modify: `miniprogram/app.json` (register page)
- Modify: `miniprogram/pages/main/main.js` (金刚区路由)
- Modify: `miniprogram/pages/profile/profile.js` (我的页路由)

**Interfaces:**
- Consumes: the page route `/pages/lucky-wheel/lucky-wheel` (Task 9).

- [ ] **Step 1: Register the page in app.json**

In `miniprogram/app.json`, add to the `pages` array (e.g. after the recharge page entry):

```json
    "pages/lucky-wheel/lucky-wheel"
```

(Comma-correct: add a comma after the previous last entry if it was the last item.)

- [ ] **Step 2: Route the 金刚区 entry in main.js**

In `miniprogram/pages/main/main.js`, in the `onMenuItem` `routes` object (~L684) change:

```js
lucky: '__toast__', service: '__toast__'
```
to:
```js
lucky: '/pages/lucky-wheel/lucky-wheel', service: '__toast__'
```

Then in the `msgs` object (~L689) **remove** the `lucky` entry (keep `service`):

```js
const msgs = { service: '客服热线: 400-888-8888' };
```

> Confirm `onMenuItem` navigates when the mapped value is a path (other entries are paths and navigate via `wx.navigateTo`/`wx.switchTab`). The `__toast__` sentinel is only for entries still in `msgs`. With `lucky` now a path and absent from `msgs`, it takes the navigate branch.

- [ ] **Step 3: Route the entry in profile.js**

In `miniprogram/pages/profile/profile.js`, in the `onMenuItem` `actions` object (~L68) change `lucky: '__toast__'` to:

```js
lucky: '/pages/lucky-wheel/lucky-wheel',
```

Then **remove** the `lucky` entry from the `messages` object (~L74). profile is a non-tab page, so a path value is navigated via `wx.navigateTo`.

- [ ] **Step 4: Verify in WeChat DevTools**

Reload `miniprogram/` in DevTools. Tap the 幸运转盘 金刚区 icon on the main page → it should navigate to the wheel page (no toast). Same from the 我的 page entry if present.

- [ ] **Step 5: Commit**

```bash
git add miniprogram/app.json miniprogram/pages/main/main.js miniprogram/pages/profile/profile.js
git commit -m "feat(miniprogram): v1.2.0 接入幸运转盘入口(金刚区+我的页路由,移除占位toast)"
```

---

# End-to-End Verification (at the user-authorized deploy/QA step)

> These run only after the user authorizes push + deploy. Not part of commit-only implementation.

1. **Migration:** `deploy.py backend` runs `migrate_lucky_wheel.sql` (now in the hardcoded list). Confirm both tables exist and `balance_history.type` includes `'reward'`; `system_config` has the 4 `lucky_*` keys.
2. **Admin:** `pnpm build` + `deploy.py frontend`. Menu shows 幸运转盘 → 奖品管理 + 抽奖记录. Create one prize of each type (a coupon prize linked to a `free_redeem` template, a points prize, a balance prize, a thanks, an again). Save 抽奖规则.
3. **Mini program (real device):** wheel renders (conic-gradient works on device, not DevTools); first draw is free; after free used, points-paid draw deducts `pointsCost`; `再来一次` re-grants a spin without cost; daily hard cap blocks past `maxPerDay`. Coupon prize appears in 领券中心/我的优惠券; points/balance reflect in the respective ledgers; 中奖记录 lists draws.
4. **Server authority:** confirm the front-end cannot pick the outcome — the landing segment always matches the server `prizeId`.
5. **Production curl:** verify against apex `https://artaides.com` (NOT www). `GET /api/v1/lucky-wheel/config` with a bearer token returns segments; never weaken TLS.

---

## Notes for the implementer

- **COMMIT ONLY.** Every task ends at `git commit`. Do NOT `git push` and do NOT run `deploy.py`. Push & deploy are a separate, user-authorized step.
- **Stage only the named paths** in each commit — never `git add -A`/`git add .` (the 8 untracked root PNGs must stay unstaged).
- Backend has no integration test harness; `node --test` covers the pure logic (Task 2), `node --check` + `npm run dev` boot is the backend smoke gate, `pnpm build` is the admin gate, DevTools compile is the mini-program gate. Full request/animation behavior is verified at the end-to-end QA step.
- If `git push` is later authorized and hits the openssl `unexpected eof`/`missing close_notify` issue, retry once; switching `http.sslBackend` to openssl and bumping `http.postBuffer` are allowed — never `-k`/`sslVerify false`.
