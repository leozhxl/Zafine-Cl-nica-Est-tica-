import Link from 'next/link'
import { Bot, Flag, GitBranch, Hourglass, MessageSquare, Play, Sparkles } from 'lucide-react'
import { blockInfo } from '@/lib/agent-flow'

export const metadata = { title: 'Ajuda · CRM Zafine' }

const sections = [
  { id: 'comeco', label: 'Por onde começar' },
  { id: 'como-funciona', label: 'Como o atendimento automático funciona' },
  { id: 'agentes', label: 'Agentes' },
  { id: 'blocos', label: 'Os blocos, um por um' },
  { id: 'testar', label: 'Testar e ativar um agente' },
  { id: 'ia', label: 'IA e roteiro' },
  { id: 'conversas', label: 'Conversas e atendimento humano' },
  { id: 'crm', label: 'Clientes, funil e agenda' },
  { id: 'problemas', label: 'Problemas comuns' },
  { id: 'dicas', label: 'Boas práticas' },
]

const blocks = [
  {
    kind: 'start' as const, icon: Play,
    what: 'É o ponto de partida. Todo agente tem um, e ele não pode ser apagado.',
    how: [
      '“Qualquer mensagem”: o agente começa sempre que a cliente escreve e não está no meio do fluxo. Se o fluxo terminou e ela escreve de novo, ele recomeça do início. É a opção recomendada.',
      '“Primeira mensagem”: o agente fala só uma vez com cada cliente. Depois que ela passa pelo fluxo, ele não responde mais (só a IA, se estiver ligada).',
    ],
  },
  {
    kind: 'message' as const, icon: MessageSquare,
    what: 'Envia um texto para a cliente e segue direto para o próximo bloco.',
    how: [
      'Escreva {nome} para colocar o primeiro nome da cliente. Se o nome dela ainda não for conhecido, o {nome} some sozinho da frase.',
      'Use *texto* para deixar em negrito no WhatsApp.',
      'Vários blocos de mensagem seguidos viram várias mensagens separadas.',
    ],
  },
  {
    kind: 'wait' as const, icon: Hourglass,
    what: 'Para o fluxo e espera a cliente responder. A resposta dela é usada pela Condição que vem depois.',
    how: [
      'Saída “Respondeu”: para onde ir quando ela responder.',
      'Marcando “Seguir outro caminho se ela não responder”, aparece a saída “Sem resposta”, usada quando o tempo acaba (por exemplo, para mandar um lembrete).',
      'O tempo é conferido a cada minuto, então o lembrete pode chegar até 1 minuto depois do horário exato.',
    ],
  },
  {
    kind: 'condition' as const, icon: GitBranch,
    what: 'Escolhe o caminho de acordo com o que a cliente respondeu, usando palavras-chave. Não usa IA e não tem custo.',
    how: [
      'Cada opção tem uma lista de palavras-chave separadas por vírgula, por exemplo: 2, agendar, marcar, horário.',
      'Não importa se ela escreveu com acento, sem acento, em maiúscula ou minúscula.',
      'A palavra precisa aparecer inteira na mensagem: “1” bate com “1” ou “opção 1”, mas não com “10”.',
      'As opções são conferidas de cima para baixo. A primeira que bater define o caminho, então coloque as mais específicas primeiro.',
      'Se nenhuma bater, segue pela saída “Nenhuma das opções”. Normalmente ela leva a uma mensagem de “não entendi” e volta para o Aguardar.',
    ],
  },
  {
    kind: 'ai' as const, icon: Sparkles,
    what: 'A IA lê a conversa e escreve uma resposta usando o roteiro, as respostas prontas e as informações da clínica.',
    how: [
      'Só funciona com a IA ligada e com créditos (veja a seção IA e roteiro). Sem isso, o bloco é simplesmente pulado.',
      'Se a IA perceber que a cliente precisa de uma pessoa, ela avisa a cliente e passa o atendimento para a equipe.',
      'Bom para perguntas abertas que não cabem em palavras-chave.',
    ],
  },
  {
    kind: 'action' as const, icon: Flag,
    what: 'Faz algo no CRM sem enviar mensagem.',
    how: [
      '“Mover no funil”: muda a etapa da cliente (Novo lead, Contatado, Avaliação, Cliente, Perdido).',
      '“Salvar tratamento de interesse”: grava um tratamento fixo ou o que a cliente respondeu.',
      '“Passar para atendente”: pausa o robô para essa cliente. Ela aparece no Painel em “Aguardando atendente”. O fluxo termina aqui.',
      '“Encerrar conversa”: termina o fluxo sem passar para ninguém.',
    ],
  },
]

