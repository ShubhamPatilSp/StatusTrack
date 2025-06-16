import { handleAuth } from '@auth0/nextjs-auth0';

export default handleAuth();

export const config = {
  baseURL: process.env.NEXT_PUBLIC_AUTH0_BASE_URL || 'http://localhost:3000',
  issuerBaseURL: process.env.NEXT_PUBLIC_AUTH0_ISSUER_BASE_URL,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
  secret: process.env.AUTH0_SECRET,
};
