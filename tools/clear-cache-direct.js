const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjgsivmslfacmxpwfkph.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqZ3Npdm1zbGZhY214cHdma3BoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzQ4Nzg5MiwiZXhwIjoyMDc5MDYzODkyfQ.nAq_rB2skDZqDftYcvn14_UL6Cu_FSCEINjFEDU8Wms';

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearCache() {
    console.log('Clearing cache...');
    const { error } = await supabase
        .from('product_search_cache')
        .delete()
        .neq('geohash', 'dummy'); // Delete all

    if (error) {
        console.error('Error clearing cache:', error);
    } else {
        console.log('Cache cleared successfully.');
    }
}

clearCache();
