/**
 * 生日券自动发放服务
 *
 * 每天 8:00 执行：查询当天生日的用户 → 按会员等级发放两张券 → 标记已领取。
 * 每年只发一次（birthday_claimed_year 防重复）。
 *
 * 券1 — 无门槛券：birthday_coupon_* 字段
 * 券2 — 满减券：  birthday_coupon2_* 字段
 * 两张券 source 均为 'birthday'，同一订单仅可使用一张。
 */
const pool = require('../config/database');
const userService = require('./userService');
const memberTierService = require('./memberTierService');
const { createLogger } = require('../utils/logger');
const log = createLogger('BirthdayCoupon');

const birthdayCouponService = {

  /**
   * 为单个用户发放生日券（幂等：同一年只发一次）。
   * 返回 { issued: number, coupons: string[] }。
   * 用于：首次设置生日即当天 + 定时任务批量发放 + 管理员手动触发。
   */
  async issueForUser(userId) {
    const user = await userService.findById(userId);
    if (!user || !user.birthday) return { issued: 0, coupons: [] };

    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    // 检查今天是否为该用户生日
    const bd = typeof user.birthday === 'string' ? user.birthday : String(user.birthday).slice(0, 10);
    const parts = bd.split('-');
    if (parseInt(parts[1], 10) !== month || parseInt(parts[2], 10) !== day) {
      return { issued: 0, coupons: [] };
    }

    const year = today.getFullYear();

    // 幂等保护
    const [existing] = await pool.query(
      "SELECT id FROM coupons WHERE user_id = ? AND source = 'birthday' AND code LIKE ?",
      [userId, `BDAY-${year}-%`]
    );
    if (existing.length) return { issued: 0, coupons: [] };

    const tiers = await memberTierService.getActive();
    const tier = tiers.find(t => t.levelKey === user.member_level) || tiers[tiers.length - 1];
    if (!tier) return { issued: 0, coupons: [] };

    const coupons = [];

    // 券1：无门槛券
    if (tier.birthdayCouponValue && tier.birthdayCouponValue > 0) {
      coupons.push({
        code: `BDAY-${year}-${String(userId).padStart(6, '0')}-1`,
        name: '生日专享券',
        desc: `生日快乐！🎂 ${tier.name}专属无门槛券`,
        valueLabel: tier.birthdayCouponType === 'percentage' ? `${tier.birthdayCouponValue}折` : `¥${tier.birthdayCouponValue}`,
        discountType: tier.birthdayCouponType || 'fixed_amount',
        discountValue: tier.birthdayCouponValue,
        minSpend: 0,
        validDays: tier.birthdayCouponValidDays || 30,
        color: '#D32F2F',
      });
    }

    // 券2：满减券
    if (tier.birthdayCoupon2Value && tier.birthdayCoupon2Value > 0) {
      coupons.push({
        code: `BDAY-${year}-${String(userId).padStart(6, '0')}-2`,
        name: '生日满减券',
        desc: `生日快乐！🎂 ${tier.name}专属满减券`,
        valueLabel: tier.birthdayCoupon2Type === 'percentage' ? `${tier.birthdayCoupon2Value}折` : `¥${tier.birthdayCoupon2Value}`,
        discountType: tier.birthdayCoupon2Type || 'fixed_amount',
        discountValue: tier.birthdayCoupon2Value,
        minSpend: tier.birthdayCoupon2MinSpend || 0,
        validDays: tier.birthdayCoupon2ValidDays || 30,
        color: '#E65100',
      });
    }

    if (coupons.length === 0) {
      log.info({ userId }, 'Birthday skipped: no coupons configured for tier');
      return { issued: 0, coupons: [] };
    }

    for (const c of coupons) {
      const validFrom = today.toISOString().slice(0, 10);
      const validToDate = new Date(today);
      validToDate.setDate(validToDate.getDate() + c.validDays);
      const validTo = validToDate.toISOString().slice(0, 10);

      await pool.query(
        `INSERT INTO coupons
           (user_id, name, \`desc\`, category, \`value\`, status, code,
            discount_type, discount_value, min_spend, valid_from, valid_to, source, color)
         VALUES (?, ?, ?, 'discount', ?, 'available', ?, ?, ?, ?, ?, ?, 'birthday', ?)`,
        [userId, c.name, c.desc, `${c.valueLabel}生日券`, c.code,
         c.discountType, c.discountValue, c.minSpend, validFrom, validTo, c.color]
      );
    }

    await userService.markBirthdayClaimed(userId, year);
    log.info({ userId, tier: tier.name, couponCount: coupons.length }, 'Birthday coupons issued (single user)');
    return { issued: 1, coupons: coupons.map(c => c.name) };
  },

  async issueDaily() {
    const users = await userService.findTodayBirthdayUsers();
    if (!users.length) return { issued: 0 };

    let issued = 0;
    for (const user of users) {
      try {
        const result = await this.issueForUser(user.id);
        if (result.issued) issued++;
      } catch (err) {
        log.error({ err, userId: user.id }, 'Failed to issue birthday coupons');
      }
    }

    if (issued > 0) log.info({ issued, total: users.length }, 'Birthday coupon batch complete');
    return { issued, total: users.length };
  },

};

module.exports = birthdayCouponService;
