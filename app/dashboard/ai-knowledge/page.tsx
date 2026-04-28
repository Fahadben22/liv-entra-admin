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

  async function loadCorpora() {
    setLoading(true);
    const res  = await fetch(`${BASE}/superadmin/knowledge/corpora`, { headers: { Authorization: `Bearer ${token()}` } });
    const json = await res.json();
    setCorpora(json.data || []);
    setLoading(false);
  }

  useEffect(() => { loadCorpora(); }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(null);
    setResult(null);
    setError('');

    // Auto-preview
    setPreviewing(true);
    const fd = new FormData();
    fd.append('file', f);
    const res  = await fetch(`${BASE}/superadmin/knowledge/preview`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd });
    const json = await res.json();
    setPreviewing(false);
    if (json.success) {
      setPreview(json.data);
      // Auto-fill corpus name from filename
      if (!corpusName) setCorpusName(f.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '));
    } else {
      setError(json.message);
    }
  }

  async function handleUpload() {
    if (!file || !corpusName) return;
    setUploading(true);
    setError('');
    setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('corpus_name', corpusName);
    fd.append('source_authority', authority || 'Open Government Data');
    const res  = await fetch(`${BASE}/superadmin/knowledge/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd });
    const json = await res.json();
    setUploading(false);
    if (json.success) {
      setResult(json.data);
      setFile(null);
      setPreview(null);
      setCorpusName('');
      setAuthority('');
      if (fileRef.current) fileRef.current.value = '';
      loadCorpora();
    } else {
      setError(json.message);
    }
  }

  async function handleDelete(corpusId: string) {
    if (!confirm(`حذف قاعدة البيانات ${corpusId}؟`)) return;
    await fetch(`${BASE}/superadmin/knowledge/corpora/${corpusId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    loadCorpora();
  }

  return (
    <div style={{ padding: '32px', maxWidth: 960, margin: '0 auto', direction: 'rtl', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>قاعدة المعرفة</h1>
      <p style={{ color: '#666', marginBottom: 32, fontSize: 14 }}>رفع بيانات Excel لتدريب وكلاء الذكاء الاصطناعي</p>

      {/* Upload card */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>رفع ملف جديد</h2>

        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 6 }}>ملف Excel / CSV</span>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            style={{ fontSize: 13, width: '100%' }}
          />
        </label>

        {previewing && <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>جاري تحليل الملف…</p>}

        {preview && (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 24, marginBottom: 12, fontSize: 13 }}>
              <span>إجمالي الصفوف: <strong>{preview.total_rows.toLocaleString()}</strong></span>
              <span>نوع البيانات: <strong style={{ color: '#2563eb' }}>{preview.schema}</strong></span>
            </div>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>معاينة كيف سيُحوّل كل صف إلى جملة:</p>
            {preview.preview.map((p, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: '#10b981' }}>✓</span> {p.sentence}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <label>
            <span style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 4 }}>اسم المجموعة *</span>
            <input
              value={corpusName}
              onChange={e => setCorpusName(e.target.value)}
              placeholder="مثال: صفقات عقارية 2024"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
            />
          </label>
          <label>
            <span style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 4 }}>المصدر / الجهة</span>
            <input
              value={authority}
              onChange={e => setAuthority(e.target.value)}
              placeholder="مثال: وزارة العدل — بيانات حكومية مفتوحة"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
            />
          </label>
        </div>

        {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        {result && (
          <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>
            تم استيعاب <strong>{result.inserted.toLocaleString()}</strong> صف بنجاح في <code style={{ fontSize: 11 }}>{result.corpus_id}</code>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || !corpusName || uploading || previewing}
          style={{
            background: (!file || !corpusName || uploading) ? '#d1d5db' : '#1d4ed8',
            color: '#fff', border: 'none', borderRadius: 8,
            padding: '10px 24px', fontSize: 14, fontWeight: 600,
            cursor: (!file || !corpusName || uploading) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          {uploading ? (
            <>
              <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              جاري المعالجة…
            </>
          ) : 'رفع وتضمين في قاعدة المعرفة'}
        </button>
        <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
          كل صف يُحوَّل إلى جملة عربية ثم يُضمَّن باستخدام text-embedding-3-large. قد تستغرق العملية دقيقة أو أكثر للملفات الكبيرة.
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
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>{c.authority} — {c.row_count.toLocaleString()} صف — {c.schema}</p>
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
