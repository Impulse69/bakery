import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@bakery.com';
  const password = 'admin123';
  const passwordHash = await bcrypt.hash(password, 10);

  console.log(`🔐 Setting up user ${email}...`);

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash },
      create: {
        name: 'Admin User',
        email,
        passwordHash,
        role: 'admin',
      },
    });
    console.log('✅ User successfully created/updated:', user.email);
  } catch (error) {
    console.error('❌ Error during user setup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
