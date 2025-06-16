/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://status-track-alpha.vercel.app';
    return [
      {
        source: "/api/v1/(.*)", // More specific path to avoid conflict with Auth0 routes
        destination: `${backendUrl}/api/v1/$1`, // Proxy to Backend
      },
      {
        source: "/api/auth/callback",
        destination: `${backendUrl}/api/auth/callback`
      }
    ];
  },
  env: {
    NEXT_PUBLIC_AUTH0_BASE_URL: process.env.NEXT_PUBLIC_AUTH0_BASE_URL || 'https://status-track-alpha.vercel.app'
  }
};

export default nextConfig;
