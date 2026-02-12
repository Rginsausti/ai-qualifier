import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase/server-client';

const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;

export async function GET(request: Request) {
  if (!adminSecret) {
    return NextResponse.json({ error: 'ADMIN_SECRET is not configured' }, { status: 503 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseServiceClient();

    const { error } = await supabase
      .from('product_search_cache')
      .delete()
      .neq('geohash', 'dummy');

    const { error: error2 } = await supabase
      .from('product_search_cache')
      .delete()
      .eq('result_count', 0);

    if (error && error2) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Cache cleared for empty results' });
  } catch {
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
