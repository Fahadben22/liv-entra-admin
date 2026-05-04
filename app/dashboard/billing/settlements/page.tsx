'use client';
import { useState, useEffect } from 'react';
import { request, BASE } from '@/lib/api';
import Link from 'next/link';
import { FileText, Download, ChevronLeft, ChevronRight, Search } from 'lucide-react';

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft:         { label: 'مسودة',          color: '#6b7280', bg: '#f9fafb' },
  sent:          { label: 'مُرسل',           color: '#3b82f6', bg: '#eff6ff' },
  acknowledged:  { label: 'مُقَر به',         color: '#22c55e', bg: '#f0fdf4' },
  completed:     { label: 'مكتمل',           color: '#8b5cf6', bg: '#f5f3ff' },
};

function formatSAR(n: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);
}
function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function SettlementsAdminPage() {
  const [data,       setData]       = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [page,       setPage]       = useState(1);
  const [statusFilter, setStatus]   = useState('');
  const [companyId,  setCompanyId]  = useState('');
  const [companies,  setCompanies]  = useState<any[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);

  async function loadCompanies() {
    try {
      const res = await request<any>('GET', '/admin/companies?limit=200');
      setCompanies(res.data?.companies || res.data || []);
    } catch {}
  }

  async function load(p = page) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (statusFilter) params.set('status', statusFilter);
      if (companyId)    params.set('company_id', companyId);
      const res = await request<any>('GET', `/admin/settlements?${params}`);
      setData(res.data || res);
    } catch { setData(null); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadCompanies(); load(1); }, []);

  async function downloadPdf(ownerId: string, settlementId: string) {
    setDownloading(settlementId);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') || '' : '';
      const res = await fetch(`${BASE}/owners/${ownerId}/settlement/${settlementId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('فشل التحميل');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `settlement-${settlementId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('فشل تحميل PDF'); }
    finally { setDownloading(null); }
  }

  const settlements: any[] = data?.settlements || [];
  const total: number      = data?.total  || 0;
  const pages: number      = data?.pages  || 1;

  return (
    <div style={{ padding: '28px 32px', minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>تسويات المُلاك</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4, margin: 0 }}>جميع تسويات المُلاك عبر الشركات — {total} تسوية</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <select value={companyId} onChange={e => setCompanyId(e.target.value)} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, background: 'white', cursor: 'pointer', minWidth: 180 }}>
          <option value="">جميع الشركات</option>
          {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)} style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, background: 'white', cursor: 'pointer' }}>
          <option value="">جميع الحالات</option>
          <option value="draft">مسودة</option>
          <option value="sent">مُرسل</option>
          <option value="acknowledged">مُقَر به</option>
          <option value="completed">مكتمل</option>
        </select>
        <button onClick={() => { setPage(1); load(1); }} style={{ padding: '8px 18px', background: '#1d4070', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          بحث
        </button>
      </div>

      {/* Table */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', fontSize: 13 }}>جاري التحميل...</div>
        ) : settlements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>
            <FileText style={{ width: 32, height: 32, margin: '0 auto 12px', opacity: 0.3 }} />
            <p style={{ fontSize: 13 }}>لا توجد تسويات</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['الشركة', 'المالك', 'الفترة', 'إجمالي المحصّل', 'صافي الدفع', 'الحالة', 'بتاريخ', 'إجراء'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 600, color: '#374151', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {settlements.map((s: any, i: number) => {
                const statusMeta = STATUS_META[s.status] || { label: s.status, color: '#6b7280', bg: '#f9fafb' };
                return (
                  <tr key={s.id} style={{ borderBottom: i < settlements.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <td style={{ padding: '11px 14px', fontWeight: 500, color: '#1d4070' }}>
                      {s.companies?.name_ar || '—'}
                    </td>
                    <td style={{ padding: '11px 14px' }}>{s.property_owners?.full_name_ar || '—'}</td>
                    <td style={{ padding: '11px 14px', color: '#6b7280', fontSize: 12 }}>
                      {formatDate(s.period_start)} — {formatDate(s.period_end)}
                    </td>
                    <td style={{ padding: '11px 14px', color: '#16a34a', fontWeight: 500 }}>
                      {formatSAR(s.total_collected)}
                    </td>
                    <td style={{ padding: '11px 14px', fontWeight: 700, color: '#1d4070' }}>
                      {formatSAR(s.net_payout)}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: statusMeta.bg, color: statusMeta.color }}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', color: '#6b7280', fontSize: 12 }}>{formatDate(s.created_at)}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <button onClick={() => downloadPdf(s.owner_id, s.id)} disabled={downloading === s.id} title="تحميل PDF" style={{ padding: 6, borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: downloading === s.id ? 0.5 : 1 }}>
                        <Download style={{ width: 13, height: 13, color: '#374151' }} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 20 }}>
          <button onClick={() => { const p = Math.max(1, page - 1); setPage(p); load(p); }} disabled={page === 1} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: page > 1 ? 'pointer' : 'not-allowed', opacity: page === 1 ? 0.4 : 1, display: 'flex', alignItems: 'center' }}>
            <ChevronRight style={{ width: 14, height: 14 }} />
          </button>
          <span style={{ fontSize: 13, color: '#374151' }}>صفحة {page} من {pages}</span>
          <button onClick={() => { const p = Math.min(pages, page + 1); setPage(p); load(p); }} disabled={page === pages} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: page < pages ? 'pointer' : 'not-allowed', opacity: page === pages ? 0.4 : 1, display: 'flex', alignItems: 'center' }}>
            <ChevronLeft style={{ width: 14, height: 14 }} />
          </button>
        </div>
      )}
    </div>
  );
}
