module.exports = {
  apps: [{
    name: 'qr-integration',
    script: 'src/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '256M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: './logs/error.log',
    out_file: './logs/app.log',
    merge_logs: true,
    env: {
      NODE_ENV: 'production',
      PORT: 3003,
    },
  }],
};
