import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@bakery/types';
import { api, ApiError } from '../lib/api';
import { disconnectSocket } from '../lib/socket';
import { db } from '../lib/db';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('bakery_token'),
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get<User>('/auth/me')
      .then((u) => {
        setUser(u);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          localStorage.removeItem('bakery_token');
          setToken(null);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await api.post<{ token: string; user: User }>('/auth/login', {
        email,
        password,
      });
      // Cache for offline use
      try {
        await db.users.put({
          email,
          passwordHash: password, // Simple plain text for offline comparison
          token: res.token,
          user: res.user,
        });
      } catch (dbErr) {
        console.error('Failed to cache user offline', dbErr);
      }
      
      localStorage.setItem('bakery_token', res.token);
      setToken(res.token);
      setUser(res.user);
    } catch (err) {
      // Offline fallback
      const isNetworkOr500 = err instanceof TypeError || (err instanceof ApiError && err.status >= 500);
      if (isNetworkOr500) {
        const cached = await db.users.get(email);
        if (cached && cached.passwordHash === password) {
          localStorage.setItem('bakery_token', cached.token);
          setToken(cached.token);
          setUser(cached.user);
          return;
        }
        if (cached) {
          throw new Error('Invalid offline credentials');
        }
      }
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('bakery_token');
    setToken(null);
    setUser(null);
    disconnectSocket();
  }, []);

  useEffect(() => {
    const handleAuthExpired = () => logout();
    window.addEventListener('bakery:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('bakery:auth-expired', handleAuthExpired);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
