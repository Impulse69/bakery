import type { UserRole } from '@bakery/types';

const PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['*'],
  cashier: [
    'dashboard:view',
    'sales:view',
    'sales:create',
    'customers:view',
    'customers:create',
    'customers:delete',
    'inventory:view',
    'products:view',
  ],
  baker: [
    'dashboard:view',
    'inventory:view',
    'production:view',
    'production:create',
    'products:view',
  ],
  owner: ['*:view'],
};

export function can(role: UserRole, action: string): boolean {
  const allowed = PERMISSIONS[role];
  if (!allowed) return false;

  // Admin has wildcard access to everything
  if (allowed.includes('*')) return true;

  // Owner has read-only access to all modules
  if (allowed.includes('*:view') && action.endsWith(':view')) return true;

  // Direct permission match
  if (allowed.includes(action)) return true;

  // Check module wildcard (e.g. 'sales:*' matches 'sales:create')
  const [module] = action.split(':');
  if (allowed.includes(`${module}:*`)) return true;

  return false;
}
