// Manejo de sesión local. Una sesión = { userId } en localStorage.
// Apto para uso local; NO usar en multi-usuario / producción sin migrar a
// JWT firmado por el backend.

const KEY = 'noa_session';

export function getSession() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(userId) {
  localStorage.setItem(KEY, JSON.stringify({ userId, since: Date.now() }));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
