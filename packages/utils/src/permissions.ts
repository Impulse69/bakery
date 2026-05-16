import type { UserRole } from '@bakery/types';

const PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['*'],
  cashier: [
    'dashboard:view',
    'sales:view',
    'sales:create',
    // Cashier can edit ONLY their own sales — server enforces processedBy match.
    'sales:edit-own',
    'customers:view',
    'customers:create',
    // NOTE: customers:delete intentionally NOT granted — server enforces
    // admin/owner-only deactivation. Removing the frontend permission keeps
    // the "Deactivate" button from showing for cashiers in the first place.
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
  // Owner has the same operational power as admin (per user direction) without
  // granting wildcard ('*'). Spell out every action the bakery owner needs.
  owner: [
    '*:view',
    'expenses:*',
    'products:cost-view',
    'products:create',
    'products:edit',
    'products:delete',
    'sales:edit',
    'users:create',
    'users:edit',
    'users:delete',
    'users:reset-password',
    'audit:view',
    'settings:manage',
  ],
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
