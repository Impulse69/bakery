import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setIO } from './lib/socket.js';
import { authMiddleware } from './middleware/auth.js';
import { paginationMiddleware } from './middleware/pagination.js';
import { globalErrorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import customerRoutes from './routes/customers.js';
import inventoryRoutes from './routes/inventory.js';
import salesOrderRoutes from './routes/sales-orders.js';
import recipeRoutes from './routes/recipes.js';
import productionRoutes from './routes/production.js';
import supplierRoutes from './routes/suppliers.js';
import purchaseOrderRoutes from './routes/purchase-orders.js';
import expenseRoutes from './routes/expenses.js';
import inventoryCountRoutes from './routes/inventory-counts.js';
import reportRoutes from './routes/reports.js';

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

setIO(io);

// Global middleware
app.use(cors());
app.use(express.json());
app.use(paginationMiddleware);

// Health check (no auth)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Auth routes (login is public, /me requires auth)
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/products', authMiddleware, productRoutes);
app.use('/api/customers', authMiddleware, customerRoutes);
app.use('/api/inventory', authMiddleware, inventoryRoutes);
app.use('/api/sales-orders', authMiddleware, salesOrderRoutes);
app.use('/api/recipes', authMiddleware, recipeRoutes);
app.use('/api/production', authMiddleware, productionRoutes);
app.use('/api/suppliers', authMiddleware, supplierRoutes);
app.use('/api/purchase-orders', authMiddleware, purchaseOrderRoutes);
app.use('/api/expenses', authMiddleware, expenseRoutes);
app.use('/api/inventory-counts', authMiddleware, inventoryCountRoutes);
app.use('/api/reports', authMiddleware, reportRoutes);

// Error handler (must be last)
app.use(globalErrorHandler);

// Socket.io connection logging
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Bread Faculty API running on port ${PORT}`);
});

