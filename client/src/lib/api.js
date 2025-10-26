import axios from 'axios';

const baseURL =
  import.meta.env.VITE_API_BASE?.trim() ||
  'http://localhost:4000'; // use 'http://localhost:4000/api' if mounted routes under /api

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:4000/api',
  withCredentials: false, // send cookies if your auth uses them
});

// keep token in memory + localStorage + axios default header
let _token = localStorage.getItem('token') || null;
if (_token) {
  api.defaults.headers.common.Authorization = `Bearer ${_token}`;
}

// helpers expected by pages
export function setToken(token) {
  _token = token || null;
  if (token) {
    localStorage.setItem('token', token);
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    localStorage.removeItem('token');
    delete api.defaults.headers.common.Authorization;
  }
}

export function getToken() {
  return _token || localStorage.getItem('token') || null;
}

export function clearToken() {
  setToken(null);
}

//auto-handle 401 -> clear token (adjust if you have a global auth flow)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      clearToken();
    }
    return Promise.reject(err);
  }
);

// export both default and named so either import style works
export { api };
export default api;
