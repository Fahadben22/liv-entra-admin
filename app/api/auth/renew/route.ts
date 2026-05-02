import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://liv-entra-api-production.up.railway.app/api/v1';
const COOKIE = 'admin_rt';
const MAX_AGE = 30 * 24 * 60 * 60;

export async function POST() {
  const store = await cookies();
  const rt = store.get(COOKIE)?.value;
  if (!rt) return NextResponse.json({ ok: false }, { status: 401 });

  let railwayRes: Response;
  try {
    railwayRes = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  if (!railwayRes.ok) {
    const res = NextResponse.json({ ok: false }, { status: 401 });
    res.cookies.delete(COOKIE);
    return res;
  }

  const json = await railwayRes.json();
  const token = json.data?.token;
  const newRt = json.data?.refresh_token;
  if (!token) return NextResponse.json({ ok: false }, { status: 401 });

  const res = NextResponse.json({ ok: true, token });
  if (newRt) {
    res.cookies.set(COOKIE, newRt, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: MAX_AGE,
      path: '/',
    });
  }
  return res;
}
