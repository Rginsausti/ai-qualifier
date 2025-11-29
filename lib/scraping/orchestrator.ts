// Orchestrator for nearby product search
import { GeoHash } from 'geohash';
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from '@supabase/supabase-js';
import { findNearbyStores, type NearbyStore } from './osm-discovery';
import { type Product, type StoreAdapter, type StoreSource, type ScrapeContext } from './types';
import { cotoAdapter } from './adapters/coto';
import { carrefourAdapter } from './adapters/carrefour';
import { jumboAdapter, veaAdapter, discoAdapter } from './adapters/jumbo';
import { getSourcesGroupedByStore } from './sources';
import { ensureDefaultSourcesForStores } from './auto-sources';
import { instagramSourceAdapter } from './adapters/instagram';
import { websiteSourceAdapter } from './adapters/website';

const ADAPTER_MAP: Record<string, StoreAdapter> = {
    'COTO': cotoAdapter,
    'CARREFOUR': carrefourAdapter,
    'JUMBO': jumboAdapter,
    'VEA': veaAdapter,
    'DISCO': discoAdapter,
};

// Mapa de adapters por tipo de fuente adicional
const SOURCE_ADAPTER_MAP: Record<string, { scrape: (source: StoreSource, query: string, context?: ScrapeContext) => Promise<Product[]> }> = {
    instagram: instagramSourceAdapter,
    website: websiteSourceAdapter,
};

const encodeGeohash = (lat: number, lon: number, precision = 6) => {
    const hash = GeoHash.encodeGeoHash(lat, lon);
    return hash.substring(0, precision);
};

export type AggregatedProduct = Product & {
    store_id: string;
    store_name: string;
    store_brand?: string;
    distance_meters: number;
    store_lat: number;
    store_lon: number;
};

export type AggregatedProductResults = {
    products: AggregatedProduct[];
    stores_searched: number;
    cache_hit: boolean;
    search_latency_ms: number;
    filtered_out_count?: number;
};

// --- Intolerance Filtering Logic ---

type IntoleranceConfig = {
    id: string;
    synonyms: string[];
    blocked: string[];
    safe: string[];
};

const INTOLERANCE_CONFIGS: IntoleranceConfig[] = [
    {
        id: 'lactose',
        synonyms: ['lactosa', 'lactose', 'intolerancia lactosa', 'intolerancia a la lactosa', 'dairy', 'lacteos', 'lacteos'],
        blocked: [
            'lacte',
            'leche',
            'queso',
            'quesos',
            'yogur',
            'yoghurt',
            'crema',
            'manteca',
            'mantecol',
            'dulce de leche',
            'ricota',
            'provolone',
            'muzzarella',
            'quesillo',
            'gruyere',
            'requeson'
        ],
        safe: ['sin lactosa', 'libre de lactosa', 'vegano', 'vegetal', 'plant based', 'origen vegetal', '100% vegetal']
    },
    {
        id: 'gluten',
        synonyms: ['gluten', 'celiaco', 'celiac', 'tacc', 'celiaquia'],
        blocked: ['gluten', 'trigo', 'harina', 'pan', 'cebada', 'centeno', 'pastas', 'fideos', 'pizza', 'empanada', 'galleta'],
        safe: ['sin tacc', 'libre de gluten', 'gluten free']
    },
    {
        id: 'peanut',
        synonyms: ['mani', 'maní', 'peanut', 'cacahuate', 'frutos secos', 'nuts', 'almendra', 'avellana', 'nueces'],
        blocked: ['mani', 'maní', 'cacahuate', 'almendra', 'avellana', 'nuez', 'nueces', 'pistacho', 'huevo de mani'],
        safe: ['sin frutos secos', 'libre de frutos secos']
    }
];

