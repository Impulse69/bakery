import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getParam } from '../lib/params.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

const ingredientSchema = z.object({
  inventoryItemId: z.string(),
  quantityRequired: z.number().positive(),
  unit: z.string().min(1),
  notes: z.string().optional(),
});

const createRecipeSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  yieldQuantity: z.number().positive(),
  yieldUnit: z.string().min(1),
  instructions: z.string().optional(),
  ingredients: z.array(ingredientSchema).min(1),
});

// GET /api/recipes
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { skip, take } = req.pagination;
    const [recipes, total] = await Promise.all([
      prisma.recipe.findMany({
        where: { isActive: true },
        include: { ingredients: { include: { inventoryItem: true } } },
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
      prisma.recipe.count({ where: { isActive: true } }),
    ]);
    res.json({ data: recipes, total, page: req.pagination.page, limit: req.pagination.limit });
  }),
);

// GET /api/recipes/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const recipe = await prisma.recipe.findUnique({
      where: { id: getParam(req, 'id') },
      include: { ingredients: { include: { inventoryItem: true } } },
    });
    if (!recipe) throw new AppError(404, 'Recipe not found');
    res.json(recipe);
  }),
);

// POST /api/recipes
router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { ingredients, ...data } = createRecipeSchema.parse(req.body);
    const recipe = await prisma.recipe.create({
      data: {
        ...data,
        ingredients: { create: ingredients },
      },
      include: { ingredients: { include: { inventoryItem: true } } },
    });
    res.status(201).json(recipe);
  }),
);

export default router;
