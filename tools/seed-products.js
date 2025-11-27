#!/usr/bin/env node

/**
 * Seed script to scrape multiple supermarkets and populate Supabase cached products.
 * Usage: node tools/seed-products.js
 */

const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');
const Groq = require('groq-sdk');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GROQ_API_KEY',
  'HEADLESSX_AUTH_TOKEN'
];

const missingEnv = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
if (missingEnv.length) {
  console.error('[Seed] Missing environment variables:', missingEnv.join(', '));
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HEADLESSX_API_URL = process.env.HEADLESSX_API_URL || 'http://localhost:3000/api/render';
const HEADLESSX_AUTH_TOKEN = process.env.HEADLESSX_AUTH_TOKEN;

const KEYWORDS = ['pollo', 'leche', 'cafe', 'yerba'];

const DEFAULT_STORES = [
  {
    osm_id: 9990000001,
    name: 'Coto Caballito',
    brand: 'COTO',
    lat: -34.6195,
    lon: -58.4423,
    address: { street: 'Av. Rivadavia 4900', city: 'CABA' }
  },
  {
    osm_id: 9990000002,
    name: 'Carrefour Palermo',
    brand: 'CARREFOUR',
    lat: -34.5855,
    lon: -58.4246,
    address: { street: 'Av. Córdoba 5500', city: 'CABA' }
  },
  {
    osm_id: 9990000003,
    name: 'Jumbo Nuñez',
    brand: 'JUMBO',
    lat: -34.5341,
    lon: -58.4706,
    address: { street: 'Av. del Libertador 6835', city: 'CABA' }
  },
  {
    osm_id: 9990000004,
    name: 'Vea San Telmo',
    brand: 'VEA',
    lat: -34.6227,
    lon: -58.373,
    address: { street: 'Av. Paseo Colón 800', city: 'CABA' }
  },
  {
    osm_id: 9990000005,
    name: 'Disco Belgrano',
    brand: 'DISCO',
    lat: -34.5627,
    lon: -58.4561,
    address: { street: 'Av. Cabildo 1800', city: 'CABA' }
  }
];

const SCRAPING_TARGETS = {
  COTO: {
    buildUrl: (query) => `https://www.cotodigital3.com.ar/sitios/cdigi/buscar?q=${encodeURIComponent(query)}`,
    waitSelector: '.product-item, .producto, table.products'
  },
  CARREFOUR: {
    buildUrl: (query) => `https://www.carrefour.com.ar/${encodeURIComponent(query)}`,
    waitSelector: '.vtex-search-result-3-x-gallery'
  },
  JUMBO: {
    buildUrl: (query) => `https://www.jumbo.com.ar/buscar?q=${encodeURIComponent(query)}`,
    waitSelector: '.product-card, .shelf-item'
  },
  VEA: {
    buildUrl: (query) => `https://www.vea.com.ar/buscar?q=${encodeURIComponent(query)}`,
    waitSelector: '.product-card, .shelf-item'
  },
  DISCO: {
    buildUrl: (query) => `https://www.disco.com.ar/buscar?q=${encodeURIComponent(query)}`,
    waitSelector: '.product-card, .shelf-item'
  }
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function isRateLimitError(error) {
  if (!error) return false;
  if (error.response?.status === 429) return true;

  const data = error.response?.data || error.data;
  if (data?.error?.code === 'rate_limit_exceeded') return true;

  const message = error.message || '';
  return message.includes('rate limit') || message.includes('rate_limit_exceeded');
}

async function scrapeWithHeadlessX({ url, waitSelector, scrollCount = 3 }) {
  console.log(`[HeadlessX] Scraping ${url}`);
  try {
    const response = await axios.post(
      HEADLESSX_API_URL,
      {
        url,
        stealthMode: true,
        behaviorSimulation: true,
        wait: {
          selector: waitSelector,
          timeout: 30000
        },
        scroll: {
          count: scrollCount,
          delay: 1000
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${HEADLESSX_AUTH_TOKEN}`
        },
        timeout: 120000
      }
    );

    if (response.status === 200 && response.data?.html) {
      return response.data.html;
    }

    throw new Error(`Unexpected response ${response.status}`);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[HeadlessX] HTTP Error ${error.response?.status}:`, error.response?.data);
    } else {
      console.error('[HeadlessX] Error:', error.message);
    }
    throw error;
  }
}

function cleanHtml(html) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s{2,}/g, ' ');
}

async function parseHtmlWithGroq(html) {
  if (!html || html.length < 500) {
    return [];
  }

  const cleanedHtml = cleanHtml(html);

  const systemPrompt = `
        Eres un motor de extracción de datos JSON para productos alimenticios.
        Salida: Array JSON válido de objetos Product.
        Campos: product_name, brand, price_current (number), price_regular (number), unit, quantity, image_url, product_url, nutritional_claims (string[]).
        Sin markdown.
    `;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `HTML: ${cleanedHtml.substring(0, 15000)}` }
  ];

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return [];
    }

    const parsed = JSON.parse(content);
    const products = parsed.products || parsed.data || (Array.isArray(parsed) ? parsed : []);

    return products.map((product) => ({
      product_name: String(product.product_name || ''),
      brand: product.brand ? String(product.brand) : null,
      price_current: parseFloat(String(product.price_current ?? '').replace(/[^0-9.,]/g, '').replace(',', '.')),
      price_regular: product.price_regular
        ? parseFloat(String(product.price_regular ?? '').replace(/[^0-9.,]/g, '').replace(',', '.'))
        : null,
      unit: product.unit ? String(product.unit) : null,
      quantity: product.quantity ? parseFloat(String(product.quantity).replace(',', '.')) : null,
      image_url: product.image_url ? String(product.image_url) : null,
      product_url: product.product_url ? String(product.product_url) : null,
      nutritional_claims: Array.isArray(product.nutritional_claims) ? product.nutritional_claims : [],
      nutrition_info: product.nutrition_info || null
    }));
  } catch (error) {
    error.isRateLimit = isRateLimitError(error);
    throw error;
  }
}

