import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import i18n, { rememberLanguage, getRememberedLanguage } from '../i18n';
import { login as apiLogin, logout as apiLogout, verifyMfa as apiVerifyMfa } from '../api/auth';
import { resolveAccount, resolveContact } from '../api/d365';
import { setAccessToken, clearAccessToken } from '../utils/tokenStore';
import { getBrand, rememberCompany, setTab } from '@/lib/brand';

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
  // tanto al restaurarla al montar como al hacer login. Además se RECUERDA en
  // este navegador (decisión del usuario): el login sale en el idioma del
  // último usuario que entró (también al cerrar sesión). Sin sesión ni idioma
  // recordado → español.
  useEffect(() => {
    if (isLoading) return;
    if (user?.language) {
      rememberLanguage(user.language);
      i18n.changeLanguage(user.language);
    } else {
      i18n.changeLanguage(getRememberedLanguage());
    }
  }, [user?.language, isLoading]);

  // Marca del portal (Grupo Staff / Satustec) según user.company: atributo
  // data-brand en <html> (variables CSS de src/index.css), título e ícono de la
  // pestaña. La empresa además se RECUERDA en el navegador para mandar a quien
  // se quede sin sesión a su login (/login o /loginst, ver getLoginPath).
  // Sin sesión → sin data-brand; la pestaña la pone cada pantalla de login
  // (la de Grupo Staff o la de Satustec).
  useEffect(() => {
    if (isLoading) return;
    const root = document.documentElement;
    if (user) {
      const brand = getBrand(user.company);
      rememberCompany(brand.key);
      root.dataset.brand = brand.key;
      setTab(brand.documentTitle[user.language] || brand.documentTitle.es, brand.favicon);
    } else {
      delete root.dataset.brand;
    }
  }, [user, isLoading]);

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

  // Con verificación en dos pasos pendiente (2026-11-24) todavía no hay
  // sesión: se devuelve { mfaRequired, mfaToken, ... } y LoginPage pide el código.
  const login = async (email, password) => {
    const data = await apiLogin(email, password);
    if (data.mfaRequired) return data;
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data;
  };

  const verifyMfa = async (mfaToken, code, remember) => {
    const data = await apiVerifyMfa(mfaToken, code, remember);
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data;
  };

  // Sesión nueva devuelta por el backend sin pasar por login (p. ej. después
  // de cambiar la contraseña, 2026-11-23: el usuario sigue dentro y las demás
  // sesiones quedan cerradas). `user.mustChangePassword` decide si
  // ProtectedRoute muestra la pantalla de cambio obligatorio.
  const applySession = useCallback(({ accessToken, user: nextUser }) => {
    setAccessToken(accessToken);
    setUser(nextUser);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, verifyMfa, logout, applySession, customerLabel }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
