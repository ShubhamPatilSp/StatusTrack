/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/public_proxy/:path*',
        destination: `${backendUrl}/api/v1/public/:path*`,
      },
      {
        source: '/api/services_proxy_route/:path*',
        destination: `${backendUrl}/api/v1/services/:path*`,
      },


    ];
  },
  env: {
    NEXT_PUBLIC_AUTH0_BASE_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
    NEXT_PUBLIC_AUTH0_ISSUER_BASE_URL: process.env.NEXT_PUBLIC_AUTH0_ISSUER_BASE_URL,
    NEXT_PUBLIC_AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
    NEXT_PUBLIC_AUTH0_AUDIENCE: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE
  }
};

export default nextConfig;
