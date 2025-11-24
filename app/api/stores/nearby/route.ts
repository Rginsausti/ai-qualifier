import { NextRequest, NextResponse } from 'next/server';
import { findNearbyStores } from '@/lib/scraping/osm-discovery';

/**
 * GET /api/stores/nearby
 * Discovers nearby stores using OpenStreetMap
 * 
 * Query params:
 * - lat: number (required)
 * - lon: number (required)
 * - radius: number (optional, default 2000m)
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;

        const lat = parseFloat(searchParams.get('lat') || '');
        const lon = parseFloat(searchParams.get('lon') || '');
        const radius = parseInt(searchParams.get('radius') || '2000');

        // Validate inputs
        if (isNaN(lat) || isNaN(lon)) {
            return NextResponse.json(
                { error: 'Invalid lat/lon parameters' },
                { status: 400 }
            );
        }

        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            return NextResponse.json(
                { error: 'Lat/lon out of valid range' },
                { status: 400 }
            );
        }

        if (radius < 100 || radius > 10000) {
            return NextResponse.json(
                { error: 'Radius must be between 100m and 10km' },
                { status: 400 }
            );
        }

        // Discover stores
        const stores = await findNearbyStores(lat, lon, radius);

        return NextResponse.json({
            success: true,
            stores,
            count: stores.length,
        });
    } catch (error) {
        console.error('[API /stores/nearby] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
