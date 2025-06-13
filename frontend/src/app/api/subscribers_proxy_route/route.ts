import { NextRequest, NextResponse } from 'next/server';

const API_ROOT_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
const FASTAPI_SUBSCRIBERS_ENDPOINT = `${API_ROOT_URL}/api/v1/subscribers/`;

async function handleBackendResponse(response: Response) {
  if (response.ok) {
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  }
  const errorDetails = await response.text();
  console.error(`FastAPI backend error: ${response.status} ${response.statusText}`, errorDetails);
  try {
    const errorJson = JSON.parse(errorDetails);
    return NextResponse.json(errorJson, { status: response.status });
  } catch (e) {
    return new NextResponse(errorDetails, { status: response.status, statusText: response.statusText });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const fastapiResponse = await fetch(FASTAPI_SUBSCRIBERS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    return await handleBackendResponse(fastapiResponse);
  } catch (error: any) {
    console.error('Error in POST /api/subscribers_proxy_route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
