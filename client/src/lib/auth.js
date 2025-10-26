import { getToken, setToken as _setToken, clearToken as _clearToken } from './api';

// decode JWT payload safely
export function getUserFromToken() {
  const t = getToken();
  if (!t) return null;
  try {
    const payload = JSON.parse(atob(t.split('.')[1]));
    // Expect payload like: { id, email, role, ... }
    return { id: payload.id, email: payload.email, role: payload.role || 'CUSTOMER' };
  } catch {
    return null;
  }
}

export function setToken(token) {
  _setToken(token);
}

export function clearToken() {
  _clearToken();
}
