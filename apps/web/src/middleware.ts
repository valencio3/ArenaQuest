import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};

export function middleware(request: NextRequest) {
  const hasRefreshCookie = request.cookies.has('refresh_token');
  if (!hasRefreshCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}
