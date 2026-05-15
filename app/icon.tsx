import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: 192, height: 192, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 120 120" width="192" height="192">
        <path d="M60 6 L114 60 L60 114 L6 60 Z" fill="#0E5C3F" />
        <path d="M60 30 L90 60 L60 90 L48 78 L66 60 L48 42 Z" fill="#F4EDE0" />
      </svg>
    </div>,
    { ...size },
  );
}
