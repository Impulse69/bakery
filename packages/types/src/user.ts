import type { Timestamps, UserRole } from './common';

export type User = Timestamps & {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  /** Set true after an admin resets this user's password. The next login
   *  forces a change-password modal before any other route loads. */
  mustChangePassword?: boolean;
};

export type AuthPayload = {
  id: string;
  email: string;
  role: UserRole;
};
