import { generateReply } from '@/lib/ai-whatsapp'
import { type AiSettings, type BotMenu, type WhatsappMessage, menuMessage, optionKey } from '@/lib/crm'

export type BotReply = { reply: string; handoff: boolean; source: 'menu' | 'ai'; aiError?: string }

const MENU_WORDS = ['0', 'menu', 'inicio', 'voltar', 'opcoes']

const normalize = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

// Aceita "2", "2.", "opção 2" ou o nome exato da opção.
function matchOption(menu: BotMenu, text: string) {
  const t = normalize(text).replace(/^opcao /, '')
  const index = menu.options.findIndex((o, i) => t === optionKey(i) || t === normalize(o.label))
  return index >= 0 ? menu.options[index] : null
}

/**
 * Decide a resposta para a última mensagem recebida da cliente.
 * Ordem: opção do menu → menu (primeira mensagem ou "menu"/"0") → IA (se permitida) → "não entendi" + menu.
 */
export async function botReply({ menu, ai, aiAllowed, history }: {
  menu: BotMenu
  ai: AiSettings
  aiAllowed: boolean
  history: WhatsappMessage[]
}): Promise<BotReply | null> {
  const last = history.at(-1)
  if (!last || last.direction !== 'in') return null
  const text = normalize(last.body)
  const isFirst = history.filter((m) => m.direction === 'in').length === 1

  if (menu.enabled && menu.options.length) {
    const option = matchOption(menu, last.body)
    if (option) {
      const reply = option.handoff || !menu.footer ? option.reply : `${option.reply}\n\n${menu.footer}`
      return { reply, handoff: option.handoff, source: 'menu' }
    }
    if (isFirst || MENU_WORDS.includes(text)) return { reply: menuMessage(menu), handoff: false, source: 'menu' }
  }

  let aiError: string | undefined
  if (aiAllowed) {
    try {
      const { reply, needsHuman } = await generateReply(ai, history)
      return { reply, handoff: needsHuman, source: 'ai' }
    } catch (error) {
      aiError = error instanceof Error ? error.message : String(error)
      if (!menu.enabled) throw error
    }
  }

  if (menu.enabled && menu.options.length) return { reply: menuMessage(menu, menu.fallback), handoff: false, source: 'menu', aiError }
  return null
}
