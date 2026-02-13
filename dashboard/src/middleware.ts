export { auth as middleware } from '@/lib/auth/config';

export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*', '/anomalies/:path*', '/reports/:path*', '/history/:path*'],
};
