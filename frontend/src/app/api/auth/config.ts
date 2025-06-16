import { handleAuth } from '@auth0/nextjs-auth0';

export default handleAuth();

export const config = {
  baseURL: process.env.NEXT_PUBLIC_AUTH0_BASE_URL,
  issuerBaseURL: process.env.NEXT_PUBLIC_AUTH0_ISSUER_BASE_URL,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
  secret: process.env.AUTH0_SECRET,
  redirectUri: `${process.env.NEXT_PUBLIC_AUTH0_BASE_URL}/api/auth/callback`,
  postLogoutRedirectUri: process.env.NEXT_PUBLIC_AUTH0_BASE_URL
};
