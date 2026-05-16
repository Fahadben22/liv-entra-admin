'use client';
import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/api';

interface BudgetData {
  agent_type: string;
  agent_name: string;
  budget_monthly: number;
  budget_used: number;
  budget_pending: number;
  budget_remaining: number;
  usage_pct: number;
  warning_threshold: number;
  critical_threshold: number;
  auto_rebalance: boolean;
  max_transfer_pct: number;
}

interface Transaction {
  id: string;
  agent_type: string;
  transaction_type: string;
  amount: number;
  counterparty: string | null;
  category: string | null;
  description: string | null;
  created_at: string;
}

interface TransferRequest {
  id: string;
  from_agent: string;
  to_agent: string;
  from_name: string;
  to_name: string;
  amount: number;
  reason: string;
  status: string;
  created_at: string;
}

interface EconomyData {
  budgets: BudgetData[];
  transactions: Transaction[];
  transfers: TransferRequest[];
  summary: {
    total_budget: number;
    total_used: number;
    total_pending: number;
    total_remaining: number;
    agents_near_limit: number;
    agents_critical: number;
    pending_transfers: number;
  };
}

const TYPE_LABELS: Record<string, string> = {
  spend: 'صرف',
  transfer_out: 'تحويل خارج',
  transfer_in: 'تحويل وارد',
  budget_adjustment: 'تعديل ميزانية',
  auto_rebalance: 'إعادة توازن',
  budget_reset: 'إعادة تعيين',
};

function BudgetBar({ used, pending, remaining, warningPct, criticalPct }: {
  used: number; pending: number; remaining: number; warningPct: number; criticalPct: number;
}) {
  const total = used + pending + remaining;
  const usedPct = total > 0 ? (used / total) * 100 : 0;
  const pendPct = total > 0 ? (pending / total) * 100 : 0;
  return (
    <div style={{ height: 8, background: 'var(--bg)', borderRadius: 6, overflow: 'hidden', display: 'flex', marginTop: 8 }}>
      <div style={{ width: usedPct + '%', height: '100%', background: usedPct > criticalPct ? '#ef4444' : usedPct > warningPct ? '#f59e0b' : '#10b981', borderRadius: '6px 0 0 6px', transition: 'width .3s' }} />
      {pendPct > 0 && <div style={{ width: pendPct + '%', height: '100%', background: '#fbbf24', opacity: 0.6 }} />}
    </div>
  );
}

function AgentBudgetCard({ budget, onTransfer, onAdjust }: {
  budget: BudgetData;
  onTransfer: (agent: string) => void;
  onAdjust: (agent: string) => void;
}) {
  const isCritical = budget.usage_pct >= budget.critical_threshold;
  const isWarning = budget.usage_pct >= budget.warning_threshold && !isCritical;
  const statusColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981';
  const statusLabel = isCritical ? 'حرج' : isWarning ? 'تحذير' : 'جيد';

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid ' + (isCritical ? '#fecaca' : isWarning ? '#fde68a' : 'var(--border)'),
      borderRadius: 14,
      padding: '18px 20px',
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
            {budget.agent_name}
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 6, fontWeight: 400, textTransform: 'uppercase' }}>{budget.agent_type}</span>
          </p>
        </div>
        <span style={{
          fontSize: 10, padding: '3px 10px', borderRadius: 20,
          background: statusColor + '18',
          color: statusColor,
          fontWeight: 700,
        }}>
          {statusLabel} {budget.usage_pct.toFixed(0)}%
        </span>
      </div>

      {/* Budget numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <div style={{ background: 'var(--ink-50)', borderRadius: 8, padding: '8px 10px' }}>
          <p style={{ fontSize: 9, color: 'var(--text-muted)', margin: '0 0 2px', fontWeight: 600 }}>الميزانية</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>{budget.budget_monthly.toLocaleString()} ر.س</p>
        </div>
        <div style={{ background: 'var(--ink-50)', borderRadius: 8, padding: '8px 10px' }}>
          <p style={{ fontSize: 9, color: 'var(--text-muted)', margin: '0 0 2px', fontWeight: 600 }}>المتبقي</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: budget.budget_remaining < 0 ? '#dc2626' : 'var(--text-1)', margin: 0 }}>
            {budget.budget_remaining.toLocaleString()} ر.س
          </p>
        </div>
      </div>

      {/* Visual bar */}
      <BudgetBar
        used={budget.budget_used}
        pending={budget.budget_pending}
        remaining={budget.budget_remaining}
        warningPct={budget.warning_threshold}
        criticalPct={budget.critical_threshold}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
        <span>مستخدم: {budget.budget_used.toLocaleString()} ر.س</span>
        {budget.budget_pending > 0 && <span>معلق: {budget.budget_pending.toLocaleString()} ر.س</span>}
      </div>

      {/* Warning/Critical line */}
      {budget.usage_pct >= budget.warning_threshold && (
        <div style={{
          marginTop: 10, padding: '6px 10px', borderRadius: 8,
          background: isCritical ? '#fef2f2' : '#fffbeb',
          fontSize: 11, color: statusColor, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {isCritical ? 'تجاوز الحد الحرج' : 'اقترب من الحد الحرج'}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          onClick={() => onTransfer(budget.agent_type)}
          style={{
            flex: 1, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--surface)', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text-2)',
          }}
        >
          طلب تحويل
        </button>
        <button
          onClick={() => onAdjust(budget.agent_type)}
          style={{
            flex: 1, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--surface)', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text-2)',
          }}
        >
          تعديل
        </button>
      </div>
    </div>
  );
}

