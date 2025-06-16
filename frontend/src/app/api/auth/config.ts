import { handleAuth } from '@auth0/nextjs-auth0';
import { NextApiRequest, NextApiResponse } from 'next';

export default handleAuth({
  async callback(req: NextApiRequest, res: NextApiResponse) {
    try {
      const returnTo = process.env.NEXT_PUBLIC_BACKEND_URL as string;
      res.redirect(returnTo);
    } catch (error) {
      console.error('Callback error:', error);
      res.status(500).json({ error: 'Callback failed' });
    }
  },
  async login(req: NextApiRequest, res: NextApiResponse) {
    try {
      const returnTo = process.env.NEXT_PUBLIC_BACKEND_URL as string;
      res.redirect(`https://dev-wdap2xecqkjob0lj.us.auth0.com/authorize?redirect_uri=${encodeURIComponent(returnTo + '/api/auth/callback')}&client_id=${process.env.AUTH0_CLIENT_ID}&response_type=code`);
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  },
  async logout(req: NextApiRequest, res: NextApiResponse) {
    try {
      const returnTo = process.env.NEXT_PUBLIC_BACKEND_URL as string;
      res.redirect(`https://dev-wdap2xecqkjob0lj.us.auth0.com/v2/logout?returnTo=${encodeURIComponent(returnTo)}`);
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }
});

export const config = {
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL as string,
  issuerBaseURL: process.env.NEXT_PUBLIC_AUTH0_ISSUER_BASE_URL as string,
  clientId: process.env.AUTH0_CLIENT_ID as string,
  clientSecret: process.env.AUTH0_CLIENT_SECRET as string,
  audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE as string,
  secret: process.env.AUTH0_SECRET as string,
  redirectUri: `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/callback` as string,
  postLogoutRedirectUri: process.env.NEXT_PUBLIC_BACKEND_URL as string
};
