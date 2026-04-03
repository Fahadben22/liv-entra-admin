import type { Metadata } from 'next';
import { Noto_Sans_Arabic } from 'next/font/google';
import './globals.css';

const noto = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-noto',
  display: 'swap',
});

export const metadata: Metadata = { title: 'Liventra OS — Admin', description: 'Super Admin Dashboard' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={noto.variable}>
      <body style={{ margin: 0, fontFamily: 'var(--font-noto, "Noto Sans Arabic"), system-ui, sans-serif', background: '#f8fafc', color: '#0f172a' }}>
        {children}
      </body>
    </html>
  );
}