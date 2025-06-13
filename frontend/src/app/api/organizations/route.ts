import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { NextRequest, NextResponse } from 'next/server';

const API_ROOT_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
const FASTAPI_ORGANIZATIONS_ENDPOINT = `${API_ROOT_URL}/api/v1/organizations`;
const AUTH0_AUDIENCE = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE;
// Define necessary scopes if different from services, typically reading orgs might be covered by general read scopes.
const AUTH0_SCOPES_READ_ORGS = process.env.AUTH0_SCOPES_READ_ORGS || 'openid profile email read:organizations'; // Example scope, adjust as needed
const AUTH0_SCOPES_CREATE_ORGS = process.env.AUTH0_SCOPES_CREATE_ORGS || 'openid profile email create:organizations'; // Scope for creating

export const GET = withApiAuthRequired(async function handleGetOrganizations(req: NextRequest) {
  try {
    const { accessToken } = await getAccessToken({
      authorizationParams: {
        audience: AUTH0_AUDIENCE,
        scope: AUTH0_SCOPES_READ_ORGS // Use a specific scope for reading organizations if defined
      }
    });

    if (!accessToken) {
      return NextResponse.json({ error: 'Access token not available' }, { status: 401 });
    }

    const fastapiResponse = await fetch(FASTAPI_ORGANIZATIONS_ENDPOINT, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!fastapiResponse.ok) {
      const errorData = await fastapiResponse.text(); 
      console.error('FastAPI backend error fetching organizations (organizations):', fastapiResponse.status, 'details:', errorData);
      return NextResponse.json(
        { error: `Error from backend fetching organizations: ${fastapiResponse.statusText}`, details: errorData },
        { status: fastapiResponse.status }
      );
    }

    const data = await fastapiResponse.json();
    // Ensure _id is mapped to id for frontend consistency.
    const organizationsWithId = data.map((org: any) => ({ ...org, id: org._id }));
    return NextResponse.json(organizationsWithId);

  } catch (error: any) {
    console.error('Error in Next.js API route (GET /api/organizations):', error);
    const status = error.status || 500;
    return NextResponse.json(
      { error: error.message || 'Internal Server Error fetching organizations' }, 
      { status }
    );
  }
});

export const POST = withApiAuthRequired(async function handleCreateOrganization(req: NextRequest) {
  try {
    const { accessToken } = await getAccessToken({
      authorizationParams: {
        audience: AUTH0_AUDIENCE,
        scope: AUTH0_SCOPES_CREATE_ORGS
      }
    });

    if (!accessToken) {
      return NextResponse.json({ error: 'Access token not available' }, { status: 401 });
    }

    const body = await req.json();

    const fastapiResponse = await fetch(FASTAPI_ORGANIZATIONS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!fastapiResponse.ok) {
      const errorData = await fastapiResponse.text();
      console.error('FastAPI backend error creating organization:', fastapiResponse.status, 'details:', errorData);
      return NextResponse.json(
        { error: `Error from backend: ${fastapiResponse.statusText}`, details: errorData },
        { status: fastapiResponse.status }
      );
    }

    const data = await fastapiResponse.json();
    // Ensure _id is mapped to id for frontend consistency.
    const newOrganization = { ...data, id: data._id };
    return NextResponse.json(newOrganization, { status: 201 });

  } catch (error: any) {
    console.error('Error in Next.js API route (POST /api/organizations):', error);
    const status = error.status || 500;
    return NextResponse.json(
      { error: error.message || 'Internal Server Error creating organization' },
      { status }
    );
  }
});
