import { db } from './db';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function generateLocalId() {
  return 'local_' + Math.random().toString(36).substring(2, 11);
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('bakery_token');
  const method = options.method || 'GET';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      if (res.status === 401) {
        window.dispatchEvent(new CustomEvent('bakery:auth-expired'));
      }
      throw new ApiError(res.status, body.error || res.statusText);
    }

    const data = await res.json();
    
    // Manage cache on success
    try {
      if (method === 'GET') {
        if (path.startsWith('/products')) {
           if (Array.isArray(data)) {
               await db.products.bulkPut(data);
           } else if (data.data && Array.isArray(data.data)) {
               await db.products.bulkPut(data.data);
           }
        } else if (path.startsWith('/customers')) {
           if (Array.isArray(data)) {
               await db.customers.bulkPut(data);
           } else if (data.data && Array.isArray(data.data)) {
               await db.customers.bulkPut(data.data);
           }
        }
      } else {
        // Mutations: POST, PATCH, PUT, DELETE
        const isProduct = path.startsWith('/products');
        const isCustomer = path.startsWith('/customers');
        
        if (isProduct || isCustomer) {
          const table = isProduct ? db.products : db.customers;
          const segments = path.split('/');
          const id = segments.length > 2 ? segments[2].split('?')[0] : null;

          if (method === 'DELETE' && id) {
            await table.delete(id);
          } else if (data && data.id) {
            await (table as any).put(data);
          }
        }
      }
    } catch (dbErr) {
      console.error('Failed to update cache', dbErr);
    }
    
    return data;
  } catch (err) {
    // Only treat true network failures as "offline" — never server-returned 5xx.
    // Previously, a server 500 (e.g. Prisma crash) was silently swallowed and a
    // fake "success" object was returned to the client, making sales look like
    // they recorded when they didn't. Surface real server errors as errors.
    const isOffline = err instanceof TypeError;

    if (isOffline) {
      console.warn(`[Offline Fallback] Intercepted failed request to ${path}`);
      
      if (method === 'GET') {
        if (path.startsWith('/products')) {
          const products = await db.products.toArray();
          return { data: products, total: products.length, page: 1, limit: products.length } as any;
        } else if (path.startsWith('/customers')) {
          const customers = await db.customers.toArray();
          return { data: customers, total: customers.length, page: 1, limit: customers.length } as any;
        } else if (path.startsWith('/auth/me')) {
          const auth = await db.users.toArray();
          if (auth.length > 0) return auth[0].user as any;
        } else if (path.startsWith('/production/history')) {
          // Batch history expects { days, nextCursor } — empty paginated shape would crash render.
          return { days: [], nextCursor: null } as any;
        }

        // Return empty paginated structure to prevent crash
        if (path.includes('?')) return { data: [], total: 0 } as any;
        return [] as any;
      } else {
         // Mutation Queue
         if (path !== '/auth/login') { 
           const bodyObj = options.body ? JSON.parse(options.body as string) : {};
           
           let fakeId = bodyObj.id;
           if (method === 'POST' && !fakeId) {
              fakeId = generateLocalId();
           }

           await db.syncQueue.add({
             method: method as any,
             path,
             body: bodyObj,
             status: 'pending',
             createdAt: Date.now()
           });
           
           return { id: fakeId, ...bodyObj, _offline: true } as any;
         }
      }
    }
    
    throw err;
  }
}

export const api = {
  get<T>(path: string): Promise<T> {
    return apiFetch<T>(path);
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return apiFetch<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return apiFetch<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(path: string, body?: unknown): Promise<T> {
    return apiFetch<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(path: string): Promise<T> {
    return apiFetch<T>(path, { method: 'DELETE' });
  },
};
