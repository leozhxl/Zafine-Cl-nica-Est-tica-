-- Agentes (fluxos em blocos) — rode no SQL Editor do Supabase.

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  enabled boolean not null default false,
  flow jsonb not null default '{"nodes": [], "edges": []}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Em qual bloco do agente cada cliente está (uma execução por cliente).
create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references clients(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  node_id text,
  status text not null default 'waiting' check (status in ('waiting', 'done')),
  wait_until timestamptz,
  vars jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists agent_runs_wait_idx on agent_runs (wait_until) where status = 'waiting';

alter table agents enable row level security;
alter table agent_runs enable row level security;
drop policy if exists "equipe" on agents;
create policy "equipe" on agents for all to authenticated using (true) with check (true);
drop policy if exists "equipe" on agent_runs;
create policy "equipe" on agent_runs for all to authenticated using (true) with check (true);
