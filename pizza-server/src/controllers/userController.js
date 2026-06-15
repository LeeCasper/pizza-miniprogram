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
};

module.exports = userController;
