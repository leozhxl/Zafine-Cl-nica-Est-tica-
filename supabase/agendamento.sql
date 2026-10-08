-- Agendamento pelo agente — rode no SQL Editor do Supabase.

-- Serviços que podem ser agendados, com a duração de cada um.
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  duration_min int not null default 60 check (duration_min between 10 and 480),
  active boolean not null default true,
  sort int not null default 0
);

insert into services (name, duration_min, sort) values
  ('Avaliação gratuita', 30, 0),
  ('Depilação a laser', 30, 1),
  ('Estética corporal', 60, 2),
  ('Flacidez', 60, 3),
  ('Estrias', 60, 4),
  ('Rejuvenescimento facial', 60, 5),
  ('Lipo enzimática', 45, 6),
  ('Radiofrequência', 45, 7),
  ('Lipo de papada', 45, 8)
on conflict (name) do nothing;

-- Horários de atendimento (uma linha só).
create table if not exists schedule_settings (
  id int primary key default 1 check (id = 1),
  -- Por dia da semana (0 = domingo … 6 = sábado): {"open": "08:00", "close": "19:00"} ou null (fechado).
  hours jsonb not null default '{"0": null, "1": {"open": "08:00", "close": "19:00"}, "2": {"open": "08:00", "close": "19:00"}, "3": {"open": "08:00", "close": "19:00"}, "4": {"open": "08:00", "close": "19:00"}, "5": {"open": "08:00", "close": "19:00"}, "6": {"open": "08:00", "close": "12:00"}}'::jsonb,
  break_start time,
  break_end time,
  slot_step_min int not null default 30 check (slot_step_min between 5 and 240),
  capacity int not null default 1 check (capacity between 1 and 50),
  min_notice_hours int not null default 2 check (min_notice_hours between 0 and 168),
  days_ahead int not null default 14 check (days_ahead between 1 and 90),
  blocked_dates date[] not null default '{}',
  updated_at timestamptz not null default now()
);
insert into schedule_settings (id, break_start, break_end) values (1, '12:00', '13:00') on conflict do nothing;

-- Quem marcou a sessão: a equipe ou o agente.
alter table appointments add column if not exists created_by text not null default 'equipe';
alter table appointments drop constraint if exists appointments_created_by_check;
alter table appointments add constraint appointments_created_by_check check (created_by in ('equipe', 'agente'));

alter table services enable row level security;
alter table schedule_settings enable row level security;
drop policy if exists "equipe" on services;
create policy "equipe" on services for all to authenticated using (true) with check (true);
drop policy if exists "equipe" on schedule_settings;
create policy "equipe" on schedule_settings for all to authenticated using (true) with check (true);
