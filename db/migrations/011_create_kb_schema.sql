-- Knowledge Base schema for structured nutrition data + vector content
create extension if not exists vector;

create table if not exists citations (
    id bigserial primary key,
    reference text not null unique,
    doi text,
    publisher text,
    publication_year smallint,
    source_url text,
    inserted_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists population_groups (
    id bigserial primary key,
    slug text not null unique,
    name text not null,
    age_min smallint,
    age_max smallint,
    sex text,
    physiological_state text,
    notes text,
    inserted_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists nutrients (
    id bigserial primary key,
    code text unique,
    name text not null unique,
    nutrient_class text,
    sub_class text,
    default_unit text,
    conversion_notes text,
    inserted_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists dri_reference (
    id bigserial primary key,
    population_group_id bigint not null references population_groups(id) on delete cascade,
    nutrient_id bigint not null references nutrients(id) on delete cascade,
    rda_ai_value numeric,
    ul_value numeric,
    unit text not null,
    citation_id bigint references citations(id),
    source_note text,
    inserted_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uniq_dri_population_nutrient unique (population_group_id, nutrient_id)
);

create table if not exists food_items (
    id bigserial primary key,
    slug text not null unique,
    fao_food_code text unique,
    local_name text not null,
    scientific_name text,
    edible_portion numeric,
    source_id bigint references citations(id),
    tags jsonb,
    inserted_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists food_nutrients (
    id bigserial primary key,
    food_item_id bigint not null references food_items(id) on delete cascade,
    nutrient_id bigint not null references nutrients(id) on delete cascade,
    value_per_100g numeric not null,
    unit text not null,
    energy_kcal numeric,
    energy_kj numeric,
    method_code text,
    quality_flag text,
    citation_id bigint references citations(id),
    notes text,
    inserted_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uniq_food_nutrient unique (food_item_id, nutrient_id)
);

create table if not exists safety_rules (
    id bigserial primary key,
    rule_key text not null unique,
    description text not null,
    threshold numeric,
    unit text,
    condition jsonb,
    jurisdiction text,
    severity text,
    citation_id bigint references citations(id),
    inserted_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists labeling_terms (
    id bigserial primary key,
    term text not null,
    jurisdiction text,
    definition text not null,
    numeric_threshold numeric,
    unit text,
    citation_id bigint references citations(id),
    inserted_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create type kb_module_tag as enum ('patrones', 'filosofia', 'recetas', 'guardrails');

create table if not exists kb_chunks (
    id uuid primary key default gen_random_uuid(),
    module_tag kb_module_tag not null,
    language text not null default 'es',
    title text,
    chunk text not null,
    content_hash text not null unique,
    metadata jsonb,
    embedding vector(1536),
    citation_id bigint references citations(id),
    inserted_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists uniq_population_group_idx on population_groups (name, coalesce(sex, ''), coalesce(physiological_state, ''), coalesce(age_min, -1), coalesce(age_max, -1));
create index if not exists idx_dri_population on dri_reference(population_group_id);
create index if not exists idx_food_nutrients_food on food_nutrients(food_item_id);
create index if not exists idx_food_nutrients_nutrient on food_nutrients(nutrient_id);
create index if not exists idx_safety_rules_key on safety_rules(rule_key);
create index if not exists idx_labeling_terms_term on labeling_terms(term);
create unique index if not exists uniq_labeling_term_jurisdiction on labeling_terms (term, coalesce(jurisdiction, ''));
create index if not exists idx_kb_chunks_module on kb_chunks(module_tag);
create index if not exists idx_kb_chunks_language on kb_chunks(language);
create index if not exists idx_kb_chunks_embedding on kb_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

comment on table dri_reference is 'Dietary reference intake values per population group and nutrient';
comment on table food_nutrients is 'Food composition data per nutrient for each food item';
comment on table safety_rules is 'Clinical and regulatory guardrails applied before recommendations';
comment on table kb_chunks is 'Vectorized narrative content used by RAG retrieval.';