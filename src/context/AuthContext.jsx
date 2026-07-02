import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { login as apiLogin, logout as apiLogout } from '../api/auth';
import { setAccessToken, clearAccessToken } from '../utils/tokenStore';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: try to restore session using the httpOnly refresh-token cookie
  useEffect(() => {
    axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true })
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        setUser(data.user);
      })
      .catch(() => {
        clearAccessToken();
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch {}
    clearAccessToken();
    setUser(null);
  }, []);

  useEffect(() => {
    // Fired by the axios interceptor when a token refresh fails
    const handle = () => { clearAccessToken(); setUser(null); };
    window.addEventListener('auth:logout', handle);
    return () => window.removeEventListener('auth:logout', handle);
  }, []);

  const login = async (email, password) => {
    const data = await apiLogin(email, password);
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
