import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';

type PrismaUserClient = {
  user: {
    count: () => Promise<number>;
    create: (args: {
      data: {
        name: string;
        email: string;
        passwordHash: string;
        role: 'admin';
        isActive: boolean;
      };
    }) => Promise<{ email: string }>;
  };
};

type BcryptLike = {
  hash: (password: string, saltRounds: number) => Promise<string>;
};

type DefaultAdminConfig = {
  email?: string;
  password?: string;
  name?: string;
};

export async function ensureDefaultAdmin(
  prismaClient: PrismaUserClient = prisma,
  bcryptClient: BcryptLike = bcrypt,
  config: DefaultAdminConfig = {},
) {
  const existingUsers = await prismaClient.user.count();

  if (existingUsers > 0) {
    return { created: false, reason: 'users-exist' as const };
  }

  const email = config.email ?? process.env.DEFAULT_ADMIN_EMAIL ?? 'admin@bakery.com';
  const password = config.password ?? process.env.DEFAULT_ADMIN_PASSWORD ?? 'admin123';
  const name = config.name ?? process.env.DEFAULT_ADMIN_NAME ?? 'Admin User';
  const passwordHash = await bcryptClient.hash(password, 10);

  const user = await prismaClient.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: 'admin',
      isActive: true,
    },
  });

  return { created: true, email: user.email };
}

if (require.main === module) {
  ensureDefaultAdmin()
    .then((result) => {
      if (result.created) {
        console.log(`Default admin created: ${result.email}`);
        console.log('Set DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD before setup to override the defaults.');
      } else {
        console.log('Default admin skipped: users already exist.');
      }
    })
    .catch((error) => {
      console.error('Default admin setup failed:', error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
