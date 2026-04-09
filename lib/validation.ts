// lib/validation.ts
// Validation rules engine — used by useFormValidation hook and FormField components.

export type ValidationRule = {
  test: (value: any) => boolean;
  message: string;
};

// ─── Built-in rules ──────────────────────────────────────────────────────────

export const rules = {
  required: (msg = 'هذا الحقل مطلوب'): ValidationRule => ({
    test: (v) => v !== undefined && v !== null && String(v).trim().length > 0,
    message: msg,
  }),

  email: (msg = 'البريد الإلكتروني غير صالح — مثال: name@company.com'): ValidationRule => ({
    test: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)),
    message: msg,
  }),

  phone: (msg = 'رقم الجوال غير صالح — يجب أن يبدأ بـ 05 أو رمز دولي'): ValidationRule => ({
    test: (v) => !v || /^(\+?\d{1,4})?[\s-]?\d{7,14}$/.test(String(v).replace(/\s/g, '')),
    message: msg,
  }),

  minLength: (min: number, msg?: string): ValidationRule => ({
    test: (v) => !v || String(v).length >= min,
    message: msg || `يجب أن يكون ${min} أحرف على الأقل`,
  }),

  maxLength: (max: number, msg?: string): ValidationRule => ({
    test: (v) => !v || String(v).length <= max,
    message: msg || `يجب ألا يتجاوز ${max} حرف`,
  }),

  min: (min: number, msg?: string): ValidationRule => ({
    test: (v) => !v || Number(v) >= min,
    message: msg || `يجب أن يكون ${min} أو أكثر`,
  }),

  max: (max: number, msg?: string): ValidationRule => ({
    test: (v) => !v || Number(v) <= max,
    message: msg || `يجب ألا يتجاوز ${max}`,
  }),

  pattern: (regex: RegExp, msg: string): ValidationRule => ({
    test: (v) => !v || regex.test(String(v)),
    message: msg,
  }),

  slug: (msg = 'يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطة فقط'): ValidationRule => ({
    test: (v) => !v || /^[a-z0-9-]+$/.test(String(v)),
    message: msg,
  }),

  url: (msg = 'رابط غير صالح — مثال: https://example.com'): ValidationRule => ({
    test: (v) => !v || /^https?:\/\/.+/.test(String(v)),
    message: msg,
  }),

  match: (otherValue: () => string, msg = 'القيمتان غير متطابقتين'): ValidationRule => ({
    test: (v) => !v || String(v) === otherValue(),
    message: msg,
  }),
};

// ─── Validate a single field against its rules ───────────────────────────────
export function validateField(value: any, fieldRules: ValidationRule[]): string | undefined {
  for (const rule of fieldRules) {
    if (!rule.test(value)) return rule.message;
  }
  return undefined;
}

// ─── Validate all fields in a form ───────────────────────────────────────────
export function validateForm(
  values: Record<string, any>,
  schema: Record<string, ValidationRule[]>
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [field, fieldRules] of Object.entries(schema)) {
    const error = validateField(values[field], fieldRules);
    if (error) errors[field] = error;
  }
  return errors;
}
