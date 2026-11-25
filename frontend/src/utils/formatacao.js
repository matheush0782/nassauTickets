export const TIPOS_SENHA = {
  SP: { codigo: 'SP', nome: 'Prioritária', classe: 'sp' },
  SE: { codigo: 'SE', nome: 'Retirada de Exames', classe: 'se' },
  SG: { codigo: 'SG', nome: 'Geral', classe: 'sg' },
}

export const STATUS_SENHA = {
  EMITIDA: 'Emitida',
  AGUARDANDO: 'Aguardando',
  CHAMADA: 'Chamada',
  CHAMADA_NOVAMENTE: 'Chamada novamente',
  EM_ATENDIMENTO: 'Em atendimento',
  ATENDIDA: 'Atendida',
  NAO_COMPARECEU: 'Não compareceu',
  DESCARTADA: 'Descartada',
}

export function formatarDataHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function formatarHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('pt-BR')
}

export function formatarDuracao(ms) {
  if (ms == null || Number.isNaN(ms)) return '—'
  const totalSeg = Math.round(ms / 1000)
  const min = Math.floor(totalSeg / 60)
  const seg = totalSeg % 60
  return `${min} min ${String(seg).padStart(2, '0')} s`
}

export function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
