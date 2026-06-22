# 幸运转盘（Lucky Wheel）模块 — 设计文档

**日期**：2026-06-22
**目标**：从零完善"幸运转盘"模块——小程序抽奖页 + 服务端抽奖机制 + 后台奖品/记录/规则管理。当前 `main.js`/`profile.js` 的 `onMenuItem` 中 `lucky` 仅弹"功能开发中"toast。
**架构**：服务端权威（server-authoritative）加权随机抽奖 + 关系表建模，复用现有优惠券发券、积分/余额账本、`FOR UPDATE`+CAS 库存、后台 CRUD 四套成熟模式，零新范式。
**技术栈**：miniprogram（WXML/WXSS/JS，CSS 旋转动画，无 canvas）、pizza-server（Express + MySQL + JWT）、soybean-admin（Vue3 + NaiveUI + elegant-router）。

---

## 已确认的产品决策

1. **抽奖机会来源**：每日免费 1 次（`DATE(created_at)=CURDATE()` 判定，无重置定时任务）+ 用完后花积分加抽（每次消耗积分后台可配，默认 50）。
2. **奖品类型**：全部支持 → 收敛为 5 种枚举 `coupon · points · balance · thanks · again`。"实物奖品"建模为一个 `coupon` 奖品挂一张 **免费兑换型券模板（free_redeem）**，核销复用优惠券现有 `available→used` 生命周期，**不另建核销表**。
3. **核心架构**：方案 1（服务端权威 + 关系表）。前端动画纯展示，结果与发放均由服务端在一个事务内完成（防作弊）。
4. **实物核销**：复用兑换券。

---

## Global Constraints（全局约束，每个实现任务都隐含遵守）

- **数据库**：MySQL `pizza`，`utf8mb4 / utf8mb4_unicode_ci`，`ENGINE=InnoDB`。新表进 `pizza-server/db/schema.sql`（`CREATE TABLE IF NOT EXISTS`）+ 增量迁移 `pizza-server/db/migrate_lucky_wheel.sql`。**生产 MySQL 不支持 `ADD COLUMN IF NOT EXISTS`，一律用普通 `ADD COLUMN`**（重复执行产生无害 Duplicate column 警告）；ENUM 改动用 `MODIFY COLUMN`。
- **deploy.py 迁移清单是硬编码的**（`soybean-admin-temp/deploy.py` 约 L49–60 的 `migrations=[...]`），**新迁移文件必须手动追加路径**，否则部署不执行。
- **前端动画绝不决定结果**：中奖奖品与 `segmentIndex` 都由服务端返回。
- **`utils/api.js` 在非 2xx 已自带中文 toast 并 reject**，小程序调用方 `.catch` 中**不得二次 toast**。
- **WXSS 禁用 `backdrop-filter`**（WeChat 切前台重栅格化闪屏）；用静态渐变 + inset 高光 + 投影的"假玻璃"。`rpx` 为主单位（750rpx=屏宽）。
- **新小程序页必须有 `.json`** 含 `"navigationStyle":"custom"` + `navigationBarTitleText`。
- **soybean-admin elegant-router 路由名必须全小写**并与目录生成名精确匹配，否则菜单重复；推荐 `pnpm gen-route` 自动生成 `imports/transform/typings`，仅手改 `routes/index.ts` 与 i18n。
- **Node ≥ v22.13** 构建 admin：`$env:PATH = "C:\Program Files\nodejs;" + $env:PATH`。
- **版本号 commit**（auto-commit-push 习惯）；**推送与部署是单独的、用户显式授权的步骤**，实现阶段默认只到带版本号 commit，不 push、不部署。

---

## 数据模型

