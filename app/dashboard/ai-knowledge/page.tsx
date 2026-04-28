'use client';
import { useEffect, useRef, useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_API_URL || '';

function token() {
  return typeof window !== 'undefined' ? localStorage.getItem('admin_token') || '' : '';
}

interface Corpus {
  corpus_id: string;
  name: string;
  authority: string;
  schema: string;
  row_count: number;
  created_at: string;
}

interface PreviewRow {
  raw: Record<string, unknown>;
  sentence: string;
}

interface Preview {
  total_rows: number;
  headers: string[];
  schema: string;
  preview: PreviewRow[];
}

export default function KnowledgePage() {
  const fileRef   = useRef<HTMLInputElement>(null);
  const dropRef   = useRef<HTMLDivElement>(null);
  const [corpora, setCorpora]       = useState<Corpus[]>([]);
  const [loading, setLoading]       = useState(true);
  const [file, setFile]             = useState<File | null>(null);
  const [corpusName, setCorpusName] = useState('');
  const [authority, setAuthority]   = useState('');
  const [preview, setPreview]       = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [result, setResult]         = useState<{ inserted: number; corpus_id: string } | null>(null);
  const [error, setError]           = useState('');
  const [dragging, setDragging]     = useState(false);

  async function loadCorpora() {
    setLoading(true);
    try {
      const res  = await fetch(`${BASE}/superadmin/knowledge/corpora`, { headers: { Authorization: `Bearer ${token()}` } });
      const json = await res.json();
      setCorpora(json.data || []);
    } catch { /* silent */ }
    setLoading(false);
  }

  useEffect(() => { loadCorpora(); }, []);

  async function runPreview(f: File) {
    setFile(f);
    setPreview(null);
    setResult(null);
    setError('');
    setPreviewing(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res  = await fetch(`${BASE}/superadmin/knowledge/preview`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd });
      const json = await res.json();
      if (json.success) {
        setPreview(json.data);
        setCorpusName(prev => prev || f.name.replace(/\.[^.]+$/, '').replace(/[_\-]/g, ' '));
      } else {
        setError(json.message || 'فشل تحليل الملف');
      }
    } catch (e: any) {
      setError('تعذّر الاتصال بالخادم: ' + e.message);
    } finally {
      setPreviewing(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) runPreview(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) runPreview(f);
  }

  async function handleUpload() {
    if (!file || !corpusName || uploading || previewing) return;
    setUploading(true);
    setError('');
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('corpus_name', corpusName);
      fd.append('source_authority', authority || 'Open Government Data');
      const res  = await fetch(`${BASE}/superadmin/knowledge/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd });
      const json = await res.json();
      if (json.success) {
        setResult(json.data);
        setFile(null);
        setPreview(null);
        setCorpusName('');
        setAuthority('');
        if (fileRef.current) fileRef.current.value = '';
        loadCorpora();
      } else {
        setError(json.message || 'فشل رفع الملف');
      }
    } catch (e: any) {
      setError('تعذّر الاتصال بالخادم: ' + e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(corpusId: string) {
    if (!confirm(`حذف قاعدة البيانات ${corpusId}؟`)) return;
    await fetch(`${BASE}/superadmin/knowledge/corpora/${corpusId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    loadCorpora();
  }

  const canUpload = !!file && !!corpusName && !uploading && !previewing;
  const disabledReason = !file ? 'اختر ملفاً أولاً' : !corpusName ? 'أدخل اسم المجموعة' : previewing ? 'جاري تحليل الملف…' : '';

  return (
    <div style={{ padding: '32px', maxWidth: 960, margin: '0 auto', direction: 'rtl', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>قاعدة المعرفة</h1>
      <p style={{ color: '#666', marginBottom: 32, fontSize: 14 }}>رفع بيانات Excel لتدريب وكلاء الذكاء الاصطناعي</p>

      {/* Upload card */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>رفع ملف جديد</h2>

        {/* Step 1 — File drop zone */}
        <div
          ref={dropRef}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragging ? '#1d4ed8' : file ? '#10b981' : '#d1d5db'}`,
            borderRadius: 10,
            padding: '28px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            marginBottom: 16,
            background: dragging ? '#eff6ff' : file ? '#f0fdf4' : '#fafafa',
            transition: 'all 0.15s',
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          {file ? (
            <>
              <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#065f46', margin: 0 }}>{file.name}</p>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>
                {(file.size / 1024).toFixed(0)} KB — انقر لاختيار ملف آخر
              </p>
            </>
          ) : (
            <>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: 0 }}>
                اسحب الملف هنا أو انقر للاختيار
              </p>
              <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>
                xlsx · xls · csv — حتى 10 MB
              </p>
            </>
          )}
        </div>

        {previewing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
            <span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid #d1d5db', borderTopColor: '#1d4ed8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            جاري تحليل الملف وتوليد معاينة الجمل…
          </div>
        )}

        {preview && (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 24, marginBottom: 12, fontSize: 13 }}>
              <span>إجمالي الصفوف: <strong>{preview.total_rows.toLocaleString()}</strong></span>
              <span>نوع البيانات المكتشف: <strong style={{ color: '#2563eb' }}>{preview.schema}</strong></span>
            </div>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>معاينة كيف سيُحوَّل كل صف إلى جملة للتضمين:</p>
            {preview.preview.map((p, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', marginBottom: 6, fontSize: 12, lineHeight: 1.6 }}>
                <span style={{ color: '#10b981', marginLeft: 6 }}>✓</span>{p.sentence}
              </div>
            ))}
          </div>
        )}

        {/* Step 2 — Metadata */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <label>
            <span style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 4 }}>
              اسم المجموعة <span style={{ color: '#dc2626' }}>*</span>
            </span>
            <input
              value={corpusName}
              onChange={e => setCorpusName(e.target.value)}
              placeholder="مثال: مؤشرات الإيجار — المنطقة الشرقية"
              style={{ width: '100%', padding: '9px 12px', border: `1px solid ${!corpusName && file ? '#fca5a5' : '#d1d5db'}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
            />
          </label>
          <label>
            <span style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 4 }}>المصدر / الجهة</span>
            <input
              value={authority}
              onChange={e => setAuthority(e.target.value)}
              placeholder="مثال: سدايا — بيانات حكومية مفتوحة"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
            />
          </label>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#dc2626' }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#065f46' }}>
            ✅ تم استيعاب <strong>{result.inserted.toLocaleString()}</strong> صف بنجاح في <code style={{ fontSize: 11, background: '#d1fae5', padding: '1px 5px', borderRadius: 4 }}>{result.corpus_id}</code>
          </div>
        )}

        {/* Upload button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={handleUpload}
            disabled={!canUpload}
            style={{
              background: canUpload ? '#1d4ed8' : '#e5e7eb',
              color: canUpload ? '#fff' : '#9ca3af',
              border: 'none', borderRadius: 8,
              padding: '11px 28px', fontSize: 14, fontWeight: 600,
              cursor: canUpload ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'background 0.15s',
            }}
          >
            {uploading ? (
              <>
                <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #fff4', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                جاري المعالجة…
              </>
            ) : 'رفع وتضمين في قاعدة المعرفة'}
          </button>

          {!canUpload && disabledReason && (
            <span style={{ fontSize: 13, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
              ⚠ {disabledReason}
            </span>
          )}
        </div>

        <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 10 }}>
          كل صف يُحوَّل إلى جملة عربية ثم يُضمَّن باستخدام text-embedding-3-large بحجم 1536 بُعداً.
          {preview && ` المتوقع: ~${Math.ceil(preview.total_rows / 50)} دفعة تضمين.`}
        </p>
      </div>

      {/* Existing corpora */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>المجموعات المتاحة</h2>
        {loading ? (
          <p style={{ color: '#9ca3af', fontSize: 14 }}>جاري التحميل…</p>
        ) : corpora.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 14 }}>لا توجد مجموعات مضافة بعد.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {corpora.map(c => (
              <div key={c.corpus_id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{c.name}</p>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>
                    {c.authority} · {c.row_count.toLocaleString()} صف مُضمَّن · {c.schema}
                  </p>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0', direction: 'ltr', textAlign: 'right' }}>{c.corpus_id}</p>
                </div>
                <button
                  onClick={() => handleDelete(c.corpus_id)}
                  style={{ background: '#fff', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
