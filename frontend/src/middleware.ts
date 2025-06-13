import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
// No need to import { auth0 } from './lib/auth0' if only checking cookies

export function middleware(req: NextRequest) { // Can be synchronous if only checking cookies
  const pathname = req.nextUrl.pathname;
  const sessionCookie = req.cookies.get('appSession'); // Default cookie name for @auth0/nextjs-auth0 v3

  console.log(`[Middleware] Path: ${pathname}, Session cookie exists: ${!!sessionCookie}`);

  if (pathname.startsWith('/admin')) {
    if (!sessionCookie) {
      console.log('[Middleware] No session cookie found for /admin route. Redirecting to login.');
      const loginUrl = new URL('/api/auth/login', req.url);
      loginUrl.searchParams.set('returnTo', pathname);
      return NextResponse.redirect(loginUrl);
    }
    // If cookie exists, let the page component handle full session validation
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
