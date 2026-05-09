import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcryptjs';

describe('Production Route - Daily Run Carry-Over', () => {
  let token: string;
  let adminId: string;
  let productId: string;

  beforeAll(async () => {
    // 1. Setup Admin User
    const email = 'prod-admin@example.com';
    const password = 'password123';
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash },
      create: {
        email,
        passwordHash,
        name: 'Prod Admin',
        role: 'admin'
      }
    });
    adminId = user.id;

    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    token = loginRes.body.token;

    // 2. Setup Product
    const product = await prisma.product.upsert({
      where: { sku: 'TEST-BRD-01' },
      update: { isActive: true },
      create: {
        name: 'Test Bread',
        sku: 'TEST-BRD-01',
        category: 'Bread',
        price: 1000,
        isActive: true
      }
    });
    productId = product.id;

    // 3. Clear existing targets to have a clean state
    await prisma.dailyProductionTarget.deleteMany({});
  });

  it('should return latestShortage when there are past shortages', async () => {
    // Clear all to be sure
    await prisma.dailyProductionTarget.deleteMany({});

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    twoDaysAgo.setHours(0, 0, 0, 0);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    // Create a target for two days ago
    await prisma.dailyProductionTarget.create({
      data: {
        targetDate: twoDaysAgo,
        productId,
        targetQty: 100,
        actualQty: 50,
        shortage: 50,
        status: 'completed'
      }
    });

    // Create a target for yesterday with more shortage
    await prisma.dailyProductionTarget.create({
      data: {
        targetDate: yesterday,
        productId,
        targetQty: 100,
        actualQty: 80,
        shortage: 20,
        status: 'completed'
      }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const response = await request(app)
      .get(`/api/production/daily-run?date=${todayStr}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('latestShortage');
    // Should pick yesterday (the most recent)
    expect(response.body.latestShortage.totalUnits).toBe(20);
    expect(response.body.latestShortage.date).toBe(yesterday.toISOString().split('T')[0]);
  });

  it('should return latestShortage = null if no past shortages exist', async () => {
    await prisma.dailyProductionTarget.deleteMany({});

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const response = await request(app)
      .get(`/api/production/daily-run?date=${todayStr}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.latestShortage).toBeNull();
  });

  it('should return carriedOverShortage = 0 if carryFrom is NOT provided', async () => {
    // Even if there is a past shortage
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    await prisma.dailyProductionTarget.upsert({
      where: { targetDate_productId: { targetDate: yesterday, productId } },
      update: { shortage: 20 },
      create: { targetDate: yesterday, productId, shortage: 20, status: 'completed' }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const response = await request(app)
      .get(`/api/production/daily-run?date=${todayStr}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const suggestion = response.body.suggestions.find((s: any) => s.productId === productId);
    expect(suggestion.carriedOverShortage).toBe(0);
  });

  it('should return carriedOverShortage from specified carryFrom date', async () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    twoDaysAgo.setHours(0, 0, 0, 0);
    const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

    await prisma.dailyProductionTarget.upsert({
      where: {
        targetDate_productId: {
          targetDate: twoDaysAgo,
          productId
        }
      },
      update: { shortage: 50 },
      create: {
        targetDate: twoDaysAgo,
        productId,
        shortage: 50,
        status: 'completed'
      }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const response = await request(app)
      .get(`/api/production/daily-run?date=${todayStr}&carryFrom=${twoDaysAgoStr}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const suggestion = response.body.suggestions.find((s: any) => s.productId === productId);
    expect(suggestion.carriedOverShortage).toBe(50);
    expect(suggestion.sourceDate).toBe(twoDaysAgoStr);
  });

  it('should return carriedOverShortage = 0 if carryFrom date has no record', async () => {
    const wayPast = '2000-01-01';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const response = await request(app)
      .get(`/api/production/daily-run?date=${todayStr}&carryFrom=${wayPast}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const suggestion = response.body.suggestions.find((s: any) => s.productId === productId);
    expect(suggestion.carriedOverShortage).toBe(0);
  });
});
