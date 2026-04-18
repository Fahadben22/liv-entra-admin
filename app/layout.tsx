import type { Metadata } from 'next';
import { Noto_Sans_Arabic, Inter_Tight, JetBrains_Mono, Fraunces, Cairo } from 'next/font/google';
import './globals.css';

const noto = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-noto',
  display: 'swap',
});

const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter-tight',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz'],
  weight: ['400', '600', '800'],
  variable: '--font-fraunces',
  display: 'swap',
});

const cairo = Cairo({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-cairo',
  display: 'swap',
});

export const metadata: Metadata = { title: 'Liventra OS — Admin', description: 'Super Admin Dashboard' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${noto.variable} ${interTight.variable} ${jetbrainsMono.variable} ${fraunces.variable} ${cairo.variable}`}
    >
      <body style={{ margin: 0, fontFamily: 'var(--font-noto, "Noto Sans Arabic"), system-ui, sans-serif', background: '#f8fafc', color: '#0f172a' }}>
        {children}
      </body>
    </html>
  );
}
