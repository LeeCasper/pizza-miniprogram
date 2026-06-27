const userService = require('../services/userService');
const { computeTier } = require('../utils/memberTier');
const memberTierService = require('../services/memberTierService');

const userController = {
  async getMemberTiers(req, res, next) {
    try {
      const tiers = await memberTierService.getActive();
      return res.json({ code: 0, data: tiers });
    } catch (err) {
      next(err);
    }
  },

  async getProfile(req, res, next) {
    try {
      const user = await userService.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ code: 404, message: '用户不存在' });
      }
      const tier = await computeTier(parseFloat(user.total_spent || 0));
      res.json({
        code: 0,
        data: {
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          memberLevel: user.member_level,
          memberId: String(user.id).padStart(6, '0'),
          points: user.points,
          totalSpent: parseFloat(user.total_spent || 0),
          coupons: 0,
          cardCount: 0,
          balance: parseFloat(user.balance),
          bio: user.bio,
          phone: user.phone || '',
          birthday: user.birthday
            ? (user.birthday instanceof Date
              ? user.birthday.toISOString().slice(0, 10)
              : String(user.birthday).slice(0, 10))
            : null,
          tier,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async updateProfile(req, res, next) {
    try {
      const user = await userService.updateProfile(req.user.id, req.body);
      res.json({ code: 0, data: user, message: '保存成功' });
    } catch (err) {
      next(err);
    }
  },

  async getSettings(req, res, next) {
    try {
      const settings = await userService.getSettings(req.user.id);
      res.json({ code: 0, data: settings });
    } catch (err) {
      next(err);
    }
  },

  async updateSettings(req, res, next) {
    try {
      await userService.updateSettings(req.user.id, req.body);
      const settings = await userService.getSettings(req.user.id);
      res.json({ code: 0, data: settings, message: '保存成功' });
    } catch (err) {
      next(err);
    }
  },

  async recharge(req, res, next) {
    try {
      const { amount } = req.body;
      const amt = parseFloat(amount);
      if (!amt || amt <= 0) {
        return res.status(400).json({ code: 400, message: '充值金额无效' });
      }
      if (amt > 5000) {
        return res.status(400).json({ code: 400, message: '单次充值上限¥5000' });
      }
      const result = await userService.rechargeBalance(req.user.id, amt, req.body.remark);
      res.json({ code: 0, data: result, message: '充值成功' });
    } catch (err) {
      next(err);
    }
  },

  async getBalanceHistory(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const result = await userService.getBalanceHistory(req.user.id, page, limit);
      res.json({ code: 0, data: result });
    } catch (err) {
      next(err);
    }
  },

  async deleteAccount(req, res, next) {
    try {
      await userService.deleteAccount(req.user.id);
      res.json({ code: 0, message: '账号已注销' });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ code: err.statusCode, message: err.message });
      }
      next(err);
    }
  },
};

module.exports = userController;