const normalizeText = (value?: string | null) => {
    if (!value) return '';

    const base = value
        .toLocaleLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    return base
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const buildProductHaystack = (product: Product) => {
    const claims = product.nutritional_claims?.join(' ') || '';
    const nutritionKeys = product.nutrition_info
        ? Object.entries(product.nutrition_info)
            .map(([key, value]) => `${key} ${value ?? ''}`)
            .join(' ')
        : '';

    return normalizeText(
        [product.product_name, product.brand, claims, nutritionKeys, product.unit]
            .filter(Boolean)
            .join(' ')
    );
};

const buildClaimsHaystack = (product: Product) =>
    normalizeText(product.nutritional_claims?.join(' ') || '');

const findMatchingConfigs = (intolerances: string[]): IntoleranceConfig[] => {
    const matches = new Map<string, IntoleranceConfig>();
    intolerances.forEach((raw) => {
        const normalized = normalizeText(raw);
        INTOLERANCE_CONFIGS.forEach((config) => {
            if (config.synonyms.some((syn) => normalized.includes(normalizeText(syn)))) {
                matches.set(config.id, config);
            }
        });
    });
    return Array.from(matches.values());
};

const filterProductsByIntolerances = (
    products: AggregatedProduct[],
    intolerances: string[]
) => {
    const configs = findMatchingConfigs(intolerances);
    if (configs.length === 0) return products;

    return products.filter((product) => {
        const haystack = buildProductHaystack(product);
        const claims = buildClaimsHaystack(product);

        return configs.every((config) => {
            const hasSafeKeyword = config.safe.some((phrase) => {
                const normalizedPhrase = normalizeText(phrase);
                return (
                    haystack.includes(normalizedPhrase) || claims.includes(normalizedPhrase)
                );
            });

            if (hasSafeKeyword) {
                return true;
            }

            return !config.blocked.some((keyword) => {
                const normalizedKeyword = normalizeText(keyword);
                return normalizedKeyword && haystack.includes(normalizedKeyword);
            });
        });
    });
};

type KeywordGroups = Record<string, string[]>;

const mergeKeywordGroups = (groups: KeywordGroups) =>
    Array.from(
        new Set(
            Object.values(groups)
                .flat()
                .map((term) => term.trim())
                .filter(Boolean)
        )
    );

const NON_FOOD_KEYWORDS = mergeKeywordGroups({
    es: [
        'shampoo',
        'shampu',
        'acondicionador',
        'mascarilla',
        'hair food',
        'capilar',
        'tratamiento capilar',
        'vela',
        'velon',
        'difusor',
        'ambientador',
        'aromatizador',
        'aromatica',
        'aromatico',
        'perfume',
        'colonia',
        'desodorante',
        'jabon',
        'detergente',
        'limpiador',
        'lavandina',
        'suavizante',
        'limpieza',
        'panal',
        'panales',
        'toallitas',
        'toallitas humedas',
        'hisopos',
        'algodon',
        'panitos',
        'maquillaje',
        'labial',
        'rimel',
        'esmalte',
        'protector solar',
        'crema corporal',
        'crema facial',
        'crema hidratante',
        'after sun',
        'adorno',
        'adornos',
        'ornamento',
        'ornamentos',
        'decoracion',
        'decoraciones',
        'decorativo',
        'decorativos',
        'decorativa',
        'guirnalda',
        'guirnaldas',
        'luces navidad',
        'luces led',
        'arbolito',
        'arbol de navidad',
        'muñeco navidad',
        'muneco navidad',
        'cascanueces',
        'campana decorativa',
        'campanas navidad'
    ],
    en: [
        'shampoo',
        'conditioner',
        'hair mask',
        'hair treatment',
        'candle',
        'diffuser',
        'air freshener',
        'aromatherapy',
        'fragrance',
        'perfume',
        'cologne',
        'deodorant',
        'soap',
        'detergent',
        'cleaner',
        'bleach',
        'fabric softener',
        'household cleaning',
        'diaper',
        'diapers',
        'baby wipe',
        'wipes',
        'cotton swab',
        'cotton pads',
        'makeup',
        'lipstick',
        'mascara',
        'nail polish',
        'sunscreen',
        'body lotion',
        'face cream',
        'moisturizer',
        'hand cream',
        'ornament',
        'christmas ornament',
        'holiday ornament',
        'xeric decor',
        'xmas',
        'nutcracker',
        'garland',
        'string lights',
        'fairy lights',
        'holiday decoration',
        'tree topper',
        'wreath',
        'jingle bell'
    ],
    pt: [
        'shampoo',
        'xampu',
        'condicionador',
        'mascara capilar',
        'hidratacao capilar',
        'vela',
        'difusor',
        'aromatizador',
        'cheiro para ambiente',
        'perfume',
        'colonia',
        'desodorante',
        'sabonete',
        'detergente',
        'limpador',
        'alvejante',
        'amaciante',
        'limpeza domestica',
        'fralda',
        'fraldas',
        'lenco umedecido',
        'lenços umedecidos',
        'algodao',
        'cotonete',
        'maquiagem',
        'batom',
        'rimel',
        'esmalte',
        'protetor solar',
        'hidratante',
        'creme corporal',
        'creme facial',
        'ornamento',
        'ornamentos',
        'decoracao de natal',
        'enfeite',
        'enfeites',
        'guirlanda',
        'pisca pisca',
        'luzes de natal',
        'sino decorativo'
    ],
    it: [
        'shampoo',
        'balsamo',
        'maschera capelli',
        'trattamento capelli',
        'candela',
        'diffusore',
        'profumatore',
        'profumo',
        'colonia',
        'deodorante',
        'sapone',
        'detersivo',
        'detergente',
        'candeggina',
        'ammorbidente',
        'pulizia casa',
        'pannolino',
        'pannolini',
        'salviettine',
        'cotone',
        'trucco',
        'rossetto',
        'mascara',
        'smalto',
        'crema solare',
        'lozione corpo',
        'crema viso',
        'idratante',
        'ornamento natalizio',
        'decorazione natalizia',
        'ghirlanda',
        'luci di natale',
        'campanella',
        'schiaccianoci'
    ],
    fr: [
        'shampoing',
        'apres shampoing',
        'masque capillaire',
        'soin capillaire',
        'bougie',
        'diffuseur',
        'desodorisant',
        'parfum',
        'eau de cologne',
        'deodorant',
        'savon',
        'detergent',
        'nettoyant',
        'eau de javel',
        'assouplissant',
        'menage',
        'couche',
        'couches',
        'lingettes',
        'coton',
        'maquillage',
        'rouge a levres',
        'mascara',
        'vernis',
        'creme solaire',
        'lotion pour le corps',
        'creme visage',
        'hydratant',
        'decoration de noel',
        'ornement',
        'boule de noel',
        'guirlande',
        'couronne',
        'figurine casse noisette',
        'clochette',
        'xmas'
    ],
    de: [
        'shampoo',
        'spulung',
        'haarmaske',
        'haarpflege',
        'duftkerze',
        'diffusor',
        'raumduft',
        'parfum',
        'kolnisch wasser',
        'deo',
        'seife',
        'waschmittel',
        'reiniger',
        'bleichmittel',
        'weichspuler',
        'haushaltsreinigung',
        'windel',
        'windeln',
        'feuchttucher',
        'watte',
        'make up',
        'lippenstift',
        'wimperntusche',
        'nagellack',
        'sonnencreme',
        'korperlotion',
        'gesichtscreme',
        'feuchtigkeitscreme',
        'weihnachtsdeko',
        'weihnachtskugel',
        'girlande',
        'lichterkette',
        'nussknacker',
        'dekoration',
        'glöckchen'
    ],
    ja: [
        'シャンプー',
        'コンディショナー',
        'ヘアマスク',
        'ヘアトリートメント',
        'キャンドル',
        'ディフューザー',
        '芳香剤',
        '香水',
        'コロン',
        'デオドラント',
        '石鹸',
        '洗剤',
        'クリーナー',
        '漂白剤',
        '柔軟剤',
        '掃除用品',
        'おむつ',
        'オムツ',
        'ウェットティッシュ',
        '綿棒',
        'コットン',
        'メイク',
        '口紅',
        'マスカラ',
        'ネイル',
        '日焼け止め',
        'ボディローション',
        'フェイスクリーム',
        '保湿クリーム',
        'オーナメント',
        'クリスマスオーナメント',
        'ガーランド',
        '飾り',
        'ナッツクラッカー',
        'ベル飾り',
        'イルミネーション'
    ]
});

const NON_FOOD_BRANDS = [
    'garnier',
    'fructis',
    'organic spa',
    'natura',
    'l oreal',
    'loreal',
    'nivea',
    'dove',
    'rexona',
    'axe',
    'pantene',
    'head & shoulders',
    'head and shoulders',
    'colgate',
    'oral b',
    'kerastase',
    'avon'
];

const FOOD_EXCEPTION_KEYWORDS = [
    'crema de leche',
    'crema americana',
    'crema pastelera',
    'crema chantilly',
    'queso crema'
];

const JUNK_FOOD_KEYWORDS = mergeKeywordGroups({
    es: [
        'gomita',
        'gomitas',
        'caramelo',
        'caramelos',
        'oblea',
        'obleas',
        'chicle',
        'chicles',
        'pastilla',
        'pastillas',
        'alfajor',
        'alfajores',
        'galleta',
        'galletita',
        'galletitas',
        'dulce',
        'dulces',
        'golosina',
        'golosinas',
        'barra de cereal',
        'barra dulce',
        'paleta',
        'paletas',
        'piruleta',
        'piruletas',
        'turron',
        'turrones'
    ],
    en: [
        'candy',
        'candies',
        'sweet',
        'sweets',
        'dessert',
        'desserts',
        'cookie',
        'cookies',
        'biscuit',
        'biscuits',
        'wafer',
        'wafers',
        'snack cake',
        'brownie',
        'cupcake',
        'donut',
        'gummy',
        'gummies',
        'marshmallow',
        'marshmallows',
        'lollipop',
        'lollipops',
        'candy bar',
        'chocolate bar',
        'chewing gum',
        'gum',
        'toffee',
        'jelly'
    ],
    pt: [
        'bala',
        'balas',
        'doce',
        'doces',
        'goma',
        'gominha',
        'chiclete',
        'chicletes',
        'biscoito',
        'biscoitos',
        'bolacha',
        'bolachas',
        'barra de cereal',
        'barra doce'
    ],
    it: [
        'caramella',
        'caramelle',
        'biscotto',
        'biscotti',
        'wafer',
        'wafer al cioccolato',
        'merendina',
        'merendine',
        'dolce',
        'dolci',
        'cioccolato',
        'cioccolatini',
        'torroncino',
        'barra di cereali'
    ],
    fr: [
        'bonbon',
        'bonbons',
        'sucrerie',
        'friandise',
        'gaufrette',
        'gaufrettes',
        'biscuit',
        'biscuits',
        'gateau',
        'gateaux',
        'chocolat',
        'barre chocolat',
        'pate de fruit'
    ],
    de: [
        'sussigkeit',
        'sussigkeiten',
        'susswaren',
        'suss',
        'keks',
        'kekse',
        'waffel',
        'waffeln',
        'schokolade',
        'gummibarchen',
        'lutscher',
        'bonbonniere'
    ],
    ja: [
        'お菓子',
        'キャンディ',
        'キャンディー',
        'グミ',
        'マシュマロ',
        'ロリポップ',
        'チョコ',
        'チョコレート',
        'クッキー',
        'ビスケット',
        'ウエハース',
        'キャラメル',
        'ラムネ',
        'スナック',
        '甘菓子'
    ]
});

const JUNK_FOOD_BRANDS = [
    'halls',
    'beldent',
    'menthoplus',
    'tic tac',
    'arcor',
    'classic',
    'felfort',
    'bon o bon',
    'cadbury',
    'milka',
    'm&m',
    'm & m',
    'skittles',
    'trident',
    'sugus'
];

const ULTRA_PROCESSED_KEYWORDS = mergeKeywordGroups({
    es: [
        'gaseosa',
        'refresco',
        'cola',
        'bebida cola',
        'bebida azucarada',
        'energy drink',
        'bebida energetica',
        'energizante',
        'cerveza',
        'fernet',
        'licor',
        'vodka',
        'whisky',
        'whiskey',
        'gin',
        'champagne',
        'espumante',
        'sidra',
        'aperitivo',
        'spritz',
        'pan dulce',
        'budin navideno',
        'medialuna',
        'factura',
        'snack frito',
        'papas fritas',
        'nachos',
        'hamburguesa congelada'
    ],
    en: [
        'soda',
        'soft drink',
        'cola',
        'energy drink',
        'sports drink',
        'beer',
        'lager',
        'ale',
        'stout',
        'vodka',
        'whisky',
        'whiskey',
        'rum',
        'gin',
        'liquor',
        'liqueur',
        'alcoholic beverage',
        'champagne',
        'sparkling wine'
    ],
    pt: [
        'refrigerante',
        'cola',
        'bebida acucarada',
        'energetico',
        'bebida energetica',
        'cerveja',
        'vodka',
        'uísque',
        'whisky',
        'gin',
        'licor',
        'bebida alcoolica',
        'champanhe',
        'espumante'
    ],
    it: [
        'bibita',
        'bevanda gassata',
        'cola',
        'energy drink',
        'bevanda energetica',
        'birra',
        'vino',
        'vodka',
        'whisky',
        'liquore',
        'alcolico',
        'spumante'
    ],
    fr: [
        'soda',
        'boisson gazeuse',
        'cola',
        'boisson energetique',
        'biere',
        'vin',
        'vodka',
        'whisky',
        'gin',
        'liqueur',
        'alcool',
        'champagne'
    ],
    de: [
        'limo',
        'limonade',
        'cola',
        'energydrink',
        'energy drink',
        'bier',
        'wein',
        'vodka',
        'whisky',
        'likor',
        'schnaps',
        'alkohol'
    ],
    ja: [
        'ソーダ',
        '炭酸飲料',
        'コーラ',
        'エナジードリンク',
        'スポーツドリンク',
        'ビール',
        'ワイン',
        'ウォッカ',
        'ウイスキー',
        'ジン',
        'リキュール',
        'アルコール飲料'
    ]
});

const ULTRA_PROCESSED_BRANDS = [
    'coca cola',
    'pepsi',
    'fanta',
    'sprite',
    '7up',
    'seven up',
    'mirinda',
    'manaos',
    'secco',
    'paso de los toros',
    'red bull',
    'monster',
    'speed unlimited',
    'rockstar',
    'schweppes',
    'quilmes',
    'heineken',
    'budweiser',
    'andes',
    'brahma',
    'smirnoff',
    'absolut',
    'bacardi',
    'campari',
    'fernet branca',
    'jagermeister',
    'johnnie walker',
    'gin beefeater',
    'bombay sapphire'
];

const filterOutNonFoodProducts = (products: AggregatedProduct[]) => {
    let removed = 0;

    const filtered = products.filter((product) => {
        const haystack = buildProductHaystack(product);
        if (!haystack) return true;

        const hasException = FOOD_EXCEPTION_KEYWORDS.some((term) =>
            haystack.includes(normalizeText(term))
        );
        if (hasException) {
            return true;
        }

        const brandMatch = product.brand
            ? NON_FOOD_BRANDS.some((brand) =>
                normalizeText(product.brand).includes(normalizeText(brand))
            )
            : false;

        const keywordMatch = NON_FOOD_KEYWORDS.some((keyword) =>
            haystack.includes(normalizeText(keyword))
        );

        if (brandMatch || keywordMatch) {
            removed += 1;
            return false;
        }

        return true;
    });

    return { products: filtered, removed };
};

const filterOutJunkFoodProducts = (products: AggregatedProduct[]) => {
    let removed = 0;

    const filtered = products.filter((product) => {
        const haystack = buildProductHaystack(product);
        if (!haystack) return true;

        const brandMatch = product.brand
            ? JUNK_FOOD_BRANDS.some((brand) =>
                normalizeText(product.brand).includes(normalizeText(brand))
            )
            : false;

        const keywordMatch = JUNK_FOOD_KEYWORDS.some((keyword) =>
            haystack.includes(normalizeText(keyword))
        );

        if (brandMatch || keywordMatch) {
            removed += 1;
            return false;
        }

        return true;
    });

    return { products: filtered, removed };
};

const filterOutUltraProcessedProducts = (products: AggregatedProduct[]) => {
    let removed = 0;

    const filtered = products.filter((product) => {
        const haystack = buildProductHaystack(product);
        if (!haystack) return true;

        const brandMatch = product.brand
            ? ULTRA_PROCESSED_BRANDS.some((brand) =>
                normalizeText(product.brand).includes(normalizeText(brand))
            )
            : false;

        const keywordMatch = ULTRA_PROCESSED_KEYWORDS.some((keyword) =>
            haystack.includes(normalizeText(keyword))
        );

        if (brandMatch || keywordMatch) {
            removed += 1;
            return false;
        }

        return true;
    });

    return { products: filtered, removed };
};

const applyContentFilters = (products: AggregatedProduct[]) => {
    const nonFood = filterOutNonFoodProducts(products);
    const junk = filterOutJunkFoodProducts(nonFood.products);
    const ultraProcessed = filterOutUltraProcessedProducts(junk.products);
    return {
        products: ultraProcessed.products,
        removed: nonFood.removed + junk.removed + ultraProcessed.removed,
    };
};

const LLM_BATCH_SIZE = 24;

type GroqDecision = {
    id: string;
    is_food: boolean;
    is_healthy: boolean;
};

const GROQ_PRODUCT_SYSTEM_PROMPT = `Sos una nutricionista que evalúa productos detectados en supermercados. Marcá is_food = true solo si el ítem es comestible o bebible. Entre esos, marcá is_healthy = true únicamente si es un alimento fresco, mínimamente procesado o alineado a planes mindful (verduras, frutas, proteínas magras, lácteos simples, legumbres, snacks integrales, bebidas sin azúcar, etc.). Marca is_healthy = false cuando sea alcohol, bebidas azucaradas, snacks ultra procesados, postres, panadería industrial, dulces, decoración, productos de limpieza o cualquier cosa no nutritiva. Respondé SOLO JSON válido con este formato exacto:
{
  "decisions": [
    { "id": string, "is_food": boolean, "is_healthy": boolean }
  ]
}`;

async function guardProductsWithGroq(
    products: AggregatedProduct[],
    query: string
): Promise<{ products: AggregatedProduct[]; removed: number }> {
    if (!process.env.GROQ_API_KEY || products.length === 0) {
        return { products, removed: 0 };
    }

    const indexesToDrop = new Set<number>();

    for (let start = 0; start < products.length; start += LLM_BATCH_SIZE) {
        const batch = products.slice(start, start + LLM_BATCH_SIZE);
        const blocked = await classifyProductBatchWithGroq(batch, query, start);
        blocked.forEach((index) => indexesToDrop.add(index));
    }

    if (indexesToDrop.size === 0) {
        return { products, removed: 0 };
    }

    const filtered = products.filter((_, index) => !indexesToDrop.has(index));
    const removed = products.length - filtered.length;
    return { products: filtered, removed };
}

async function classifyProductBatchWithGroq(
    batch: AggregatedProduct[],
    query: string,
    offset: number
): Promise<number[]> {
    try {
        const items = batch.map((product, index) => ({
            id: `p${offset + index}`,
            name: product.product_name,
            brand: product.brand,
            store: product.store_brand ?? product.store_name ?? null,
            claims: product.nutritional_claims?.slice(0, 5) ?? [],
            unit: product.unit,
            price: product.price_current,
            hints: buildProductHaystack(product).slice(0, 220),
        }));

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                temperature: 0,
                response_format: { type: "json_object" },
                messages: [
                    { role: 'system', content: GROQ_PRODUCT_SYSTEM_PROMPT },
                    { role: 'user', content: JSON.stringify({ query, items }) },
                ],
            }),
        });

        if (!response.ok) {
            throw new Error(`Groq guard request failed: ${response.status}`);
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) return [];

        const parsed = JSON.parse(content) as { decisions?: GroqDecision[] };
        if (!parsed?.decisions || !Array.isArray(parsed.decisions)) return [];

        const blockedIndexes: number[] = [];
        parsed.decisions.forEach((decision) => {
            if (!decision || typeof decision.id !== 'string') return;
            const match = decision.id.match(/^p(\d+)$/);
            if (!match) return;
            const globalIndex = Number(match[1]);
            if (!decision.is_food || !decision.is_healthy) {
                blockedIndexes.push(globalIndex);
            }
        });
        return blockedIndexes;
    } catch (error) {
        console.error('[Orquestador] Error al clasificar productos con LLM:', error);
        return [];
    }
}

