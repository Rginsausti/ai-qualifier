#!/usr/bin/env tsx
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";
const ALLOWED_MODULES = new Set(["patrones", "filosofia", "recetas", "guardrails"]);
const SUPPORTED_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);
const CHUNK_CHAR_LIMIT = 1400;

const huggingFaceApiKey = process.env.HUGGINGFACE_API_KEY
  ?? process.env.HUGGINFACE_API_KEY
  ?? "";
const huggingFaceModel = process.env.KB_EMBEDDING_MODEL ?? "intfloat/multilingual-e5-large";
const huggingFaceBaseEndpoint = (process.env.HUGGINGFACE_API_URL ?? "https://router.huggingface.co").replace(/\/$/, "");
let embeddingWarningPrinted = false;
let observedEmbeddingLength: number | null = null;

type HuggingFaceRequestConfig = {
  url: string;
  body: Record<string, unknown>;
};

function getHuggingFaceRequest(text: string): HuggingFaceRequestConfig {
  const apiStyle = detectApiStyle(huggingFaceBaseEndpoint);

  if (apiStyle === "router-openai") {
    return {
      url: buildRouterEmbeddingsUrl(huggingFaceBaseEndpoint),
      body: {
        model: huggingFaceModel,
        input: [text],
      },
    };
  }

  if (apiStyle === "router-hf-inference") {
    const modelsBase = /\/hf-inference\/models$/i.test(huggingFaceBaseEndpoint)
      ? huggingFaceBaseEndpoint
      : `${huggingFaceBaseEndpoint}/hf-inference/models`;

    return {
      url: `${modelsBase}/${huggingFaceModel}`,
      body: { inputs: text },
    };
  }

  const legacyBase = /\/models$/i.test(huggingFaceBaseEndpoint)
    ? huggingFaceBaseEndpoint
    : `${huggingFaceBaseEndpoint}/models`;

  return {
    url: `${legacyBase}/${huggingFaceModel}`,
    body: { inputs: text },
  };
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

function assertModule(module: string) {
  if (!ALLOWED_MODULES.has(module as typeof module)) {
    console.error(`Modulo inválido '${module}'. Usa: patrones | filosofia | recetas | guardrails`);
    process.exit(1);
  }
}

function collectFiles(target: string): string[] {
  const stats = fs.statSync(target);
  if (stats.isDirectory()) {
    return fs
      .readdirSync(target)
      .flatMap((entry) => collectFiles(path.join(target, entry)));
  }

  if (stats.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(target).toLowerCase())) {
    return [target];
  }

  return [];
}

function normalizeText(text: string) {
  return text.replace(/\r\n/g, "\n");
}

