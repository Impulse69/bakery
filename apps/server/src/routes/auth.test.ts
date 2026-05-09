import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcryptjs';

describe('Auth Flow Integration', () => {
  const testUser = {
    email: 'test-user@example.com',
    password: 'password123',
    name: 'Test User'
  };

  beforeAll(async () => {
    // Ensure test user exists
    const passwordHash = await bcrypt.hash(testUser.password, 10);
    await prisma.user.upsert({
      where: { email: testUser.email },
      update: { passwordHash },
      create: {
        email: testUser.email,
        passwordHash,
        name: testUser.name,
        role: 'admin'
      }
    });
  });

  it('should login successfully with correct credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body.user.email).toBe(testUser.email);
  });

  it('should fail login with incorrect password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'wrong-password'
      });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error', 'Invalid credentials');
  });

  it('should return user info for /me with valid token', async () => {
    // First login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    const token = loginRes.body.token;

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.email).toBe(testUser.email);
  });

  it('should fail /me with invalid token', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
  });
});
