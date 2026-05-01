'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

const BASE = process.env.NEXT_PUBLIC_API_URL || '';

function token() {
  return typeof window !== 'undefined' ? localStorage.getItem('admin_token') || '' : '';
}

// Mirrors backend categorizeByFilename
function categorizeByFilename(filename: string): { category: string; label: string; color: string; bg: string } {
  const s = filename.toLowerCase();
  if (/market|rental|price|transaction|deal|سوق|إيجار|مؤشر|عقاري|صفقة/.test(s))
    return { category: 'market-data',            label: 'سوق عقاري', color: '#1d4ed8', bg: '#eff6ff' };
  if (/legal|ejar|contract|regulation|law|قانوني|عقد|نظام|تنظيم/.test(s))
    return { category: 'legal',                  label: 'قانوني',    color: '#7c3aed', bg: '#f5f3ff' };
  if (/maintenance|repair|work.?order|صيانة|تصليح/.test(s))
    return { category: 'ops-maintenance',        label: 'صيانة',     color: '#d97706', bg: '#fffbeb' };
  if (/finance|payment|invoice|billing|revenue|مالي|دفع|فاتورة/.test(s))
    return { category: 'finance',                label: 'مالي',      color: '#059669', bg: '#ecfdf5' };
  if (/property|unit|building|عقار|وحدة|مبنى/.test(s))
    return { category: 'property-info',          label: 'عقارات',    color: '#0891b2', bg: '#ecfeff' };
  if (/tenant|renter|lease|مستأجر/.test(s))
    return { category: 'tenant-info',            label: 'مستأجرون',  color: '#db2777', bg: '#fdf2f8' };
  return { category: 'general',                  label: 'عام',       color: '#6b7280', bg: '#f9fafb' };
}

const SUPPORTED_EXT = ['xlsx', 'xls', 'csv', 'pdf', 'docx', 'doc', 'txt', 'md'];

function fileExt(name: string) { return name.split('.').pop()?.toLowerCase() || ''; }
function isSupported(name: string) { return SUPPORTED_EXT.includes(fileExt(name)); }
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type FileStatus = 'queued' | 'uploading' | 'done' | 'error' | 'empty';

interface QueuedFile {
  id: string;
  file: File;
  cat: ReturnType<typeof categorizeByFilename>;
  status: FileStatus;
  inserted?: number;
  corpus_id?: string;
  error?: string;
}

interface Corpus {
  corpus_id: string;
  name: string;
  authority: string;
  schema: string;
  row_count: number;
  created_at: string;
}

const STATUS_STYLE: Record<FileStatus, { label: string; color: string; bg: string }> = {
  queued:    { label: 'في الانتظار', color: '#6b7280', bg: '#f3f4f6' },
  uploading: { label: 'جاري الرفع…', color: '#1d4ed8', bg: '#eff6ff' },
  done:      { label: 'تم',         color: '#059669', bg: '#ecfdf5' },
  empty:     { label: 'فارغ',       color: '#d97706', bg: '#fffbeb' },
  error:     { label: 'خطأ',        color: '#dc2626', bg: '#fef2f2' },
};

const EXT_ICON: Record<string, string> = {
  pdf: '📄', xlsx: '📊', xls: '📊', csv: '📋', docx: '📝', doc: '📝', txt: '📃', md: '📃',
};

