// Tipos e modelos dos agentes em blocos. Sem dependências de servidor: usado também no editor.
import { stages } from '@/lib/crm'

export type Branch = { id: string; label: string; keywords: string }

export type NodeData =
  | { kind: 'start'; trigger: 'first_message' | 'any_message' }
  | { kind: 'message'; text: string }
  | { kind: 'wait'; timeoutMinutes: number | null }
  | { kind: 'condition'; branches: Branch[] }
  | { kind: 'ai' }
  | { kind: 'action'; action: 'set_stage' | 'set_interest' | 'handoff' | 'end'; value: string }

export type FlowNode = { id: string; type: NodeData['kind']; position: { x: number; y: number }; data: NodeData }
export type FlowEdge = { id: string; source: string; sourceHandle?: string | null; target: string }
export type Flow = { nodes: FlowNode[]; edges: FlowEdge[] }

export type Agent = { id: string; name: string; enabled: boolean; flow: Flow; updated_at: string }

export type RunState = {
  node_id: string | null
  status: 'waiting' | 'done'
  wait_until: string | null
  vars: Record<string, string>
}

export const blockInfo: Record<NodeData['kind'], { label: string; color: string; description: string }> = {
  start: { label: 'Início', color: '#7c5cd6', description: 'Quando o agente começa' },
  message: { label: 'Enviar mensagem', color: '#2d7299', description: 'Envia um texto para a cliente' },
  wait: { label: 'Aguardar resposta', color: '#b7791f', description: 'Espera a cliente responder' },
  condition: { label: 'Condição', color: '#2f7d5b', description: 'Separa pelo que a cliente respondeu' },
  ai: { label: 'Resposta com IA', color: '#c2417a', description: 'IA responde usando o roteiro' },
  action: { label: 'Ação', color: '#4a5568', description: 'Funil, interesse, atendente ou fim' },
}

export const actionLabels: Record<Extract<NodeData, { kind: 'action' }>['action'], string> = {
  set_stage: 'Mover no funil',
  set_interest: 'Salvar tratamento de interesse',
  handoff: 'Passar para atendente',
  end: 'Encerrar conversa',
}

export const newId = () => Math.random().toString(36).slice(2, 10)

export function defaultData(kind: NodeData['kind']): NodeData {
  switch (kind) {
    case 'start': return { kind, trigger: 'any_message' }
    case 'message': return { kind, text: '' }
    case 'wait': return { kind, timeoutMinutes: null }
    case 'condition': return { kind, branches: [{ id: newId(), label: 'Opção 1', keywords: '1' }] }
    case 'ai': return { kind }
    case 'action': return { kind, action: 'set_stage', value: stages[0].value }
  }
}

/** Modelo pronto: o atendimento do menu, montado em blocos. */
export function templateFlow(): Flow {
  const n = (id: string, x: number, y: number, data: NodeData): FlowNode => ({ id, type: data.kind, position: { x, y }, data })
  const e = (source: string, target: string, sourceHandle?: string): FlowEdge => ({ id: `${source}-${sourceHandle ?? 'next'}-${target}`, source, sourceHandle: sourceHandle ?? null, target })
  return {
    nodes: [
      n('inicio', 0, 160, { kind: 'start', trigger: 'any_message' }),
      n('boas-vindas', 260, 140, { kind: 'message', text: 'Olá, {nome}! 💙 Seja bem-vinda à *Zafine Clínica Estética Avançada*.\nComo podemos te ajudar? Responda com o *número*:\n\n*1* - Conhecer os tratamentos\n*2* - Agendar avaliação gratuita\n*3* - Falar com uma atendente' }),
      n('espera', 560, 160, { kind: 'wait', timeoutMinutes: 720 }),
      n('opcoes', 840, 120, { kind: 'condition', branches: [
        { id: 'tratamentos', label: 'Tratamentos', keywords: '1, tratamento, tratamentos' },
        { id: 'agendar', label: 'Agendar', keywords: '2, agendar, avaliação, marcar, horário' },
        { id: 'atendente', label: 'Atendente', keywords: '3, atendente, pessoa, humano' },
      ] }),
      n('lista', 1140, -80, { kind: 'message', text: 'Nossos tratamentos:\n\n✨ Depilação a laser\n✨ Estética corporal\n✨ Flacidez\n✨ Estrias\n✨ Rejuvenescimento facial\n✨ Lipo enzimática\n✨ Radiofrequência\n✨ Lipo de papada\n\nA avaliação é *gratuita*! Digite *2* para agendar ou *3* para falar com a equipe.' }),
      n('agendar-msg', 1140, 120, { kind: 'message', text: 'Que ótimo! 🥰 Uma atendente vai falar com você para marcar o melhor horário. Qual período você prefere: manhã ou tarde?' }),
      n('agendar-funil', 1440, 120, { kind: 'action', action: 'set_stage', value: 'avaliacao' }),
      n('agendar-humano', 1700, 120, { kind: 'action', action: 'handoff', value: '' }),
      n('atendente-msg', 1140, 300, { kind: 'message', text: 'Certo! Uma de nossas atendentes vai continuar o atendimento, só um instante. 💙' }),
      n('atendente-humano', 1440, 300, { kind: 'action', action: 'handoff', value: '' }),
      n('nao-entendi', 1140, 470, { kind: 'message', text: 'Desculpe, não entendi. 😊 Responda com *1*, *2* ou *3*.' }),
      n('lembrete', 840, 420, { kind: 'message', text: 'Oi, {nome}! Ainda posso te ajudar? É só responder com *1*, *2* ou *3*. 💙' }),
      n('fim', 1140, 640, { kind: 'action', action: 'end', value: '' }),
    ],
    edges: [
      e('inicio', 'boas-vindas'),
      e('boas-vindas', 'espera'),
      e('espera', 'opcoes', 'reply'),
      e('espera', 'lembrete', 'timeout'),
      e('lembrete', 'fim'),
      e('opcoes', 'lista', 'tratamentos'),
      e('lista', 'espera'),
      e('opcoes', 'agendar-msg', 'agendar'),
      e('agendar-msg', 'agendar-funil'),
      e('agendar-funil', 'agendar-humano'),
      e('opcoes', 'atendente-msg', 'atendente'),
      e('atendente-msg', 'atendente-humano'),
      e('opcoes', 'nao-entendi', 'else'),
      e('nao-entendi', 'espera'),
    ],
  }
}

export const emptyFlow = (): Flow => ({
  nodes: [{ id: 'inicio', type: 'start', position: { x: 0, y: 0 }, data: { kind: 'start', trigger: 'any_message' } }],
  edges: [],
})
