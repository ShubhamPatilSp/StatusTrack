import { NextResponse } from 'next/server';

export const revalidate = 60; // Revalidate every 60 seconds

export async function GET(
  request: Request,
  { params }: { params: { slug: string; serviceId: string } }
) {
  const { slug, serviceId } = params;

  if (!slug || !serviceId) {
    return NextResponse.json({ error: 'Missing slug or serviceId' }, { status: 400 });
  }

  const backendUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/public/${slug}/services/${serviceId}/uptime`;

  try {
    const response = await fetch(backendUrl, {
      next: { revalidate }, // Use Next.js caching
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let errorDetail = 'Failed to fetch uptime data from backend';
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        errorDetail = errorData.detail || errorDetail;
      } else {
        // The response is not JSON, so we read it as text.
        errorDetail = await response.text();
      }
      return NextResponse.json(
        { error: errorDetail },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching uptime data:', error);
    return NextResponse.json(
      { error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
