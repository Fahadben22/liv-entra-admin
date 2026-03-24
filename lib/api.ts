
const BASE = process.env.NEXT_PUBLIC_API_URL || 'https://liv-entra-api-production.up.railway.app/api/v1';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Request failed');
  return json;
}

export const adminApi = {
  // Companies
  listCompanies:   ()             => request<any>('GET',  '/admin/companies'),
  getCompany:      (id: string)   => request<any>('GET',  `/admin/companies/${id}`),
  createCompany:   (data: any)    => request<any>('POST', '/admin/companies', data),
  updateCompany:   (id: string, data: any) => request<any>('PATCH', `/admin/companies/${id}`, data),
  suspendCompany:  (id: string)   => request<any>('POST', `/admin/companies/${id}/suspend`),
  activateCompany: (id: string)   => request<any>('POST', `/admin/companies/${id}/activate`),
  // Usage
  getUsage:        (id: string)   => request<any>('GET',  `/admin/companies/${id}/usage`),
  // Stats
  getStats:        ()             => request<any>('GET',  '/admin/stats'),
};
