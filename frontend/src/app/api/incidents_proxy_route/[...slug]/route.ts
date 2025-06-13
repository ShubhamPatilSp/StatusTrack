import { getAccessToken, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { NextRequest, NextResponse } from 'next/server';

const API_ROOT_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
const FASTAPI_INCIDENTS_ENDPOINT_BASE = `${API_ROOT_URL}/api/v1/incidents`;

// Common function to get access token with incident scopes
async function getAuthToken() {
  return getAccessToken({
    authorizationParams: {
      audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
      scope: 'openid profile email read:incidents write:incidents',
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
    
    // Helper to map _id to id recursively, as frontend expects 'id'
    const mapId = (item: any): any => {
      if (Array.isArray(item)) {
        return item.map(mapId);
      }
      if (item && typeof item === 'object' && item !== null && '_id' in item) {
        const { _id, ...rest } = item;
        const newObj: any = { id: _id, ...rest };
        for (const key in newObj) {
          if (typeof newObj[key] === 'object') {
            newObj[key] = mapId(newObj[key]);
          }
        }
        return newObj;
      }
      return item;
    };

    return NextResponse.json(mapId(data), { status: response.status });
  }

  const errorDetails = await response.text();
  console.error(`FastAPI backend error: ${response.status} ${response.statusText}`, errorDetails);
  return new NextResponse(errorDetails, { status: response.status, statusText: response.statusText });
}

const handler = withApiAuthRequired(async (req, ctx) => {
  try {
    const { accessToken } = await getAuthToken();
    
    const slug = ctx.params?.slug;
    if (!slug || !Array.isArray(slug)) {
        return NextResponse.json({ error: 'Slug parameter is missing or invalid in proxy route' }, { status: 400 });
    }

    const path = slug.join('/');
    const backendUrl = `${FASTAPI_INCIDENTS_ENDPOINT_BASE}/${path}`;

    const options: RequestInit = {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const body = await req.text();
      if (body) {
        options.body = body;
      }
    }

    const fastapiResponse = await fetch(backendUrl, options);
    return await handleBackendResponse(fastapiResponse);

  } catch (error: any) {
    console.error(`Error in /api/incidents_proxy_route:`, error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
});

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
