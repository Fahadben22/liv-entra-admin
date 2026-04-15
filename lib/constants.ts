// ─── Shared constants for SaaS Admin ─────────────────────────────────────────

export const CITIES = [
  'الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر',
  'الأحساء', 'تبوك', 'أبها', 'القصيم', 'حائل', 'جازان', 'نجران', 'الطائف',
  'بريدة', 'ينبع',
];

export const STAGES = [
  { key: 'trial',     label: 'تجريبي',  color: '#f59e0b', bg: '#fefce8', border: '#fde68a', icon: '⏳' },
  { key: 'active',    label: 'نشط',      color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0', icon: '✅' },
  { key: 'overdue',   label: 'متأخر',    color: '#f97316', bg: '#fff7ed', border: '#fed7aa', icon: '⚠️' },
  { key: 'suspended', label: 'موقوف',    color: '#ef4444', bg: '#fef2f2', border: '#fecaca', icon: '🔴' },
] as const;

export const LC_MAP: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  trial:     { bg: '#fefce8', color: '#854d0e', dot: '#f59e0b', label: 'تجريبي' },
  active:    { bg: '#f0fdf4', color: '#15803d', dot: '#22c55e', label: 'نشط' },
  overdue:   { bg: '#fff7ed', color: '#c2410c', dot: '#f97316', label: 'متأخر' },
  suspended: { bg: '#fef2f2', color: '#dc2626', dot: '#ef4444', label: 'موقوف' },
  deleted:   { bg: '#f1f5f9', color: '#94a3b8', dot: '#94a3b8', label: 'محذوف' },
};

export const PLAN_AR: Record<string, string> = {
  trial: 'تجريبي', basic: 'أساسي', professional: 'احترافي', enterprise: 'مؤسسي',
};

export const PLAN_COLORS: Record<string, string> = {
  trial: '#64748b', basic: '#0284c7', professional: '#7c3aed', enterprise: '#b45309',
};

export const NAV_ITEMS = [
  { href: '/dashboard',                label: 'لوحة التحكم',    section: 'main' },
  { href: '/dashboard/companies',      label: 'الشركات',        section: 'main' },
  { href: '/dashboard/features',       label: 'الميزات',        section: 'main' },
  { href: '/dashboard/billing',        label: 'الفواتير',       section: 'main' },
  { href: '/dashboard/intelligence',    label: 'الذكاء العقاري',  section: 'ops' },
  { href: '/dashboard/activity',       label: 'نشاط العملاء',   section: 'ops' },
  { href: '/dashboard/command-center', label: 'مركز القيادة',   section: 'ops' },
  { href: '/dashboard/agents',         label: 'الوكلاء',        section: 'ops' },
  { href: '/dashboard/leads',          label: 'طلبات العرض',    section: 'growth' },
  { href: '/dashboard/demo-leads',     label: 'قيادات الديمو',  section: 'growth' },
  { href: '/dashboard/landing-page/analytics', label: 'تحليلات الموقع', section: 'growth' },
  { href: '/dashboard/template-center',label: 'القوالب',        section: 'settings' },
  { href: '/dashboard/landing-page',   label: 'الموقع',         section: 'settings' },
  { href: '/dashboard/audit',          label: 'التدقيق',        section: 'settings' },
  { href: '/dashboard/maintenance-flows', label: 'مسارات الصيانة',  section: 'settings' },
];

export const NAV_SECTIONS: Record<string, string> = {
  main: 'إدارة',
  ops: 'العمليات',
  growth: 'النمو',
  settings: 'الإعدادات',
};
