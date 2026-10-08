-- Roteiro da IA (etapas da conversa e respostas prontas) — rode no SQL Editor do Supabase.

alter table ai_settings add column if not exists script_steps jsonb not null default '[]'::jsonb;
alter table ai_settings add column if not exists faq jsonb not null default '[]'::jsonb;

-- Roteiro inicial (só preenche se ainda estiver vazio).
update ai_settings set script_steps = $j$[
  { "title": "Cumprimentar", "instruction": "Dê boas-vindas à Zafine de forma calorosa e pergunte o nome da cliente." },
  { "title": "Entender o interesse", "instruction": "Pergunte qual tratamento ela procura ou qual incômodo quer resolver. Se ela já disse, não pergunte de novo." },
  { "title": "Explicar", "instruction": "Explique o tratamento em 2 ou 3 frases simples, usando só as informações da clínica e as respostas prontas." },
  { "title": "Convidar para a avaliação", "instruction": "Convide para a avaliação gratuita e pergunte qual período prefere (manhã ou tarde)." },
  { "title": "Passar para a atendente", "instruction": "Quando ela aceitar a avaliação ou informar o período, avise que uma atendente vai confirmar o horário e marque needs_human como true." }
]$j$::jsonb
where id = 1 and script_steps = '[]'::jsonb;

update ai_settings set faq = $j$[
  { "question": "A avaliação é paga?", "answer": "Não! A avaliação é gratuita. 💙 Nela entendemos o que você procura e montamos um plano personalizado." },
  { "question": "Quantas sessões preciso?", "answer": "Depende da região, do tipo de pelo e de cada pessoa. Na avaliação gratuita a gente te passa o número certinho de sessões para o seu caso." },
  { "question": "Dói?", "answer": "A tecnologia que usamos deixa o procedimento bem mais confortável. A sensação é rápida e a maioria das clientes tolera super bem." },
  { "question": "Posso fazer laser no verão?", "answer": "Pode sim! Com os cuidados certos, que a nossa equipe te orienta, o laser pode ser feito o ano todo. ☀️" },
  { "question": "Quanto custa?", "answer": "Os valores variam conforme a região e o número de sessões. Na avaliação gratuita passamos o valor certinho e as condições do momento. Quer agendar?" }
]$j$::jsonb
where id = 1 and faq = '[]'::jsonb;
