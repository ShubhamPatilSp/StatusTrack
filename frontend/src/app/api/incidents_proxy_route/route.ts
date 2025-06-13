import { withApiAuthRequired, getAccessToken } from '@auth0/nextjs-auth0';
import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Helper function to recursively map _id to id, which the frontend expects
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
                    newObj[key] = recursiveIdMapper(obj[key]);
                }
            }
        }
        return newObj;
    }
    return obj;
}


const handlePost = async (req: Request) => {
    try {
        const { accessToken } = await getAccessToken();
        const backendUrl = `${API_URL}/api/v1/incidents`;

        const body = await req.json();

        const backendResponse = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await backendResponse.json();

        if (!backendResponse.ok) {
            // Forward the error response from the backend
            return NextResponse.json(data, { status: backendResponse.status });
        }
        
        // Map the response data before sending it to the client
        const mappedData = recursiveIdMapper(data);
        return NextResponse.json(mappedData);

    } catch (error: any) {
        console.error('Error in incident creation proxy route:', error);
        return NextResponse.json({ error: error.message || 'An unexpected error occurred' }, { status: 500 });
    }
};

export const POST = withApiAuthRequired(handlePost);
