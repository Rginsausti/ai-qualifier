#!/usr/bin/env tsx
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { Client } from "pg";

const ruleSchema = z.object({
  rule_key: z.string().min(1, "rule_key requerido"),
  description: z.string().min(1, "description requerida"),
  threshold: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  condition: z.record(z.string(), z.any()).nullable().optional(),
  jurisdiction: z.string().nullable().optional(),
  severity: z.string().nullable().optional(),
  citation: z.string().nullable().optional(),
});

const labelingSchema = z.object({
  term: z.string().min(1, "term requerido"),
  jurisdiction: z.string().nullable().optional(),
  definition: z.string().min(1, "definition requerida"),
  numeric_threshold: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  citation: z.string().nullable().optional(),
});

const payloadSchema = z.object({
  safety_rules: z.array(ruleSchema).optional(),
  labeling_terms: z.array(labelingSchema).optional(),
});

type Rule = z.infer<typeof ruleSchema>;
type Label = z.infer<typeof labelingSchema>;

type Cache = Map<string, number>;

async function upsertCitation(client: Client, cache: Cache, reference?: string | null) {
  if (!reference) return null;
  const key = reference.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key)!;

  const { rows } = await client.query(
    `insert into citations (reference)
     values ($1)
     on conflict (reference) do update set reference = excluded.reference
     returning id`,
    [reference.trim()]
  );

  const id = rows[0]?.id as number;
  cache.set(key, id);
  return id;
}

async function upsertSafetyRule(client: Client, rule: Rule, citationId: number | null) {
  await client.query(
    `insert into safety_rules (rule_key, description, threshold, unit, condition, jurisdiction, severity, citation_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (rule_key) do update set
       description = excluded.description,
       threshold = excluded.threshold,
       unit = excluded.unit,
       condition = excluded.condition,
       jurisdiction = excluded.jurisdiction,
       severity = excluded.severity,
       citation_id = coalesce(excluded.citation_id, safety_rules.citation_id),
       updated_at = now()`,
    [
      rule.rule_key,
      rule.description,
      rule.threshold ?? null,
      rule.unit ?? null,
      rule.condition ?? null,
      rule.jurisdiction ?? null,
      rule.severity ?? null,
      citationId,
    ]
  );
}

async function upsertLabel(client: Client, label: Label, citationId: number | null) {
  await client.query(
    `insert into labeling_terms (term, jurisdiction, definition, numeric_threshold, unit, citation_id)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (term, jurisdiction) do update set
       definition = excluded.definition,
       numeric_threshold = excluded.numeric_threshold,
       unit = excluded.unit,
       citation_id = coalesce(excluded.citation_id, labeling_terms.citation_id),
       updated_at = now()`,
    [
      label.term,
      label.jurisdiction ?? null,
      label.definition,
      label.numeric_threshold ?? null,
      label.unit ?? null,
      citationId,
    ]
  );
}

function normalizeInput(raw: unknown): z.infer<typeof payloadSchema> {
  if (Array.isArray(raw)) {
    return { safety_rules: raw.map((item) => ruleSchema.parse(item)) };
  }
  return payloadSchema.parse(raw);
}

async function main() {
  const [, , inputPath] = process.argv;
  if (!inputPath) {
    console.error("Uso: tsx scripts/ingest-safety-rules.ts <ruta-json>");
    process.exit(1);
  }

  const filePath = path.resolve(inputPath);
  if (!fs.existsSync(filePath)) {
    console.error(`No se encontró el archivo ${filePath}`);
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error("Falta DATABASE_URL o POSTGRES_URL en el entorno");
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const payload = normalizeInput(raw);

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const citationCache: Cache = new Map();

  try {
    if (payload.safety_rules?.length) {
      console.log(`Ingresando ${payload.safety_rules.length} reglas de seguridad`);
      for (const rule of payload.safety_rules) {
        const citationId = await upsertCitation(client, citationCache, rule.citation);
        await upsertSafetyRule(client, rule, citationId);
      }
    }

    if (payload.labeling_terms?.length) {
      console.log(`Ingresando ${payload.labeling_terms.length} términos de etiquetado`);
      for (const label of payload.labeling_terms) {
        const citationId = await upsertCitation(client, citationCache, label.citation);
        await upsertLabel(client, label, citationId);
      }
    }

    console.log("Ingesta de reglas y etiquetado completada");
  } catch (error) {
    console.error("Error durante la ingesta de reglas", error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
