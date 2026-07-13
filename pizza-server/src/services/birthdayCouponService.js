/**
 * 生日券自动发放服务
 *
 * 每天 8:00 执行：查询当天生日的用户 → 按会员等级配置发放优惠券 → 标记已领取。
 * 每年只发一次（birthday_claimed_year 防重复）。
 *
 * 生日券配置（来自 member_tiers）：
 *   birthday_coupon_value      — 券面额/折扣率
 *   birthday_coupon_type       — fixed_amount | percentage
 *   birthday_coupon_min_spend  — 最低消费门槛
 *   birthday_coupon_valid_days — 有效天数
 */
const pool = require('../config/database');
const userService = require('./userService');
const memberTierService = require('./memberTierService');
const { createLogger } = require('../utils/logger');
const log = createLogger('BirthdayCoupon');

const birthdayCouponService = {

  /** 主入口：为所有当天生日且未领取的用户发放生日券 */
  async issueDaily() {
    const users = await userService.findTodayBirthdayUsers();
    if (!users.length) return { issued: 0 };

    const tiers = await memberTierService.getActive();
    const today = new Date();
    const year = today.getFullYear();

    let issued = 0;
    for (const user of users) {
      try {
        const tier = tiers.find(t => t.levelKey === user.member_level) || tiers[tiers.length - 1];
        if (!tier || !tier.birthdayCouponValue || tier.birthdayCouponValue <= 0) {
          log.info({ userId: user.id, memberLevel: user.member_level }, 'Birthday skipped: no coupon configured');
          continue;
        }

        const code = `BDAY-${year}-${String(user.id).padStart(6, '0')}`;

        // 幂等保护
        const [existing] = await pool.query(
          "SELECT id FROM coupons WHERE user_id = ? AND code = ? AND source = 'birthday'",
          [user.id, code]
        );
        if (existing.length) continue;

        const couponType = tier.birthdayCouponType || 'fixed_amount';
        const couponValue = tier.birthdayCouponValue;
        const minSpend = tier.birthdayCouponMinSpend || 0;
        const validDays = tier.birthdayCouponValidDays || 30;

        const validFrom = today.toISOString().slice(0, 10);
        const validToDate = new Date(today);
        validToDate.setDate(validToDate.getDate() + validDays);
        const validTo = validToDate.toISOString().slice(0, 10);

        const typeLabel = couponType === 'percentage' ? `${couponValue}折` : `¥${couponValue}`;
        const desc = `生日快乐！🎂 ${tier.name}专属生日福利`;

        await pool.query(
          `INSERT INTO coupons
             (user_id, name, \`desc\`, category, \`value\`, status, code,
              discount_type, discount_value, min_spend, valid_from, valid_to, source, color)
           VALUES (?, ?, ?, 'discount', ?, 'available', ?,
                   ?, ?, ?, ?, ?, 'birthday', '#D32F2F')`,
          [
            user.id,
            '生日专享券',
            desc,
            `${typeLabel}生日券`,
            code,
            couponType,
            couponValue,
            minSpend,
            validFrom,
            validTo,
          ]
        );

        await userService.markBirthdayClaimed(user.id, year);
        issued++;
        log.info({ userId: user.id, tier: tier.name, couponType, couponValue, minSpend, validDays }, 'Birthday coupon issued');
      } catch (err) {
        log.error({ err, userId: user.id }, 'Failed to issue birthday coupon');
      }
    }

    if (issued > 0) log.info({ issued, total: users.length }, 'Birthday coupon batch complete');
    return { issued, total: users.length };
  },

};

module.exports = birthdayCouponService;
