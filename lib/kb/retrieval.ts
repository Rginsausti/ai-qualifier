import { getDbPool } from "@/lib/db/pool";

export type KnowledgeSnippet = {
  id: string;
  moduleTag: string;
  language: string;
  title: string | null;
  chunk: string;
  metadata: Record<string, unknown> | null;
  similarity: number | null;
};

export type KnowledgeQueryInput = {
  query: string;
  language?: string;
  limit?: number;
  modules?: string[];
};

type FormatKnowledgeOptions = {
  maxChars?: number;
};

const huggingFaceApiKey = process.env.HUGGINGFACE_API_KEY
  ?? process.env.HUGGINFACE_API_KEY
  ?? "";
const huggingFaceModel = process.env.KB_EMBEDDING_MODEL ?? "intfloat/multilingual-e5-large";
const huggingFaceBaseEndpoint = (process.env.HUGGINGFACE_API_URL ?? "https://router.huggingface.co").replace(/\/$/, "");
const EMBEDDING_TIMEOUT_MS = Number(process.env.KB_EMBEDDING_TIMEOUT_MS ?? "10000");
const EMBEDDING_INPUT_MAX_CHARS = Number(process.env.KB_EMBEDDING_INPUT_MAX_CHARS ?? "1200");
const EMBEDDING_CACHE_TTL_MS = Number(process.env.KB_EMBEDDING_CACHE_TTL_MS ?? "600000");
const MIN_SIMILARITY_SCORE = Number(process.env.KB_MIN_SIMILARITY_SCORE ?? "0.22");
const DEFAULT_LANGUAGE = "es";

const embeddingCache = new Map<string, { vector: number[]; expiresAt: number }>();

function vectorLiteral(values: number[]): string {
  return `[${values.map((value) => Number(value).toString()).join(",")}]`;
}

type ApiStyle = "router-openai" | "router-hf-inference" | "legacy";

function detectApiStyle(base: string): ApiStyle {
  if (/\/v1(\/|$)/i.test(base) || /\/embeddings$/i.test(base)) {
    return "router-openai";
  }

  if (/router\.huggingface\.co/i.test(base)) {
    return "router-hf-inference";
  }

  return "legacy";
}

function buildRouterEmbeddingsUrl(base: string) {
  if (/\/v1\/embeddings$/i.test(base)) return base;
  if (/\/v1$/i.test(base)) return `${base}/embeddings`;
  return `${base}/v1/embeddings`;
}

function getHuggingFaceRequest(text: string) {
  const apiStyle = detectApiStyle(huggingFaceBaseEndpoint);

  if (apiStyle === "router-openai") {
    return {
      url: buildRouterEmbeddingsUrl(huggingFaceBaseEndpoint),
      body: {
        model: huggingFaceModel,
        input: [text],
      },
    } as const;
  }

  if (apiStyle === "router-hf-inference") {
    const modelsBase = /\/hf-inference\/models$/i.test(huggingFaceBaseEndpoint)
      ? huggingFaceBaseEndpoint
      : `${huggingFaceBaseEndpoint}/hf-inference/models`;

    return {
      url: `${modelsBase}/${huggingFaceModel}`,
      body: { inputs: text },
    } as const;
  }

  const modelsBase = /\/models$/i.test(huggingFaceBaseEndpoint)
    ? huggingFaceBaseEndpoint
    : `${huggingFaceBaseEndpoint}/models`;

  return {
    url: `${modelsBase}/${huggingFaceModel}`,
    body: { inputs: text },
  } as const;
}

