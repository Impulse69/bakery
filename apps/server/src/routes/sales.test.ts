import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcryptjs';

describe('Sales & Stock Integration', () => {
  let authToken: string;
  let testProductId: string;
  const testLocationId = 'test-location';

  beforeAll(async () => {
    // 1. Setup User & Token
    const passwordHash = await bcrypt.hash('password123', 10);
    const user = await prisma.user.upsert({
      where: { email: 'sales-test@example.com' },
      update: { passwordHash },
      create: {
        email: 'sales-test@example.com',
        passwordHash,
        name: 'Sales Tester',
        role: 'admin'
      }
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'password123' });
    authToken = loginRes.body.token;

    // 2. Setup Location
    await prisma.location.upsert({
      where: { id: testLocationId },
      update: {},
      create: { id: testLocationId, name: 'Test Shop' }
    });

    // 3. Setup Product with Stock
    const product = await prisma.product.upsert({
      where: { sku: 'TEST-BRD-01' },
      update: { stockQuantity: 50, isAvailable: true },
      create: {
        name: 'Test Bread',
        sku: 'TEST-BRD-01',
        price: 1000,
        wholesalePrice: 800,
        stockQuantity: 50,
        category: 'Bread',
        isAvailable: true
      }
    });
    testProductId = product.id;
  });

  it('should create a sales order and decrement stock', async () => {
    const initialProduct = await prisma.product.findUnique({ where: { id: testProductId } });
    const initialStock = initialProduct?.stockQuantity || 0;

    const response = await request(app)
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        locationId: testLocationId,
        items: [
          {
            productId: testProductId,
            quantity: 5,
            unitPrice: 1000,
            tax: 0
          }
        ]
      });

    expect(response.status).toBe(201);
    expect(response.body.total).toBe(5000);
    expect(response.body.items).toHaveLength(1);

    // Verify stock decrement
    const updatedProduct = await prisma.product.findUnique({ where: { id: testProductId } });
    expect(updatedProduct?.stockQuantity).toBe(initialStock - 5);
  });

  it('should fail to create order if stock is insufficient', async () => {
    const response = await request(app)
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        locationId: testLocationId,
        items: [
          {
            productId: testProductId,
            quantity: 100, // Exceeds available stock
            unitPrice: 1000
          }
        ]
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Insufficient stock');
  });

  it('should process payment and update order status to paid', async () => {
    // 1. Create a fresh order
    const orderRes = await request(app)
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        locationId: testLocationId,
        items: [{ productId: testProductId, quantity: 1, unitPrice: 1000 }]
      });
    
    const orderId = orderRes.body.id;
    const total = orderRes.body.total;

    // 2. Add full payment
    const paymentRes = await request(app)
      .post(`/api/sales-orders/${orderId}/payments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: total,
        method: 'cash',
        note: 'Full payment'
      });

    expect(paymentRes.status).toBe(201);
    expect(paymentRes.body.order.status).toBe('paid');
    expect(paymentRes.body.order.balanceDue).toBe(0);
    expect(paymentRes.body.order.amountPaid).toBe(total);
  });
});
