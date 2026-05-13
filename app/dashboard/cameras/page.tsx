'use client';
import { useState, useEffect, useRef } from 'react';
import { adminApi } from '@/lib/api';
import Icon from '@/components/Icon';

const LOCATIONS: Record<string, string> = {
  entrance: 'المدخل', exterior: 'الخارج', parking: 'الموقف',
  living: 'الصالة', bedroom: 'غرفة النوم', other: 'أخرى',
};

const EMPTY_FORM = {
  name: '', location_tag: 'entrance',
  device_serial: '', ezviz_email: '', ezviz_password: '',
  rtsp_url: '', rtsp_username: '', rtsp_password: '',
};

type StreamData = { hls?: string | null; rtmp?: string | null; flv?: string | null; rtsp?: string | null; provider?: string };

// ── EZVIZ OAuth Panel ─────────────────────────────────────────────────────────
function OAuthPanel({ companyId, showToast }: { companyId: string; showToast: (m: string) => void }) {
  const [status,   setStatus]   = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [working,  setWorking]  = useState(false);

  useEffect(() => {
    setLoading(true);
    adminApi.cameras.oauthStatus(companyId)
      .then((r: any) => setStatus(r.data))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, [companyId]);

  // Handle ?oauth=success in URL after callback redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('oauth') === 'success' && params.get('company_id') === companyId) {
      showToast('تم تفويض EZVIZ بنجاح');
      window.history.replaceState({}, '', window.location.pathname);
      adminApi.cameras.oauthStatus(companyId).then((r: any) => setStatus(r.data)).catch(() => {});
    }
    if (params.get('oauth') === 'error') {
      showToast(`خطأ في التفويض: ${params.get('msg') || 'حاول مجدداً'}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [companyId]);

  const handleAuthorize = async () => {
    setWorking(true);
    try {
      const r: any = await adminApi.cameras.oauthUrl(companyId);
      window.open(r.data.url, '_blank', 'width=520,height=620');
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setWorking(false);
  };

  const handleRevoke = async () => {
    if (!confirm('إلغاء تفويض EZVIZ لهذه الشركة؟')) return;
    setWorking(true);
    try {
      await adminApi.cameras.oauthRevoke(companyId);
      setStatus({ authorized: false });
      showToast('تم إلغاء التفويض');
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setWorking(false);
  };

  if (loading) return null;

  const authorized = status?.authorized && !status?.expired;
  const expired    = status?.authorized && status?.expired;

  return (
    <div style={{
      background: authorized ? '#f0fdf4' : expired ? '#fff8ee' : '#fef2f2',
      border: `1px solid ${authorized ? '#86efac' : expired ? '#fcd34d' : '#fca5a5'}`,
      borderRadius: 12, padding: '14px 18px', marginBottom: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
    }}>
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 3px',
          color: authorized ? '#15803d' : expired ? '#b45309' : '#dc2626' }}>
          {authorized ? 'مفوّض — EZVIZ' : expired ? 'انتهت صلاحية التفويض' : 'غير مفوّض — EZVIZ'}
        </p>
        <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
          {authorized
            ? `الوصول إلى الكاميرات الشخصية مفعّل · ${status.ezviz_user_id || ''}`
            : 'أرسل رابط التفويض لصاحب الكاميرا لتفعيل الوصول'}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {!authorized && (
          <button onClick={handleAuthorize} disabled={working}
            style={{ padding: '7px 16px', borderRadius: 8, background: '#0071e3', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            {working ? '...' : expired ? 'تجديد التفويض' : 'إنشاء رابط التفويض'}
          </button>
        )}
        {authorized && (
          <button onClick={handleRevoke} disabled={working}
            style={{ padding: '7px 14px', borderRadius: 8, background: 'white', color: '#dc2626', border: '1px solid #fca5a5', cursor: 'pointer', fontSize: 11 }}>
            إلغاء التفويض
          </button>
        )}
      </div>
    </div>
  );
}

// ── EZUIKit Live Player ───────────────────────────────────────────────────────
function StreamModal({ cam, data, onClose, showToast }: {
  cam: any; data: StreamData; onClose: () => void; showToast: (m: string) => void;
}) {
  const playerContainerId = 'ezviz-player-container';
  const [loading,   setLoading]   = useState(true);
  const [playerErr, setPlayerErr] = useState('');
  const playerRef = useRef<any>(null);

  useEffect(() => {
    let destroyed = false;

    async function init() {
      try {
        // Fetch accessToken + deviceSerial from API
        const r: any = await adminApi.cameras.playerToken(cam.id);
        if (destroyed) return;
        const { accessToken, ezOpenUrl } = r.data;

        // Load EZUIKit from EZVIZ CDN if not already loaded
        if (!(window as any).EZUIKit) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://open.ys7.com/sdk/js/latest/ezuikit.js';
            s.onload  = () => resolve();
            s.onerror = () => reject(new Error('فشل تحميل EZVIZ SDK'));
            document.head.appendChild(s);
          });
        }

        if (destroyed) return;

        playerRef.current = new (window as any).EZUIKitPlayer({
          id:          playerContainerId,
          accessToken,
          url:         ezOpenUrl,
          width:       660,
          height:      380,
          autoplay:    true,
          handleError: (e: any) => {
            setPlayerErr(`خطأ في البث: ${e?.msg || 'تحقق من اتصال الكاميرا'}`);
          },
        });
        setLoading(false);
      } catch (e: any) {
        if (!destroyed) setPlayerErr(e.message || 'فشل تهيئة المشغّل');
        setLoading(false);
      }
    }

    init();
    return () => {
      destroyed = true;
      try { playerRef.current?.stop?.(); } catch {}
    };
  }, [cam.id]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: '#0f172a', borderRadius: 16, padding: 20, maxWidth: 740, width: '95%' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', display: 'inline-block' }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>{cam.name} — بث مباشر</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
        </div>

        {/* Player area */}
        <div style={{ background: '#020617', borderRadius: 10, overflow: 'hidden', marginBottom: 14, minHeight: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {loading && !playerErr && (
            <p style={{ color: '#475569', fontSize: 12, position: 'absolute' }}>جاري تحميل البث...</p>
          )}
          {playerErr && (
            <p style={{ color: '#ef4444', fontSize: 12, textAlign: 'center', padding: '0 24px', position: 'absolute' }}>{playerErr}</p>
          )}
          <div id={playerContainerId} style={{ width: 660, height: 380 }} />
        </div>

        {/* URL copy cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.hls && (
            <div style={{ background: '#1e293b', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#38bdf8', minWidth: 36 }}>HLS</span>
              <p style={{ fontSize: 10, color: '#94a3b8', margin: 0, flex: 1, direction: 'ltr', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.hls}</p>
              <button onClick={() => { navigator.clipboard.writeText(data.hls!); showToast('تم النسخ'); }}
                style={{ padding: '3px 10px', borderRadius: 6, background: '#0f3460', color: '#38bdf8', border: 'none', cursor: 'pointer', fontSize: 10, flexShrink: 0 }}>نسخ</button>
            </div>
          )}
          {data.rtmp && (
            <div style={{ background: '#1e293b', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', minWidth: 36 }}>RTMP</span>
              <p style={{ fontSize: 10, color: '#94a3b8', margin: 0, flex: 1, direction: 'ltr', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.rtmp}</p>
              <button onClick={() => { navigator.clipboard.writeText(data.rtmp!); showToast('تم النسخ'); }}
                style={{ padding: '3px 10px', borderRadius: 6, background: '#2d1b69', color: '#a78bfa', border: 'none', cursor: 'pointer', fontSize: 10, flexShrink: 0 }}>نسخ</button>
            </div>
          )}
          <p style={{ fontSize: 10, color: '#334155', margin: '2px 0 0' }}>الروابط صالحة 30 دقيقة — اضغط "بث مباشر" مجدداً للتجديد</p>
        </div>
      </div>
    </div>
  );
}

export default function CamerasPage() {
  const [companies,   setCompanies]   = useState<any[]>([]);
  const [properties,  setProperties]  = useState<any[]>([]);
  const [cameras,     setCameras]     = useState<any[]>([]);
  const [snapshots,   setSnapshots]   = useState<Record<string, string>>({});
  const [statuses,    setStatuses]    = useState<Record<string, any>>({});
  const [streamModal, setStreamModal] = useState<{ cam: any; data: StreamData } | null>(null);
  const [alarmModal,  setAlarmModal]  = useState<{ cam: any; alarms: any[] } | null>(null);
  const [boundDevices, setBoundDevices] = useState<any[]>([]);

  const [companyId,   setCompanyId]   = useState('');
  const [propertyId,  setPropertyId]  = useState('');
  const [provider,    setProvider]    = useState<'ezviz' | 'rtsp'>('ezviz');
  const [form,        setForm]        = useState({ ...EMPTY_FORM });
  const [showForm,    setShowForm]    = useState(false);
  const [activeTab,   setActiveTab]   = useState<'cameras' | 'devices'>('cameras');

  const [loadingCo,    setLoadingCo]    = useState(true);
  const [loadingProp,  setLoadingProp]  = useState(false);
  const [loadingCam,   setLoadingCam]   = useState(false);
  const [loadingStream, setLoadingStream] = useState<string | null>(null);
  const [loadingAlarm,  setLoadingAlarm]  = useState<string | null>(null);
  const [propError,    setPropError]    = useState('');
  const [saving,       setSaving]       = useState(false);
  const [toast,        setToast]        = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };
  const f = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    adminApi.sa.listCompanies().then((r: any) => setCompanies(r.data || []))
      .catch(() => {}).finally(() => setLoadingCo(false));
    // Load bound devices
    adminApi.cameras.listBoundDevices?.().then((r: any) => setBoundDevices(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!companyId) { setProperties([]); setPropertyId(''); setCameras([]); return; }
    setLoadingProp(true); setPropertyId(''); setCameras([]); setPropError('');
    adminApi.sa.listCompanyProperties(companyId)
      .then((r: any) => { setProperties(r.data || []); if (!(r.data || []).length) setPropError('لا توجد عقارات لهذه الشركة'); })
      .catch((e: any) => { setProperties([]); setPropError(`خطأ: ${e.message}`); })
      .finally(() => setLoadingProp(false));
  }, [companyId]);

  useEffect(() => {
    if (!propertyId) { setCameras([]); return; }
    setLoadingCam(true);
    adminApi.cameras.listByProperty(propertyId)
      .then((r: any) => setCameras(r.data || []))
      .catch(() => setCameras([]))
      .finally(() => setLoadingCam(false));
  }, [propertyId]);

  const reloadCameras = () => {
    if (!propertyId) return;
    setLoadingCam(true);
    adminApi.cameras.listByProperty(propertyId)
      .then((r: any) => setCameras(r.data || []))
      .catch(() => {}).finally(() => setLoadingCam(false));
  };

  const handleAdd = async () => {
    if (!propertyId) return showToast('اختر عقاراً أولاً');
    if (!form.name) return showToast('اسم الكاميرا مطلوب');
    if (provider === 'ezviz' && (!form.device_serial || !form.ezviz_email || !form.ezviz_password))
      return showToast('Serial Number وبيانات حساب EZVIZ مطلوبة');
    if (provider === 'rtsp' && !form.rtsp_url) return showToast('RTSP URL مطلوب');
    setSaving(true);
    try {
      await adminApi.cameras.add(propertyId, { ...form, provider, company_id: companyId });
      showToast('تمت إضافة الكاميرا وربطها بحساب EZVIZ');
      setForm({ ...EMPTY_FORM }); setShowForm(false); reloadCameras();
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setSaving(false);
  };

  const handleRemove = async (cameraId: string, name: string) => {
    if (!confirm(`حذف كاميرا "${name}"؟`)) return;
    try { await adminApi.cameras.remove(cameraId); showToast('تم الحذف'); reloadCameras(); }
    catch (e: any) { showToast(`خطأ: ${e.message}`); }
  };

  const handleSnapshot = async (cameraId: string) => {
    try {
      const r: any = await adminApi.cameras.snapshot(cameraId);
      if (r.data?.url) setSnapshots(p => ({ ...p, [cameraId]: r.data.url }));
      showToast('تم التقاط الصورة');
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
  };

  const handleStatus = async (cameraId: string) => {
    try {
      const r: any = await adminApi.cameras.status(cameraId);
      setStatuses(p => ({ ...p, [cameraId]: r.data }));
    } catch (e: any) { showToast(`خطأ في حالة الكاميرا: ${e.message}`); }
  };

  const handleStream = async (cam: any) => {
    setLoadingStream(cam.id);
    try {
      const r: any = await adminApi.cameras.stream(cam.id);
      setStreamModal({ cam, data: r.data || {} });
    } catch (e: any) { showToast(`خطأ في رابط البث: ${e.message}`); }
    setLoadingStream(null);
  };

  const handleAlarms = async (cam: any) => {
    setLoadingAlarm(cam.id);
    try {
      const r: any = await adminApi.cameras.alarms(cam.id);
      setAlarmModal({ cam, alarms: r.data || [] });
    } catch (e: any) { showToast(`خطأ: ${e.message}`); }
    setLoadingAlarm(null);
  };

  const inp = {
    padding: '8px 12px', borderRadius: 10, border: '1px solid var(--lv-line)',
    fontSize: 12, background: 'var(--lv-bg)', color: 'var(--lv-fg)',
    width: '100%', boxSizing: 'border-box' as const,
  };

  const selectedCompany  = companies.find(c => c.id === companyId);
  const selectedProperty = properties.find(p => p.id === propertyId);
  const propLabel = (p: any) => p.name_ar || p.name_en || p.id;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: 'var(--lv-accent)', color: '#fff', padding: '7px 20px', borderRadius: 7, fontSize: 12, zIndex: 9999, boxShadow: '0 2px 8px rgba(124,92,252,.3)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Icon name="camera" size={18} color="var(--lv-accent)" />
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--lv-fg)', margin: 0 }}>إدارة الكاميرات</h1>
        </div>
        <p style={{ fontSize: 12, color: 'var(--lv-muted)', margin: 0 }}>
          EZVIZ Open Platform — ربط كاميرات EZVIZ وRTSP بعقارات الشركات
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['cameras', 'devices'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding: '6px 18px', borderRadius: 8, border: '1px solid var(--lv-line)', fontSize: 12, cursor: 'pointer', fontWeight: 500,
              background: activeTab === t ? 'var(--lv-accent)' : 'var(--lv-bg)',
              color: activeTab === t ? '#fff' : 'var(--lv-fg)' }}>
            {t === 'cameras' ? 'كاميرات العقارات' : 'الأجهزة المربوطة'}
          </button>
        ))}
      </div>

      {/* ── Tab: Bound Devices ── */}
      {activeTab === 'devices' && (
        <div style={{ background: 'var(--lv-panel)', borderRadius: 14, border: '1px solid var(--lv-line)', padding: '18px 22px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--lv-muted)', margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            أجهزة مربوطة بحساب EZVIZ المطور ({boundDevices.length})
          </p>
          {boundDevices.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--lv-muted)' }}>لا توجد أجهزة مربوطة بعد — أضف كاميرا من تبويب "كاميرات العقارات"</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {boundDevices.map((d: any) => (
                <div key={d.deviceSerial} style={{ background: 'var(--lv-bg)', borderRadius: 10, border: '1px solid var(--lv-line)', padding: '12px 14px' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px', color: 'var(--lv-fg)' }}>{d.deviceName || d.deviceSerial}</p>
                  <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 2px', direction: 'ltr' }}>{d.deviceSerial}</p>
                  <p style={{ fontSize: 11, margin: 0 }}>
                    <span style={{ padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                      background: d.status === 1 ? '#f0fdf4' : '#fef2f2',
                      color: d.status === 1 ? '#16a34a' : '#dc2626' }}>
                      {d.status === 1 ? 'متصل' : 'غير متصل'}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Cameras ── */}
      {activeTab === 'cameras' && (
        <>
          {/* Step 1 — Company */}
          <div style={{ background: 'var(--lv-panel)', borderRadius: 14, border: '1px solid var(--lv-line)', padding: '18px 22px', marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--lv-muted)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>1 — اختر الشركة</p>
            {loadingCo ? <p style={{ fontSize: 12, color: 'var(--lv-muted)' }}>جاري التحميل...</p> : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {companies.map((c: any) => (
                  <button key={c.id} onClick={() => setCompanyId(c.id)}
                    style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--lv-line)', fontSize: 12, cursor: 'pointer', fontWeight: 500,
                      background: companyId === c.id ? 'var(--lv-accent)' : 'var(--lv-bg)',
                      color: companyId === c.id ? '#fff' : 'var(--lv-fg)' }}>
                    {c.name || c.name_ar}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* OAuth Authorization Panel */}
          {companyId && <OAuthPanel companyId={companyId} showToast={showToast} />}

          {/* Step 2 — Property */}
          {companyId && (
            <div style={{ background: 'var(--lv-panel)', borderRadius: 14, border: '1px solid var(--lv-line)', padding: '18px 22px', marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--lv-muted)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                2 — اختر العقار · {selectedCompany?.name || selectedCompany?.name_ar}
              </p>
              {loadingProp ? <p style={{ fontSize: 12, color: 'var(--lv-muted)' }}>جاري التحميل...</p>
                : properties.length === 0 ? <p style={{ fontSize: 12, color: propError ? '#ef4444' : 'var(--lv-muted)' }}>{propError || 'لا توجد عقارات'}</p>
                : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {properties.map((p: any) => (
                      <button key={p.id} onClick={() => setPropertyId(p.id)}
                        style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--lv-line)', fontSize: 12, cursor: 'pointer', fontWeight: 500,
                          background: propertyId === p.id ? 'var(--lv-accent)' : 'var(--lv-bg)',
                          color: propertyId === p.id ? '#fff' : 'var(--lv-fg)' }}>
                        {propLabel(p)}
                      </button>
                    ))}
                  </div>
                )}
            </div>
          )}

          {/* Step 3 — Camera list */}
          {propertyId && (
            <>
              <div style={{ background: 'var(--lv-panel)', borderRadius: 14, border: '1px solid var(--lv-line)', padding: '18px 22px', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--lv-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    3 — الكاميرات · {selectedProperty ? propLabel(selectedProperty) : ''} ({cameras.length})
                  </p>
                  <button onClick={() => { setShowForm(f => !f); setForm({ ...EMPTY_FORM }); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: 'var(--lv-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                    <Icon name="plus" size={12} color="#fff" />
                    إضافة كاميرا
                  </button>
                </div>

                {loadingCam ? <p style={{ fontSize: 12, color: 'var(--lv-muted)' }}>جاري التحميل...</p>
                  : cameras.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                      <Icon name="camera" size={32} color="var(--lv-line)" />
                      <p style={{ fontSize: 13, color: 'var(--lv-muted)', marginTop: 10 }}>لا توجد كاميرات لهذا العقار</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                      {cameras.map((cam: any) => {
                        const status = statuses[cam.id];
                        return (
                          <div key={cam.id} style={{ background: 'var(--lv-bg)', borderRadius: 12, border: '1px solid var(--lv-line)', overflow: 'hidden' }}>
                            {/* Snapshot preview */}
                            <div style={{ background: '#0f172a', aspectRatio: '16/9', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {snapshots[cam.id] ? (
                                <img src={snapshots[cam.id]} alt="snap" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                              ) : (
                                <Icon name="camera" size={24} color="#334155" />
                              )}
                              {/* Provider badge */}
                              <span style={{ position: 'absolute', top: 6, right: 6, fontSize: 10, padding: '2px 7px', borderRadius: 5,
                                background: cam.provider === 'rtsp' ? 'rgba(59,130,246,.85)' : 'rgba(124,92,252,.85)',
                                color: '#fff', fontWeight: 600 }}>
                                {cam.provider?.toUpperCase()}
                              </span>
                              {/* Online status dot */}
                              {status && (
                                <span style={{ position: 'absolute', top: 6, left: 6, width: 8, height: 8, borderRadius: '50%',
                                  background: status.online ? '#22c55e' : '#ef4444',
                                  boxShadow: status.online ? '0 0 6px #22c55e' : 'none' }} />
                              )}
                            </div>

                            <div style={{ padding: '10px 12px' }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--lv-fg)', margin: '0 0 2px' }}>{cam.name}</p>
                              <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 8px' }}>
                                {LOCATIONS[cam.location_tag] || cam.location_tag}
                                {cam.device_serial && !cam.device_serial.startsWith('rtsp_') ? ` · ${cam.device_serial}` : ''}
                              </p>

                              {/* Last alarm info */}
                              {status?.last_alarm_time && (
                                <p style={{ fontSize: 10, color: '#f59e0b', margin: '0 0 8px' }}>
                                  آخر حركة: {new Date(status.last_alarm_time).toLocaleString('ar-SA')}
                                </p>
                              )}

                              {/* Action buttons */}
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {cam.provider === 'ezviz' && (
                                  <button onClick={() => handleStream(cam)} disabled={loadingStream === cam.id}
                                    style={{ flex: 1, padding: '5px 0', borderRadius: 7, background: '#0f172a', color: '#38bdf8', border: '1px solid #1e3a5f', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                                    {loadingStream === cam.id ? '...' : 'بث مباشر'}
                                  </button>
                                )}
                                <button onClick={() => handleSnapshot(cam.id)}
                                  style={{ flex: 1, padding: '5px 0', borderRadius: 7, background: 'var(--lv-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
                                  لقطة
                                </button>
                                <button onClick={() => handleStatus(cam.id)}
                                  style={{ padding: '5px 8px', borderRadius: 7, background: 'var(--lv-panel)', color: 'var(--lv-muted)', border: '1px solid var(--lv-line)', cursor: 'pointer', fontSize: 11 }}>
                                  <Icon name="refresh" size={11} color="var(--lv-muted)" />
                                </button>
                                {cam.provider === 'ezviz' && (
                                  <button onClick={() => handleAlarms(cam)} disabled={loadingAlarm === cam.id}
                                    style={{ padding: '5px 8px', borderRadius: 7, background: '#fff8ee', color: '#d97706', border: '1px solid #fde68a', cursor: 'pointer', fontSize: 11 }}>
                                    {loadingAlarm === cam.id ? '...' : <Icon name="bell" size={11} color="#d97706" />}
                                  </button>
                                )}
                                <button onClick={() => handleRemove(cam.id, cam.name)}
                                  style={{ padding: '5px 8px', borderRadius: 7, background: '#fef2f2', color: '#ef4444', border: '1px solid rgba(239,68,68,.2)', cursor: 'pointer', fontSize: 11 }}>
                                  <Icon name="trash" size={11} color="#ef4444" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
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
                    <>
                      <div style={{ background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 11, color: '#1d4ed8' }}>
                        أدخل Serial Number من ملصق الكاميرا، وبيانات تسجيل الدخول في تطبيق EZVIZ
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>Serial Number *</p>
                        <input value={form.device_serial} onChange={f('device_serial')} dir="ltr" style={inp} placeholder="BG8598562" />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                        <div>
                          <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>EZVIZ Email *</p>
                          <input value={form.ezviz_email} onChange={f('ezviz_email')} dir="ltr" style={inp} placeholder="you@example.com" type="email" />
                        </div>
                        <div>
                          <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: '0 0 4px', fontWeight: 500 }}>EZVIZ Password *</p>
                          <input value={form.ezviz_password} onChange={f('ezviz_password')} dir="ltr" style={inp} placeholder="••••••••" type="password" />
                        </div>
                      </div>
                    </>
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
                      {saving ? 'جاري الربط...' : 'إضافة الكاميرا'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Stream Modal ── */}
      {streamModal && (
        <StreamModal
          cam={streamModal.cam}
          data={streamModal.data}
          onClose={() => setStreamModal(null)}
          showToast={showToast}
        />
      )}

      {/* ── Alarms Modal ── */}
      {alarmModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setAlarmModal(null)}>
          <div style={{ background: 'var(--lv-panel)', borderRadius: 16, padding: 24, maxWidth: 560, width: '90%', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--lv-fg)', margin: 0 }}>{alarmModal.cam.name} — سجل التنبيهات</p>
              <button onClick={() => setAlarmModal(null)} style={{ background: 'none', border: 'none', color: 'var(--lv-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            {alarmModal.alarms.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--lv-muted)', textAlign: 'center', padding: '24px 0' }}>لا توجد تنبيهات في آخر 7 أيام</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {alarmModal.alarms.map((a: any) => (
                  <div key={a.alarm_id} style={{ background: 'var(--lv-bg)', borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center' }}>
                    {a.pic_url && <img src={a.pic_url} alt="alarm" style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--lv-fg)', margin: '0 0 2px' }}>{a.type_name || a.type}</p>
                      <p style={{ fontSize: 11, color: 'var(--lv-muted)', margin: 0 }}>{new Date(a.occurred_at).toLocaleString('ar-SA')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
