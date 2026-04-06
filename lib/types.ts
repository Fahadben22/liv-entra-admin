// ─── Shared TypeScript types for SaaS Admin ─────────────────────────────────

export interface Company {
  id: string;
  name: string;
  name_ar?: string;
  slug: string;
  plan: string;
  plan_id?: string;
  lifecycle_status: string;
  is_active: boolean;
  contact_email?: string;
  contact_phone?: string;
  city?: string;
  cr_number?: string;
  max_units: number;
  max_staff: number;
  max_properties: number;
  max_contracts: number;
  trial_ends_at?: string;
  suspended_at?: string;
  suspended_reason?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  subscription?: Subscription;
  health?: HealthMetrics;
}

export interface Subscription {
  id: string;
  status: string;
  billing_cycle: string;
  current_period_end?: string;
  plan?: {
    name: string;
    name_ar: string;
    price_monthly: number;
    price_yearly?: number;
  };
}

export interface HealthMetrics {
  score: number;
  grade: string;
  occupancy: number;
  collection_rate: number;
  maintenance_response: number;
  feature_adoption: number;
}

export interface UsageData {
  units:      { used: number; max: number; pct: number };
  staff:      { used: number; max: number; pct: number };
  properties: { used: number; max: number; pct: number };
  contracts:  { used: number; max: number; pct: number };
}

export interface CompanyFlag {
  feature_key: string;
  name_ar?: string;
  tier_min: string;
  beta?: boolean;
  is_enabled: boolean;
  rollout_pct: number;
  set_at?: string;
  plan_includes?: boolean;
}

export interface Plan {
  id: string;
  name: string;
  name_ar: string;
  price_monthly: number;
  price_yearly?: number;
  max_units: number;
  max_users: number;
  max_properties: number;
  max_contracts: number;
  features?: string[];
  is_active: boolean;
}

export interface AuditEntry {
  id: string;
  actor_email?: string;
  actor_role?: string;
  action: string;
  target_type?: string;
  target_id?: string;
  ip_address?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export type LifecycleStatus = 'trial' | 'active' | 'overdue' | 'suspended' | 'deleted';
