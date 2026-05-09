const { Service } = require('node-windows');
const path = require('path');
const fs = require('fs');

const localNodePath = path.join(__dirname, '..', 'runtime', 'node.exe');
const execPath = fs.existsSync(localNodePath) ? localNodePath : process.execPath;

// Create a new service object
const svc = new Service({
  name: 'Bread Faculty Server',
  description: 'The Node.js backend API and WebSocket server for the Bread Faculty POS system.',
  script: path.join(__dirname, '..', 'dist', 'index.js'),
  execPath
});

// Listen for the "uninstall" event so we know when it's done.
svc.on('uninstall', function() {
  console.log('Uninstall complete.');
  console.log('The service exists: ', svc.exists);
});

// Uninstall the service.
console.log('Uninstalling Bread Faculty Server service...');
console.log('You may be prompted for Administrator privileges.');
svc.uninstall();
