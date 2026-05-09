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
  execPath,
  nodeOptions: [
    '--max_old_space_size=4096'
  ],
  workingDirectory: path.join(__dirname, '..'),
  env: {
    name: 'NODE_ENV',
    value: 'production'
  },
  // Wait 2 seconds before restarting if it crashes
  wait: 2,
  // Restart infinitely
  grow: 0.5,
  maxRestarts: 100
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install', function() {
  console.log('Service installed successfully!');
  console.log('Starting the service...');
  svc.start();
});

svc.on('alreadyinstalled', function() {
  console.log('This service is already installed.');
  console.log('Attempting to start the service...');
  svc.start();
});

svc.on('start', function() {
  console.log('Service started! The backend is now running in the background.');
});

svc.on('error', function(err) {
  console.error('An error occurred:', err);
});

// Install the script as a service.
console.log('Installing Bread Faculty Server as a Windows Service...');
console.log('You may be prompted for Administrator privileges.');
svc.install();
