/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://status-track-alpha.vercel.app';
    return [
      {
        source: "/api/v1/:path*", // More specific path to avoid conflict with Auth0 routes
        destination: `${backendUrl}/api/v1/:path*`, // Proxy to Backend
      },
      {
        source: "/api/auth/callback",
        destination: `${backendUrl}/api/auth/callback`
      }
    ];
  },
};

export default nextConfig;
