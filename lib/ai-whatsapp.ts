import Anthropic from '@anthropic-ai/sdk'
import type { AiSettings, WhatsappMessage } from '@/lib/crm'

// Chaves de usuário (sk-ant-usr-…) não são ligadas a um workspace e exigem o header com o ID dele.
const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID
const anthropic = new Anthropic(workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : {})

export type AiReply = { reply: string; needsHuman: boolean }

function scriptSection(settings: AiSettings) {
  const steps = (settings.script_steps ?? []).filter((s) => s.instruction.trim())
  const faq = (settings.faq ?? []).filter((f) => f.question.trim() && f.answer.trim())
  let text = ''
  if (steps.length) {
    text += `\n<roteiro>
Conduza a conversa seguindo estas etapas, na ordem. Veja no histórico em qual etapa a cliente está e avance uma etapa por vez, sem pular nem repetir as que já foram feitas. Se a cliente fizer uma pergunta no meio, responda e depois retome o roteiro de onde parou.
${steps.map((s, i) => `${i + 1}. ${s.title ? `${s.title}: ` : ''}${s.instruction}`).join('\n')}
</roteiro>\n`
  }
  if (faq.length) {
    text += `\n<respostas_prontas>
Quando a cliente perguntar algo igual ou parecido com uma destas perguntas, responda com a resposta cadastrada, mantendo o conteúdo e o tom. Pode só ajustar o início para encaixar na conversa (por exemplo, usar o nome dela).
${faq.map((f) => `<item>\n<pergunta>${f.question}</pergunta>\n<resposta>${f.answer}</resposta>\n</item>`).join('\n')}
</respostas_prontas>\n`
  }
  return text
}

function systemPrompt(settings: AiSettings) {
  return `Você é ${settings.assistant_name}, assistente virtual da Zafine Clínica Estética Avançada (Sombrio, SC), respondendo clientes pelo WhatsApp.

<instrucoes>
${settings.instructions}
</instrucoes>

<informacoes_da_clinica>
${settings.knowledge || 'Nenhuma informação adicional cadastrada.'}
</informacoes_da_clinica>
${scriptSection(settings)}
Regras:
- Use apenas as informações e respostas acima. Se não souber algo (preços, horários livres, condições específicas), não invente: diga que a equipe vai confirmar.
- Não faça diagnósticos nem prometa resultados.
- Marque needs_human como true quando a pessoa pedir para falar com uma atendente, quiser fechar um agendamento com data e horário, fizer uma reclamação, ou quando você não conseguir ajudar. Nesse caso, escreva em reply uma mensagem curta avisando que uma atendente vai continuar o atendimento.`
}

function toMessages(history: WhatsappMessage[]): Anthropic.Beta.BetaMessageParam[] {
  const messages = history.map((m) => ({ role: m.direction === 'in' ? 'user' : 'assistant', content: m.body }) as const)
  while (messages.length && messages[0].role === 'assistant') messages.shift()
  return messages
}

export async function generateReply(settings: AiSettings, history: WhatsappMessage[]): Promise<AiReply> {
  const messages = toMessages(history)
  if (!messages.length) throw new Error('Nenhuma mensagem da cliente para responder.')

  const response = await anthropic.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    cache_control: { type: 'ephemeral' },
    output_config: {
      effort: 'low',
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            reply: { type: 'string', description: 'Mensagem a enviar no WhatsApp.' },
            needs_human: { type: 'boolean' },
          },
          required: ['reply', 'needs_human'],
          additionalProperties: false,
        },
      },
    },
    system: systemPrompt(settings),
    messages,
  })

  if (response.stop_reason === 'refusal') return { reply: settings.handoff_message, needsHuman: true }

  const text = response.content.find((b) => b.type === 'text')
  if (!text || text.type !== 'text') throw new Error(`Resposta sem texto (stop_reason: ${response.stop_reason}).`)
  const parsed = JSON.parse(text.text) as { reply: string; needs_human: boolean }
  return { reply: parsed.reply, needsHuman: parsed.needs_human }
}

export function isWithinBusinessHours(settings: AiSettings, now = new Date()) {
  const time = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false })
  const weekday = now.toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' })
  if (weekday === 'Sun') return false
  return time >= settings.hours_start.slice(0, 5) && time < settings.hours_end.slice(0, 5)
}

async function postWhatsapp(payload: Record<string, unknown>) {
  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) throw new Error('WhatsApp não conectado (faltam WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID).')
  const version = process.env.WHATSAPP_API_VERSION || 'v23.0'
  const res = await fetch(`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  })
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as { messages?: { id: string }[] }
  return data.messages?.[0]?.id ?? null
}

export function sendWhatsappText(to: string, body: string) {
  return postWhatsapp({ to, type: 'text', text: { body } })
}

/** Modelo aprovado pela Meta: único jeito de iniciar conversa fora da janela de 24h. */
export function sendWhatsappTemplate(to: string, name: string, language: string, params: string[]) {
  return postWhatsapp({
    to,
    type: 'template',
    template: {
      name,
      language: { code: language },
      ...(params.length ? { components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text: text || '-' })) }] } : {}),
    },
  })
}
