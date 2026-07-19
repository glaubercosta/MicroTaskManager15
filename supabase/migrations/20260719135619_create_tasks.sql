-- Tabela de tarefas (GC-c / GC-14). Modelo: PRD §8.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- list_id: coluna já criada aqui (nullable, sem FK); a FK para public.lists
  -- é adicionada na GC-d, quando a tabela lists existir.
  list_id uuid,
  title text not null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date date,
  status text not null default 'new' check (status in ('new', 'working', 'done', 'canceled')),
  created_at timestamptz not null default now()
);

-- RLS: cada linha só é acessível pelo dono (RNF-1). O banco é a fronteira.
alter table public.tasks enable row level security;

create policy "tasks_owner_all" on public.tasks
  for all
  to anon, authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Data API não auto-expõe tabelas novas (ver supabase/config.toml). Conceder DML
-- explicitamente; a RLS acima continua escopando por usuário para anon/authenticated.
grant select, insert, update, delete on public.tasks to anon, authenticated, service_role;
