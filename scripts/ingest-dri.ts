#!/usr/bin/env tsx
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { Client } from "pg";

const rowSchema = z.object({
  grupo_poblacional: z.string().min(1, "grupo_poblacional requerido"),
  edad_min: z.string().optional().nullable(),
  edad_max: z.string().optional().nullable(),
  sexo: z.string().optional().nullable(),
  estado_fisiologico: z.string().optional().nullable(),
  nutriente: z.string().min(1, "nutriente requerido"),
  valor_rda_ai: z.string().optional().nullable(),
  valor_ul: z.string().optional().nullable(),
  unidad: z.string().optional().nullable(),
  fuente_bibliografica: z.string().optional().nullable(),
});

type Row = z.infer<typeof rowSchema>;

type Cache = Map<string, number>;

function parseNumber(value?: string | null): number | null {
  if (!value) return null;
  const normalized = value.replace(/,/, ".").trim();
  if (!normalized) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function buildSlug(parts: Array<string | number | null | undefined>): string {
  return parts
    .map((entry) => (entry ?? "").toString().trim().toLowerCase())
    .filter(Boolean)
    .join("-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

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

async function upsertPopulationGroup(client: Client, cache: Cache, row: Row) {
  const slug = buildSlug([
    row.grupo_poblacional,
    row.sexo ?? "*",
    row.estado_fisiologico ?? "*",
    row.edad_min ?? "na",
    row.edad_max ?? "na",
  ]);

  if (cache.has(slug)) return cache.get(slug)!;

  const { rows } = await client.query(
    `insert into population_groups (slug, name, age_min, age_max, sex, physiological_state)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (slug) do update set
       name = excluded.name,
       age_min = excluded.age_min,
       age_max = excluded.age_max,
       sex = excluded.sex,
       physiological_state = excluded.physiological_state,
       updated_at = now()
     returning id`,
    [
      slug,
      row.grupo_poblacional.trim(),
      parseNumber(row.edad_min),
      parseNumber(row.edad_max),
      row.sexo?.trim() ?? null,
      row.estado_fisiologico?.trim() ?? null,
    ]
  );

  const id = rows[0]?.id as number;
  cache.set(slug, id);
  return id;
}

async function upsertNutrient(client: Client, cache: Cache, row: Row) {
  const name = row.nutriente.trim();
  if (!name) {
    throw new Error("Nutriente vacío en la fila");
  }
  const key = name.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  const { rows } = await client.query(
    `insert into nutrients (name, default_unit)
     values ($1, $2)
     on conflict (name) do update set default_unit = coalesce(excluded.default_unit, nutrients.default_unit)
     returning id`,
    [name, row.unidad?.trim() ?? null]
  );

  const id = rows[0]?.id as number;
  cache.set(key, id);
  return id;
}

async function upsertDri(client: Client, payload: {
  populationGroupId: number;
  nutrientId: number;
  rdaValue: number | null;
  ulValue: number | null;
  unit: string | null;
  citationId: number | null;
}) {
  const { populationGroupId, nutrientId, rdaValue, ulValue, unit, citationId } = payload;

  await client.query(
    `insert into dri_reference (population_group_id, nutrient_id, rda_ai_value, ul_value, unit, citation_id)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (population_group_id, nutrient_id) do update set
       rda_ai_value = excluded.rda_ai_value,
       ul_value = excluded.ul_value,
       unit = excluded.unit,
       citation_id = coalesce(excluded.citation_id, dri_reference.citation_id),
       updated_at = now()`,
    [populationGroupId, nutrientId, rdaValue, ulValue, unit, citationId]
  );
}

async function main() {
  const [, , inputPath] = process.argv;
  if (!inputPath) {
    console.error("Uso: tsx scripts/ingest-dri.ts <ruta-al-csv>");
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

  const csv = fs.readFileSync(filePath, "utf8");
  const rawRows = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
  const rows = rawRows.map((row: unknown, index: number) => {
    try {
      return rowSchema.parse(row);
    } catch (error) {
      console.error(`Fila ${index + 2} inválida`, error);
      throw error;
    }
  });

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log(`Importando ${rows.length} filas desde ${filePath}`);

  const populationCache: Cache = new Map();
  const nutrientCache: Cache = new Map();
  const citationCache: Cache = new Map();

  try {
    for (const row of rows) {
      const populationGroupId = await upsertPopulationGroup(client, populationCache, row);
      const nutrientId = await upsertNutrient(client, nutrientCache, row);
      const citationId = await upsertCitation(client, citationCache, row.fuente_bibliografica);

      await upsertDri(client, {
        populationGroupId,
        nutrientId,
        rdaValue: parseNumber(row.valor_rda_ai),
        ulValue: parseNumber(row.valor_ul),
        unit: row.unidad?.trim() ?? null,
        citationId,
      });
    }

    console.log("Ingesta de DRIs completada");
  } catch (error) {
    console.error("Error durante la ingesta de DRIs", error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