export default function AgentEconomyPage() {
  const [data, setData] = useState<EconomyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'budgets' | 'transactions' | 'transfers'>('budgets');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [transferForm, setTransferForm] = useState({ to_agent: '', amount: 0, reason: '' });
  const [adjustForm, setAdjustForm] = useState({ budget_monthly: 0, reason: '' });
  const [actionMsg, setActionMsg] = useState('');
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.economy.getSnapshot();
      setData((res as any)?.data || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load economy data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleTransfer = async () => {
    if (!selectedAgent || !transferForm.to_agent || transferForm.amount <= 0) {
      setActionMsg('يرجى ملء جميع الحقول');
      return;
    }
    try {
      const res = await adminApi.economy.requestTransfer({
        from_agent: selectedAgent,
        to_agent: transferForm.to_agent,
        amount: transferForm.amount,
        reason: transferForm.reason,
      });
      const result = (res as any)?.data || res;
      setActionMsg(result.success ? 'تم إرسال طلب التحويل' : 'فشل: ' + (result.message || ''));
      setShowTransferModal(false);
      load();
    } catch (err: any) {
      setActionMsg('خطأ: ' + err.message);
    }
  };

  const handleAdjust = async () => {
    if (!selectedAgent || adjustForm.budget_monthly <= 0) {
      setActionMsg('يرجى إدخال مبلغ صحيح');
      return;
    }
    try {
      const res = await adminApi.economy.adjustBudget({
        agent_type: selectedAgent,
        budget_monthly: adjustForm.budget_monthly,
        reason: adjustForm.reason,
      });
      const result = (res as any)?.data || res;
      setActionMsg(result.success ? 'تم تعديل الميزانية' : 'فشل: ' + (result.message || ''));
      setShowAdjustModal(false);
      load();
    } catch (err: any) {
      setActionMsg('خطأ: ' + err.message);
    }
  };

  const handleDecideTransfer = async (requestId: string, approved: boolean) => {
    try {
      const res = await adminApi.economy.decideTransfer({ request_id: requestId, approved });
      const result = (res as any)?.data || res;
      setActionMsg(result.success ? (approved ? 'تمت الموافقة' : 'تم الرفض') : 'فشل');
      load();
    } catch (err: any) {
      setActionMsg('خطأ: ' + err.message);
    }
  };

  const openTransferModal = (agent: string) => {
    setSelectedAgent(agent);
    setTransferForm({ to_agent: '', amount: 0, reason: '' });
    setShowTransferModal(true);
  };

  const openAdjustModal = (agent: string) => {
    setSelectedAgent(agent);
    const budget = data?.budgets?.find(b => b.agent_type === agent);
    setAdjustForm({ budget_monthly: budget?.budget_monthly || 0, reason: '' });
    setShowAdjustModal(true);
  };

  useEffect(() => {
    if (actionMsg) {
      const t = setTimeout(() => setActionMsg(''), 4000);
      return () => clearTimeout(t);
    }
  }, [actionMsg]);

  const filteredBudgets = data?.budgets?.filter(b => {
    if (filter === 'all') return true;
    if (filter === 'warning') return b.usage_pct >= b.warning_threshold;
    if (filter === 'critical') return b.usage_pct >= b.critical_threshold;
    return false;
  }) || [];

  const allAgents = data?.budgets?.map(b => b.agent_type) || [];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px', direction: 'rtl' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>اقتصاد الوكلاء</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '4px 0 0' }}>إدارة ميزانيات جميع الوكلاء الـ 11 وتحويلاتهم المالية</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', opacity: loading ? .5 : 1 }}
        >
          {loading ? '...' : 'تحديث'}
        </button>
      </div>

      {/* Summary strip */}
      {data?.summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'إجمالي الميزانيات', value: data.summary.total_budget.toLocaleString() + ' ر.س', color: 'var(--text-1)' },
            { label: 'المستخدم', value: data.summary.total_used.toLocaleString() + ' ر.س', color: '#6366f1' },
            { label: 'المتبقي', value: data.summary.total_remaining.toLocaleString() + ' ر.س', color: '#10b981' },
            { label: 'في التحذير', value: String(data.summary.agents_near_limit), color: '#f59e0b' },
            { label: 'في الحرجة', value: String(data.summary.agents_critical), color: '#ef4444' },
            { label: 'تحويلات معلقة', value: String(data.summary.pending_transfers), color: '#3b82f6' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: s.color, margin: '0 0 3px' }}>{loading ? '...' : s.value}</p>
              <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
        {([
          ['budgets', 'الميزانيات'],
          ['transactions', 'المعاملات'],
          ['transfers', 'طلبات التحويل'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            style={{
              padding: '6px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: tab === key ? 'var(--text-1)' : 'transparent',
              color: tab === key ? '#fff' : 'var(--text-3)',
            }}
          >
            {label}
            {key === 'transfers' && data?.transfers?.filter(t => t.status === 'pending').length ? (
              <span style={{ marginRight: 5, background: '#ef4444', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10 }}>
                {data.transfers.filter(t => t.status === 'pending').length}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Action message */}
      {actionMsg && (
        <div style={{
          padding: '10px 16px', borderRadius: 10, marginBottom: 16,
          background: actionMsg.includes('فشل') || actionMsg.includes('خطأ') ? '#fef2f2' : '#f0fdf4',
          color: actionMsg.includes('فشل') || actionMsg.includes('خطأ') ? '#dc2626' : '#16a34a',
          fontSize: 12, fontWeight: 600,
        }}>
          {actionMsg}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: 16, borderRadius: 10, marginBottom: 16, background: '#fef2f2', color: '#dc2626', fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>جاري التحميل...</div>
      )}

      {/* ──────── BUDGETS TAB ──────── */}
      {tab === 'budgets' && data && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {([
              ['all', 'الكل'],
              ['warning', 'تحذير'],
              ['critical', 'حرج'],
            ] as const).map(([key, label]: any) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  padding: '4px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  background: filter === key ? 'var(--text-1)' : 'var(--bg)',
                  color: filter === key ? '#fff' : 'var(--text-2)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {filteredBudgets.map(b => (
              <AgentBudgetCard key={b.agent_type} budget={b} onTransfer={openTransferModal} onAdjust={openAdjustModal} />
            ))}
          </div>
        </>
      )}

      {/* ──────── TRANSACTIONS TAB ──────── */}
      {tab === 'transactions' && data && (
        <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--ink-50)' }}>
                  {['الوكيل', 'النوع', 'المبلغ', 'الطرف الآخر', 'الوصف', 'التاريخ'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-2)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.transactions.map(tx => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-1)' }}>{tx.agent_type}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                        background: tx.transaction_type === 'spend' ? '#fef2f2' : tx.transaction_type === 'transfer_in' ? '#f0fdf4' : 'var(--ink-50)',
                        color: tx.transaction_type === 'spend' ? '#dc2626' : tx.transaction_type === 'transfer_in' ? '#16a34a' : 'var(--text-2)',
                      }}>
                        {TYPE_LABELS[tx.transaction_type] || tx.transaction_type}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: tx.amount < 0 ? '#dc2626' : 'var(--text-1)' }}>
                      {tx.amount.toLocaleString()} ر.س
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-3)' }}>{tx.counterparty || '—'}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-3)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.description || tx.category || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 11 }}>
                      {new Date(tx.created_at).toLocaleDateString('ar-SA')}
                    </td>
                  </tr>
                ))}
                {data.transactions.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>لا توجد معاملات بعد</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ──────── TRANSFERS TAB ──────── */}
      {tab === 'transfers' && data && (
        <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--ink-50)' }}>
                  {['من', 'إلى', 'المبلغ', 'السبب', 'الحالة', 'التاريخ', 'إجراء'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-2)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.transfers.map(tr => (
                  <tr key={tr.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-1)' }}>{tr.from_name}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-1)' }}>{tr.to_name}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-1)' }}>{tr.amount.toLocaleString()} ر.س</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-3)', maxWidth: 200 }}>{tr.reason}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                        background: tr.status === 'pending' ? '#fffbeb' : tr.status === 'approved' ? '#f0fdf4' : '#fef2f2',
                        color: tr.status === 'pending' ? '#d97706' : tr.status === 'approved' ? '#16a34a' : '#dc2626',
                      }}>
                        {tr.status === 'pending' ? 'معلق' : tr.status === 'approved' ? 'موافق' : 'مرفوض'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 11 }}>
                      {new Date(tr.created_at).toLocaleDateString('ar-SA')}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {tr.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => handleDecideTransfer(tr.id, true)}
                            style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}
                          >
                            موافقة
                          </button>
                          <button
                            onClick={() => handleDecideTransfer(tr.id, false)}
                            style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}
                          >
                            رفض
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {data.transfers.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>لا توجد طلبات تحويل</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ──────── TRANSFER MODAL ──────── */}
      {showTransferModal && data && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}
          onClick={() => setShowTransferModal(false)}
        >
          <div style={{
            background: 'var(--surface)', borderRadius: 16, padding: '24px', maxWidth: 420, width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,.15)',
          }} onClick={(e: any) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 16px' }}>
              طلب تحويل ميزانية
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
              {data.budgets.find(b => b.agent_type === selectedAgent)?.agent_name || selectedAgent}
              {' '}يطلب تحويل مبلغ إلى وكيل آخر
            </p>

            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>إلى وكيل</label>
            <select
              value={transferForm.to_agent}
              onChange={(e) => setTransferForm({ ...transferForm, to_agent: e.target.value })}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 14, fontSize: 12 }}
            >
              <option value="">اختر وكيل...</option>
              {allAgents.filter(a => a !== selectedAgent).map(a => (
                <option key={a} value={a}>{data.budgets.find(b => b.agent_type === a)?.agent_name || a}</option>
              ))}
            </select>

            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>المبلغ (ر.س)</label>
            <input
              type="number"
              value={transferForm.amount || ''}
              onChange={(e) => setTransferForm({ ...transferForm, amount: Number(e.target.value) })}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 14, fontSize: 12 }}
            />

            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>السبب</label>
            <textarea
              value={transferForm.reason}
              onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
              rows={3}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 20, fontSize: 12, resize: 'none' }}
              placeholder="اذكر سبب طلب التحويل..."
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowTransferModal(false)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}
              >
                إلغاء
              </button>
              <button
                onClick={handleTransfer}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--text-1)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
              >
                إرسال الطلب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────── ADJUST MODAL ──────── */}
      {showAdjustModal && data && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}
          onClick={() => setShowAdjustModal(false)}
        >
          <div style={{
            background: 'var(--surface)', borderRadius: 16, padding: '24px', maxWidth: 420, width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,.15)',
          }} onClick={(e: any) => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: '0 0 16px' }}>
              تعديل ميزانية {data.budgets.find(b => b.agent_type === selectedAgent)?.agent_name || selectedAgent}
            </h3>

            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>الميزانية الشهرية (ر.س)</label>
            <input
              type="number"
              value={adjustForm.budget_monthly || ''}
              onChange={(e) => setAdjustForm({ ...adjustForm, budget_monthly: Number(e.target.value) })}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 14, fontSize: 12 }}
            />

            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>السبب (اختياري)</label>
            <textarea
              value={adjustForm.reason}
              onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
              rows={2}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 20, fontSize: 12, resize: 'none' }}
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowAdjustModal(false)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}
              >
                إلغاء
              </button>
              <button
                onClick={handleAdjust}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--text-1)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
              >
                حفظ التعديل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
