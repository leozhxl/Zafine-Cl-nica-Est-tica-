-- Robô de menu do WhatsApp — rode no SQL Editor do Supabase (depois do schema.sql).

create table if not exists bot_menu (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  welcome text not null default $t$Olá! 💙 Seja bem-vinda à *Zafine Clínica Estética Avançada*.
Como podemos te ajudar? Responda com o *número* da opção:$t$,
  options jsonb not null default $j$[
    { "label": "Conhecer os tratamentos", "handoff": false, "reply": "Nossos tratamentos:\n\n✨ Depilação a laser (feminina, masculina e facial)\n✨ Estética corporal\n✨ Flacidez\n✨ Estrias\n✨ Rejuvenescimento facial\n✨ Lipo enzimática\n✨ Radiofrequência\n✨ Lipo de papada\n\nA avaliação é *gratuita*! Para agendar, digite *3*." },
    { "label": "Depilação a laser", "handoff": false, "reply": "A depilação a laser é a nossa especialidade há 9 anos, com mais de 130 mil clientes atendidos. 💙\n\nO laser age no folículo e reduz o crescimento dos pelos de forma progressiva. O número de sessões varia conforme a região e o tipo de pelo, e pode ser feito o ano todo, inclusive no verão.\n\nNa avaliação gratuita montamos um plano para você. Para agendar, digite *3*." },
    { "label": "Agendar avaliação gratuita", "handoff": true, "reply": "Que ótimo! 🥰 Uma de nossas atendentes já vai falar com você para marcar o melhor horário.\n\nEnquanto isso, conta pra gente: qual tratamento te interessa e qual período você prefere (manhã ou tarde)?" },
    { "label": "Endereço e horários", "handoff": false, "reply": "📍 Estamos em Sombrio, SC.\n\n(Edite esta resposta no CRM com o endereço completo e os horários de atendimento.)" },
    { "label": "Universidade do Laser (cursos)", "handoff": false, "reply": "A Universidade do Laser Zafine forma profissionais em depilação a laser, com teoria e prática. 🎓\n\nQuer saber datas e valores da próxima turma? Digite *6* para falar com a nossa equipe." },
    { "label": "Falar com uma atendente", "handoff": true, "reply": "Certo! Uma de nossas atendentes vai continuar o atendimento, só um instante. 💙" }
  ]$j$::jsonb,
  footer text not null default 'Digite *0* para ver o menu novamente.',
  fallback text not null default 'Desculpe, não entendi. 😊 Responda com o *número* de uma das opções:',
  updated_at timestamptz not null default now()
);
insert into bot_menu (id) values (1) on conflict do nothing;

alter table bot_menu enable row level security;
drop policy if exists "equipe" on bot_menu;
create policy "equipe" on bot_menu for all to authenticated using (true) with check (true);
