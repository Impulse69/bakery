import { Service } from 'node-windows';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a new service object
const svc = new Service({
  name: 'Bread Faculty Server',
  description: 'The Node.js backend API and WebSocket server for the Bread Faculty POS system.',
  script: path.join(__dirname, '..', 'dist', 'index.js')
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