const pino = require('pino');
const config = require('../config');

const isDev = config.nodeEnv !== 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:yyyy-mm-dd HH:MM:ss' },
        },
      }
    : {}),
});

/**
 * Create a named child logger.
 * Usage: const log = createLogger('Payment');
 *        log.info({ orderId }, 'Order paid');
 */
function createLogger(name) {
  return logger.child({ module: name });
}

module.exports = { logger, createLogger };
