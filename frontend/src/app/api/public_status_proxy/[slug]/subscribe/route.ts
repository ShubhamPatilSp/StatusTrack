import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@auth0/nextjs-auth0';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { user } = await auth();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/${params.slug}/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.access_token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error('Failed to subscribe');
    }

    return NextResponse.json({ message: 'Successfully subscribed' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to subscribe' },
      { status: 500 }
    );
  }
}