export default function KnowledgePage() {
  const dropRef       = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLInputElement>(null);
  const [dragging, setDragging]     = useState(false);
  const [queue, setQueue]           = useState<QueuedFile[]>([]);
  const [uploading, setUploading]   = useState(false);
  const [corpora, setCorpora]       = useState<Corpus[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const loadCorpora = useCallback(async () => {
    setLoadingList(true);
    try {
      const res  = await fetch(`${BASE}/superadmin/knowledge/corpora`, { headers: { Authorization: `Bearer ${token()}` } });
      const json = await res.json();
      setCorpora(json.data || []);
    } catch { /* silent */ }
    setLoadingList(false);
  }, []);

  useEffect(() => { loadCorpora(); }, [loadCorpora]);

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const valid = arr.filter(f => isSupported(f.name));
    if (!valid.length) return;
    setQueue(prev => {
      const existingNames = new Set(prev.map(q => q.file.name));
      const fresh = valid
        .filter(f => !existingNames.has(f.name))
        .map(f => ({
          id:  `${f.name}-${Date.now()}-${Math.random()}`,
          file: f,
          cat:  categorizeByFilename(f.name),
          status: 'queued' as FileStatus,
        }));
      return [...prev, ...fresh];
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  function removeFile(id: string) {
    setQueue(prev => prev.filter(q => q.id !== id));
  }

  async function handleUploadAll() {
    const pending = queue.filter(q => q.status === 'queued');
    if (!pending.length || uploading) return;

    setUploading(true);

    // Upload all queued files in one request
    setQueue(prev => prev.map(q => q.status === 'queued' ? { ...q, status: 'uploading' } : q));

    try {
      const fd = new FormData();
      for (const q of pending) fd.append('files', q.file);

      const res  = await fetch(`${BASE}/superadmin/knowledge/bulk-upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
        body: fd,
      });
      const json = await res.json();

      if (json.success) {
        const resultMap: Record<string, any> = {};
        for (const r of (json.data?.results || [])) resultMap[r.filename] = r;

        setQueue(prev => prev.map(q => {
          if (q.status !== 'uploading') return q;
          const r = resultMap[q.file.name];
          if (!r) return { ...q, status: 'error', error: 'لم يُعالَج' };
          if (r.status === 'success') return { ...q, status: 'done', inserted: r.inserted, corpus_id: r.corpus_id };
          if (r.status === 'empty')   return { ...q, status: 'empty', inserted: 0 };
          return { ...q, status: 'error', error: r.error || 'خطأ غير معروف' };
        }));

        loadCorpora();
      } else {
        setQueue(prev => prev.map(q => q.status === 'uploading' ? { ...q, status: 'error', error: json.message } : q));
      }
    } catch (err: any) {
      setQueue(prev => prev.map(q => q.status === 'uploading' ? { ...q, status: 'error', error: err.message } : q));
    }

    setUploading(false);
  }

  async function handleDelete(corpusId: string) {
    if (!confirm(`حذف قاعدة البيانات ${corpusId}؟`)) return;
    await fetch(`${BASE}/superadmin/knowledge/corpora/${corpusId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    loadCorpora();
  }

  const pendingCount = queue.filter(q => q.status === 'queued').length;
  const doneCount    = queue.filter(q => q.status === 'done').length;

  return (
    <div style={{ padding: '32px', maxWidth: 1000, margin: '0 auto', direction: 'rtl', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>قاعدة المعرفة</h1>
        <p style={{ color: '#6b7280', marginTop: 4, fontSize: 14 }}>
          ارفع ملفات Excel أو PDF أو Word أو CSV وسيتم تصنيفها تلقائياً وتضمينها في ذاكرة الوكلاء
        </p>
      </div>

      {/* Drop zone */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 24, marginBottom: 28 }}>
        <div
          ref={dropRef}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragging ? '#1d4ed8' : '#d1d5db'}`,
            borderRadius: 10,
            padding: '36px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragging ? '#eff6ff' : '#fafafa',
            transition: 'all 0.15s',
            marginBottom: queue.length ? 20 : 0,
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".xlsx,.xls,.csv,.pdf,.docx,.doc,.txt,.md"
            onChange={e => { if (e.target.files) { addFiles(e.target.files); e.target.value = ''; } }}
            style={{ display: 'none' }}
          />
          <div style={{ fontSize: 36, marginBottom: 10 }}>📂</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#374151', margin: 0 }}>اسحب الملفات هنا أو انقر للاختيار</p>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '6px 0 0' }}>
            xlsx · xls · csv · pdf · docx · txt — حتى 20 MB لكل ملف، حتى 20 ملف في المرة
          </p>
        </div>

        {/* File queue */}
        {queue.length > 0 && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {queue.map(q => {
                const st  = STATUS_STYLE[q.status];
                const ext = fileExt(q.file.name);
                return (
                  <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                    {/* File icon */}
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{EXT_ICON[ext] || '📁'}</span>

                    {/* Name + size */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {q.file.name}
                      </p>
                      <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>
                        {fmtSize(q.file.size)}
                        {q.status === 'done' && q.inserted !== undefined && ` · ${q.inserted.toLocaleString()} جزء مُضمَّن`}
                        {q.status === 'error' && ` · ${q.error}`}
                      </p>
                    </div>

                    {/* Category badge */}
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: q.cat.bg, color: q.cat.color, fontWeight: 700, flexShrink: 0 }}>
                      {q.cat.label}
                    </span>

                    {/* Status badge */}
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: st.bg, color: st.color, fontWeight: 700, flexShrink: 0, minWidth: 52, textAlign: 'center' }}>
                      {q.status === 'uploading'
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ display: 'inline-block', width: 8, height: 8, border: '1.5px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                            {st.label}
                          </span>
                        : st.label
                      }
                    </span>

                    {/* Remove (queued only) */}
                    {q.status === 'queued' && (
                      <button
                        onClick={() => removeFile(q.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, padding: '0 4px', lineHeight: 1, flexShrink: 0 }}
                      >×</button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Actions row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={handleUploadAll}
                disabled={pendingCount === 0 || uploading}
                style={{
                  background: pendingCount > 0 && !uploading ? '#1d4ed8' : '#e5e7eb',
                  color:      pendingCount > 0 && !uploading ? '#fff'    : '#9ca3af',
                  border: 'none', borderRadius: 8,
                  padding: '11px 24px', fontSize: 14, fontWeight: 600,
                  cursor: pendingCount > 0 && !uploading ? 'pointer' : 'not-allowed',
                }}
              >
                {uploading ? 'جاري الرفع…' : `رفع وتضمين ${pendingCount > 0 ? `(${pendingCount})` : ''} ملف`}
              </button>

              {doneCount > 0 && (
                <button
                  onClick={() => setQueue(prev => prev.filter(q => q.status !== 'done'))}
                  style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 18px', fontSize: 13, color: '#6b7280', cursor: 'pointer' }}
                >
                  مسح المكتملة ({doneCount})
                </button>
              )}

              {queue.some(q => q.status === 'queued') && (
                <button
                  onClick={() => setQueue(prev => prev.filter(q => q.status !== 'queued'))}
                  style={{ background: '#fff', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 18px', fontSize: 13, color: '#dc2626', cursor: 'pointer' }}
                >
                  إلغاء الكل
                </button>
              )}
            </div>

            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 10 }}>
              يتم تصنيف كل ملف تلقائياً حسب اسمه، ثم يُحوَّل إلى جمل نصية وتُضمَّن باستخدام text-embedding-3-large.
            </p>
          </>
        )}
      </div>

      {/* Category legend */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', marginBottom: 28 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>التصنيف التلقائي — يعتمد على اسم الملف:</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {([
            { label: 'سوق عقاري',  kw: 'market / rental / سوق',          color: '#1d4ed8', bg: '#eff6ff' },
            { label: 'قانوني',     kw: 'legal / ejar / contract',          color: '#7c3aed', bg: '#f5f3ff' },
            { label: 'صيانة',      kw: 'maintenance / repair / صيانة',    color: '#d97706', bg: '#fffbeb' },
            { label: 'مالي',       kw: 'finance / payment / مالي',         color: '#059669', bg: '#ecfdf5' },
            { label: 'عقارات',     kw: 'property / unit / عقار',          color: '#0891b2', bg: '#ecfeff' },
            { label: 'مستأجرون',   kw: 'tenant / renter / مستأجر',        color: '#db2777', bg: '#fdf2f8' },
            { label: 'عام',        kw: 'غير ذلك',                          color: '#6b7280', bg: '#f9fafb' },
          ] as const).map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: item.bg, border: `1px solid ${item.color}22` }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: item.color }}>{item.label}</span>
              <span style={{ fontSize: 10, color: '#9ca3af' }}>{item.kw}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Existing corpora list */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>المجموعات المُضمَّنة ({corpora.length})</h2>
          <button onClick={loadCorpora} style={{ fontSize: 12, color: '#6b7280', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>
            تحديث
          </button>
        </div>

        {loadingList ? (
          <p style={{ color: '#9ca3af', fontSize: 14 }}>جاري التحميل…</p>
        ) : corpora.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 14 }}>
            لا توجد مجموعات بعد — ارفع ملفاتك للبدء
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {corpora.map(c => {
              const cat = categorizeByFilename(c.name + ' ' + c.corpus_id);
              return (
                <div key={c.corpus_id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{c.name}</p>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: cat.bg, color: cat.color, fontWeight: 700 }}>{cat.label}</span>
                    </div>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                      {c.authority} · <strong>{c.row_count.toLocaleString()}</strong> جزء مُضمَّن
                    </p>
                    <p style={{ fontSize: 10, color: '#9ca3af', margin: '2px 0 0', direction: 'ltr', textAlign: 'right' }}>{c.corpus_id}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(c.corpus_id)}
                    style={{ background: '#fff', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
                  >
                    حذف
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
