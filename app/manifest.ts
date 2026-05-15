import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Liventra OS — Admin',
    short_name: 'Liventra OS',
    description: 'لوحة تحكم المسؤول — Liventra SaaS Admin',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#0E5C3F',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
      { src: '/icon', sizes: '192x192', type: 'image/png', purpose: 'any' },
    ],
  };
}
