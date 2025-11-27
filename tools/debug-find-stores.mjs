import { findNearbyStores } from '../lib/scraping/osm-discovery';

const lat = parseFloat(process.argv[2] ?? '-32.9582817');
const lon = parseFloat(process.argv[3] ?? '-60.6750367');
const radius = parseInt(process.argv[4] ?? '2000', 10);

(async () => {
    const stores = await findNearbyStores(lat, lon, radius);
    console.log('Total stores:', stores.length);
    console.log(
        stores
            .filter((store) => store.scraping_enabled)
            .slice(0, 5)
            .map((store) => ({
                id: store.id,
                osm_id: store.osm_id,
                name: store.name,
                brand: store.brand,
                scraping_enabled: store.scraping_enabled,
                distance: store.distance,
            }))
    );
})();