### 新表 1：`lucky_wheel_prizes`（奖品 = 转盘格子）
```sql
CREATE TABLE IF NOT EXISTS lucky_wheel_prizes (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type               ENUM('coupon','points','balance','thanks','again') NOT NULL,
  name               VARCHAR(50)   NOT NULL,                 -- 格子文案
  weight             INT UNSIGNED  NOT NULL DEFAULT 1,        -- 中奖权重（相对概率）
  stock              INT UNSIGNED  NULL,                      -- 空=不限
  awarded_count      INT UNSIGNED  NOT NULL DEFAULT 0,
  coupon_template_id INT UNSIGNED  NULL,                      -- type=coupon 指向券模板(free_redeem即实物)
  points_amount      INT UNSIGNED  NULL,                      -- type=points
  balance_amount     DECIMAL(10,2) NULL,                      -- type=balance
  color              VARCHAR(16)   NULL,                      -- 扇区色
  icon               VARCHAR(255)  NULL,                      -- 可选图标 URL
  sort_order         INT           NOT NULL DEFAULT 0,
  is_active          TINYINT(1)    NOT NULL DEFAULT 1,
  created_at         DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (coupon_template_id) REFERENCES coupon_templates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```
> `coupon_template_id` 可空 + `ON DELETE SET NULL`：避免删券模板触发 FK 1451，且抽奖时对 NULL/失效模板降级为"谢谢参与"。

### 新表 2：`lucky_wheel_draws`（抽奖记录 = 次数账本）
```sql
CREATE TABLE IF NOT EXISTS lucky_wheel_draws (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id        INT UNSIGNED  NOT NULL,
  prize_id       INT UNSIGNED  NULL,
  prize_type     ENUM('coupon','points','balance','thanks','again') NOT NULL,  -- 快照
  prize_name     VARCHAR(50)   NOT NULL,                                        -- 快照
  source         ENUM('free','points','again') NOT NULL,   -- again=再来一次落点，不计免费/积分子额度
  cost_points    INT UNSIGNED  NOT NULL DEFAULT 0,
  coupon_id      INT UNSIGNED  NULL,                        -- 发放快照
  points_amount  INT           NULL,
  balance_amount DECIMAL(10,2) NULL,
  created_at     DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_date (user_id, created_at),
  FOREIGN KEY (user_id)  REFERENCES users(id)              ON DELETE CASCADE,
  FOREIGN KEY (prize_id) REFERENCES lucky_wheel_prizes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 改表：`balance_history.type` 增加 `reward` 档
```sql
ALTER TABLE balance_history
  MODIFY COLUMN type ENUM('recharge','deduct','refund','reward') NOT NULL;
