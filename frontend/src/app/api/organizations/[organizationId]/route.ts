import { withApiAuthRequired, getAccessToken } from '@auth0/nextjs-auth0';
import { NextResponse, type NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Helper function to recursively map _id to id
function recursiveIdMapper(obj: any): any {
    if (Array.isArray(obj)) {
        return obj.map(recursiveIdMapper);
    }
    if (obj !== null && typeof obj === 'object') {
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                if (key === '_id') {
                    newObj['id'] = obj[key];
                } else {
                    // The backend now returns populated members with 'id', so we pass them directly.
                    if (key === 'members' && Array.isArray(obj[key])) {
                         newObj[key] = obj[key];
                    } else {
                        newObj[key] = recursiveIdMapper(obj[key]);
                    }
                }
            }
        }
        return newObj;
    }
    return obj;
}


export const GET = withApiAuthRequired(async function GET(req: NextRequest, ctx: { params?: { organizationId?: string } }) {
    try {
        const organizationId = ctx.params?.organizationId;
        if (!organizationId) {
            return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
        }

        const { accessToken } = await getAccessToken();
        const backendUrl = `${API_URL}/api/v1/organizations/${organizationId}`;

        const backendResponse = await fetch(backendUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        const data = await backendResponse.json();

        if (!backendResponse.ok) {
            return NextResponse.json(data, { status: backendResponse.status });
        }
        
        const mappedData = recursiveIdMapper(data);
        return NextResponse.json(mappedData);

    } catch (error: any) {
        console.error('Error in organization proxy route (GET):', error);
        return NextResponse.json({ error: error.message || 'An unexpected error occurred' }, { status: 500 });
    }
});


export const PUT = withApiAuthRequired(async function PUT(req: NextRequest, ctx: { params?: { organizationId?: string } }) {
    try {
        const organizationId = ctx.params?.organizationId;
        if (!organizationId) {
            return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
        }

        const { accessToken } = await getAccessToken();
        const backendUrl = `${API_URL}/api/v1/organizations/${organizationId}`;

        const body = await req.json();

        const backendResponse = await fetch(backendUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await backendResponse.json();

        if (!backendResponse.ok) {
            return NextResponse.json(data, { status: backendResponse.status });
        }
        
        const mappedData = recursiveIdMapper(data);
        return NextResponse.json(mappedData);

    } catch (error: any) {
        console.error('Error in organization proxy route (PUT):', error);
        return NextResponse.json({ error: error.message || 'An unexpected error occurred' }, { status: 500 });
    }
});
