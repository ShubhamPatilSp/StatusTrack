import { withApiAuthRequired, getAccessToken } from '@auth0/nextjs-auth0';
import { NextResponse, NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Helper to map MongoDB's _id to id
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

type AppRouteHandlerContext = {
    params?: { 
        incidentId?: string;
    };
}

// Handler for updating an incident
const handlePatch = async (req: NextRequest, { params }: AppRouteHandlerContext) => {
    const incidentId = params?.incidentId;

    if (typeof incidentId !== 'string') {
        return NextResponse.json({ message: 'A valid incidentId is required.' }, { status: 400 });
    }

    try {
        const { accessToken } = await getAccessToken();
        const backendUrl = `${API_URL}/api/v1/incidents/${incidentId}`;
        
        const body = await req.json();

        const response = await fetch(backendUrl, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json({ message: data.detail || 'Failed to update incident' }, { status: response.status });
        }

        return NextResponse.json(mapMongoId(data));

    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'An unexpected error occurred' }, { status: 500 });
    }
};

// Handler for deleting an incident
const handleDelete = async (req: NextRequest, { params }: AppRouteHandlerContext) => {
    const incidentId = params?.incidentId;

    if (typeof incidentId !== 'string') {
        return NextResponse.json({ message: 'A valid incidentId is required.' }, { status: 400 });
    }

    try {
        const { accessToken } = await getAccessToken();
        const backendUrl = `${API_URL}/api/v1/incidents/${incidentId}`;
        
        const response = await fetch(backendUrl, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (response.status !== 204) { // 204 No Content on success
            const data = await response.json();
            return NextResponse.json({ message: data.detail || 'Failed to delete incident' }, { status: response.status });
        }

        return new NextResponse(null, { status: 204 });

    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'An unexpected error occurred' }, { status: 500 });
    }
};

export const PATCH = withApiAuthRequired(handlePatch);
export const DELETE = withApiAuthRequired(handleDelete);