const filterProductsByRelevance = (
    products: AggregatedProduct[],
    query: string
) => {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return products;

    const tokens = normalizedQuery
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length >= 3);

    if (tokens.length === 0) {
        tokens.push(normalizedQuery);
    }

    return products.filter((product) => {
        const haystack = buildProductHaystack(product);
        if (!haystack) return false;

        return tokens.some((token) => haystack.includes(token));
    });
};

// --- Main Logic ---

async function scrapeSingleStore(
    store: NearbyStore,
    query: string,
    sourcesForStore: StoreSource[] = [],
): Promise<AggregatedProduct[]> {
    try {
        const allProducts: Product[] = [];

        const context: ScrapeContext = {
            storeId: store.id!,
            storeName: store.name,
            storeBrand: store.brand ?? undefined,
            storeWebsite: store.website_url ?? null,
        };

        // 1) Adapter por marca (Carrefour/Coto/etc.) si existe
        const brandAdapter = store.brand ? ADAPTER_MAP[store.brand] : undefined;
        if (brandAdapter) {
            const products = await brandAdapter.scrape(query, context);
            allProducts.push(...products);
        } else {
            // Sin adaptador registrado para la marca
        }

        // 2) Fuentes adicionales (instagram, website, etc.)
        if (sourcesForStore.length > 0) {
            for (const source of sourcesForStore) {
                const adapter = SOURCE_ADAPTER_MAP[source.source_type];
                if (!adapter) {
                    continue;
                }

                try {
                    const productsFromSource = await adapter.scrape(source, query, context);
                    allProducts.push(...productsFromSource);
                } catch (sourceError) {
                    console.error(`[Orquestador] Error en fuente ${source.source_type} (${source.id}) para tienda ${store.name}:`, sourceError);
                }
            }
        }

        if (allProducts.length === 0) {
            return [];
        }

        const supabase = await createClient();
        await persistProducts(allProducts, store.id!, supabase);

        return allProducts.map(p => ({
            ...p,
            store_id: store.id!,
            store_name: store.name,
            store_brand: store.brand,
            distance_meters: store.distance || 0,
            store_lat: store.latitude,
            store_lon: store.longitude,
        }));
    } catch (error) {
        console.error(`[Orquestador] Failed scraping store ${store.name}:`, (error as Error).message);
        return [];
    }
}

