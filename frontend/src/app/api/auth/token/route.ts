import { getSession, getAccessToken, AccessTokenRequest } from '@auth0/nextjs-auth0';
import { NextResponse } from 'next/server';

export async function GET() { // Removed req: Request as it's not directly used by getSession/getAccessToken in this context
  try {
    const session = await getSession(); // Call without arguments in App Router
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Ensure AUTH0_AUDIENCE is set in your .env.local and matches your API identifier in Auth0
    const audience = process.env.AUTH0_AUDIENCE; // We check this for sanity
    if (!audience) {
      console.error('AUTH0_AUDIENCE is not set in environment variables. This is required for the SDK to pick up the audience.');
      return NextResponse.json({ error: 'Authentication configuration error: AUTH0_AUDIENCE missing.' }, { status: 500 });
    }

    // AccessTokenRequest might only be for 'scopes' or other specific request params,
    // relying on AUTH0_AUDIENCE env var for the audience itself.
    const tokenOptions: AccessTokenRequest = {
      scopes: ['openid', 'profile', 'email'],
    };

    const { accessToken } = await getAccessToken(tokenOptions);

    if (!accessToken) {
      return NextResponse.json({ error: 'Access token not available' }, { status: 500 });
    }

    return NextResponse.json({ accessToken });
  } catch (error: any) {
    console.error('Error getting access token:', error);
    return NextResponse.json({ error: error.message || 'Failed to get access token' }, { status: error.status || 500 });
  }
}