```
转盘发余额记 `type='reward'`、`remark='幸运转盘中奖'`。

### 配置（存 `system_config` 键值，沿用现有 4 组键值模式）
| key | 默认 | 含义 |
|---|---|---|
| `lucky_enabled` | `1` | 转盘总开关 |
| `lucky_free_per_day` | `1` | 每日免费次数 |
| `lucky_points_cost` | `50` | 加抽每次消耗积分 |
| `lucky_max_per_day` | `10` | 每日总次数硬上限（防刷，含免费+积分+再来） |

读取：`luckyWheelService` 内小 helper `getLuckyConfig()` 一次性 `SELECT config_key,config_value FROM system_config WHERE config_key IN (...)`，缺省回退上表默认值。写入：后台"抽奖规则"卡 `INSERT ... ON DUPLICATE KEY UPDATE`（UPSERT，键自动创建）。

---

## 后端抽奖引擎（pizza-server）

### 复用的现成函数（探查已确认）
- **发券**：`couponClaimService.mintCouponFromTemplate(conn, tpl, userId, source)`（`src/services/couponClaimService.js:21-37`，事务感知，返回 `couponId`）；`couponClaimService.rowToTpl(row)`（`:40-47`，snake→camel）；非事务取模板 `couponTemplateService.findById(id)`（camelCase）。
- **并发模板**：`couponClaimService.claim`（`:94-144`，`SELECT ... FOR UPDATE` + `UPDATE ... WHERE awarded_count<total_stock` 的 CAS + `affectedRows` 检查）——逐行镜像。
- **加积分**（内联）：`UPDATE users SET points = points + ? WHERE id=?` + `INSERT INTO points_history (user_id, points_change, balance_after, reason, reference_id) VALUES (?,?,?,?,?)`（参考 `orderController.js:233-257`）。
- **加余额**（内联）：`UPDATE users SET balance = ? WHERE id=?` + `INSERT INTO balance_history (user_id, amount, balance_after, type, remark) VALUES (?,?,?,'reward',?)`（参考 `refundService.js:93-98` 的纯加余额，不动 `total_spent`/tier）。

### 抽奖事务 `POST /lucky-wheel/draw  { source:'free'|'points' }`
```
 1. getLuckyConfig(); lucky_enabled=0 → 403 "活动未开始"
 2. conn=getConnection; beginTransaction
 3. SELECT id,points,balance FROM users WHERE id=? FOR UPDATE      (锁单用户，串行其抽奖)
 4. 今日统计：SELECT COUNT(*) total, SUM(source='free') freeCnt
    FROM lucky_wheel_draws WHERE user_id=? AND DATE(created_at)=CURDATE()
 5. 硬上限：total >= max_per_day → rollback，拒"今日次数已用完"
 6. 资格：
    source='free'   → 需 freeCnt < free_per_day，否则拒"今日免费次数已用完"
    source='points' → 需 user.points >= points_cost，否则拒"积分不足"
 7. 选奖（加权随机 + CAS 兜底）：
    pool = SELECT * FROM lucky_wheel_prizes
           WHERE is_active=1 AND (stock IS NULL OR awarded_count<stock) ORDER BY sort_order,id
    pool 为空 → rollback，优雅返回"今日奖品已抽完"（不扣费）
    循环：按 weight 加权随机选 winner
      若 winner.stock 不限 → 直接选定
      否则 CAS：UPDATE lucky_wheel_prizes SET awarded_count=awarded_count+1
                WHERE id=? AND awarded_count<stock
           affectedRows=1 → 选定；=0（并发抢光）→ 从 pool 移除该奖品重抽
      pool 抽空仍未选定 → 优雅返回"今日奖品已抽完"（不扣费）
 8. 命中处理：
    winner.type='again'：
        source='again'，cost=0，不扣分、不计免费/积分子额度（但第 4 步 total 已含它→受硬上限约束）
        bonusSpin=true（前端可立即再抽）
    其余且 source='points'：UPDATE users SET points=points-cost；
        INSERT points_history(points_change=负cost, balance_after, reason='幸运转盘加抽', reference_id='')
 9. 发奖（winner.type）：
    coupon  → 取券模板(coupon_template_id)；模板缺失/未启用 → 降级 type=thanks（不 500）；
              否则 mintCouponFromTemplate(conn, rowToTpl(模板行), userId, 'lucky_wheel') → coupon_id
    points  → UPDATE users points+=points_amount；INSERT points_history(正,'幸运转盘中奖')
    balance → UPDATE users balance+=balance_amount；INSERT balance_history('reward','幸运转盘中奖')
    thanks  → 不发
10. INSERT lucky_wheel_draws（快照：prize_id/type/name、source、cost_points、coupon_id/points/balance）
11. commit；异常 rollback；finally release
12. 返回 { prizeId, segmentIndex, type, name, awardText, bonusSpin,
            userPoints, balanceText, freeRemaining, drawsRemaining }
