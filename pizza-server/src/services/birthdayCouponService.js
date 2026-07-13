/**
 * 生日券自动发放服务
 *
 * 每天 8:00 执行：查询当天生日的用户 → 按会员等级发放固定金额券 → 标记已领取。
 * 每年只发一次（birthday_claimed_year 防重复）。
 */
const pool = require('../config/database');
const userService = require('./userService');
const memberTierService = require('./memberTierService');
const { createLogger } = require('../utils/logger');
const log = createLogger('BirthdayCoupon');

const BIRTHDAY_COUPON_VALID_DAYS = 30; // 生日券有效期（天）

const birthdayCouponService = {

  /** 主入口：为所有当天生日且未领取的用户发放生日券 */
  async issueDaily() {
    const users = await userService.findTodayBirthdayUsers();
    if (!users.length) return { issued: 0 };

    const tiers = await memberTierService.getActive();
    const today = new Date();
    const year = today.getFullYear();

    // 计算有效期
    const validFrom = today.toISOString().slice(0, 10);
    const validToDate = new Date(today);
    validToDate.setDate(validToDate.getDate() + BIRTHDAY_COUPON_VALID_DAYS);
    const validTo = validToDate.toISOString().slice(0, 10);

    let issued = 0;
    for (const user of users) {
      try {
        // 确定用户的会员等级对应的生日券金额
        const tier = tiers.find(t => t.levelKey === user.member_level) || tiers[tiers.length - 1];
        const couponValue = tier ? (tier.birthdayCouponValue || 0) : 0;

        if (couponValue <= 0) {
          log.warn({ userId: user.id, memberLevel: user.member_level }, 'Birthday coupon skipped: coupon_value is 0');
          continue;
        }

        const code = `BDAY-${year}-${String(user.id).padStart(6, '0')}`;

        // 检查是否已发过（幂等保护）
        const [existing] = await pool.query(
          "SELECT id FROM coupons WHERE user_id = ? AND code = ? AND source = 'birthday'",
          [user.id, code]
        );
        if (existing.length) continue; // 已发放，跳过

        await pool.query(
          `INSERT INTO coupons
             (user_id, name, \`desc\`, category, \`value\`, status, code,
              discount_type, discount_value, min_spend, valid_from, valid_to, source, color)
           VALUES (?, ?, ?, 'discount', ?, 'available', ?,
                   'fixed_amount', ?, 0, ?, ?, 'birthday', '#D32F2F')`,
          [
            user.id,
            '生日专享券',
            `生日快乐！🎂 会员专属生日福利`,
            `${couponValue}元生日券`,
            code,
            couponValue,
            validFrom,
            validTo,
          ]
        );

        // 标记本年度已领取
        await userService.markBirthdayClaimed(user.id, year);
        issued++;
        log.info({ userId: user.id, couponValue, code }, 'Birthday coupon issued');
      } catch (err) {
        log.error({ err, userId: user.id }, 'Failed to issue birthday coupon');
      }
    }

    if (issued > 0) log.info({ issued, total: users.length }, 'Birthday coupon batch complete');
    return { issued, total: users.length };
  },

};

module.exports = birthdayCouponService;
