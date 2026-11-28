import { STATUS_SENHA, TIPOS_SENHA } from '../constants/domain.js'
import { NotFoundError, ValidationError } from '../errors/AppError.js'
import { auditRepository } from '../repositories/auditRepository.js'
import { ticketRepository } from '../repositories/ticketRepository.js'

/**
 * Servico base de persistencia e consultas de senhas (Desenvolvedor 1).
 *
 * Nota de integracao para o Desenvolvedor 2:
 * As regras de prioridade da fila (SP -> SE/SG -> SP -> SE/SG),
 * transicoes da maquina de estados, horario de expediente (07h-17h),
 * sincronizacao em tempo real e chamadas por audio devem ser acopladas
 * sobre este servico/repositorio.
 */
export function createTicketService({
  tickets = ticketRepository,
  audit = auditRepository,
} = {}) {
  return {
    async emitirSenha({ tipo, ipOrigem = null }) {
      const tipoNormalizado = String(tipo || '').trim().toUpperCase()
      if (!TIPOS_SENHA.includes(tipoNormalizado)) {
        throw new ValidationError('Tipo de senha invalido. Valores aceitos: SP, SG, SE.')
      }

      const ticket = await tickets.createTicket({
        tipo: tipoNormalizado,
        status: 'AGUARDANDO',
      })

      await audit.registrarEvento({
        senhaId: ticket.id,
        acao: 'SENHA_EMITIDA',
        detalhes: { codigo: ticket.codigo, tipo: ticket.tipo },
        ipOrigem,
      })

      return ticket
    },

    async listarSenhas(filters = {}) {
      if (filters.tipo && !TIPOS_SENHA.includes(String(filters.tipo).toUpperCase())) {
        throw new ValidationError('Filtro de tipo invalido. Valores aceitos: SP, SG, SE.')
      }
      if (filters.status && !STATUS_SENHA.includes(String(filters.status).toUpperCase())) {
        throw new ValidationError('Filtro de status invalido.')
      }

      return tickets.list({
        dataReferencia: filters.data || null,
        tipo: filters.tipo ? String(filters.tipo).toUpperCase() : null,
        status: filters.status ? String(filters.status).toUpperCase() : null,
        limit: filters.limit,
        offset: filters.offset,
      })
    },

    async buscarSenhaPorId(id) {
      const ticket = await tickets.findById(id)
      if (!ticket) {
        throw new NotFoundError('Senha nao encontrada.')
      }
      return ticket
    },

    async obterPainelChamadas({ limit = 5 } = {}) {
      return tickets.listPainelChamadas({ limit })
    },

    async atualizarStatusPersistencia(id, payload, actor) {
      await this.buscarSenhaPorId(id)
      const status = String(payload.status || '').trim().toUpperCase()

      if (!STATUS_SENHA.includes(status)) {
        throw new ValidationError('Status de senha invalido.')
      }

      const fields = { status }
      if (payload.guicheId !== undefined) fields.guicheId = payload.guicheId
      if (payload.atendenteId !== undefined) {
        fields.atendenteId = payload.atendenteId
      } else if (actor?.id) {
        fields.atendenteId = actor.id
      }

      const updated = await tickets.updateById(id, fields)

      await audit.registrarEvento({
        usuarioId: actor?.id ?? null,
        senhaId: updated.id,
        guicheId: updated.guiche_id,
        acao: 'SENHA_STATUS_ATUALIZADO',
        detalhes: { status: updated.status },
        ipOrigem: actor?.ipOrigem ?? null,
      })

      return updated
    },
  }
}

export const ticketService = createTicketService()
