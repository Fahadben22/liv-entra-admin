'use client';
import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  pageSize?: number;
  searchPlaceholder?: string;
  isLoading?: boolean;
  emptyLabel?: string;
}

export function DataTable<T>({
  data,
  columns,
  pageSize = 25,
  searchPlaceholder = 'بحث...',
  isLoading = false,
  emptyLabel = 'لا توجد بيانات',
}: DataTableProps<T>) {
  const [sorting, setSorting]           = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const { pageIndex, pageSize: ps } = table.getState().pagination;
  const totalRows = table.getFilteredRowModel().rows.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, direction: 'rtl' }}>
      <input
        value={globalFilter}
        onChange={e => setGlobalFilter(e.target.value)}
        placeholder={searchPlaceholder}
        style={{
          width: 240, padding: '7px 12px', border: '1px solid var(--lv-line)',
          borderRadius: 7, fontSize: 13, outline: 'none',
          background: 'var(--lv-bg)', color: 'var(--lv-fg)',
        }}
      />

      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--lv-line)', background: 'var(--lv-surface)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} style={{ borderBottom: '1px solid var(--lv-line)' }}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    style={{
                      padding: '9px 14px', textAlign: 'right', fontSize: 10.5,
                      fontWeight: 600, color: 'var(--lv-muted)',
                      textTransform: 'uppercase', letterSpacing: '.05em',
                      cursor: header.column.getCanSort() ? 'pointer' : 'default',
                      userSelect: 'none', fontFamily: 'var(--lv-font-ui)',
                    }}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc'  && ' ↑'}
                    {header.column.getIsSorted() === 'desc' && ' ↓'}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--lv-line)' }}>
                  {columns.map((_, ci) => (
                    <td key={ci} style={{ padding: '12px 14px' }}>
                      <div style={{ height: 12, background: 'var(--lv-line)', borderRadius: 4, width: '60%', animation: 'lvpulse 1.5s infinite' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--lv-muted)', fontSize: 13 }}>
                  {globalFilter ? `لا توجد نتائج لـ "${globalFilter}"` : emptyLabel}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  style={{ borderBottom: '1px solid var(--lv-line)', transition: 'background .1s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--lv-hover)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} style={{ padding: '11px 14px', color: 'var(--lv-fg)', verticalAlign: 'middle', fontFamily: 'var(--lv-font-ar)' }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalRows > ps && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--lv-muted)' }}>
          <span>عرض {pageIndex * ps + 1}–{Math.min((pageIndex + 1) * ps, totalRows)} من {totalRows}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}
              style={{ padding: '4px 12px', border: '1px solid var(--lv-line)', borderRadius: 6, fontSize: 12, background: 'var(--lv-bg)', color: 'var(--lv-fg)', cursor: 'pointer', opacity: table.getCanPreviousPage() ? 1 : .4 }}>
              السابق
            </button>
            <span style={{ padding: '4px 10px', fontWeight: 600, color: 'var(--lv-fg)', fontFamily: 'var(--lv-font-mono)' }}>
              <bdi dir="ltr">{pageIndex + 1} / {table.getPageCount()}</bdi>
            </span>
            <button disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}
              style={{ padding: '4px 12px', border: '1px solid var(--lv-line)', borderRadius: 6, fontSize: 12, background: 'var(--lv-bg)', color: 'var(--lv-fg)', cursor: 'pointer', opacity: table.getCanNextPage() ? 1 : .4 }}>
              التالي
            </button>
          </div>
        </div>
      )}
      <style>{`@keyframes lvpulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>
    </div>
  );
}
