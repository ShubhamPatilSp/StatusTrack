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
        source: "/api/auth/(.*)", // Handle all Auth0 routes
        destination: `${backendUrl}/api/auth/$1`
      }
    ];
  },
  env: {
    NEXT_PUBLIC_AUTH0_BASE_URL: process.env.NEXT_PUBLIC_AUTH0_BASE_URL || 'https://status-track-alpha.vercel.app',
    NEXT_PUBLIC_AUTH0_ISSUER_BASE_URL: process.env.NEXT_PUBLIC_AUTH0_ISSUER_BASE_URL,
    NEXT_PUBLIC_AUTH0_CLIENT_ID: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID,
    NEXT_PUBLIC_AUTH0_AUDIENCE: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE
  }
};

export default nextConfig;
