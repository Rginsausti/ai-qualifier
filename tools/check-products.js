const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gjgsivmslfacmxpwfkph.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqZ3Npdm1zbGZhY214cHdma3BoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzQ4Nzg5MiwiZXhwIjoyMDc5MDYzODkyfQ.nAq_rB2skDZqDftYcvn14_UL6Cu_FSCEINjFEDU8Wms';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLatestProducts() {
    console.log('Checking latest scraped products...');
    const { data, error } = await supabase
        .from('scraped_products')
        .select('product_name, brand, scraped_at')
        .order('scraped_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching products:', error);
    } else {
        console.log('Latest products:', data);
    }
}

checkLatestProducts();
