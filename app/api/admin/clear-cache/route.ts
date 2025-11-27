import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
    try {
        const supabase = await createClient();
        
        // Delete all rows from product_search_cache
        const { error } = await supabase
            .from('product_search_cache')
            .delete()
            .neq('geohash', 'dummy'); // Delete all rows (hacky way to delete all if no PK filter)

        // If the above doesn't work because of RLS or safety settings, we might need a specific filter.
        // But usually .delete().neq('id', 0) works.
        // Let's try to delete everything where result_count is 0 first, which is the main issue.
        
        const { error: error2 } = await supabase
            .from('product_search_cache')
            .delete()
            .eq('result_count', 0);

        if (error && error2) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Cache cleared for empty results' });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
