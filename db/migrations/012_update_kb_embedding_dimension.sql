-- Align kb_chunks embedding dimension with Hugging Face model output (multilingual-e5-large => 1024)
-- Drop dependent index before altering the vector column.
drop index if exists idx_kb_chunks_embedding;

alter table if exists kb_chunks
  alter column embedding type vector(1024);

create index if not exists idx_kb_chunks_embedding on kb_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
