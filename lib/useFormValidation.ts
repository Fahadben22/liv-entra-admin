// lib/useFormValidation.ts
// React hook for form validation — manages touched state, validates on blur, returns errors.

import { useState, useCallback } from 'react';
import { ValidationRule, validateField, validateForm } from './validation';

interface UseFormValidationOptions<T extends Record<string, any>> {
  initialValues: T;
  schema: Partial<Record<keyof T, ValidationRule[]>>;
  onSubmit?: (values: T) => void | Promise<void>;
}

interface FormState<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isSubmitting: boolean;
  isValid: boolean;
}

export function useFormValidation<T extends Record<string, any>>({
  initialValues,
  schema,
  onSubmit,
}: UseFormValidationOptions<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set a single field value
  const setValue = useCallback((field: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
    // Clear error on change if field was touched
    if (touched[field]) {
      const fieldRules = schema[field];
      if (fieldRules) {
        const error = validateField(value, fieldRules);
        setErrors(prev => {
          const next = { ...prev };
          if (error) next[field] = error;
          else delete next[field];
          return next;
        });
      }
    }
  }, [schema, touched]);

  // onChange handler factory — for use with <input onChange={field('name')}>
  const field = useCallback((name: keyof T) => ({
    value: values[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
      setValue(name, val);
    },
    onBlur: () => {
      setTouched(prev => ({ ...prev, [name]: true }));
      const fieldRules = schema[name];
      if (fieldRules) {
        const error = validateField(values[name], fieldRules);
        setErrors(prev => {
          const next = { ...prev };
          if (error) next[name] = error;
          else delete next[name];
          return next;
        });
      }
    },
    error: touched[name] ? errors[name] : undefined,
  }), [values, errors, touched, schema, setValue]);

  // Validate all fields
  const validateAll = useCallback((): boolean => {
    const allErrors = validateForm(values, schema as Record<string, ValidationRule[]>);
    setErrors(allErrors as Partial<Record<keyof T, string>>);
    // Mark all as touched
    const allTouched: Partial<Record<keyof T, boolean>> = {};
    for (const key of Object.keys(schema)) allTouched[key as keyof T] = true;
    setTouched(allTouched);
    return Object.keys(allErrors).length === 0;
  }, [values, schema]);

  // Submit handler
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validateAll()) return;
    if (!onSubmit) return;
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validateAll, onSubmit]);

  // Reset form
  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  const isValid = Object.keys(errors).length === 0;

  return {
    values, errors, touched, isSubmitting, isValid,
    setValue, field, validateAll, handleSubmit, reset,
    setValues,
  };
}
