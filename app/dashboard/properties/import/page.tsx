'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { adminApi, BASE } from '@/lib/api';
import { UploadCloud, RefreshCw, FileText, CheckCircle, AlertCircle, Clock, Loader2, ChevronRight, Play } from 'lucide-react';

interface ImportSession {
  id: string;
  company_id: string;
  created_by: string;
  status: string;
  file_count: number;
  total_entities: number;
  imported_count: number;
  failed_count: number;
  confidence_score: number;
  created_at: string;
  completed_at?: string;
}

const STATUS_ACTIVE = new Set(['uploaded','analyzing','extracting','validating','importing','reconciling']);

const STATUS_LABELS: Record<string, string> = {
  uploaded:        'مرفوع',
  analyzing:       'تحليل الملفات',
  extracting:      'استخراج البيانات',
  validating:      'التحقق من الصحة',
  awaiting_review: 'في انتظار REEA',
  importing:       'استيراد جاري',
  reconciling:     'تدقيق',
  completed:       'مكتمل',
  failed:          'فشل',
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    uploaded:        'bg-gray-100 text-gray-700',
    analyzing:       'bg-blue-100 text-blue-700',
    extracting:      'bg-blue-100 text-blue-700',
    validating:      'bg-yellow-100 text-yellow-700',
    awaiting_review: 'bg-purple-100 text-purple-700',
    importing:       'bg-orange-100 text-orange-700',
    reconciling:     'bg-orange-100 text-orange-700',
    completed:       'bg-green-100 text-green-700',
    failed:          'bg-red-100 text-red-700',
  };
  const icons: Record<string, React.ReactNode> = {
    analyzing:       <Loader2 className="h-3 w-3 animate-spin" />,
    extracting:      <Loader2 className="h-3 w-3 animate-spin" />,
    validating:      <Loader2 className="h-3 w-3 animate-spin" />,
    importing:       <Loader2 className="h-3 w-3 animate-spin" />,
    reconciling:     <Loader2 className="h-3 w-3 animate-spin" />,
    awaiting_review: <Clock className="h-3 w-3" />,
    completed:       <CheckCircle className="h-3 w-3" />,
    failed:          <AlertCircle className="h-3 w-3" />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {icons[status]}
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export default function PortfolioImportPage() {
  const [sessions, setSessions]   = useState<ImportSession[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [dragOver, setDragOver]   = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError]         = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);
  const [executeResult, setExecuteResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/admin/portfolio/import/sessions?limit=20`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
      });
      const json = await res.json();
      if (json.success) setSessions(json.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Poll every 10s when active sessions exist
  useEffect(() => {
    const hasActive = sessions.some(s => STATUS_ACTIVE.has(s.status));
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(fetchSessions, 10000);
    } else if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sessions, fetchSessions]);

  function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const allowed = ['xlsx','pdf','csv','zip'];
    const valid = Array.from(files).filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      return allowed.includes(ext);
    });
    if (valid.length < files.length) setError(`بعض الملفات غير مدعومة — مسموح: Excel, PDF, CSV, ZIP`);
    else setError(null);
    setSelectedFiles(prev => [...prev, ...valid]);
  }

  async function handleUpload() {
    if (!selectedFiles.length) return;
    setUploading(true);
    setError(null);
    setUploadResult(null);
    try {
      const form = new FormData();
      selectedFiles.forEach(f => form.append('files', f));
      const res = await fetch(`${BASE}/admin/portfolio/import/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
        body: form,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'فشل الرفع');
      setUploadResult(`تم إنشاء جلسة الاستيراد — REEA ستتولى المعالجة تلقائياً. رمز الجلسة: ${json.data.session_id.slice(0,8)}`);
      setSelectedFiles([]);
      await fetchSessions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'خطأ غير معروف');
    } finally {
      setUploading(false);
    }
  }

  async function handleExecute(sessionId: string) {
    setExecuting(sessionId);
    setExecuteResult(null);
    setError(null);
    try {
      const res = await fetch(`${BASE}/admin/portfolio/import/sessions/${sessionId}/execute`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'فشل تنفيذ الاستيراد');
      const r = json.data.import;
      setExecuteResult(`اكتمل الاستيراد — مستورد: ${r.imported} | فشل: ${r.failed}`);
      await fetchSessions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'خطأ في التنفيذ');
    } finally {
      setExecuting(null);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">استيراد المحافظ العقارية</h1>
        <p className="mt-1 text-sm text-gray-500">ارفع ملفات المحفظة — REEA ستستخرج وتتحقق وتستورد البيانات تلقائياً</p>
      </div>

      {/* Upload Zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".xlsx,.pdf,.csv,.zip"
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        <UploadCloud className="mx-auto h-10 w-10 text-gray-400 mb-3" />
        <p className="font-medium text-gray-700">اسحب الملفات هنا أو اضغط للاختيار</p>
        <p className="text-sm text-gray-400 mt-1">Excel, PDF, CSV, ZIP — حتى 50 MB لكل ملف</p>
      </div>

      {/* Selected files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">الملفات المختارة ({selectedFiles.length})</p>
          <div className="space-y-1">
            {selectedFiles.map((f, i) => (
              <div key={i} className="flex items-center justify-between bg-white border rounded-lg px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-700">{f.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-400">{(f.size / 1024).toFixed(0)} KB</span>
                  <button onClick={(e) => { e.stopPropagation(); setSelectedFiles(prev => prev.filter((_, j) => j !== i)); }} className="text-gray-400 hover:text-red-500">×</button>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {uploading ? 'جاري الرفع...' : `رفع ${selectedFiles.length} ملف وبدء الاستيراد`}
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {uploadResult && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          {uploadResult}
        </div>
      )}
      {executeResult && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          {executeResult}
        </div>
      )}

      {/* Sessions Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">جلسات الاستيراد</h2>
          <button onClick={fetchSessions} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <RefreshCw className="h-4 w-4" />
            تحديث
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">لا توجد جلسات استيراد بعد</div>
        ) : (
          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">الرمز</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">الحالة</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">الملفات</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">الكيانات</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">مستورد / فشل</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">الثقة</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">التاريخ</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sessions.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.id.slice(0,8)}</td>
                    <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3 text-gray-700">{s.file_count}</td>
                    <td className="px-4 py-3 text-gray-700">{s.total_entities || '—'}</td>
                    <td className="px-4 py-3">
                      {s.imported_count > 0 || s.failed_count > 0 ? (
                        <span className={s.failed_count > 0 ? 'text-red-600' : 'text-green-600'}>
                          {s.imported_count} / {s.failed_count}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{s.confidence_score > 0 ? `${s.confidence_score}%` : '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(s.created_at).toLocaleDateString('ar-SA')}</td>
                    <td className="px-4 py-3">
                      {['awaiting_review', 'validating'].includes(s.status) && (
                        <button
                          onClick={() => handleExecute(s.id)}
                          disabled={executing === s.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium disabled:opacity-60"
                        >
                          {executing === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                          نفّذ
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs text-gray-400 flex items-center gap-1">
          <ChevronRight className="h-3 w-3" />
          REEA تراقب الجلسات تلقائياً وتتولى المراجعة والاستيراد والتدقيق
        </p>
      </div>
    </div>
  );
}
