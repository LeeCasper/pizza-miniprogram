module.exports = {
  apps: [{
    name: 'pizza-server',
    script: './src/app.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
    },
    error_file: '/var/log/pizza/err.log',
    out_file: '/var/log/pizza/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '300M',
  }],
};
