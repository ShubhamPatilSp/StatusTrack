import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { NextRequest, NextResponse } from 'next/server';

const API_ROOT_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
const FASTAPI_SERVICES_ENDPOINT_BASE = `${API_ROOT_URL}/api/v1/services`;

async function getAuthToken() {
  return getAccessToken({
    authorizationParams: {
      audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
      scope: 'openid profile email read:services write:services',
    },
  });
}

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

type HandlerContext = {
    params?: {
        serviceId?: string;
    }
}

/**
 * PATCH /api/services/[serviceId]
 * Forwards PATCH requests to update an existing service.
 */
export const PATCH = withApiAuthRequired(async function handlePatch(req: NextRequest, context: HandlerContext) {
  try {
    const { accessToken } = await getAuthToken();
    const serviceId = context.params?.serviceId;
    if (!serviceId) {
        return NextResponse.json({ error: 'Service ID is required.' }, { status: 400 });
    }
    const body = await req.json();

    const fastapiResponse = await fetch(`${FASTAPI_SERVICES_ENDPOINT_BASE}/${serviceId}`,
     {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    return await handleBackendResponse(fastapiResponse);
  } catch (error: any) {
    console.error(`Error in PATCH /api/services/${context.params?.serviceId}:`, error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
});

/**
 * DELETE /api/services/[serviceId]
 * Forwards DELETE requests to remove a service.
 */
export const DELETE = withApiAuthRequired(async function handleDelete(req: NextRequest, context: HandlerContext) {
  try {
    const { accessToken } = await getAuthToken();
    const serviceId = context.params?.serviceId;
    if (!serviceId) {
        return NextResponse.json({ error: 'Service ID is required.' }, { status: 400 });
    }

    const fastapiResponse = await fetch(`${FASTAPI_SERVICES_ENDPOINT_BASE}/${serviceId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    return await handleBackendResponse(fastapiResponse);
  } catch (error: any) {
    console.error(`Error in DELETE /api/services/${context.params?.serviceId}:`, error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
});

