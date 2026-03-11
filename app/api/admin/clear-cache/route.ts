import { NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/auth/admin';
import { getSupabaseServiceClient } from '@/lib/supabase/server-client';

export async function GET(request: Request) {
  const auth = await assertAdminRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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
