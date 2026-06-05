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

describe('Admin recovery (local, loopback-only)', () => {
  const lockedEmail = 'recover-test@example.com';

  beforeAll(async () => {
    // Simulate a locked-out admin: a password nobody knows (mirrors the client
    // whose forced password-change never persisted on a read-only DB).
    const passwordHash = await bcrypt.hash('nobody-knows-this-xyz', 10);
    await prisma.user.upsert({
      where: { email: lockedEmail },
      update: { passwordHash, role: 'admin', isActive: true, mustChangePassword: true },
      create: { email: lockedEmail, passwordHash, name: 'Recover Test', role: 'admin' },
    });
  });

  it('resets a locked-out admin and lets them log in with the new password', async () => {
    const newPassword = 'fresh-pass-123';

    const recover = await request(app)
      .post('/api/auth/recover-admin')
      .send({ email: lockedEmail, newPassword });
    expect(recover.status).toBe(200);

    const ok = await request(app)
      .post('/api/auth/login')
      .send({ email: lockedEmail, password: newPassword });
    expect(ok.status).toBe(200);
    expect(ok.body).toHaveProperty('token');

    const oldStillFails = await request(app)
      .post('/api/auth/login')
      .send({ email: lockedEmail, password: 'nobody-knows-this-xyz' });
    expect(oldStillFails.status).toBe(401);
  });

  it('creates an admin when the email does not exist yet', async () => {
    const email = 'brand-new-admin@example.com';
    await prisma.user.deleteMany({ where: { email } });

    const recover = await request(app)
      .post('/api/auth/recover-admin')
      .send({ email, newPassword: 'created-pass-1' });
    expect(recover.status).toBe(200);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'created-pass-1' });
    expect(login.status).toBe(200);
  });

  it('rejects a short password', async () => {
    const res = await request(app)
      .post('/api/auth/recover-admin')
      .send({ email: lockedEmail, newPassword: '123' });
    expect(res.status).toBe(400);
  });
});
