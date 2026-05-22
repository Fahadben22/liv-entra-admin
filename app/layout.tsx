import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Liventra OS — Admin',
  description: 'Super Admin Dashboard',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/icon', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/apple-icon', sizes: '180x180', type: 'image/png' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        {process.env.NEXT_PUBLIC_PLAUSIBLE_URL && (
          <Script defer data-domain="admin.liv-entra.com" src={`${process.env.NEXT_PUBLIC_PLAUSIBLE_URL}/js/script.js`} />
        )}
      </head>
      <body style={{ margin: 0, fontFamily: "'Thmanyah', system-ui, sans-serif", background: '#f8fafc', color: '#0f172a' }}>
        {children}
      </body>
    </html>
  );
}
