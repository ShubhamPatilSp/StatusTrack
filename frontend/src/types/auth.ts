import { NextApiRequest, NextApiResponse } from 'next';

export type NextPageRouterHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void>;
export type NextAppRouterHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

export interface AuthConfig {
  baseURL: string;
  issuerBaseURL: string;
  clientId: string;
  clientSecret: string;
  audience: string;
  secret: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
}
