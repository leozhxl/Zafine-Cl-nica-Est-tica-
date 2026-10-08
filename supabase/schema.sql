-- CRM Zafine — rode este arquivo no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text unique,
  email text,
  source text not null default 'outro',
  stage text not null default 'novo' check (stage in ('novo', 'contatado', 'avaliacao', 'fechado', 'perdido')),
  interest text,
  notes text,
  ai_paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  treatment text not null,
  professional text,
  starts_at timestamptz not null,
  duration_min int not null default 60,
  status text not null default 'agendado' check (status in ('agendado', 'confirmado', 'realizado', 'faltou', 'cancelado')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists appointments_starts_at_idx on appointments (starts_at);

create table if not exists whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  phone text not null,
  direction text not null check (direction in ('in', 'out')),
  body text not null,
  from_ai boolean not null default false,
  wa_message_id text unique,
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_messages_client_idx on whatsapp_messages (client_id, created_at desc);

create table if not exists ai_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  assistant_name text not null default 'Zafine',
  instructions text not null default 'Seja acolhedora, simpática e objetiva. Responda em português do Brasil, com mensagens curtas como numa conversa de WhatsApp. Seu objetivo é tirar dúvidas e convidar a cliente para uma avaliação gratuita.',
  knowledge text not null default 'Zafine Clínica Estética Avançada — Sombrio, SC. Há 9 anos referência em depilação a laser, mais de 130 mil clientes atendidos. Também temos a Universidade do Laser (cursos).

Tratamentos: depilação a laser (feminina, masculina e facial), estética corporal, flacidez, estrias, rejuvenescimento facial, lipo enzimática, radiofrequência e lipo de papada.

A avaliação é gratuita. O número de sessões varia conforme a região, o tipo de pelo e cada pessoa — definimos um plano personalizado na avaliação. O laser pode ser feito o ano todo, inclusive no verão, com os cuidados orientados pela equipe.',
  handoff_message text not null default 'Vou chamar uma de nossas atendentes para continuar com você, só um instante! 💙',
  outside_hours_only boolean not null default false,
  hours_start time not null default '08:00',
  hours_end time not null default '19:00',
  updated_at timestamptz not null default now()
);
insert into ai_settings (id) values (1) on conflict do nothing;

-- Acesso: qualquer usuário logado (equipe) pode ler e editar.
-- O webhook do WhatsApp usa a service role key, que ignora RLS.
alter table clients enable row level security;
alter table appointments enable row level security;
alter table whatsapp_messages enable row level security;
alter table ai_settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['clients', 'appointments', 'whatsapp_messages', 'ai_settings'] loop
    execute format('drop policy if exists "equipe" on %I', t);
    execute format('create policy "equipe" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
