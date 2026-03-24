
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

export function clearAdminSession() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
}

export function isAdminLoggedIn(): boolean {
  return !!getAdminToken();
}
