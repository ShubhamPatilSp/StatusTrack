import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { NextRequest, NextResponse } from 'next/server';

// The base URL for the FastAPI backend
const API_ROOT_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
const FASTAPI_SERVICES_ENDPOINT_BASE = `${API_ROOT_URL}/api/v1/services`;

// Common function to get access token
async function getAuthToken() {
  return getAccessToken({
    authorizationParams: {
      audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
      scope: 'openid profile email read:services write:services',
    },
  });
}

// Generic function to handle backend responses
async function handleBackendResponse(response: Response) {
  if (response.ok) {
    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  }

  const errorDetails = await response.text();
  console.error(`FastAPI backend error: ${response.status} ${response.statusText}`, errorDetails);
  return new NextResponse(errorDetails, { status: response.status, statusText: response.statusText });
}

/**
 * GET /api/services_proxy_route
 * Forwards GET requests to the FastAPI backend to list services.
 * Supports query parameters like `organization_id`.
 */
export const GET = withApiAuthRequired(async function handleGet(req: NextRequest) {
  try {
    const { accessToken } = await getAuthToken();
    const backendUrl = new URL(FASTAPI_SERVICES_ENDPOINT_BASE);
    backendUrl.search = req.nextUrl.search;

    const fastapiResponse = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!fastapiResponse.ok) {
      const errorDetails = await fastapiResponse.text();
      console.error(`FastAPI backend error: ${fastapiResponse.status} ${fastapiResponse.statusText}`, errorDetails);
      return new NextResponse(errorDetails, { status: fastapiResponse.status, statusText: fastapiResponse.statusText });
    }

    const services = await fastapiResponse.json();
    // Map _id to id for frontend compatibility
    const servicesWithId = services.map((service: any) => ({ ...service, id: service._id }));
    
    return NextResponse.json(servicesWithId);

  } catch (error: any) {
    console.error('Error in GET /api/services_proxy_route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
});

/**
 * POST /api/services_proxy_route
 * Forwards POST requests to create a new service.
 */
export const POST = withApiAuthRequired(async function handlePost(req: NextRequest) {
  try {
    const { accessToken } = await getAuthToken();
    const body = await req.json();

    const fastapiResponse = await fetch(FASTAPI_SERVICES_ENDPOINT_BASE + '/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    return await handleBackendResponse(fastapiResponse);
  } catch (error: any) {
    console.error('Error in POST /api/services_proxy_route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
});

/**
 * PATCH /api/services_proxy_route
 * Forwards PATCH requests to update an existing service.
 */
export const PATCH = withApiAuthRequired(async function handlePatch(req: NextRequest) {
  try {
    const { accessToken } = await getAuthToken();
    const id = req.nextUrl.searchParams.get('id');
    const body = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Service ID is required' }, { status: 400 });
    }

    const backendUrl = `${FASTAPI_SERVICES_ENDPOINT_BASE}/${id}`;

    const fastapiResponse = await fetch(backendUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    return await handleBackendResponse(fastapiResponse);
  } catch (error: any) {
    console.error('Error in PATCH /api/services_proxy_route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
});

/**
 * DELETE /api/services_proxy_route
 * Forwards DELETE requests to delete an existing service.
 */
export const DELETE = withApiAuthRequired(async function handleDelete(req: NextRequest) {
  try {
    const { accessToken } = await getAuthToken();
    const id = req.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Service ID is required' }, { status: 400 });
    }

    const backendUrl = `${FASTAPI_SERVICES_ENDPOINT_BASE}/${id}`;

    const fastapiResponse = await fetch(backendUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    return await handleBackendResponse(fastapiResponse);
  } catch (error: any) {
    console.error('Error in DELETE /api/services_proxy_route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
});
