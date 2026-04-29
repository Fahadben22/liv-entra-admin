'use client';
import { useState, useEffect } from 'react';
import { adminApi } from '@/lib/api';
import Icon from '@/components/Icon';

const LOCATIONS: Record<string, string> = {
  entrance: 'المدخل', exterior: 'الخارج', parking: 'الموقف',
  living: 'الصالة', bedroom: 'غرفة النوم', other: 'أخرى',
};

const EMPTY_FORM = {
  name: '', location_tag: 'entrance',
  device_serial: '', ezviz_email: '', ezviz_password: '',
  ezviz_region: 'apiisgp.ezvizlife.com',
  rtsp_url: '', rtsp_username: '', rtsp_password: '',
};

export default function CamerasPage() {
  const [companies,   setCompanies]   = useState<any[]>([]);
  const [properties,  setProperties]  = useState<any[]>([]);
  const [cameras,     setCameras]     = useState<any[]>([]);
  const [snapshots,   setSnapshots]   = useState<Record<string, string>>({});

  const [companyId,   setCompanyId]   = useState('');
  const [propertyId,  setPropertyId]  = useState('');
  const [provider,    setProvider]    = useState<'ezviz' | 'rtsp'>('ezviz');
  const [form,        setForm]        = useState({ ...EMPTY_FORM });
  const [showForm,    setShowForm]    = useState(false);

  const [loadingCo,   setLoadingCo]   = useState(true);
  const [loadingProp, setLoadingProp] = useState(false);
  const [loadingCam,  setLoadingCam]  = useState(false);
  const [propError,   setPropError]   = useState('');
  const [saving,      setSaving]      = useState(false);
  const [toast,       setToast]       = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  // Load companies on mount
  useEffect(() => {
    adminApi.sa.listCompanies().then((r: any) => {
      setCompanies(r.data || []);
    }).catch(() => {}).finally(() => setLoadingCo(false));
  }, []);

  // Load properties when company changes
  useEffect(() => {
    if (!companyId) { setProperties([]); setPropertyId(''); setCameras([]); return; }
    setLoadingProp(true);
    setPropertyId('');
    setCameras([]);
    setPropError('');
    adminApi.sa.listCompanyProperties(companyId).then((r: any) => {
      setProperties(r.data || []);
      if ((r.data || []).length === 0) setPropError('لا توجد عقارات — تحقق أن الشركة لديها عقارات مسجلة في النظام');
    }).catch((e: any) => {
      setProperties([]);
      setPropError(`خطأ في تحميل العقارات: ${e.message}`);
    }).finally(() => setLoadingProp(false));
  }, [companyId]);

  // Load cameras when property changes
  useEffect(() => {
    if (!propertyId) { setCameras([]); return; }
    setLoadingCam(true);
    adminApi.cameras.listByProperty(propertyId).then((r: any) => {
      setCameras(r.data || []);
    }).catch(() => setCameras([])).finally(() => setLoadingCam(false));
  }, [propertyId]);

  const reloadCameras = () => {
    if (!propertyId) return;
    setLoadingCam(true);
    adminApi.cameras.listByProperty(propertyId).then((r: any) => {
      setCameras(r.data || []);
    }).catch(() => {}).finally(() => setLoadingCam(false));
  };

  const handleAdd = async () => {
    if (!propertyId) return showToast('اختر عقاراً أولاً');
    if (!form.name) return showToast('اسم الكاميرا مطلوب');
    if (provider === 'ezviz' && (!form.device_serial || !form.ezviz_email || !form.ezviz_password)) {
      return showToast('جميع حقول EZVIZ مطلوبة');
    }
    if (provider === 'rtsp' && !form.rtsp_url) return showToast('RTSP URL مطلوب');
    setSaving(true);
    try {
      await adminApi.cameras.add(propertyId, { ...form, provider, company_id: companyId });
      showToast('تمت إضافة الكاميرا');
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      reloadCameras();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setSaving(false);
  };

  const handleRemove = async (cameraId: string, name: string) => {
    if (!confirm(`حذف كاميرا "${name}"؟`)) return;
    try {
      await adminApi.cameras.remove(cameraId);
      showToast('تم الحذف');
      reloadCameras();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
  };

  const handleSnapshot = async (cameraId: string) => {
    try {
      const r: any = await adminApi.cameras.snapshot(cameraId);
      if (r.data?.url) setSnapshots(p => ({ ...p, [cameraId]: r.data.url }));
      showToast('تم التقاط الصورة');
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
  };

  const f = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const inp = {
    padding: '8px 12px', borderRadius: 10, border: '1px solid var(--lv-line)',
    fontSize: 12, background: 'var(--lv-bg)', color: 'var(--lv-fg)',
    width: '100%', boxSizing: 'border-box' as const,
  };

  const selectedCompany = companies.find(c => c.id === companyId);
  const selectedProperty = properties.find(p => p.id === propertyId);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: 'var(--lv-accent)', color: '#fff', padding: '7px 20px', borderRadius: 7, fontSize: 12, zIndex: 9999, boxShadow: '0 2px 8px rgba(124,92,252,.3)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Icon name="camera" size={18} color="var(--lv-accent)" />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--lv-fg)', margin: 0, letterSpacing: '-0.02em' }}>
            إدارة الكاميرات
          </h1>
        </div>
        <p style={{ fontSize: 12, color: 'var(--lv-muted)', margin: 0 }}>
          ربط كاميرات EZVIZ أو RTSP بعقارات الشركات — ميزة إضافية مُدارة من الأدمن
        </p>
      </div>

      {/* Step 1 — Company */}
      <div style={{ background: 'var(--lv-panel)', borderRadius: 14, border: '1px solid var(--lv-line)', padding: '18px 22px', marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--lv-muted)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          1 — اختر الشركة
        </p>
        {loadingCo ? (
          <p style={{ fontSize: 12, color: 'var(--lv-muted)' }}>جاري التحميل...</p>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {companies.map((c: any) => (
              <button key={c.id} onClick={() => setCompanyId(c.id)}
                style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--lv-line)', fontSize: 12, cursor: 'pointer', fontWeight: 500, transition: 'all .1s',
                  background: companyId === c.id ? 'var(--lv-accent)' : 'var(--lv-bg)',
                  color: companyId === c.id ? '#fff' : 'var(--lv-fg)' }}>
                {c.name || c.name_ar}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Step 2 — Property */}
      {companyId && (
        <div style={{ background: 'var(--lv-panel)', borderRadius: 14, border: '1px solid var(--lv-line)', padding: '18px 22px', marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--lv-muted)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            2 — اختر العقار · {selectedCompany?.name}
          </p>
          {loadingProp ? (
            <p style={{ fontSize: 12, color: 'var(--lv-muted)' }}>جاري التحميل...</p>
          ) : properties.length === 0 ? (
            <p style={{ fontSize: 12, color: propError ? '#ef4444' : 'var(--lv-muted)' }}>{propError || 'لا توجد عقارات لهذه الشركة'}</p>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {properties.map((p: any) => (
                <button key={p.id} onClick={() => setPropertyId(p.id)}
                  style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--lv-line)', fontSize: 12, cursor: 'pointer', fontWeight: 500, transition: 'all .1s',
                    background: propertyId === p.id ? 'var(--lv-accent)' : 'var(--lv-bg)',
                    color: propertyId === p.id ? '#fff' : 'var(--lv-fg)' }}>
                  {p.name || p.name_ar}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Cameras */}
      {propertyId && (
        <>
          {/* Camera list */}
          <div style={{ background: 'var(--lv-panel)', borderRadius: 14, border: '1px solid var(--lv-line)', padding: '18px 22px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--lv-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                3 — الكاميرات · {selectedProperty?.name} ({cameras.length})
              </p>
              <button onClick={() => { setShowForm(f => !f); setForm({ ...EMPTY_FORM }); }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: 'var(--lv-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                <Icon name="plus" size={12} color="#fff" />
                إضافة كاميرا
              </button>
            </div>

            {loadingCam ? (
              <p style={{ fontSize: 12, color: 'var(--lv-muted)' }}>جاري التحميل...</p>
            ) : cameras.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <Icon name="camera" size={32} color="var(--lv-line)" />
                <p style={{ fontSize: 13, color: 'var(--lv-muted)', marginTop: 10 }}>لا توجد كاميرات لهذا العقار</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {cameras.map((cam: any) => (
                  <div key={cam.id} style={{ background: 'var(--lv-bg)', borderRadius: 12, border: '1px solid var(--lv-line)', overflow: 'hidden' }}>
                    {/* Snapshot */}
                    <div style={{ background: '#0f172a', aspectRatio: '16/9', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {snapshots[cam.id] ? (
                        <img src={snapshots[cam.id]} alt="snap" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                      ) : (
                        <Icon name="camera" size={24} color="#334155" />
                      )}
                      <span style={{ position: 'absolute', top: 6, right: 6, fontSize: 10, padding: '2px 7px', borderRadius: 5, background: cam.provider === 'rtsp' ? 'rgba(59,130,246,.85)' : 'rgba(124,92,252,.85)', color: '#fff', fontWeight: 600 }}>
                        {cam.provider?.toUpperCase()}
                      </span>
                    </div>
                    {/* Info */}
                    <div style={{ padding: '10px 12px' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--lv-fg)', margin: '0 0 2px' }}>{cam.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 8px' }}>
                        {LOCATIONS[cam.location_tag] || cam.location_tag}
                        {cam.device_serial ? ` · ${cam.device_serial}` : ''}
                      </p>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => handleSnapshot(cam.id)}
                          style={{ flex: 1, padding: '5px 0', borderRadius: 7, background: 'var(--lv-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                          التقاط
                        </button>
                        <button onClick={() => handleRemove(cam.id, cam.name)}
                          style={{ padding: '5px 10px', borderRadius: 7, background: '#fef2f2', color: '#ef4444', border: '1px solid rgba(239,68,68,.2)', cursor: 'pointer', fontSize: 11 }}>
                          <Icon name="trash" size={12} color="#ef4444" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Camera Form */}
          {showForm && (
            <div style={{ background: 'var(--lv-panel)', borderRadius: 14, border: '2px solid var(--lv-accent)', padding: '20px 22px' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--lv-fg)', margin: '0 0 16px' }}>ربط كاميرا جديدة</p>

              {/* Provider toggle */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {(['ezviz', 'rtsp'] as const).map(p => (
                  <button key={p} onClick={() => setProvider(p)}
                    style={{ padding: '6px 18px', borderRadius: 8, border: '1px solid var(--lv-line)', fontSize: 12, cursor: 'pointer', fontWeight: 500,
                      background: provider === p ? 'var(--lv-accent)' : 'var(--lv-bg)',
                      color: provider === p ? '#fff' : 'var(--lv-fg)' }}>
                    {p === 'ezviz' ? 'EZVIZ' : 'RTSP — أي كاميرا'}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>اسم الكاميرا *</p>
                  <input value={form.name} onChange={f('name')} style={inp} placeholder="كاميرا المدخل" />
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>الموقع</p>
                  <select value={form.location_tag} onChange={f('location_tag')} style={inp}>
                    {Object.entries(LOCATIONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>

              {provider === 'ezviz' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>Serial Number *</p>
                    <input value={form.device_serial} onChange={f('device_serial')} dir="ltr" style={inp} placeholder="BG8598562" />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>إيميل EZVIZ *</p>
                    <input value={form.ezviz_email} onChange={f('ezviz_email')} type="email" dir="ltr" style={inp} placeholder="owner@email.com" />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>كلمة مرور EZVIZ *</p>
                    <input value={form.ezviz_password} onChange={f('ezviz_password')} type="password" dir="ltr" style={inp} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>Region</p>
                    <input value={form.ezviz_region} onChange={f('ezviz_region')} dir="ltr" style={inp} />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>RTSP URL *</p>
                    <input value={form.rtsp_url} onChange={f('rtsp_url')} dir="ltr" style={inp} placeholder="rtsp://192.168.1.100:554/stream1" />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>Username (اختياري)</p>
                    <input value={form.rtsp_username} onChange={f('rtsp_username')} dir="ltr" style={inp} placeholder="admin" />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>Password (اختياري)</p>
                    <input value={form.rtsp_password} onChange={f('rtsp_password')} type="password" dir="ltr" style={inp} />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowForm(false)}
                  style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid var(--lv-line)', background: 'var(--lv-bg)', color: 'var(--lv-muted)', fontSize: 12, cursor: 'pointer' }}>
                  إلغاء
                </button>
                <button onClick={handleAdd} disabled={saving}
                  style={{ padding: '8px 22px', borderRadius: 10, background: 'var(--lv-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                  {saving ? '...' : 'إضافة الكاميرا'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
