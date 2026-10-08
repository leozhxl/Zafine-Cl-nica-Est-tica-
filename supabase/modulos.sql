-- Tarefas, automações e campanhas — rode no SQL Editor do Supabase.

-- ---------- Tarefas ----------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  client_id uuid references clients(id) on delete set null,
  due_at timestamptz,
  done boolean not null default false,
  done_at timestamptz,
  assignee text,
  created_by text not null default 'equipe' check (created_by in ('equipe', 'automacao')),
  created_at timestamptz not null default now()
);
create index if not exists tasks_open_idx on tasks (done, due_at);

-- ---------- Histórico de mudança de etapa (alimenta automações e relatórios) ----------
create table if not exists client_stage_changes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  created_at timestamptz not null default now()
);
create index if not exists client_stage_changes_created_idx on client_stage_changes (created_at);

create or replace function log_stage_change() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    insert into client_stage_changes (client_id, from_stage, to_stage)
    values (new.id, case when tg_op = 'UPDATE' then old.stage end, new.stage);
  end if;
  return new;
end $$;

drop trigger if exists clients_stage_change on clients;
create trigger clients_stage_change after insert or update of stage on clients
  for each row execute function log_stage_change();

-- Clientes que não querem receber campanhas.
alter table clients add column if not exists marketing_opt_out boolean not null default false;

-- ---------- Automações ----------
create table if not exists automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  enabled boolean not null default false,
  trigger text not null check (trigger in ('lead_created', 'stage_changed', 'appointment_created', 'before_appointment', 'after_appointment')),
  trigger_config jsonb not null default '{}'::jsonb,
  action text not null check (action in ('send_message', 'send_template', 'create_task', 'set_stage')),
  action_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cada automação roda uma vez por evento (a chave evita repetir).
create table if not exists automation_log (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references automations(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  key text not null unique,
  status text not null check (status in ('ok', 'erro')),
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists automation_log_auto_idx on automation_log (automation_id, created_at desc);

-- ---------- Campanhas ----------
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'rascunho' check (status in ('rascunho', 'agendada', 'enviando', 'concluida', 'cancelada')),
  audience jsonb not null default '{}'::jsonb,
  template_name text not null default '',
  template_language text not null default 'pt_BR',
  body_params jsonb not null default '[]'::jsonb,
  preview text not null default '',
  scheduled_at timestamptz,
  sent_count int not null default 0,
  failed_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'erro')),
  error text,
  sent_at timestamptz,
  unique (campaign_id, client_id)
);
create index if not exists campaign_recipients_pending_idx on campaign_recipients (campaign_id, status);

-- ---------- Acesso: só a equipe logada ----------
do $$
declare t text;
begin
  foreach t in array array['tasks', 'client_stage_changes', 'automations', 'automation_log', 'campaigns', 'campaign_recipients'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "equipe" on %I', t);
    execute format('create policy "equipe" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
