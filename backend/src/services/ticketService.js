import { STATUS_SENHA, TIPOS_SENHA } from '../constants/domain.js'
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../errors/AppError.js'
import { auditRepository } from '../repositories/auditRepository.js'
import { ticketRepository } from '../repositories/ticketRepository.js'

function mapReservaError(errorCode) {
  switch (errorCode) {
    case 'GUICHE_NOT_FOUND':
      return new NotFoundError('Guiche informado nao encontrado.')
    case 'GUICHE_INACTIVE':
      return new ValidationError('Guiche informado esta inativo.')
    case 'GUICHE_OCCUPIED_BY_OTHER':
      return new ConflictError('Guiche esta ocupado por outro atendente.')
    case 'GUICHE_HAS_ACTIVE_TICKET':
      return new ConflictError('Este guiche ja possui uma senha em chamada ou atendimento.')
    case 'EMPTY_QUEUE':
      return new NotFoundError('Nao ha senhas aguardando na fila.', 'EMPTY_QUEUE')
    case 'TICKET_NOT_FOUND':
      return new NotFoundError('Senha nao encontrada.')
    case 'TICKET_NOT_AVAILABLE':
      return new ConflictError('A senha nao esta mais disponivel para reserva.', 'TICKET_ALREADY_RESERVED')
    case 'INVALID_TRANSITION':
      return new ConflictError('Transicao de estado nao permitida para o status atual da senha.', 'INVALID_TRANSITION')
    default:
      return new ConflictError('Nao foi possivel concluir a operacao na senha.')
  }
}

/**
 * Servico base de persistencia, fila e reserva segura de senhas (Desenvolvedor 1).
 *
 * Ponto de integracao para o Desenvolvedor 2 (Kastberg):
 * - A definicao de qual tipo priorizar (SP -> SE/SG -> SP -> SE/SG),
 *   horario de expediente (07h-17h), sincronizacao em tempo real e chamadas
 *   por audio devem invocar `reservarProximaSenha`, `reservarSenhaPorId`
 *   e os metodos operacionais abaixo.
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

      return tickets.createTicket({
        tipo: tipoNormalizado,
        status: 'AGUARDANDO',
        ipOrigem,
      })
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

    async consultarFila({ data = null, tipo = null } = {}) {
      let tipoNormalizado = null
      if (tipo) {
        tipoNormalizado = String(tipo).trim().toUpperCase()
        if (!TIPOS_SENHA.includes(tipoNormalizado)) {
          throw new ValidationError('Tipo de senha invalido. Valores aceitos: SP, SG, SE.')
        }
      }

      const [aguardando, contagem, ultimaChamada] = await Promise.all([
        tickets.consultarFila({ dataReferencia: data, tipo: tipoNormalizado }),
        tickets.contarFilaPorTipo({ dataReferencia: data }),
        tickets.buscarUltimaChamada({ dataReferencia: data }),
      ])

      return { aguardando, contagem, ultimaChamada }
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

    async reservarProximaSenha({ guicheId, tiposPrioritarios = null }, actor) {
      const parsedGuicheId = Number(guicheId)
      if (!Number.isInteger(parsedGuicheId) || parsedGuicheId <= 0) {
        throw new ValidationError('guicheId deve ser um inteiro positivo.')
      }

      let tipos = null
      if (tiposPrioritarios !== null && tiposPrioritarios !== undefined) {
        if (!Array.isArray(tiposPrioritarios) || tiposPrioritarios.length === 0) {
          throw new ValidationError('tiposPrioritarios deve ser uma lista nao vazia de tipos.')
        }
        tipos = tiposPrioritarios.map((t) => String(t).trim().toUpperCase())
        if (tipos.some((t) => !TIPOS_SENHA.includes(t))) {
          throw new ValidationError('tiposPrioritarios contem tipo invalido. Aceitos: SP, SG, SE.')
        }
      }

      const result = await tickets.reservarProximaSenha({
        tiposPrioritarios: tipos,
        guicheId: parsedGuicheId,
        atendenteId: actor.id,
        ipOrigem: actor.ipOrigem ?? null,
      })

      if (result.error) {
        throw mapReservaError(result.error)
      }
      return result.senha
    },

    async reservarSenhaPorId(senhaId, { guicheId }, actor) {
      const parsedGuicheId = Number(guicheId)
      if (!Number.isInteger(parsedGuicheId) || parsedGuicheId <= 0) {
        throw new ValidationError('guicheId deve ser um inteiro positivo.')
      }

      const result = await tickets.reservarSenhaPorId({
        senhaId,
        guicheId: parsedGuicheId,
        atendenteId: actor.id,
        ipOrigem: actor.ipOrigem ?? null,
      })

      if (result.error) {
        throw mapReservaError(result.error)
      }
      return result.senha
    },

    async registrarSegundaChamada(senhaId, actor) {
      const result = await tickets.registrarSegundaChamada({
        senhaId,
        atendenteId: actor.id,
        ipOrigem: actor.ipOrigem ?? null,
      })
      if (result.error) throw mapReservaError(result.error)
      return result.senha
    },

    async iniciarAtendimento(senhaId, actor) {
      const result = await tickets.iniciarAtendimento({
        senhaId,
        atendenteId: actor.id,
        ipOrigem: actor.ipOrigem ?? null,
      })
      if (result.error) throw mapReservaError(result.error)
      return result.senha
    },

    async finalizarAtendimento(senhaId, actor) {
      const result = await tickets.finalizarAtendimento({
        senhaId,
        atendenteId: actor.id,
        ipOrigem: actor.ipOrigem ?? null,
      })
      if (result.error) throw mapReservaError(result.error)
      return result.senha
    },

    async registrarNaoCompareceu(senhaId, actor) {
      const result = await tickets.registrarNaoCompareceu({
        senhaId,
        atendenteId: actor.id,
        ipOrigem: actor.ipOrigem ?? null,
      })
      if (result.error) throw mapReservaError(result.error)
      return result.senha
    },

    async descartarSenhasPendentes({ data = null } = {}, actor) {
      return tickets.descartarSenhasPendentes({
        dataReferencia: data || null,
        atendenteId: actor?.id ?? null,
        ipOrigem: actor?.ipOrigem ?? null,
      })
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
        guicheId: updated.guicheId ?? null,
        acao: 'SENHA_STATUS_ATUALIZADO',
        detalhes: { status: updated.status },
        ipOrigem: actor?.ipOrigem ?? null,
      })

      return updated
    },
  }
}

export const ticketService = createTicketService()
