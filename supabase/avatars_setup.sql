-- Execute no SQL Editor do Supabase (uma vez por projeto).

-- Tabela de metadados do avatar (uma linha por dispositivo/navegador)
create table if not exists public.user_avatars (
  client_id text primary key,
  storage_path text not null,
  public_url text not null,
  content_type text,
  updated_at timestamptz not null default now()
);

alter table public.user_avatars enable row level security;

-- Permite leitura/escrita via chave anon (ajuste em producao conforme sua politica de auth)
create policy "user_avatars_select_anon"
  on public.user_avatars for select
  to anon
  using (true);

create policy "user_avatars_insert_anon"
  on public.user_avatars for insert
  to anon
  with check (true);

create policy "user_avatars_update_anon"
  on public.user_avatars for update
  to anon
  using (true)
  with check (true);

create policy "user_avatars_delete_anon"
  on public.user_avatars for delete
  to anon
  using (true);

-- Bucket publico para URLs diretas no frontend
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

create policy "avatars_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

create policy "avatars_anon_insert"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'avatars');

create policy "avatars_anon_update"
  on storage.objects for update
  to anon
  using (bucket_id = 'avatars');

create policy "avatars_anon_delete"
  on storage.objects for delete
  to anon
  using (bucket_id = 'avatars');
