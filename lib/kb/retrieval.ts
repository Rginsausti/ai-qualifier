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

const huggingFaceApiKey = process.env.HUGGINGFACE_API_KEY
  ?? process.env.HUGGINFACE_API_KEY
  ?? "";
const huggingFaceModel = process.env.KB_EMBEDDING_MODEL ?? "intfloat/multilingual-e5-large";
const huggingFaceBaseEndpoint = (process.env.HUGGINGFACE_API_URL ?? "https://router.huggingface.co").replace(/\/$/, "");
const DEFAULT_LANGUAGE = "es";

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

  const requestConfig = getHuggingFaceRequest(text);
  const response = await fetch(requestConfig.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${huggingFaceApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestConfig.body),
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    console.error("HF embedding error", response.status, await response.text().catch(() => ""));
    return null;
  }

  const data = (await response.json()) as
    | { embeddings?: number[]; data?: Array<{ embedding: number[] }> }
    | number[]
    | number[][];

  if (Array.isArray(data)) {
    if (typeof data[0] === "number") {
      return data as number[];
    }
    return (data[0] as number[] | undefined) ?? null;
  }

  if (Array.isArray(data.data)) {
    return data.data[0]?.embedding ?? null;
  }

  if (Array.isArray(data.embeddings)) {
    return data.embeddings;
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

export async function retrieveKnowledge(options: KnowledgeQueryInput): Promise<KnowledgeSnippet[]> {
  const { query, language = DEFAULT_LANGUAGE, limit = 4, modules } = options;
  const pool = getDbPool();
  const vector = await embedText(query);

  if (vector) {
    const params: unknown[] = [vectorLiteral(vector), language, limit];
    const { clause, params: moduleParams } = buildModuleClause(params.length + 1, modules);
    params.push(...moduleParams);

    const rows = await pool.query<KnowledgeSnippet & { similarity: number }>(
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
         and language = $2${clause}
       order by embedding <=> ($1)::vector
       limit $3`,
      params,
    );

    return rows.rows.map((row) => ({ ...row, similarity: row.similarity ?? null }));
  }

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

export function formatKnowledgeContext(snippets: KnowledgeSnippet[]): string {
  if (!snippets.length) {
    return "Knowledge Base: No hay resultados relevantes.";
  }

  const formatted = snippets.map((snippet) => {
    const title = snippet.title ? `**${snippet.title}**\n` : "";
    return `${title}${snippet.chunk}`;
  });

  return `Knowledge Base:\n${formatted.join("\n\n---\n\n")}`;
}