async function embedText(text: string): Promise<number[] | null> {
  if (!huggingFaceApiKey || !text.trim()) {
    return null;
  }

  const normalizedInput = text
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, EMBEDDING_INPUT_MAX_CHARS);

  if (!normalizedInput) {
    return null;
  }

  const now = Date.now();
  const cached = embeddingCache.get(normalizedInput);
  if (cached && cached.expiresAt > now) {
    return cached.vector;
  }

  if (cached && cached.expiresAt <= now) {
    embeddingCache.delete(normalizedInput);
  }

  const requestConfig = getHuggingFaceRequest(normalizedInput);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(requestConfig.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${huggingFaceApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestConfig.body),
      next: { revalidate: 0 },
      signal: controller.signal,
    });
  } catch (error) {
    console.error("HF embedding request failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    console.error("HF embedding error", { status: response.status });
    return null;
  }

  const data = (await response.json()) as
    | { embeddings?: number[]; data?: Array<{ embedding: number[] }> }
    | number[]
    | number[][];

  if (Array.isArray(data)) {
    if (typeof data[0] === "number") {
      const vector = data as number[];
      embeddingCache.set(normalizedInput, { vector, expiresAt: now + EMBEDDING_CACHE_TTL_MS });
      return vector;
    }
    const vector = (data[0] as number[] | undefined) ?? null;
    if (vector) {
      embeddingCache.set(normalizedInput, { vector, expiresAt: now + EMBEDDING_CACHE_TTL_MS });
    }
    return vector;
  }

  if (Array.isArray(data.data)) {
    const vector = data.data[0]?.embedding ?? null;
    if (vector) {
      embeddingCache.set(normalizedInput, { vector, expiresAt: now + EMBEDDING_CACHE_TTL_MS });
    }
    return vector;
  }

  if (Array.isArray(data.embeddings)) {
    const vector = data.embeddings;
    embeddingCache.set(normalizedInput, { vector, expiresAt: now + EMBEDDING_CACHE_TTL_MS });
    return vector;
  }

  return null;
}

function buildModuleClause(paramIndex: number, modules?: string[]) {
  if (!modules?.length) {
    return { clause: "", params: [] as unknown[] };
  }
  return {
    clause: ` and module_tag = any($${paramIndex}::kb_module_tag[])`,
    params: [modules],
  };
}

type RetrievalCandidate = KnowledgeSnippet & {
  similarity: number | null;
  lexicalScore: number;
  semanticRank: number;
  lexicalRank: number;
  hybridScore: number;
};

const normalizeChunkKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const reciprocalRankScore = (rank: number, k = 60) => 1 / (k + rank);

function dedupeAndSortCandidates(candidates: RetrievalCandidate[], limit: number): KnowledgeSnippet[] {
  const unique = new Map<string, RetrievalCandidate>();

  for (const candidate of candidates) {
    const key = normalizeChunkKey(candidate.chunk);
    const previous = unique.get(key);
    if (!previous || candidate.hybridScore > previous.hybridScore) {
      unique.set(key, candidate);
    }
  }

  return Array.from(unique.values())
    .sort((a, b) => b.hybridScore - a.hybridScore)
    .slice(0, limit)
    .map((candidate) => ({
      id: candidate.id,
      moduleTag: candidate.moduleTag,
      language: candidate.language,
      title: candidate.title,
      chunk: candidate.chunk,
      metadata: candidate.metadata,
      similarity: candidate.similarity,
    }));
}

