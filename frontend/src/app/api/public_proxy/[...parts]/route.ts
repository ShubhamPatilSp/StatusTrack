import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parts = req.nextUrl.pathname.split('/');
  const slugAndBeyond = parts.slice(3).join('/'); // Skips /api/public_proxy

  const backendUrl = `${API_URL}/public/${slugAndBeyond}?${searchParams}`;

  try {
    const backendResponse = await fetch(backendUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' ? req.body : null,
      cache: 'no-store', // Ensure fresh data for status pages
    });

    const data = await backendResponse.json();

    return NextResponse.json(data, { status: backendResponse.status });

  } catch (error: any) {
    console.error(`Error in public proxy route:`, error);
    return NextResponse.json(
      { error: error.message || 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
