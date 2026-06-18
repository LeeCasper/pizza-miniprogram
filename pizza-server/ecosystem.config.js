module.exports = {
  apps: [{
    name: 'pizza-server',
    script: './src/app.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
    },

    // Graceful shutdown: 8s for the app to close connections before SIGKILL
    kill_timeout: 8000,
    // Wait for app to be ready
    listen_timeout: 5000,

    error_file: '/var/log/pizza/err.log',
    out_file: '/var/log/pizza/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

    max_memory_restart: '300M',

    // Exponential backoff on crash loops
    exp_backoff_restart_delay: 1000,
  }],
};
