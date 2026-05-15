import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white' }}>
      <svg viewBox="0 0 120 120" width="160" height="160">
        <path d="M60 6 L114 60 L60 114 L6 60 Z" fill="#0E5C3F" />
        <path d="M60 30 L90 60 L60 90 L48 78 L66 60 L48 42 Z" fill="#F4EDE0" />
      </svg>
    </div>,
    { ...size },
  );
}
