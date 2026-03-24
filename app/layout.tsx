import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Liventra OS — Admin', description: 'Super Admin Dashboard' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{margin:0,fontFamily:"'Segoe UI',system-ui,sans-serif",background:'#f8fafc',color:'#0f172a'}}>
        {children}
      </body>
    </html>
  );
}