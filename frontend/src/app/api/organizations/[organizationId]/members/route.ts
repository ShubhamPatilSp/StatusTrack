import { withApiAuthRequired, getAccessToken } from '@auth0/nextjs-auth0';
import { NextResponse, NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function mapMongoId(obj: any): any {
    if (obj && typeof obj === 'object') {
        if (Array.isArray(obj)) {
            return obj.map(mapMongoId);
        }
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            if (key === '_id') {
                newObj['id'] = obj[key];
            } else {
                newObj[key] = mapMongoId(obj[key]);
            }
        }
        return newObj;
    }
    return obj;
}

// Define a type for the context that withApiAuthRequired expects for App Router handlers
type AppRouteHandlerContext = {
    params?: Record<string, string | string[]>;
}

const handlePost = async (req: NextRequest, { params }: AppRouteHandlerContext) => {
    const organizationId = params?.organizationId;

    // Validate that organizationId exists and is a string
    if (typeof organizationId !== 'string') {
        return NextResponse.json({ message: 'A valid organizationId is required in the URL.' }, { status: 400 });
    }

    try {
        const { accessToken } = await getAccessToken();
        const backendUrl = `${API_URL}/api/v1/organizations/${organizationId}/members`;
        
        const body = await req.json();

        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json({ message: data.detail || 'Failed to add member' }, { status: response.status });
        }

        const mappedData = mapMongoId(data);
        return NextResponse.json(mappedData);

    } catch (error: any) {
        console.error('Error in API route:', error);
        return NextResponse.json({ message: error.message || 'An unexpected error occurred' }, { status: 500 });
    }
};

export const POST = withApiAuthRequired(handlePost);
