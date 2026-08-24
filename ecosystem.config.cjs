const path = require('node:path');

module.exports = {
  apps: [
    {
      name: 'exito-hub',
      cwd: path.join(__dirname),
      script: 'hub/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3010,
      },
      max_restarts: 10,
      restart_delay: 3000,
      autorestart: true,
    },
  ],
};
