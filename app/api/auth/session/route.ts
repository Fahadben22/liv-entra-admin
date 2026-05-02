import { NextRequest, NextResponse } from 'next/server';

const COOKIE = 'admin_rt';
const MAX_AGE = 30 * 24 * 60 * 60;

export async function POST(req: NextRequest) {
  const { refresh_token } = await req.json();
  if (!refresh_token) return NextResponse.json({ ok: false }, { status: 400 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, refresh_token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE,
    path: '/',
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE);
  return res;
}
