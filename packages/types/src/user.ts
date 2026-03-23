import type { Timestamps, UserRole } from './common';

export type User = Timestamps & {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
};