function normalizeKey(product) {
  const url = product.product_url?.trim();
  if (url) return url;
  return `${product.product_name}::${product.brand || ''}`.toLowerCase();
}

function isValidProduct(product) {
  return (
    product.product_name &&
    Number.isFinite(product.price_current) &&
    product.price_current > 0
  );
}

async function insertProducts(storeId, products) {
  if (!products.length) return 0;

  // Delete previous entries for the store to avoid uncontrolled growth
  await supabase.from('scraped_products').delete().eq('store_id', storeId);

  const chunks = [];
  const CHUNK_SIZE = 50;
  for (let i = 0; i < products.length; i += CHUNK_SIZE) {
    chunks.push(products.slice(i, i + CHUNK_SIZE));
  }

  let inserted = 0;
  for (const chunk of chunks) {
    const payload = chunk.map((product) => ({
      store_id: storeId,
      product_name: product.product_name,
      brand: product.brand,
      price_current: product.price_current,
      price_regular: product.price_regular,
      unit: product.unit,
      quantity: product.quantity,
      nutritional_claims: product.nutritional_claims,
      image_url: product.image_url,
      product_url: product.product_url,
      nutrition_info: product.nutrition_info || null,
      scraped_at: new Date().toISOString()
    }));

    const { error } = await supabase.from('scraped_products').insert(payload);
    if (error) {
      console.error('[Supabase] Insert error:', error.message);
    } else {
      inserted += chunk.length;
    }
  }

  return inserted;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function seedStore(store) {
  const config = SCRAPING_TARGETS[store.brand];
  if (!config) {
    console.log(`[Seed] Skipping store ${store.name} (${store.brand}) - no adapter config.`);
    return { inserted: 0, keywords: 0 };
  }

  console.log(`\n[Seed] Processing store ${store.name} (${store.brand})`);

  const productMap = new Map();
  let keywordsProcessed = 0;
  let rateLimited = false;

  for (const keyword of KEYWORDS) {
    try {
      const url = config.buildUrl(keyword);
      const html = await scrapeWithHeadlessX({
        url,
        waitSelector: config.waitSelector
      });

      const products = await parseHtmlWithGroq(html);
      const validProducts = products.filter(isValidProduct);

      validProducts.forEach((product) => {
        const key = normalizeKey(product);
        productMap.set(key, product);
      });

      console.log(`[Seed] ${keyword}: ${validProducts.length} productos válidos.`);
      keywordsProcessed += 1;
      await sleep(1500);
    } catch (error) {
      console.error(`[Seed] Error scraping keyword "${keyword}":`, error.message);
      if (isRateLimitError(error)) {
        console.warn('[Seed] Se alcanzó el límite de tokens de Groq. Deteniendo el seed para esta ejecución.');
        rateLimited = true;
        break;
      }
      await sleep(2000);
    }
  }

  const aggregatedProducts = Array.from(productMap.values());
  console.log(`[Seed] Total productos únicos para ${store.name}: ${aggregatedProducts.length}`);

  const inserted = await insertProducts(store.id, aggregatedProducts);
  console.log(`[Seed] Insertados ${inserted} productos en Supabase.`);

  return { inserted, keywords: keywordsProcessed, rateLimited };
}

async function main() {
  console.log('[Seed] Obteniendo tiendas activas...');

  const { data: stores, error } = await supabase
    .from('nearby_stores')
    .select('id, name, brand');

  if (error) {
    console.error('[Supabase] Error obteniendo tiendas:', error.message);
    process.exit(1);
  }

  let resolvedStores = stores || [];

  if (!resolvedStores.length) {
    console.log('[Seed] No se encontraron tiendas. Cargando catálogo base...');
    const { error: insertError } = await supabase.from('nearby_stores').insert(DEFAULT_STORES);
    if (insertError && insertError.code !== '23505') {
      console.error('[Supabase] Error creando tiendas por defecto:', insertError.message);
      process.exit(1);
    }

    const { data: seededStores, error: fetchError } = await supabase
      .from('nearby_stores')
      .select('id, name, brand');

    if (fetchError) {
      console.error('[Supabase] Error obteniendo tiendas tras seed:', fetchError.message);
      process.exit(1);
    }

    resolvedStores = seededStores || [];
  }

  const scrapableStores = resolvedStores.filter((store) => SCRAPING_TARGETS[store.brand]);
  if (!scrapableStores.length) {
    console.log('[Seed] No hay tiendas configuradas para scraping.');
    process.exit(0);
  }

  let totalInserted = 0;

  for (const store of scrapableStores) {
    const { inserted, rateLimited } = await seedStore(store);
    totalInserted += inserted;
    await sleep(3000);
    if (rateLimited) {
      console.warn('[Seed] Rate limit global detectado. Finalizando iteración.');
      break;
    }
  }

  console.log(`\n[Seed] Completado. Productos insertados: ${totalInserted}.`);
  process.exit(0);
}

main().catch((error) => {
  console.error('[Seed] Error inesperado:', error);
  process.exit(1);
});
