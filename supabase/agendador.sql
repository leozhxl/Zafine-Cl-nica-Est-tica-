-- Agendador dos agentes — rode no SQL Editor do Supabase (depois do agentes.sql).
-- A cada minuto, chama o site para disparar os blocos "Aguardar" cujo tempo acabou.
-- Troque SUA_SENHA_AQUI pelo valor de CRON_SECRET (o mesmo cadastrado na Vercel).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('agentes-tick') where exists (select 1 from cron.job where jobname = 'agentes-tick');

select cron.schedule('agentes-tick', '* * * * *', $$
  select net.http_post(
    url := 'https://zafine-cl-nica-est-tica.vercel.app/api/agents/tick',
    headers := jsonb_build_object('Authorization', 'Bearer SUA_SENHA_AQUI', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
$$);
