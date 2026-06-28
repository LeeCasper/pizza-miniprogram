const userService = require('../services/userService');
const defaultAvatarService = require('../services/defaultAvatarService');
const cuteNames = require('../utils/cuteNames');
const { code2session, getPhoneNumber } = require('../utils/wechat');
const { signToken } = require('../utils/jwt');
const { computeTier } = require('../utils/memberTier');

const authController = {
  async login(req, res, next) {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ code: 400, message: '缺少登录凭证' });
      }

      let openid, sessionKey, unionid;
      try {
        const result = await code2session(code);
        openid = result.openid;
        sessionKey = result.sessionKey;
        unionid = result.unionid;
      } catch (err) {
        // In dev mode without real WeChat secret, use code as openid
        if (process.env.NODE_ENV === 'development') {
          openid = 'dev_' + code.substring(0, 20);
          sessionKey = 'dev_session';
        } else {
          throw err;
        }
      }

      let user = await userService.findByOpenid(openid);
      if (!user) {
        user = await userService.create({ openid, unionid, sessionKey });
        // 新用户：分配随机默认头像和昵称
        const randomAvatar = await defaultAvatarService.getRandom();
        if (randomAvatar) {
          await userService.updateAvatar(user.id, randomAvatar);
          user.avatar = randomAvatar;
        }
        const randomName = cuteNames.getRandom();
        await userService.updateName(user.id, randomName);
        user.name = randomName;
      } else {
        await userService.updateSession(user.id, sessionKey);
        // 已有用户缺少头像/昵称 → 补分配默认值
        if (!user.avatar) {
          const randomAvatar = await defaultAvatarService.getRandom();
          if (randomAvatar) {
            await userService.updateAvatar(user.id, randomAvatar);
            user.avatar = randomAvatar;
          }
        }
        if (!user.name) {
          const randomName = cuteNames.getRandom();
          await userService.updateName(user.id, randomName);
          user.name = randomName;
        }
      }

      const token = signToken({ sub: user.id, role: user.role });
      const tier = await computeTier(parseFloat(user.total_spent || 0));

      res.json({
        code: 0,
        data: {
          token,
          user: {
            id: user.id,
            name: user.name,
            avatar: user.avatar,
            memberLevel: user.member_level,
            memberId: String(user.id).padStart(6, '0'),
            points: user.points,
            totalSpent: parseFloat(user.total_spent || 0),
            coupons: 0, // populated separately
            cardCount: 0,
            balance: parseFloat(user.balance),
            bio: user.bio,
            phone: user.phone || '',
            birthday: user.birthday,
            tier,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async bindPhone(req, res, next) {
    try {
      const { code, avatar: clientAvatar, name: clientName } = req.body;
      if (!code) {
        return res.status(400).json({ code: 400, message: '缺少手机号凭证' });
      }

      let phone;
      try {
        const result = await getPhoneNumber(code);
        phone = result.purePhoneNumber || result.phoneNumber;
      } catch (err) {
        // 开发环境用 code 模拟手机号，方便调试
        if (process.env.NODE_ENV === 'development') {
          phone = code.replace(/\D/g, '').slice(0, 11) || '13800138000';
        } else {
          throw err;
        }
      }

      await userService.updatePhone(req.user.id, phone);

      // 头像/昵称：客户端传了就用，否则随机默认
      const user = await userService.findById(req.user.id);
      let avatar = user.avatar || '';
      let name = user.name || '';
      if (clientAvatar) {
        await userService.updateAvatar(req.user.id, clientAvatar);
        avatar = clientAvatar;
      } else if (!avatar) {
        const randomAvatar = await defaultAvatarService.getRandom();
        if (randomAvatar) {
          await userService.updateAvatar(req.user.id, randomAvatar);
          avatar = randomAvatar;
        }
      }
      if (clientName) {
        await userService.updateName(req.user.id, clientName);
        name = clientName;
      } else if (!name) {
        const randomName = cuteNames.getRandom();
        await userService.updateName(req.user.id, randomName);
        name = randomName;
      }

      res.json({
        code: 0,
        data: { phone, avatar, name },
        message: '手机号绑定成功',
      });
    } catch (err) {
      next(err);
    }
  },

  async logout(req, res) {
    res.json({ code: 0, message: '已退出' });
  },
};

module.exports = authController;