function chunkMarkdown(content: string) {
  const lines = normalizeText(content).split("\n");
  const chunks: Array<{ title: string | null; text: string }> = [];
  let currentHeading: string | null = null;
  let buffer: string[] = [];

  const flushBuffer = () => {
    const paragraphBlock = buffer.join("\n").trim();
    buffer = [];
    if (!paragraphBlock) return;

    const paragraphs = paragraphBlock.split(/\n{2,}/);
    let running = "";

    for (const paragraph of paragraphs) {
      const addition = running ? `${running}\n\n${paragraph}` : paragraph;
      if (addition.length >= CHUNK_CHAR_LIMIT) {
        if (running) {
          chunks.push({ title: currentHeading, text: running.trim() });
        }
        chunks.push({ title: currentHeading, text: paragraph.trim() });
        running = "";
        continue;
      }

      if (addition.length > CHUNK_CHAR_LIMIT) {
        chunks.push({ title: currentHeading, text: addition.slice(0, CHUNK_CHAR_LIMIT).trim() });
        running = addition.slice(CHUNK_CHAR_LIMIT);
        continue;
      }

      running = addition;
    }

    if (running.trim()) {
      chunks.push({ title: currentHeading, text: running.trim() });
    }
  };

  for (const line of lines) {
    if (/^#{1,6}\s+/.test(line)) {
      flushBuffer();
      currentHeading = line.replace(/^#{1,6}\s+/, "").trim();
    } else {
      buffer.push(line);
    }
  }

  flushBuffer();
  return chunks;
}

function chunkHash(input: { module: string; language: string; title: string | null; text: string; sourcePath: string; index: number }) {
  return crypto
    .createHash("sha256")
    .update([input.module, input.language, input.title ?? "", input.text, input.sourcePath, input.index.toString()].join("|"))
    .digest("hex");
}

async function maybeEmbed(text: string): Promise<number[] | null> {
  if (!huggingFaceApiKey) {
    if (!embeddingWarningPrinted) {
      console.warn("HUGGINGFACE_API_KEY no está definido. Los embeddings se guardarán como NULL.");
      embeddingWarningPrinted = true;
    }
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
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Error en HuggingFace embeddings: ${response.status} ${message}`);
  }

  const data = (await response.json()) as
    | { embeddings?: number[]; data?: Array<{ embedding: number[] }> }
    | number[]
    | number[][];
  const vector = Array.isArray(data)
    ? typeof data[0] === "number"
      ? (data as number[])
      : (data[0] as number[])
    : Array.isArray((data as { data?: Array<{ embedding: number[] }> }).data)
      ? (data as { data: Array<{ embedding: number[] }> }).data[0]?.embedding ?? null
      : Array.isArray((data as { embeddings?: number[] }).embeddings)
        ? (data as { embeddings: number[] }).embeddings
        : null;

  if (vector && !observedEmbeddingLength) {
    observedEmbeddingLength = vector.length;
    console.log(`HF embeddings dimension detectada: ${observedEmbeddingLength}`);
  }

  return vector ?? null;
}

function vectorLiteral(values: number[]): string {
  return `[${values.map((value) => Number(value).toString()).join(",")}]`;
}

async function upsertChunk(client: Client, payload: {
  moduleTag: string;
  language: string;
  title: string | null;
  text: string;
  metadata: Record<string, unknown>;
  contentHash: string;
}) {
  const embedding = await maybeEmbed(payload.text);
  const values: Array<string | null | Record<string, unknown>> = [
    payload.moduleTag,
    payload.language,
    payload.title,
    payload.text,
    payload.contentHash,
    payload.metadata,
  ];

  const placeholders = values.map((_, index) => `$${index + 1}`);
  let embeddingClause = "NULL";

  if (embedding) {
    values.push(vectorLiteral(embedding));
    embeddingClause = `($${values.length})::vector`;
  }

  await client.query(
    `insert into kb_chunks (module_tag, language, title, chunk, content_hash, metadata, embedding)
     values (${placeholders.join(", ")}, ${embeddingClause})
     on conflict (content_hash) do update set
       title = excluded.title,
       chunk = excluded.chunk,
       metadata = excluded.metadata,
       embedding = coalesce(excluded.embedding, kb_chunks.embedding),
       updated_at = now()`,
    values
  );
}

async function main() {
  const [, , moduleTag, sourcePathArg, language = "es"] = process.argv;
  if (!moduleTag || !sourcePathArg) {
    console.error("Uso: tsx scripts/ingest-kb-text.ts <modulo> <ruta-archivo-o-directorio> [idioma]");
    process.exit(1);
  }

  assertModule(moduleTag);

  const sourcePath = path.resolve(sourcePathArg);
  if (!fs.existsSync(sourcePath)) {
    console.error(`No existe la ruta ${sourcePath}`);
    process.exit(1);
  }

  const files = collectFiles(sourcePath);
  if (!files.length) {
    console.error("No se encontraron archivos soportados (.md/.txt)");
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error("Falta DATABASE_URL o POSTGRES_URL en el entorno");
    process.exit(1);
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    for (const filePath of files) {
      const content = fs.readFileSync(filePath, "utf8");
      const chunks = chunkMarkdown(content);

      for (const [index, chunk] of chunks.entries()) {
        const relativePath = path.relative(process.cwd(), filePath);
        const metadata = {
          source_path: relativePath,
          chunk_index: index,
          heading: chunk.title,
          word_count: chunk.text.split(/\s+/).filter(Boolean).length,
        };

        await upsertChunk(client, {
          moduleTag,
          language,
          title: chunk.title,
          text: chunk.text,
          metadata,
          contentHash: chunkHash({
            module: moduleTag,
            language,
            title: chunk.title,
            text: chunk.text,
            sourcePath: relativePath,
            index,
          }),
        });
      }
    }

    console.log(`Ingesta completada para ${files.length} archivo(s)`);
  } catch (error) {
    console.error("Error durante la ingesta de texto", error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
