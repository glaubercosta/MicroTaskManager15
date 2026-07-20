-- Tabela de listas/categorias (GC-d / GC-15). Modelo: PRD §8.
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- RLS: cada lista só é acessível pelo dono (RNF-1). O banco é a fronteira.
alter table public.lists enable row level security;

create policy "lists_owner_all" on public.lists
  for all
  to anon, authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Data API não auto-expõe tabelas novas (ver supabase/config.toml). Conceder DML
-- explicitamente; a RLS acima continua escopando por usuário para anon/authenticated.
grant select, insert, update, delete on public.lists to anon, authenticated, service_role;

-- FK adiada da GC-c: agora que public.lists existe, vincula tasks.list_id.
-- on delete set null: apagar a lista solta as tarefas na aba "Todas" (não as apaga).
alter table public.tasks
  add constraint tasks_list_id_fkey
  foreign key (list_id) references public.lists (id) on delete set null;
