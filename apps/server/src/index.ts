import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setIO } from './lib/socket.js';
import { prisma } from './lib/prisma.js';
import { logger } from './lib/logger.js';
import { startSyncService } from './services/syncService.js';
import { authMiddleware } from './middleware/auth.js';
import { paginationMiddleware } from './middleware/pagination.js';
import { globalErrorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import customerRoutes from './routes/customers.js';
import inventoryRoutes from './routes/inventory.js';
import salesOrderRoutes from './routes/sales-orders.js';
import productionRoutes from './routes/production.js';
import supplierRoutes from './routes/suppliers.js';
import expenseRoutes from './routes/expenses.js';
import reportRoutes from './routes/reports.js';
import auditRoutes from './routes/audit.js';
import userRoutes from './routes/users.js';
import devResetRoutes from './routes/dev-reset.js';

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://localhost:3001'];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl) or if origin is in the allowed list
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: corsOptions });

setIO(io);

// Global middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(paginationMiddleware);

// Health check (no auth). Returns 200 on liveness, 503 if the DB is unreachable.
// `?deep=1` adds a real query + DB latency probe; default is a cheap ping for
// load balancers / uptime monitors that hit this endpoint frequently.
app.get('/health', async (req, res) => {
  const deep = req.query.deep === '1';
  const startedAt = Date.now();
  try {
    if (deep) {
      await prisma.$queryRaw`SELECT 1`;
    }
    res.json({
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      sockets: io.engine.clientsCount,
      ...(deep ? { dbLatencyMs: Date.now() - startedAt } : {}),
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      error: err instanceof Error ? err.message : 'Database unreachable',
      dbLatencyMs: Date.now() - startedAt,
    });
  }
});

// Auth routes (login is public, /me requires auth)
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/products', authMiddleware, productRoutes);
app.use('/api/customers', authMiddleware, customerRoutes);
app.use('/api/inventory', authMiddleware, inventoryRoutes);
app.use('/api/sales-orders', authMiddleware, salesOrderRoutes);
app.use('/api/production', authMiddleware, productionRoutes);
app.use('/api/suppliers', authMiddleware, supplierRoutes);
app.use('/api/expenses', authMiddleware, expenseRoutes);
app.use('/api/reports', authMiddleware, reportRoutes);
app.use('/api/audit', authMiddleware, auditRoutes);
app.use('/api/users', authMiddleware, userRoutes);

// Dev-only data reset (route itself returns 403 in production).
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/dev', authMiddleware, devResetRoutes);
}

// Error handler (must be last)
app.use(globalErrorHandler);

export { app, io };

// Socket.io connection logging. Single-bakery deployment — every connected
// client cares about every event, so no room scoping.
io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Client connected');
  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Client disconnected');
  });
});

const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    logger.info({ port: PORT }, 'Bread Faculty API running');
    startSyncService();
  });
}