```
- **`segmentIndex`**：服务端按 `is_active=1 ORDER BY sort_order,id` 的**同一顺序**（与 `GET /lucky-wheel` 返回的 `segments` 一致）算出中奖格下标返回。
- 扣分顺序：先选奖（含 again 判定）再扣分，避免命中 again 还要退分。

### API 契约

**用户端** — 新文件 `src/routes/luckyWheel.js`（`router.use(auth)`），`app.js` 挂 `app.use('/api/v1/lucky-wheel', require('./routes/luckyWheel'))`；控制器 `src/controllers/luckyWheelController.js`（瘦，`res.json({code:0,data})`）；服务 `src/services/luckyWheelService.js`。
- `GET /lucky-wheel` → `{ enabled, segments:[{id,type,name,color,icon}], pointsCost, freeRemaining, drawsRemaining, userPoints }`
- `POST /lucky-wheel/draw  {source}` → 见上第 12 步（body 校验加进 `middleware/validation.js` 的 `luckyDraw`：`source` ∈ {free,points}）
- `GET /lucky-wheel/my-records?page&limit` → `{ list:[{id,prizeName,prizeType,source,costPoints,createdAt}], total }`

**后台** — 方法加进 `src/controllers/adminApiController.js`，路由注册进 `src/routes/adminApi.js`（在 `router.use(auth, adminOnly)` 之后），服务复用 `luckyWheelService.js` 的 admin 方法。统一 `/api/v1/admin/lucky-wheel/*`：
- `GET /prizes`、`POST /prizes`、`GET /prizes/:id`、`PUT /prizes/:id`、`DELETE /prizes/:id`（硬删；`draws.prize_id` 经 `ON DELETE SET NULL` 自动置空，不触发 1451；控制器仍对意外 1451 兜底 400）、`PUT /prizes/:id/toggle`
- `GET /records?page&limit` → 分页，JOIN users 带昵称/手机
- `GET /config`、`PUT /config`（4 个 lucky_* 键，UPSERT）

---

## 小程序转盘页（miniprogram）

### 新页 `pages/lucky-wheel/lucky-wheel.{js,json,wxml,wxss}`
- **注册**：`app.json` `pages` 数组追加 `"pages/lucky-wheel/lucky-wheel"`。
- **入口路由**：`pages/main/main.js`（onMenuItem routes 表，约 L684）`lucky:'__toast__'` → `lucky:'/pages/lucky-wheel/lucky-wheel'`；`pages/profile/profile.js`（actions 表，约 L68）同改。两处都改（共用 `tpl-profile.wxml` 的金刚区格子）。可顺手清掉两处 `msgs/messages` 里失效的 `lucky:` 键。
- **`.json`**：`{"navigationStyle":"custom","navigationBarTitleText":"幸运转盘","usingComponents":{}}`。
- **顶栏**：`require('../../utils/layout')` 的 `getBackBtnTopBar()`（带返回键），`onLoad` `this.setData(getBackBtnTopBar())`。
- **API**：`require('../../utils/api')` 的 `api.get('/lucky-wheel')` / `api.post('/lucky-wheel/draw',{source})` / `api.get('/lucky-wheel/my-records')`。

### 页面布局
```
‹  幸运转盘
        ▼                        固定指针(顶部)
     转盘圆盘(conic-gradient整体旋转)，中心=抽奖按钮
今日免费 1/1 · 加抽 -50积分
我的积分 1280 · 今日剩 9 次
🏆 我的中奖记录 ›                上滑抽屉 overlay+drawer 列 my-records
奖品一览 · 活动规则
```

### 渲染与动画（无 canvas）
- 圆盘 `.wheel`：`conic-gradient` 按扇区数上色 + 各标签 `<view>` 绝对定位、`transform: rotate(段角*i)` 摆放；扇区色在 `--color-primary #C0563A` / `--color-secondary #FFF292` / `--color-tertiary #A0FF92` / 奶油 间交替。
- 整盘旋转：内联 `style="transform: rotate({{wheelRotate}}deg)"`，`.wheel{transition: transform 4.2s cubic-bezier(0.17,0.67,0.32,1.34)}`。
- 指针固定顶部；中心抽奖按钮用 `.btn-primary` 风格圆帽。
- 暖陶土风，**无 backdrop-filter**。后台建议启用 6 或 8 格最匀；页面对任意 ≥2 格优雅降级。

### 抽奖交互
1. onLoad → `getBackBtnTopBar()` + `GET /lucky-wheel` 渲染扇区与状态。
2. 点中心：`spinning` 单飞锁（镜像 claim-center `onClaim`）。`freeRemaining>0`→source=free；否则 `userPoints>=pointsCost && drawsRemaining>0`→`wx.showModal` 确认"消耗 N 积分加抽?"→source=points；否则 toast 终止。
3. `spinning=true` → `POST /lucky-wheel/draw {source}`。
4. 成功：用 `segmentIndex` 算目标角度（累加，只增不减，正向多圈：`wheelRotate += base*360 + (360 - (idx*段角 + 段角/2) - 当前模360)`）→ setData 触发过渡 → `setTimeout(4200)` 后弹结果弹窗。
5. 结果弹窗（玻璃卡）：恭喜获得 X / 谢谢参与 / 再来一次；按钮"知道了"，券类加"去查看"跳 `/pages/coupons/coupons`。`bonusSpin` 时按钮保持可点、提示"再来一次！"。
6. 用返回 `userPoints/balanceText/freeRemaining/drawsRemaining` 刷新状态条，并同步 `app.globalData.userInfo.points/balance`（返回后"我的"钱包即新）。
7. 失败：api.js 已 toast，`.catch` 仅 `setData({spinning:false})`，不二次 toast；动画结束统一解锁。

### 边界
- 开关关 → "活动未开始"、按钮禁用。
- 奖池空/抽光 → "今日奖品已抽完"，不扣费、不转。
- 积分不足 / 达硬上限 → toast，不转。

---

## 后台两页（soybean-admin-temp）

### 镜像 coupon-templates 的 list + form 拆分
- **`src/views/luckyWheel/prizes/list/index.vue`**：`<NCard>` + `#header-extra` "新建奖品"按钮 + `<NDataTable>`。列：文案 / 类型(`NTag` map) / 权重 / 库存(`已发/总`，null→∞) / 发放内容(券名|+积分|+余额) / 启用(`NSwitch`→toggle) / 操作(编辑 `router.push(.../:id/edit)`、删除 `dialog.warning`)。顶部额外一张**"抽奖规则"卡**：4 个 `NInputNumber`/`NSwitch`（enabled/free_per_day/points_cost/max_per_day），保存 `PUT /lucky-wheel/config`。
- **`src/views/luckyWheel/prizes/form/index.vue`**：建/编同文件（`route.params.id` 判模式）。字段：`name`(NInput)、`type`(NSelect：coupon/points/balance/thanks/again)、`weight`(NInputNumber)、`stock`(NInputNumber，空=不限)、**条件字段** `v-if`：coupon→券模板(NSelect，选项来自 `fetchCouponTemplates()`)、points→积分数、balance→余额数；`color`(NColorPicker)、`icon`(`components/common/ImageUpload.vue`)、`sort_order`、`is_active`(NSwitch)。保存校验：coupon 类型必须选了存在且启用的券模板。
- **`src/views/luckyWheel/records/index.vue`**：只读分页（镜像 `payments/list`）。列：时间 / 用户(昵称·手机) / 来源(免费|积分|再来) / 中奖(prizeName) / 消耗积分。

### 服务与路由
- 新文件 `src/service/api/luckyWheel.ts`：接口 `Prize`/`DrawRecord`/`DrawRecordListResult`/`LuckyConfig` + `fetchPrizes/fetchPrize/fetchCreatePrize/fetchUpdatePrize/fetchDeletePrize/fetchTogglePrize/fetchDrawRecords/fetchLuckyConfig/fetchUpdateLuckyConfig`，URL 形如 `/lucky-wheel/prizes`（`request` 自动前缀 `/api/v1/admin`）。`src/service/api/index.ts` barrel `export * from './luckyWheel';`。
- 菜单分组（镜像 coupons）：父级 `luckywheel`(layout.base) → 中间级 `luckywheel_prizes`(layout.base) → `luckywheel_prizes_list`/`luckywheel_prizes_create`(hideInMenu)/`luckywheel_prizes_edit`(props,hideInMenu)；叶子 `luckywheel_records`。
- 流程：先建 3 个 view 文件 → `pnpm gen-route` 自动生成 `imports.ts/transform.ts/elegant-router.d.ts` → 手改 `src/router/routes/index.ts`（customRoutes 块，名全小写）+ `src/locales/langs/zh-cn.ts`/`en-us.ts`（route 段文案）。

---

## 错误处理 / 并发正确性
- coupon 奖品券模板被删（`coupon_template_id` SET NULL）：后台保存即校验存在+启用；抽奖时模板失效 → 降级 thanks，绝不 500。
- 奖池空/库存抽光 → 优雅文案，不扣费。**建议运营至少保留 1 个不限量"谢谢参与"做兜底**，奖池永不空。
- 并发：单用户 `SELECT users FOR UPDATE` 串行其并发抽奖；奖品库存 `UPDATE ... WHERE awarded_count<stock` + `affectedRows` CAS 防超发；扣分在同锁内防双花。
- 删奖品的父删守卫：若 `lucky_wheel_draws.prize_id` 引用，靠 `ON DELETE SET NULL` 化解；控制器对 1451 兜底返回 400。

---

## 测试

**后端**：`node --check` 三个新文件；`npm run dev` 冒烟启动（Node v24）。手测：
- 免费抽一次后 `freeRemaining=0`；积分抽验证 `points` 扣减 + `points_history` 负行；
- 中 coupon → 出现在 `GET /coupons`；中 points/balance → 账本正行；中 thanks → 不发；中 again → `source='again'`、不扣分、可立即再抽；
- 库存=1 的奖品抽中后 `awarded_count=stock` 并从后续池剔除；
- 达 `max_per_day` 拒绝；`lucky_enabled=0` 时 `GET` 返回 `enabled:false`；
- 并发：两请求快速连发，库存=1 的奖品只发一次。

**小程序**：DevTools 重编译；转盘落点 == 返回 `segmentIndex`；结果弹窗、状态刷新、bonus 再抽、券类跳转 `/coupons`；金刚区"幸运转盘"进入新页。

**后台**：`pnpm build` 绿；奖品 CRUD + toggle + "抽奖规则"保存 + 记录分页。

---

## 部署（单独的、用户显式授权步骤；实现阶段不执行）
1. 后端：`schema.sql` 加两表；`pizza-server/db/migrate_lucky_wheel.sql`（两 CREATE TABLE IF NOT EXISTS + balance_history MODIFY）；**把该迁移路径追加进 `soybean-admin-temp/deploy.py` 硬编码 `migrations` 清单**；`python soybean-admin-temp/deploy.py backend`。
2. 后台：`$env:PATH=...nodejs;` → `pnpm gen-route` → `pnpm build` → `python soybean-admin-temp/deploy.py frontend`。
3. 小程序：用户在微信开发者工具上传新版本 → 提交审核 → 发布。

---

## 变更总览
| 子项目 | 文件 |
|---|---|
| **pizza-server** | 新建 `routes/luckyWheel.js`、`controllers/luckyWheelController.js`、`services/luckyWheelService.js`、`db/migrate_lucky_wheel.sql`；改 `db/schema.sql`(两表+balance_history ENUM)、`app.js`(挂载)、`routes/adminApi.js`(admin 路由)、`controllers/adminApiController.js`(admin 方法)、`middleware/validation.js`(luckyDraw schema) |
| **miniprogram** | 新建 `pages/lucky-wheel/lucky-wheel.{js,json,wxml,wxss}`；改 `app.json`、`pages/main/main.js`、`pages/profile/profile.js` |
| **soybean-admin** | 新建 `views/luckyWheel/prizes/list/index.vue`、`views/luckyWheel/prizes/form/index.vue`、`views/luckyWheel/records/index.vue`、`service/api/luckyWheel.ts`；改 `service/api/index.ts`、`router/routes/index.ts`、`locales/langs/{zh-cn,en-us}.ts`（`imports.ts`/`transform.ts`/`elegant-router.d.ts` 由 `pnpm gen-route` 重生） |
