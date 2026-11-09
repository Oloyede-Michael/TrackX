import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  const logout = useCallback(() => { setToken(null); setUser(null); }, []);

  useEffect(() => {
    if (getToken()) api.me().then((r) => setUser(r.user)).catch(() => setToken(null)).finally(() => setLoading(false));
    window.addEventListener('trackx:logout', logout);
    return () => window.removeEventListener('trackx:logout', logout);
  }, [logout]);

  const login = async (email, password) => {
    const r = await api.login({ email, password });
    setToken(r.token);
    setUser(r.user);
  };

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}
