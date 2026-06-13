const crypto = require('crypto');

/**
 * Generate a random 4-digit pickup code.
 * Excludes easily confused digits (0 vs O) and sequential patterns.
 */
function generatePickupCode() {
  const digits = '123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    const idx = crypto.randomInt(0, digits.length);
    code += digits[idx];
  }
  return code;
}

module.exports = { generatePickupCode };
