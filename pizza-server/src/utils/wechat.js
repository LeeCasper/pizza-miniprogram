const axios = require('axios');
const config = require('../config');

async function code2session(code) {
  const { data } = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
    params: {
      appid: config.wx.appId,
      secret: config.wx.secret,
      js_code: code,
      grant_type: 'authorization_code',
    },
  });

  if (data.errcode) {
    const err = new Error(`WeChat API error: ${data.errmsg}`);
    err.code = data.errcode;
    throw err;
  }

  return {
    openid: data.openid,
    sessionKey: data.session_key,
    unionid: data.unionid || null,
  };
}

// ── Access Token 缓存 ──────────────────────────

let accessTokenCache = { token: null, expiresAt: 0 };

/**
 * 获取/缓存微信公众号 access_token（2h 有效期，提前 5min 刷新）
 * 用于 getPhoneNumber 等需要服务端调用的微信 API
 */
async function getAccessToken() {
  const now = Date.now();
  if (accessTokenCache.token && now < accessTokenCache.expiresAt) {
    return accessTokenCache.token;
  }

  const { data } = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
    params: {
      grant_type: 'client_credential',
      appid: config.wx.appId,
      secret: config.wx.secret,
    },
  });

  if (data.errcode) {
    const err = new Error(`getAccessToken error: ${data.errmsg}`);
    err.code = data.errcode;
    throw err;
  }

  accessTokenCache = {
    token: data.access_token,
    expiresAt: now + (data.expires_in - 300) * 1000, // 提前 5 分钟刷新
  };

  return accessTokenCache.token;
}

/**
 * 用微信手机号授权码换取手机号
 * @param {string} code - getPhoneNumber 按钮回调返回的 code
 * @returns {{ phoneNumber: string, purePhoneNumber: string, countryCode: string }}
 */
async function getPhoneNumber(code) {
  const accessToken = await getAccessToken();
  const { data } = await axios.post(
    `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`,
    { code },
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (data.errcode !== 0) {
    const err = new Error(`getPhoneNumber error: ${data.errmsg}`);
    err.code = data.errcode;
    throw err;
  }

  const info = data.phone_info;
  return {
    phoneNumber: info.phoneNumber,
    purePhoneNumber: info.purePhoneNumber,
    countryCode: info.countryCode || '86',
  };
}

module.exports = { code2session, getAccessToken, getPhoneNumber };
