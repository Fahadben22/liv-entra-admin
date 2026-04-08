// Shared billing constants and helpers
export function lcOf(c: any): string {
  if (c.lifecycle_status) return c.lifecycle_status;
  if (!c.is_active) return 'suspended';
  if (c.plan === 'trial') return 'trial';
  return 'active';
}

export function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

export function fmt(n: any, locale = 'ar-SA') {
  return Number(n || 0).toLocaleString(locale);
}

export function fmtCurrency(n: any, currencyCode = 'SAR', locale = 'ar-SA') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 }).format(Number(n || 0));
}

export function fmtDate(iso: string, locale = 'ar-SA') {
  return iso ? new Date(iso).toLocaleDateString(locale) : '—';
}

export const PLAN_AR: Record<string, string> = {
  trial: 'تجريبي', basic: 'أساسي', professional: 'احترافي', enterprise: 'مؤسسي',
};

export const PLAN_PRICE: Record<string, number> = {
  trial: 0, basic: 299, professional: 699, enterprise: 1499,
};

export const PLAN_C: Record<string, { bg: string; color: string; border: string }> = {
  trial:        { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  basic:        { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' },
  professional: { bg: '#eff6ff', color: '#1d4070', border: '#bfdbfe' },
  enterprise:   { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
};

export const INV_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  draft:   { label: 'مسودة',   bg: '#f8fafc', color: '#64748b' },
  issued:  { label: 'مُصدرة',  bg: '#eff6ff', color: '#1d4070' },
  sent:    { label: 'مُرسلة',  bg: '#eff6ff', color: '#1d4070' },
  overdue: { label: 'متأخرة',  bg: '#fff7ed', color: '#c2410c' },
  paid:    { label: 'مدفوعة',  bg: '#f0fdf4', color: '#15803d' },
  waived:  { label: 'معفوة',   bg: '#f1f5f9', color: '#64748b' },
  void:    { label: 'ملغاة',   bg: '#fef2f2', color: '#dc2626' },
};

export const DUNNING: Record<number, string> = {
  0: '—', 1: 'تذكير ٣ أيام', 2: 'تذكير ٧ أيام', 3: 'إشعار نهائي', 4: 'موقوف',
};

export const GW_LABELS: Record<string, string> = {
  stripe: 'Stripe', payfort: 'PayFort', telr: 'Telr', tap: 'Tap Payments',
};
