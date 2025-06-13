import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const { slug } = params;

  if (!API_URL) {
    return NextResponse.json({ error: 'API URL not configured' }, { status: 500 });
  }

  if (!slug) {
    return NextResponse.json({ error: 'Organization slug is required' }, { status: 400 });
  }

  try {
    const backendUrl = `${API_URL}/api/v1/public/${slug}/status`;
    const response = await fetch(backendUrl, {
      next: {
        revalidate: 60 // Revalidate data every 60 seconds
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ error: `Failed to fetch status page data: ${errorData.detail || response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in public status proxy:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