export async function searchNearbyProducts(
    userLat: number,
    userLon: number,
    productQuery: string,
    forceRefresh: boolean = false,
    maxStores: number = 3,
    intolerances: string[] = []
): Promise<AggregatedProductResults> {
    const startTime = Date.now();

    if (!forceRefresh) {
        const cachedResult = await checkCache(userLat, userLon, productQuery);
        if (cachedResult) {
            return {
                ...cachedResult,
                cache_hit: true,
                search_latency_ms: Date.now() - startTime,
            };
        }
    }

    const nearbyStores = await findNearbyStores(userLat, userLon, 2000);

    // Antes de scrapear, aseguramos fuentes por defecto (website) para los comercios con website_url
    await ensureDefaultSourcesForStores(nearbyStores);

    const scrapableStores = nearbyStores
        .filter(store => store.scraping_enabled !== false)
        .slice(0, maxStores);

    // Cargamos fuentes configuradas automáticamente para todos los stores candidatos
    const storeIds = scrapableStores.map((s) => s.id!).filter(Boolean);
    const sourcesByStore = await getSourcesGroupedByStore(storeIds);

    const CONCURRENCY = 3;
    const allProducts: AggregatedProduct[] = [];

    for (let i = 0; i < scrapableStores.length; i += CONCURRENCY) {
        const batch = scrapableStores.slice(i, i + CONCURRENCY);
        const promises = batch.map(store => {
            const sourcesForStore = sourcesByStore.get(store.id!) ?? [];
            return scrapeSingleStore(store, productQuery, sourcesForStore);
        });
        const results = await Promise.allSettled(promises);

        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                allProducts.push(...result.value);
            }
        });
    }

    const { products: contentSafeProducts, removed: contentRemoved } = applyContentFilters(allProducts);
    const relevantProducts = filterProductsByRelevance(contentSafeProducts, productQuery);
    const personalizedProducts = intolerances.length
        ? filterProductsByIntolerances(relevantProducts, intolerances)
        : relevantProducts;

    const { products: llmGuardedProducts, removed: llmRemoved } = await guardProductsWithGroq(personalizedProducts, productQuery);

    const filteredOutCount = contentRemoved +
        Math.max(contentSafeProducts.length - relevantProducts.length, 0) +
        Math.max(relevantProducts.length - personalizedProducts.length, 0) +
        llmRemoved;

    await cacheResults(userLat, userLon, productQuery, llmGuardedProducts, scrapableStores.length);

    return {
        products: llmGuardedProducts,
        stores_searched: scrapableStores.length,
        cache_hit: false,
        search_latency_ms: Date.now() - startTime,
        filtered_out_count: filteredOutCount,
    };
}

