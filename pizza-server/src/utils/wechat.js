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

module.exports = { code2session };