const problems = [
  {
    q: 'O robô não respondeu uma cliente.',
    a: [
      'Confira em Conversas → Conexão se o WhatsApp está conectado (as três bolinhas verdes).',
      'Confira em Agentes se existe um agente “Ativo”.',
      'Veja se a conversa está com 👤 (atendimento assumido pela equipe). Nesse caso o robô fica quieto de propósito.',
      'Áudios, fotos, figurinhas e documentos não são respondidos automaticamente. Só mensagens de texto.',
      'Se o Início estiver em “Primeira mensagem” e a cliente já passou pelo fluxo, o agente não fala de novo. Troque para “Qualquer mensagem”.',
    ],
  },
  {
    q: 'A cliente sempre cai no “não entendi”.',
    a: [
      'Abra a Condição e acrescente as palavras que as clientes realmente usam. Olhe as conversas reais para descobrir quais são.',
      'Lembre que a palavra precisa aparecer inteira: “agend” não bate com “agendar”. Cadastre a palavra completa.',
      'Para perguntas muito variadas, ligue a saída “Nenhuma das opções” a um bloco Resposta com IA.',
    ],
  },
  {
    q: 'O lembrete (tempo de espera) não foi enviado.',
    a: [
      'No bloco Aguardar, a opção “Seguir outro caminho se ela não responder” precisa estar marcada, e a saída “Sem resposta” precisa estar ligada a algum bloco.',
      'Se a cliente respondeu antes do tempo acabar, o lembrete não é enviado. Isso é o esperado.',
      'Se a equipe assumiu o atendimento, o lembrete também não é enviado.',
    ],
  },
  {
    q: 'Mudei o agente e nada mudou no WhatsApp.',
    a: [
      'Clique em “Salvar alterações” no editor. O botão mostra “Salvo” quando está tudo gravado.',
      'Confira se é esse o agente marcado como Ativo.',
      'Clientes que estão no meio do fluxo continuam do bloco onde pararam. Se você apagou esse bloco, o fluxo recomeça do início na próxima mensagem dela (com o Início em “Qualquer mensagem”).',
    ],
  },
  {
    q: 'A IA não responde ou o teste mostra “IA falhou”.',
    a: [
      'Em Conversas → IA e roteiro, “Ligar a IA” precisa estar marcado e salvo.',
      'A conta da Anthropic precisa ter créditos. Sem créditos, a IA não responde.',
      'Se “Responder só fora do horário” estiver marcado, a IA fica quieta durante o horário de atendimento (de segunda a sábado; domingo conta como fechado).',
    ],
  },
  {
    q: 'A equipe não consegue responder pelo CRM.',
    a: [
      'O WhatsApp só permite mensagens livres até 24 horas depois da última mensagem da cliente. Depois disso, responda pelo celular ou espere ela escrever de novo.',
      'Confira se o WhatsApp está conectado (Conversas → Conexão).',
    ],
  },
  {
    q: 'Uma cliente ficou “presa” com o robô pausado.',
    a: [
      'Abra a conversa dela em Conversas e clique em “Devolver para o robô”.',
      'Se ninguém fizer nada, o robô volta sozinho quando ela escrever depois de 24 horas sem mensagens, e o agente recomeça do início.',
    ],
  },
]

