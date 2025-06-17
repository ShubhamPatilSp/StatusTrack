import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { NextRequest, NextResponse } from 'next/server';

const API_ROOT_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
const AUTH0_AUDIENCE = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE;
const AUTH0_SCOPES = 'openid profile email read:incidents create:incidents update:incidents delete:incidents';

export const GET = withApiAuthRequired(async function handleGetIncidents(req: NextRequest) {
  try {
    const { accessToken } = await getAccessToken({
      authorizationParams: {
        audience: AUTH0_AUDIENCE,
        scope: AUTH0_SCOPES
      }
    });

    if (!accessToken) {
      return NextResponse.json({ error: 'Access token not available' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('organization_id');
    const endpoint = `${API_ROOT_URL}/api/v1/incidents/organization/${orgId}`;

    const fastapiResponse = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!fastapiResponse.ok) {
      const errorData = await fastapiResponse.text();
      console.error('FastAPI backend error fetching incidents:', fastapiResponse.status, 'details:', errorData);
      return NextResponse.json(
        { error: `Error from backend: ${fastapiResponse.statusText}`, details: errorData },
        { status: fastapiResponse.status }
      );
    }

    const data = await fastapiResponse.json();
    const incidentsWithId = data.map((inc: any) => ({ ...inc, id: inc._id }));
    return NextResponse.json(incidentsWithId);

  } catch (error: any) {
    console.error('Error in Next.js API route (GET /api/incidents):', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' }, 
      { status: error.status || 500 }
    );
  }
});
