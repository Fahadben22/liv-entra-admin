
export const BASE = process.env.NEXT_PUBLIC_API_URL || 'https://liv-entra-api-production.up.railway.app/api/v1';

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
  // Expired or invalid token — redirect to login
  // Skip auto-redirect for /superadmin/* paths: those return 401 when the
  // migration tables don't exist yet or the old token lacks adminUser claim.
  // Those failures are handled gracefully via Promise.allSettled in each page.
  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/superadmin/')) {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    window.location.href = '/login';
    throw new Error('session_expired');
  }
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Request failed');
  return json;
}

export const adminApi = {
  // ─── Legacy admin routes (preserved) ────────────────────────────────────────
  listCompanies:   ()             => request<any>('GET',  '/admin/companies'),
  getCompany:      (id: string)   => request<any>('GET',  `/admin/companies/${id}`),
  createCompany:   (data: any)    => request<any>('POST', '/admin/companies', data),
  updateCompany:   (id: string, data: any) => request<any>('PATCH', `/admin/companies/${id}`, data),
  suspendCompany:  (id: string)   => request<any>('POST', `/admin/companies/${id}/suspend`),
  activateCompany: (id: string)   => request<any>('POST', `/admin/companies/${id}/activate`),
  getUsage:        (id: string)   => request<any>('GET',  `/admin/companies/${id}/usage`),
  getStats:        ()             => request<any>('GET',  '/admin/stats'),

  // ─── Intelligence / System Monitoring ────────────────────────────────────────
  intelligenceSummary:  ()                      => request<any>('GET',  '/admin/intelligence/summary'),
  listLogs:             (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>('GET', `/admin/intelligence/logs${qs}`);
  },
  listAlerts:           (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>('GET', `/admin/intelligence/alerts${qs}`);
  },
  analyzeLog:           (log_id: string)        => request<any>('POST', `/admin/intelligence/analyze/${log_id}`),
  resolveLog:           (id: string, notes: string) => request<any>('PATCH', `/admin/intelligence/logs/${id}/resolve`, { resolution_notes: notes }),
  ignoreLog:            (id: string)            => request<any>('PATCH', `/admin/intelligence/logs/${id}/ignore`),
  ingestLog:            (data: any)             => request<any>('POST', '/admin/intelligence/ingest', data),
  getTimeline:          ()                      => request<any>('GET',  '/admin/intelligence/timeline'),
  getTenantHealth:      ()                      => request<any>('GET',  '/admin/intelligence/tenant-health'),
  getTopErrors:         ()                      => request<any>('GET',  '/admin/intelligence/top-errors'),
  getSecurityFeed:      ()                      => request<any>('GET',  '/admin/intelligence/security-feed'),
  getHealthScore:       ()                      => request<any>('GET',  '/admin/intelligence/health-score'),
  aiChat:               (message: string, history: any[]) => request<any>('POST', '/admin/intelligence/chat', { message, history }),
  getStreamUrl:         () => `${BASE}/admin/intelligence/stream`,

  // ─── Super Admin Control Plane ───────────────────────────────────────────────
  sa: {
    // Auth
    login:           (email: string, password: string) => request<any>('POST', '/superadmin/auth/login', { email, password }),
    me:              ()             => request<any>('GET',  '/superadmin/auth/me'),
    listAdminUsers:  ()             => request<any>('GET',  '/superadmin/auth/users'),
    createAdminUser: (data: any)    => request<any>('POST', '/superadmin/auth/users', data),
    deactivateAdminUser: (id: string) => request<any>('PATCH', `/superadmin/auth/users/${id}/deactivate`),

    // Platform stats
    platformStats:   ()             => request<any>('GET',  '/superadmin/stats'),

    // Tenant / Company control
    listCompanies:   (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>('GET', `/superadmin/companies${qs}`);
    },
    getCompany:      (id: string)   => request<any>('GET',  `/superadmin/companies/${id}`),
    getCompanyUsage: (id: string)   => request<any>('GET',  `/superadmin/companies/${id}/usage`),
    activateCompany: (id: string)   => request<any>('POST', `/superadmin/companies/${id}/activate`),
    suspendCompany:  (id: string, reason: string) => request<any>('POST', `/superadmin/companies/${id}/suspend`, { reason }),
    deleteCompany:   (id: string, reason: string) => request<any>('POST', `/superadmin/companies/${id}/delete`, { reason }),
    updateLimits:    (id: string, limits: any)    => request<any>('PATCH', `/superadmin/companies/${id}/limits`, limits),

    // Subscription plans
    listPlans:       ()             => request<any>('GET',  '/superadmin/plans'),
    createPlan:      (data: any)    => request<any>('POST', '/superadmin/plans', data),
    updatePlan:      (id: string, data: any) => request<any>('PATCH', `/superadmin/plans/${id}`, data),

    // Tenant subscriptions
    assignPlan:      (companyId: string, data: any) => request<any>('POST', `/superadmin/companies/${companyId}/assign-plan`, data),
    extendTrial:     (companyId: string, days: number) => request<any>('POST', `/superadmin/companies/${companyId}/extend-trial`, { days }),

    // Payments
    listPayments:    (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>('GET', `/superadmin/payments${qs}`);
    },
    markPaymentPaid: (id: string, ref?: string) => request<any>('PATCH', `/superadmin/payments/${id}/mark-paid`, { payment_ref: ref }),
    waivePayment:    (id: string, reason: string) => request<any>('PATCH', `/superadmin/payments/${id}/waive`, { reason }),
    mrrStats:        ()             => request<any>('GET',  '/superadmin/billing/mrr'),

    // Feature flags
    featureRegistry: ()             => request<any>('GET',  '/superadmin/features/registry'),
    companyFlags:    (id: string)   => request<any>('GET',  `/superadmin/companies/${id}/flags`),
    setFlag:         (id: string, key: string, enabled: boolean, rollout_pct?: number, notes?: string) =>
      request<any>('POST', `/superadmin/companies/${id}/flags`, { feature_key: key, is_enabled: enabled, rollout_pct, notes }),
    bulkSetFlags:    (id: string, flags: { feature_key: string; is_enabled: boolean }[]) =>
      request<any>('POST', `/superadmin/companies/${id}/flags/bulk`, { flags }),
    featureStats:    ()                   => request<any>('GET', '/superadmin/features/stats'),
    featureCompanies:(key: string)        => request<any>('GET', `/superadmin/features/${key}/companies`),
    featureMatrix:   ()                   => request<any>('GET', '/superadmin/features/matrix'),

    // Audit logs
    listAudit:       (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>('GET', `/superadmin/audit${qs}`);
    },

    // Anomalies
    listAnomalies:   (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>('GET', `/superadmin/anomalies${qs}`);
    },
    updateAnomaly:   (id: string, status: string, note?: string) =>
      request<any>('PATCH', `/superadmin/anomalies/${id}`, { status, resolution_note: note }),

    // Landing page CMS
    getLanding:      ()           => request<any>('GET', '/superadmin/landing'),
    updateLanding:   (data: any)  => request<any>('PUT', '/superadmin/landing', data),

    // Demo requests (leads from landing page)
    listDemoRequests: (status?: string, page?: number) => {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      qs.set('page', String(page || 1));
      return request<any>('GET', `/superadmin/demo-requests?${qs.toString()}`);
    },
    updateDemoRequest: (id: string, data: { status?: string; notes?: string; assigned_to?: string }) =>
      request<any>('PATCH', `/superadmin/demo-requests/${id}`, data),
    getDemoRequestStats: () =>
      request<any>('GET', '/superadmin/demo-requests/stats'),

    // Demo leads (free live demo portal leads)
    listDemoLeads: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<any>('GET', `/superadmin/demo-leads${qs}`);
    },
    updateDemoLead: (id: string, data: { status?: string; notes?: string }) =>
      request<any>('PATCH', `/superadmin/demo-leads/${id}`, data),
  },

  // ─── Security Center — platform-wide cross-company (admin only) ──────────────
  securityEvents: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>('GET', `/security/events/all${qs}`);
  },
  platformSecuritySummary: () => request<any>('GET', '/security/platform-summary'),

  // ─── WhatsApp management (super-admin) ───────────────────────────────────────
  wa: {
    conversations: (companyId?: string) =>
      request<any>('GET', `/conversations${companyId ? `?company_id=${companyId}` : ''}`),
    conversation:  (id: string) =>
      request<any>('GET', `/conversations/${id}`),
    sendMessage:   (conversationId: string, body: string, companyId: string) =>
      request<any>('POST', '/whatsapp/send', { conversation_id: conversationId, body, company_id: companyId }),
    queue:         (params?: string) =>
      request<any>('GET', `/whatsapp/queue${params || ''}`),
    retryNotification: (id: string) =>
      request<any>('POST', `/whatsapp/queue/${id}/retry`),
    analytics:     () =>
      request<any>('GET', '/whatsapp/analytics'),
    setup:         (data: any) =>
      request<any>('PATCH', '/whatsapp/setup', data),
    testSetup:     (companyId: string) =>
      request<any>('POST', '/whatsapp/setup/test', { company_id: companyId }),
    templates:     () =>
      request<any>('GET', '/whatsapp/templates'),
  },
};