async function checkCache(
    lat: number,
    lon: number,
    query: string
): Promise<Omit<AggregatedProductResults, 'cache_hit' | 'search_latency_ms'> | null> {
    try {
        const supabase = await createClient();
        const hash = encodeGeohash(lat, lon, 6);

        const { data, error } = await supabase
            .from('product_search_cache')
            .select('results, result_count')
            .eq('geohash', hash)
            .eq('query', query.toLowerCase())
            .gt('expires_at', new Date().toISOString())
            .single();

        if (error || !data) return null;

        const { products: filteredProducts, removed } = applyContentFilters(data.results as AggregatedProduct[]);

        return {
            products: filteredProducts,
            stores_searched: data.result_count || 0,
            filtered_out_count: removed,
        };
    } catch (error) {
        console.error('[Cache] Check error:', error);
        return null;
    }
}

async function cacheResults(
    lat: number,
    lon: number,
    query: string,
    products: AggregatedProduct[],
    storesSearched: number
): Promise<void> {
    try {
        const supabase = await createClient();
        const hash = encodeGeohash(lat, lon, 6);
        
        // Si encontramos productos, cacheamos por 24 horas.
        // Si no encontramos nada, solo por 5 minutos para evitar persistir fallos temporales.
        const durationMs = products.length > 0 
            ? 24 * 60 * 60 * 1000 // 24 horas
            : 5 * 60 * 1000;      // 5 minutos

        const expiresAt = new Date(Date.now() + durationMs);

        await supabase.from('product_search_cache').upsert(
            {
                geohash: hash,
                query: query.toLowerCase(),
                results: products,
                result_count: storesSearched,
                expires_at: expiresAt.toISOString(),
            },
            { onConflict: 'geohash,query' }
        );
    } catch (error) {
        console.error('[Cache] Store error:', error);
    }
}

async function persistProducts(
    products: Product[],
    storeId: string,
    supabase: SupabaseClient
): Promise<void> {
    if (products.length === 0) return;
    try {
        const records = products.map(p => ({
            store_id: storeId,
            product_name: p.product_name,
            brand: p.brand,
            price_current: p.price_current,
            price_regular: p.price_regular,
            unit: p.unit,
            quantity: p.quantity,
            nutritional_claims: p.nutritional_claims,
            image_url: p.image_url,
            product_url: p.product_url,
        }));

        const { error } = await supabase.from('scraped_products').insert(records);
        if (error) {
            console.error('[DB] Insert error:', error.message);
        }
    } catch (error) {
        console.error('[DB] Persist error:', (error as Error).message);
    }
}