export default function AjudaPage() {
  return (
    <>
      <div className="crm-header">
        <div>
          <h1>Ajuda</h1>
          <p>Guia rápido do atendimento automático, da IA e do CRM.</p>
        </div>
      </div>

      <div className="crm-help">
        <nav className="crm-help-nav crm-card">
          <strong>Nesta página</strong>
          {sections.map((s) => <a key={s.id} href={`#${s.id}`}>{s.label}</a>)}
        </nav>

        <div className="crm-help-content">
          <section id="comeco" className="crm-card">
            <h2>Por onde começar</h2>
            <ol>
              <li>Vá em <Link href="/admin/agentes">Agentes</Link> e clique em <b>Novo agente</b>. Escolha <b>começar pelo modelo de atendimento</b>.</li>
              <li>No editor, clique em cada bloco e ajuste os textos para o jeito da clínica.</li>
              <li>Na aba <b>Testar</b> do editor, converse como se fosse uma cliente até ficar do jeito que você quer.</li>
              <li>Marque <b>Ativo</b> e clique em <b>Salvar alterações</b>. A partir daí, o agente responde as clientes no WhatsApp.</li>
              <li>Acompanhe tudo em <Link href="/admin/conversas">Conversas</Link> e assuma o atendimento sempre que precisar.</li>
            </ol>
          </section>

          <section id="como-funciona" className="crm-card">
            <h2>Como o atendimento automático funciona</h2>
            <p>Quando uma cliente manda mensagem no WhatsApp da clínica:</p>
            <div className="crm-help-steps">
              <div><b>1. Cadastro</b><span>Se ela ainda não existe no CRM, é cadastrada como “Novo lead”, com o nome do perfil do WhatsApp.</span></div>
              <div><b>2. Atendimento humano?</b><span>Se a equipe assumiu a conversa, o robô não responde nada.</span></div>
              <div><b>3. Agente</b><span>O agente ativo segue o fluxo de blocos e responde.</span></div>
              <div><b>4. IA</b><span>Se não há agente ativo, ou ele não responde, a IA responde sozinha (só se estiver ligada).</span></div>
            </div>
            <p className="crm-help-note">Todas as mensagens, enviadas e recebidas, ficam guardadas em <Link href="/admin/conversas">Conversas</Link>.</p>
          </section>

          <section id="agentes" className="crm-card">
            <h2>Agentes</h2>
            <p>Um agente é o caminho que a conversa segue, desenhado em blocos ligados por setas. Cada bloco faz uma coisa (mandar mensagem, esperar resposta, escolher um caminho…), e as setas dizem qual bloco vem depois.</p>
            <ul>
              <li><b>Só um agente fica ativo por vez.</b> Ativar um desliga os outros. Isso permite deixar versões prontas (por exemplo, uma de promoção) e trocar quando quiser.</li>
              <li><b>Duplicar</b> cria uma cópia desligada. Use para mexer sem afetar o agente que está funcionando.</li>
              <li><b>Adicionar bloco:</b> clique no tipo de bloco na coluna da esquerda. Ele aparece no meio da tela.</li>
              <li><b>Ligar blocos:</b> arraste da bolinha à direita de um bloco até o bloco seguinte. Cada saída leva a um único bloco; se você ligar de novo, a ligação antiga é trocada.</li>
              <li><b>Apagar uma ligação:</b> clique na seta e aperte Delete. <b>Apagar um bloco:</b> selecione e aperte Delete, ou use o botão “Apagar bloco”.</li>
              <li><b>Navegar:</b> arraste o fundo para mover a tela e use a roda do mouse ou os botões + e − para o zoom. O botão ⛶ enquadra o fluxo inteiro.</li>
              <li>Um caminho pode voltar para um bloco anterior. Por exemplo, depois do “não entendi”, voltar para o Aguardar resposta.</li>
            </ul>
          </section>

          <section id="blocos" className="crm-card">
            <h2>Os blocos, um por um</h2>
            {blocks.map(({ kind, icon: Icon, what, how }) => (
              <div key={kind} className="crm-help-block" style={{ borderLeftColor: blockInfo[kind].color }}>
                <h3 style={{ color: blockInfo[kind].color }}><Icon size={16} /> {blockInfo[kind].label}</h3>
                <p>{what}</p>
                <ul>{how.map((h) => <li key={h}>{h}</li>)}</ul>
              </div>
            ))}
          </section>

          <section id="testar" className="crm-card">
            <h2>Testar e ativar um agente</h2>
            <ul>
              <li>No editor, abra a aba <b>Testar</b> (à direita) e escreva como se fosse a cliente. Nada é enviado no WhatsApp.</li>
              <li>O teste usa o desenho que está na tela, <b>mesmo sem salvar</b>. O bloco onde a conversa parou fica com a borda amarela.</li>
              <li>Quando o fluxo está num Aguardar com tempo limite, aparece o botão <b>“Simular que ela não respondeu”</b>, para testar o lembrete sem esperar.</li>
              <li>Embaixo das respostas aparecem anotações como “funil → Avaliação” ou “passou para atendente”, mostrando o que aconteceria no CRM.</li>
              <li>O botão ↻ recomeça a conversa de teste.</li>
              <li>Para ativar: marque <b>Ativo</b> no topo do editor e clique em <b>Salvar alterações</b>. O Início precisa estar ligado a algum bloco.</li>
              <li>Se você tentar sair do editor sem salvar, o navegador avisa.</li>
            </ul>
          </section>

          <section id="ia" className="crm-card">
            <h2><Bot size={18} style={{ verticalAlign: -3 }} /> IA e roteiro</h2>
            <p>A IA é <b>opcional</b>. O agente funciona sem ela, só com mensagens, esperas e condições. Ela ajuda quando a cliente escreve algo que não cabe em palavras-chave.</p>
            <ul>
              <li><b>Custo:</b> a IA usa créditos pagos na Anthropic, cobrados por mensagem respondida. Sem créditos, ela não responde e o resto do agente continua funcionando normalmente.</li>
              <li><b>Onde configurar:</b> <Link href="/admin/conversas?aba=ia">Conversas → IA e roteiro</Link>.</li>
              <li><b>Instruções e tom de voz:</b> como ela deve falar (acolhedora, objetiva, mensagens curtas…).</li>
              <li><b>Roteiro da conversa:</b> as etapas que ela segue, uma por vez. Se a cliente perguntar algo no meio, ela responde e volta para o roteiro.</li>
              <li><b>Respostas prontas:</b> quando a cliente pergunta algo parecido, a IA usa o seu texto. Use para preços, promoções e regras que precisam ser ditos sempre do mesmo jeito.</li>
              <li><b>Informações da clínica:</b> a IA só responde com base no que estiver escrito ali. Se algo não estiver, ela diz que a equipe vai confirmar e não inventa. Mantenha esse texto atualizado.</li>
              <li><b>Passar para atendente:</b> quando a cliente pede uma pessoa, quer marcar um horário ou reclama, a IA avisa a cliente e pausa o robô para ela.</li>
              <li><b>Responder só fora do horário:</b> a IA fica quieta durante o horário de atendimento (de segunda a sábado, horário de Brasília; domingo conta como fechado).</li>
            </ul>
            <p className="crm-help-note">A IA pode errar. Revise as conversas de vez em quando e ajuste o roteiro, as respostas prontas e as informações conforme as perguntas que aparecerem.</p>
          </section>

          <section id="conversas" className="crm-card">
            <h2>Conversas e atendimento humano</h2>
            <ul>
              <li>Em <Link href="/admin/conversas">Conversas</Link> aparecem todas as clientes que escreveram, com a última mensagem. A lista se atualiza sozinha a cada 15 segundos.</li>
              <li>Ao abrir uma conversa, embaixo do nome aparece em qual bloco do agente ela está (por exemplo, “aguardar resposta até 14:30”).</li>
              <li><b>Assumir atendimento</b> pausa o robô para essa cliente, para a equipe conversar sem interferência. O ícone 👤 indica atendimento humano.</li>
              <li><b>Devolver para o robô</b> libera o atendimento automático de novo.</li>
              <li>O robô também volta sozinho quando a cliente escreve depois de 24 horas sem mensagens. Nesse caso, o agente recomeça do início.</li>
              <li>Dá para responder pelo próprio CRM, pelo campo embaixo da conversa. Atenção: o WhatsApp só permite mensagens livres até 24 horas depois da última mensagem da cliente.</li>
              <li>Clientes esperando atendimento aparecem no <Link href="/admin">Painel</Link>, em “Aguardando atendente”.</li>
              <li>Só mensagens de <b>texto</b> são respondidas automaticamente. Áudios, fotos e documentos precisam de resposta da equipe.</li>
            </ul>
          </section>

          <section id="crm" className="crm-card">
            <h2>Clientes, funil e agenda</h2>
            <ul>
              <li><Link href="/admin/clientes">Clientes</Link>: cadastro completo, com busca e filtro por etapa. Quem escreve no WhatsApp é cadastrado automaticamente.</li>
              <li><Link href="/admin/funil">Funil</Link>: arraste os cartões entre as etapas. Os agentes também podem mover clientes com o bloco Ação.</li>
              <li><Link href="/admin/agenda">Agenda</Link>: sessões por semana. Clique em um dia para agendar e em uma sessão para editar ou mudar o status.</li>
              <li>Em qualquer cliente dá para marcar “Pausar respostas automáticas”, que tem o mesmo efeito de assumir o atendimento.</li>
            </ul>
          </section>

          <section id="problemas" className="crm-card">
            <h2>Problemas comuns</h2>
            {problems.map((p) => (
              <details key={p.q} className="crm-help-faq">
                <summary>{p.q}</summary>
                <ul>{p.a.map((a) => <li key={a}>{a}</li>)}</ul>
              </details>
            ))}
          </section>

          <section id="dicas" className="crm-card">
            <h2>Boas práticas</h2>
            <ul>
              <li><b>Mensagens curtas.</b> No WhatsApp, textos longos costumam ficar sem resposta. Prefira duas mensagens curtas a uma enorme.</li>
              <li><b>Sempre dê uma saída para a equipe.</b> Tenha uma opção “falar com uma atendente” em todo menu.</li>
              <li><b>Use lembretes com moderação.</b> Um lembrete depois de algumas horas ajuda; vários seguidos incomodam.</li>
              <li><b>Teste antes de ativar.</b> Toda mudança grande deve passar pela aba Testar, de preferência numa cópia do agente.</li>
              <li><b>Revise as conversas toda semana.</b> Elas mostram as perguntas que o agente ainda não cobre.</li>
              <li><b>Mantenha preços e promoções num lugar só</b> (as respostas prontas da IA ou um bloco de mensagem), para não ficar com informações diferentes espalhadas.</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  )
}
