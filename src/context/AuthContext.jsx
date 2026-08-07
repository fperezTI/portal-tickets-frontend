import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import i18n from '../i18n';
import { login as apiLogin, logout as apiLogout } from '../api/auth';
import { resolveAccount, resolveContact } from '../api/d365';
import { setAccessToken, clearAccessToken } from '../utils/tokenStore';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [customerLabel, setCustomerLabel] = useState('');

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

  // El idioma de la interfaz es el que el admin le asignó al usuario
  // (campo Idioma en Usuarios) — se aplica en cuanto se conoce la sesión,
  // tanto al restaurarla al montar como al hacer login.
  useEffect(() => {
    i18n.changeLanguage(user?.language || 'es');
  }, [user?.language]);

  // Nombre del cliente (cuenta o contacto) a mostrar en la UI — se resuelve UNA
  // sola vez acá (al hacer login o al restaurar sesión), no en cada página que
  // lo necesita. Layout, Dashboard y Cases antes lo pedían cada uno por su
  // cuenta a /d365/accounts|contacts al montar — la misma llamada repetida 3
  // veces cada vez que un cliente navegaba entre esas páginas.
  useEffect(() => {
    if (user?.role !== 'client') {
      setCustomerLabel('');
      return;
    }
    const fallback = user.fullName || user.email || '';
    if (user.d365AccountId) {
      resolveAccount(user.d365AccountId).then((a) => setCustomerLabel(a.name || fallback)).catch(() => setCustomerLabel(fallback));
    } else if (user.d365ContactId) {
      resolveContact(user.d365ContactId).then((c) => setCustomerLabel(c.name || fallback)).catch(() => setCustomerLabel(fallback));
    } else {
      setCustomerLabel(fallback);
    }
  }, [user?.role, user?.d365AccountId, user?.d365ContactId, user?.fullName, user?.email]);

  const login = async (email, password) => {
    const data = await apiLogin(email, password);
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, customerLabel }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
