#!/usr/bin/env tsx
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { Client } from "pg";

const rowSchema = z.object({
  fao_food_code: z.string().optional().nullable(),
  nombre: z.string().min(1, "nombre requerido"),
  nombre_cientifico: z.string().optional().nullable(),
  nutriente: z.string().min(1, "nutriente requerido"),
  valor_por_100g: z.string().min(1, "valor requerido"),
  unidad: z.string().optional().nullable(),
  metodo: z.string().optional().nullable(),
  calidad: z.string().optional().nullable(),
  cita: z.string().optional().nullable(),
  energia_kcal: z.string().optional().nullable(),
  energia_kj: z.string().optional().nullable(),
  tags: z.string().optional().nullable(),
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

async function upsertFoodItem(client: Client, cache: Cache, row: Row, citationId: number | null) {
  const slug = buildSlug([
    row.fao_food_code ?? row.nombre,
    row.nombre_cientifico ?? "",
  ]);

  if (cache.has(slug)) return cache.get(slug)!;

  const { rows } = await client.query(
    `insert into food_items (slug, fao_food_code, local_name, scientific_name, source_id, tags)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (slug) do update set
       local_name = excluded.local_name,
       scientific_name = excluded.scientific_name,
       source_id = coalesce(excluded.source_id, food_items.source_id),
       tags = excluded.tags,
       updated_at = now()
     returning id`,
    [
      slug,
      row.fao_food_code?.trim() ?? null,
      row.nombre.trim(),
      row.nombre_cientifico?.trim() ?? null,
      citationId,
      row.tags ? safeJson(row.tags) : null,
    ]
  );

  const id = rows[0]?.id as number;
  cache.set(slug, id);
  return id;
}

function safeJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function upsertNutrient(client: Client, cache: Cache, row: Row) {
  const name = row.nutriente.trim();
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

async function upsertFoodNutrient(client: Client, payload: {
  foodItemId: number;
  nutrientId: number;
  valuePer100g: number;
  unit: string | null;
  energyKcal: number | null;
  energyKj: number | null;
  methodCode: string | null;
  qualityFlag: string | null;
  citationId: number | null;
}) {
  const { foodItemId, nutrientId, valuePer100g, unit, energyKcal, energyKj, methodCode, qualityFlag, citationId } = payload;

  await client.query(
    `insert into food_nutrients (food_item_id, nutrient_id, value_per_100g, unit, energy_kcal, energy_kj, method_code, quality_flag, citation_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (food_item_id, nutrient_id) do update set
       value_per_100g = excluded.value_per_100g,
       unit = excluded.unit,
       energy_kcal = excluded.energy_kcal,
       energy_kj = excluded.energy_kj,
       method_code = excluded.method_code,
       quality_flag = excluded.quality_flag,
       citation_id = coalesce(excluded.citation_id, food_nutrients.citation_id),
       updated_at = now()`,
    [foodItemId, nutrientId, valuePer100g, unit, energyKcal, energyKj, methodCode, qualityFlag, citationId]
  );
}

async function main() {
  const [, , inputPath] = process.argv;
  if (!inputPath) {
    console.error("Uso: tsx scripts/ingest-fcd.ts <ruta-al-csv>");
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

  const foodCache: Cache = new Map();
  const nutrientCache: Cache = new Map();
  const citationCache: Cache = new Map();

  try {
    for (const row of rows) {
      const citationId = await upsertCitation(client, citationCache, row.cita);
      const foodItemId = await upsertFoodItem(client, foodCache, row, citationId);
      const nutrientId = await upsertNutrient(client, nutrientCache, row);
      const valuePer100g = parseNumber(row.valor_por_100g);

      if (valuePer100g == null) {
        console.warn(`Valor nulo para ${row.nombre} - ${row.nutriente}, omitido`);
        continue;
      }

      await upsertFoodNutrient(client, {
        foodItemId,
        nutrientId,
        valuePer100g,
        unit: row.unidad?.trim() ?? null,
        energyKcal: parseNumber(row.energia_kcal),
        energyKj: parseNumber(row.energia_kj),
        methodCode: row.metodo?.trim() ?? null,
        qualityFlag: row.calidad?.trim() ?? null,
        citationId,
      });
    }

    console.log("Ingesta de composición de alimentos completada");
  } catch (error) {
    console.error("Error durante la ingesta de composición", error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
