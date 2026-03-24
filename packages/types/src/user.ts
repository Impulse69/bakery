import type { Timestamps, UserRole } from './common';

export type User = Timestamps & {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

export type AuthPayload = {
  id: string;
  email: string;
  role: UserRole;
};
