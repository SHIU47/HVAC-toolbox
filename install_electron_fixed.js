process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.env.ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/';
console.log('Starting Electron installation with custom settings...');
require('./node_modules/electron/install.js');
