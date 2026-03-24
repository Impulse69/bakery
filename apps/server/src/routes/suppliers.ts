import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getParam } from '../lib/params.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

const createSupplierSchema = z.object({
  name: z.string().min(1),
  contactPerson: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  paymentTerms: z.string().optional(),
});

const updateSupplierSchema = createSupplierSchema.partial();

// GET /api/suppliers
router.get(
  '/',
  requireRole('admin', 'owner'),
  asyncHandler(async (req, res) => {
    const { skip, take } = req.pagination;
    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where: { isActive: true },
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
      prisma.supplier.count({ where: { isActive: true } }),
    ]);
    res.json({ data: suppliers, total, page: req.pagination.page, limit: req.pagination.limit });
  }),
);

// POST /api/suppliers
router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const data = createSupplierSchema.parse(req.body);
    const supplier = await prisma.supplier.create({ data });
    res.status(201).json(supplier);
  }),
);

// PATCH /api/suppliers/:id
router.patch(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const data = updateSupplierSchema.parse(req.body);
    const supplier = await prisma.supplier.update({
      where: { id: getParam(req, 'id') },
      data,
    });
    res.json(supplier);
  }),
);

export default router;
