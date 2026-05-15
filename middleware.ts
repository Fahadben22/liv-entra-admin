import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public paths that require no authentication
const PUBLIC_PATHS = ['/login', '/pricing', '/subscribe'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get('host') || '';

  // Redirect raw Vercel deployment URLs to the canonical branded domain
  const canonical = process.env.CANONICAL_HOST;
  if (canonical && !host.includes('localhost') && host !== canonical) {
    const dest = req.nextUrl.clone();
    dest.host = canonical;
    dest.protocol = 'https:';
    return NextResponse.redirect(dest, 308);
  }

  if (pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // All other routes (dashboard, root, etc.) require the admin_rt session cookie.
  // This cookie is set by /api/auth/session POST after TOTP login.
  const hasSession = !!req.cookies.get('admin_rt')?.value;
  if (!hasSession) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
