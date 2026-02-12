import { createClient } from '@/lib/supabase/server';

export async function GET() {
    const supabase = await createClient();
    
    // Fetch all products from the DB
    const { data: products, error } = await supabase
        .from('scraped_products')
        .select(`
            *,
            nearby_stores (
                name,
                brand
            )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ products }), { 
        headers: { 'Content-Type': 'application/json' } 
    });
}
