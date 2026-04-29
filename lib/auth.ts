
export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

export function getAdminUser(): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const u = localStorage.getItem('admin_user');
    return u ? JSON.parse(u) : null;
  } catch { return null; }
}

export function setAdminSession(token: string, user: any) {
  localStorage.setItem('admin_token', token);
  localStorage.setItem('admin_user', JSON.stringify(user));
}

export async function clearAdminSession() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
  localStorage.removeItem('admin_refresh_token');
  await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
}

export function isAdminLoggedIn(): boolean {
  return !!getAdminToken();
}
