export interface Auth0User {
  sub: string;
  name?: string;
  nickname?: string;
  email?: string;
  picture?: string;
  updated_at: string;
  [key: string]: any;
}

export interface Auth0Request extends Request {
  user?: Auth0User;
}