export async function retrieveKnowledge(options: KnowledgeQueryInput): Promise<KnowledgeSnippet[]> {
  const { query, language = DEFAULT_LANGUAGE, limit = 4, modules } = options;
  const pool = getDbPool();
  const vector = await embedText(query);
  const candidateLimit = Math.max(limit * 3, 12);

  const lexicalParams: unknown[] = [query, language, candidateLimit];
  const lexicalModule = buildModuleClause(lexicalParams.length + 1, modules);
  lexicalParams.push(...lexicalModule.params);

  const lexicalPromise = pool.query<KnowledgeSnippet & { lexicalScore: number }>(
    `select
       id,
       module_tag as "moduleTag",
       language,
       title,
       chunk,
       metadata,
       null as similarity,
       ts_rank_cd(to_tsvector('simple', chunk), websearch_to_tsquery('simple', $1)) as "lexicalScore"
     from kb_chunks
     where language = $2${lexicalModule.clause}
       and to_tsvector('simple', chunk) @@ websearch_to_tsquery('simple', $1)
     order by "lexicalScore" desc, updated_at desc
     limit $3`,
    lexicalParams,
  );

  const semanticPromise = vector
    ? (() => {
        const semanticParams: unknown[] = [vectorLiteral(vector), language, candidateLimit];
        const semanticModule = buildModuleClause(semanticParams.length + 1, modules);
        semanticParams.push(...semanticModule.params);

        return pool.query<KnowledgeSnippet & { similarity: number }>(
          `select
             id,
             module_tag as "moduleTag",
             language,
             title,
             chunk,
             metadata,
             (1 - (embedding <=> ($1)::vector)) as similarity
           from kb_chunks
           where embedding is not null
             and language = $2${semanticModule.clause}
           order by embedding <=> ($1)::vector
           limit $3`,
          semanticParams,
        );
      })()
    : Promise.resolve({ rows: [] as Array<KnowledgeSnippet & { similarity: number }> });

  const [semanticRowsRaw, lexicalRows] = await Promise.all([semanticPromise, lexicalPromise]);
  const semanticRows = {
    rows: semanticRowsRaw.rows.filter((row) => row.similarity == null || row.similarity >= MIN_SIMILARITY_SCORE),
  };

  if (!semanticRows.rows.length && !lexicalRows.rows.length) {
    const params: unknown[] = [language, limit];
    const { clause, params: moduleParams } = buildModuleClause(params.length + 1, modules);
    params.push(...moduleParams);

    const rows = await pool.query<KnowledgeSnippet>(
      `select
         id,
         module_tag as "moduleTag",
         language,
         title,
         chunk,
         metadata,
         null as similarity
       from kb_chunks
       where language = $1${clause}
       order by updated_at desc
       limit $2`,
      params,
    );

    return rows.rows;
  }

  const candidates = new Map<string, RetrievalCandidate>();

  semanticRows.rows.forEach((row, index) => {
    candidates.set(row.id, {
      ...row,
      lexicalScore: 0,
      semanticRank: index + 1,
      lexicalRank: 0,
      hybridScore: reciprocalRankScore(index + 1),
    });
  });

  lexicalRows.rows.forEach((row, index) => {
    const existing = candidates.get(row.id);
    const lexicalComponent = reciprocalRankScore(index + 1);
    if (existing) {
      existing.lexicalRank = index + 1;
      existing.lexicalScore = row.lexicalScore || 0;
      existing.hybridScore += lexicalComponent;
      return;
    }

    candidates.set(row.id, {
      ...row,
      similarity: null,
      lexicalScore: row.lexicalScore || 0,
      semanticRank: 0,
      lexicalRank: index + 1,
      hybridScore: lexicalComponent,
    });
  });

  return dedupeAndSortCandidates(Array.from(candidates.values()), limit);
}

export function formatKnowledgeContext(snippets: KnowledgeSnippet[], options: FormatKnowledgeOptions = {}): string {
  if (!snippets.length) {
    return "Knowledge Base: No hay resultados relevantes.";
  }

  const maxChars = options.maxChars ?? 1800;
  let usedChars = 0;
  const selected: string[] = [];

  for (const snippet of snippets) {
    const title = snippet.title ? `**${snippet.title}**\n` : "";
    const chunk = `${title}${snippet.chunk}`.trim();
    if (!chunk) continue;

    const remaining = maxChars - usedChars;
    if (remaining <= 0) break;

    if (chunk.length <= remaining) {
      selected.push(chunk);
      usedChars += chunk.length;
      continue;
    }

    if (remaining > 120) {
      selected.push(`${chunk.slice(0, remaining - 3).trimEnd()}...`);
    }
    break;
  }

  if (!selected.length) {
    return "Knowledge Base: No hay resultados relevantes.";
  }

  return `Knowledge Base:\n${selected.join("\n\n---\n\n")}`;
}
