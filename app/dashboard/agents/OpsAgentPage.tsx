'use client';
import { useState, useEffect } from 'react';
import AgentChat from './AgentChat';
import { request } from '@/lib/api';
import type { IconName } from '@/components/Icon';

interface Company {
  id: string;
  name: string;
}

interface OpsAgentPageProps {
  agentType: string;
  agentName: string;
  agentIcon: IconName;
  accentColor: string;
  quickActions: string[];
  photoSrc?: string;
}

export default function OpsAgentPage({ agentType, agentName, agentIcon, accentColor, quickActions, photoSrc }: OpsAgentPageProps) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    request<any>('GET', '/admin/companies').then(res => {
      const list: Company[] = (res?.data || []).map((c: any) => ({ id: c.id, name: c.name || c.company_name || c.id }));
      setCompanies(list);
      if (list.length === 1) setSelectedId(list[0].id);
    }).catch(() => {});
  }, []);

  if (!selectedId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 60px)', gap: 16 }}>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>اختر الشركة لبدء المحادثة مع {agentName}</p>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(0,0,0,.1)', fontSize: 14, color: 'var(--text-1)', background: 'var(--surface)', minWidth: 240, cursor: 'pointer' }}
        >
          <option value="">-- اختر الشركة --</option>
          {companies.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
    );
  }

  const company = companies.find(c => c.id === selectedId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', background: 'var(--surface)', borderBottom: '1px solid rgba(0,0,0,.06)', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>الشركة:</span>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          style={{ fontSize: 12, color: 'var(--text-1)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          {companies.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'rgba(124,92,252,.08)', color: '#7c5cfc', marginRight: 'auto' }}>{company?.name}</span>
      </div>
      <AgentChat
        agentType={agentType}
        agentName={agentName}
        agentIcon={agentIcon}
        accentColor={accentColor}
        quickActions={quickActions}
        photoSrc={photoSrc}
        companyId={selectedId}
      />
    </div>
  );
}
