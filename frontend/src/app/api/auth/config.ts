import { init } from '@auth0/nextjs-auth0';

init({
  baseURL: process.env.NEXT_PUBLIC_AUTH0_BASE_URL || 'http://localhost:3000',
  issuerBaseURL: process.env.NEXT_PUBLIC_AUTH0_ISSUER_BASE_URL,
  clientID: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
  secret: process.env.AUTH0_SECRET,
});
