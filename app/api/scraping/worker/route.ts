import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase/server-client';
import { cotoAdapter } from '@/lib/scraping/adapters/coto';
import { carrefourAdapter } from '@/lib/scraping/adapters/carrefour';
import { jumboAdapter, veaAdapter, discoAdapter } from '@/lib/scraping/adapters/jumbo';
import type { StoreAdapter } from '@/lib/scraping/types';

const MAX_JOBS_PER_RUN = Number(process.env.SCRAPING_MAX_JOBS_PER_RUN || '2');
const MAX_PRODUCTS_PER_JOB = Number(process.env.SCRAPING_MAX_PRODUCTS_PER_JOB || '8');
const MAX_RETRIES = Number(process.env.SCRAPING_MAX_RETRIES || '3');

const brandAdapters: Record<string, StoreAdapter> = {
  COTO: cotoAdapter,
  CARREFOUR: carrefourAdapter,
  JUMBO: jumboAdapter,
  VEA: veaAdapter,
  DISCO: discoAdapter,
};

function pickAdapter(brand?: string | null): StoreAdapter | null {
  if (!brand) return null;
  return brandAdapters[brand.toUpperCase()] ?? null;
}

function parseQueries(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_PRODUCTS_PER_JOB);
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();

  const { data: jobs, error } = await supabase
    .from('scraping_jobs')
    .select('id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(Math.max(1, MAX_JOBS_PER_RUN));

  if (error) {
    console.error('[scraping/worker] failed to fetch pending jobs', error);
    return NextResponse.json({ error: 'Unable to fetch pending jobs' }, { status: 500 });
  }

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ success: true, processed: 0, message: 'No pending jobs' });
  }

  const summary: Array<{ jobId: string; status: string; productsFound?: number; error?: string }> = [];

  for (const jobRef of jobs) {
    const startedAt = new Date().toISOString();
    const { data: claimedRows, error: claimError } = await supabase
      .from('scraping_jobs')
      .update({ status: 'running', started_at: startedAt })
      .eq('id', jobRef.id)
      .eq('status', 'pending')
      .select('id, store_id, search_query, retry_count')
      .limit(1);

    if (claimError) {
      summary.push({ jobId: jobRef.id, status: 'claim_failed', error: claimError.message });
      continue;
    }

    const job = claimedRows?.[0];
    if (!job) {
      summary.push({ jobId: jobRef.id, status: 'already_claimed' });
      continue;
    }

    try {
      const { data: store, error: storeError } = await supabase
        .from('nearby_stores')
        .select('id, name, brand, website_url, scraping_enabled')
        .eq('id', job.store_id)
        .single();

      if (storeError || !store) {
        throw new Error('Store not found for scraping job');
      }

      if (!store.scraping_enabled) {
        throw new Error('Scraping disabled for store');
      }

      const adapter = pickAdapter(store.brand);
      if (!adapter) {
        throw new Error(`Unsupported store brand: ${store.brand ?? 'unknown'}`);
      }

      const queries = parseQueries(job.search_query);
      if (queries.length === 0) {
        throw new Error('Job has no valid product queries');
      }

      let totalProducts = 0;

      for (const query of queries) {
        const extractedProducts = await adapter.scrape(query, {
          storeBrand: store.brand,
          storeId: store.id,
          storeName: store.name,
          storeWebsite: store.website_url,
        });

        if (extractedProducts.length > 0) {
          const records = extractedProducts.map((product) => ({
            store_id: store.id,
            product_name: product.product_name,
            brand: product.brand,
            price_current: product.price_current,
            price_regular: product.price_regular,
            unit: product.unit,
            nutritional_claims: product.nutritional_claims,
            nutrition_info: product.nutrition_info,
            image_url: product.image_url,
            product_url: product.product_url,
          }));

          const { error: insertError } = await supabase
            .from('scraped_products')
            .insert(records);

          if (insertError) {
            throw new Error(insertError.message);
          }
        }

        totalProducts += extractedProducts.length;
      }

      await supabase
        .from('scraping_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          products_found: totalProducts,
          error_message: null,
        })
        .eq('id', job.id);

      summary.push({ jobId: job.id, status: 'completed', productsFound: totalProducts });
    } catch (workerError) {
      const nextRetry = (job.retry_count ?? 0) + 1;
      const canRetry = nextRetry <= MAX_RETRIES;
      const nextStatus = canRetry ? 'pending' : 'failed';
      const errorMessage = workerError instanceof Error ? workerError.message : 'Unknown scraping error';

      await supabase
        .from('scraping_jobs')
        .update({
          status: nextStatus,
          retry_count: nextRetry,
          completed_at: canRetry ? null : new Date().toISOString(),
          error_message: errorMessage,
        })
        .eq('id', job.id);

      summary.push({
        jobId: job.id,
        status: canRetry ? 'retry_scheduled' : 'failed',
        error: errorMessage,
      });
    }
  }

  return NextResponse.json({
    success: true,
    processed: summary.length,
    jobs: summary,
  });
}
