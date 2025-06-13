import { NextResponse } from 'next/server';
import { Incident, Service, Organization, IncidentUpdate } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

// --- Backend Type Definitions ---
// These types represent the data structure as it comes from the Python backend (with _id)

interface BackendIncidentUpdate extends Omit<IncidentUpdate, 'id'> {
  _id: string;
}

interface BackendIncident extends Omit<Incident, 'id' | 'updates'> {
  _id: string;
  updates: BackendIncidentUpdate[];
}

interface BackendService extends Omit<Service, 'id'> {
  _id: string;
}

// Assuming the backend sends a partial Organization object
interface BackendOrganization extends Omit<Partial<Organization>, 'id'> {
  _id: string;
  name: string; // Ensure name is always present
}

interface BackendResponse {
  organization: BackendOrganization;
  services: BackendService[];
  incidents: BackendIncident[];
}

// --- Transformation Helper ---

function transformDocument<T extends { _id: string }>(doc: T): Omit<T, '_id'> & { id: string } {
  const { _id, ...rest } = doc;
  return { ...rest, id: _id };
}

// --- API Route Handler ---

export async function GET(
  req: Request,
  { params }: { params: { organizationSlug: string } }
) {
  const { organizationSlug } = params;

  if (!organizationSlug) {
    return NextResponse.json({ error: 'Organization slug is required' }, { status: 400 });
  }

  try {
    const backendUrl = `${API_URL}/api/v1/organizations/public/${organizationSlug}`;
    
    const orgRes = await fetch(backendUrl);

    if (!orgRes.ok) {
        const errorBody = await orgRes.text();
        console.error(`Backend error fetching public status: ${orgRes.status}`, errorBody);
        return NextResponse.json({ error: 'Failed to fetch organization status.' }, { status: orgRes.status });
    }
    
    const backendData: BackendResponse = await orgRes.json();

    // Transform the backend data (_id -> id) to match frontend type definitions
    const responseData = {
      organization: transformDocument(backendData.organization),
      services: backendData.services.map(transformDocument),
      incidents: backendData.incidents.map(incident => ({
        ...transformDocument(incident),
        updates: incident.updates.map(transformDocument)
      }))
    };

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error('Error in public_status API route:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
