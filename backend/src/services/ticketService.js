import { PERFIS, STATUS_SENHA, TIPOS_SENHA } from '../constants/domain.js'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors/AppError.js'
import { auditRepository } from '../repositories/auditRepository.js'
import { ticketRepository } from '../repositories/ticketRepository.js'

/**
 * Guardiao padrao de transicoes usado apenas quando `domain.podeTransitar`
 * (de `src/domain/estados.mjs` do Dev 2) ainda nao foi injetado.
 * Ao integrar o PR #6, injetar `{ podeTransitar, ordemDeBusca }` diretamente.
 */
const FALLBACK_TRANSICOES = Object.freeze({
  EMITIDA: ['AGUARDANDO'],
  AGUARDANDO: ['CHAMADA', 'DESCARTADA'],
  CHAMADA: ['CHAMADA_NOVAMENTE', 'EM_ATENDIMENTO'],
  CHAMADA_NOVAMENTE: ['EM_ATENDIMENTO', 'NAO_COMPARECEU'],
  EM_ATENDIMENTO: ['ATENDIDA'],
  ATENDIDA: [],
  NAO_COMPARECEU: [],
  DESCARTADA: [],
})

function fallbackPodeTransitar(atual, proximo) {
  return (FALLBACK_TRANSICOES[atual] || []).includes(proximo)
}

/**
 * Servico base de persistencia e consultas de senhas (Desenvolvedor 1).
 *
 * Ponto de integracao com o Desenvolvedor 2 (PR #6):
 * Aceita `domain = { podeTransitar, ordemDeBusca, verificarExpedienteAberto }`
 * para consumir diretamente `estados.mjs`, `prioridade.mjs` e `expediente.mjs`
 * sem duplicar regras de negocio.
 */
export function createTicketService({
  tickets = ticketRepository,
  audit = auditRepository,
  domain = {},
} = {}) {
  const podeTransitar = domain.podeTransitar || fallbackPodeTransitar
  const ordemDeBusca = domain.ordemDeBusca || undefined

  async function assertTicketOwnership(id, actor) {
    if (!actor?.id || actor.perfil === PERFIS.GESTOR) return
    const current = await tickets.findById(id)
    if (!current) {
      throw new NotFoundError('Senha nao encontrada.')
    }
    const ownerId = current.atendenteId ?? current.atendente_id ?? null
    if (ownerId !== null && Number(ownerId) !== Number(actor.id)) {
      throw new ForbiddenError(
        'Apenas o atendente responsavel ou o gestor pode alterar este atendimento.',
      )
    }
  }

  return {
    async emitirSenha({ tipo, ipOrigem = null }) {
      const tipoNormalizado = String(tipo || '').trim().toUpperCase()
      if (!TIPOS_SENHA.includes(tipoNormalizado)) {
        throw new ValidationError('Tipo de senha invalido. Valores aceitos: SP, SG, SE.')
      }

      if (domain.verificarExpedienteAberto) {
        const expStatus = domain.verificarExpedienteAberto()
        const aberto = typeof expStatus === 'boolean' ? expStatus : Boolean(expStatus?.aberto)
        if (!aberto) {
          throw new ConflictError(
            (typeof expStatus === 'object' && expStatus?.motivo) ||
              'Expediente encerrado. Novas emissoes estao bloqueadas.',
            'EXPEDIENTE_ENCERRADO',
          )
        }
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

    async listarPorPeriodo({ periodo = 'diario', referencia }) {
      if (!['diario', 'mensal'].includes(periodo)) {
        throw new ValidationError('Parametro "periodo" deve ser "diario" ou "mensal".')
      }
      if (!referencia) {
        throw new ValidationError('Parametro "referencia" e obrigatorio.')
      }
      if (tickets.listByPeriodo) {
        return tickets.listByPeriodo({ periodo, referencia })
      }
      return tickets.list({ dataReferencia: referencia })
    },

    async buscarSenhaPorId(id) {
      const ticket = await tickets.findById(id)
      if (!ticket) {
        throw new NotFoundError('Senha nao encontrada.')
      }
      return ticket
    },

    async atendimentoAtualDoGuiche(guicheIdOrNumero) {
      if (!tickets.findAtendimentoAtualByGuiche) return null
      return tickets.findAtendimentoAtualByGuiche(guicheIdOrNumero)
    },

    /**
     * Consulta a fila de senhas aguardando atendimento.
     */
    async consultarFila({ tipo = null } = {}) {
      const aguardando = await tickets.consultarFila({ tipo })
      const contagem = await tickets.contarFilaPorTipo()
      const ultimaChamada = await tickets.buscarUltimaChamada()
      return { aguardando, contagem, ultimaChamada }
    },

    async obterPainelChamadas({ limit = 5 } = {}) {
      return tickets.listPainelChamadas({ limit })
    },

    /**
     * Reserva atomicamente a proxima senha da fila para um guiche.
     * A ordem de prioridade e determinada exclusivamente no servidor
     * (via `ordemDeBusca` + `expediente_diario.ultimo_tipo_chamado`),
     * nunca por parametro arbitrario do cliente.
     */
    async reservarProximaSenha({ guicheId, atendenteId, ipOrigem = null }) {
      const guicheNum = Number(guicheId)
      if (!Number.isInteger(guicheNum) || guicheNum <= 0) {
        throw new ValidationError('Parametro "guicheId" (ou "guiche") deve ser um inteiro positivo.')
      }

      const result = await tickets.reservarProximaSenha({
        guicheId: guicheNum,
        atendenteId,
        resolverOrdemDeBusca: ordemDeBusca,
        ipOrigem,
      })

      if (result.error === 'EXPEDIENTE_ENCERRADO') {
        throw new ConflictError(
          'Expediente encerrado. Novas chamadas estao bloqueadas.',
          'EXPEDIENTE_ENCERRADO',
        )
      }
      if (result.error === 'GUICHE_NOT_FOUND') throw new NotFoundError('Guiche nao encontrado.')
      if (result.error === 'GUICHE_INACTIVE') throw new ValidationError('Guiche inativo.')
      if (result.error === 'GUICHE_OCCUPIED_BY_OTHER') {
        throw new ConflictError('Guiche ocupado por outro atendente.')
      }
      if (result.error === 'GUICHE_HAS_ACTIVE_TICKET') {
        throw new ConflictError('Guiche ja possui uma senha em atendimento.')
      }
      if (result.error === 'EMPTY_QUEUE') {
        throw new NotFoundError('Nao ha senhas aguardando na fila.', 'EMPTY_QUEUE')
      }

      await audit.registrarEvento({
        usuarioId: atendenteId,
        senhaId: result.senha.id,
        guicheId: result.senha.guicheId ?? result.senha.guiche_id ?? guicheNum,
        acao: 'SENHA_RESERVADA',
        detalhes: { codigo: result.senha.codigo, tipo: result.senha.tipo },
        ipOrigem,
      })

      return result.senha
    },

    /**
     * Reserva atomicamente uma senha especifica por ID para um guiche.
     */
    async reservarSenhaPorId({ senhaId, guicheId, atendenteId, ipOrigem = null }) {
      const guicheNum = Number(guicheId)
      if (!Number.isInteger(guicheNum) || guicheNum <= 0) {
        throw new ValidationError('Parametro "guicheId" deve ser um inteiro positivo.')
      }

      const result = await tickets.reservarSenhaPorId({
        senhaId,
        guicheId: guicheNum,
        atendenteId,
      })

      if (result.error === 'EXPEDIENTE_ENCERRADO') {
        throw new ConflictError(
          'Expediente encerrado. Novas chamadas estao bloqueadas.',
          'EXPEDIENTE_ENCERRADO',
        )
      }
      if (result.error === 'TICKET_NOT_FOUND') throw new NotFoundError('Senha nao encontrada.')
      if (result.error === 'TICKET_NOT_AVAILABLE') {
        throw new ConflictError('Senha nao esta disponivel para reserva.')
      }
      if (result.error === 'GUICHE_NOT_FOUND') throw new NotFoundError('Guiche nao encontrado.')
      if (result.error === 'GUICHE_INACTIVE') throw new ValidationError('Guiche inativo.')
      if (result.error === 'GUICHE_OCCUPIED_BY_OTHER') {
        throw new ConflictError('Guiche ocupado por outro atendente.')
      }
      if (result.error === 'GUICHE_HAS_ACTIVE_TICKET') {
        throw new ConflictError('Guiche ja possui uma senha em atendimento.')
      }

      await audit.registrarEvento({
        usuarioId: atendenteId,
        senhaId: result.senha.id,
        guicheId: result.senha.guicheId ?? result.senha.guiche_id ?? guicheNum,
        acao: 'SENHA_RESERVADA',
        detalhes: { codigo: result.senha.codigo, tipo: result.senha.tipo },
        ipOrigem,
      })

      return result.senha
    },

    /**
     * Registra segunda chamada (CHAMADA -> CHAMADA_NOVAMENTE).
     */
    async registrarSegundaChamada({ senhaId, atendenteId, perfil = null, ipOrigem = null }) {
      await assertTicketOwnership(senhaId, { id: atendenteId, perfil })
      const result = await tickets.registrarSegundaChamada({ senhaId, atendenteId })

      if (result.error === 'TICKET_NOT_FOUND') throw new NotFoundError('Senha nao encontrada.')
      if (result.error === 'INVALID_TRANSITION') {
        throw new ConflictError(
          'Transicao de estado invalida: a senha nao esta em CHAMADA.',
          'INVALID_TRANSITION',
        )
      }

      await audit.registrarEvento({
        usuarioId: atendenteId,
        senhaId: result.senha.id,
        guicheId: result.senha.guicheId ?? result.senha.guiche_id,
        acao: 'SENHA_CHAMADA_NOVAMENTE',
        detalhes: { codigo: result.senha.codigo },
        ipOrigem,
      })

      return result.senha
    },

    /**
     * Inicia atendimento (CHAMADA/CHAMADA_NOVAMENTE -> EM_ATENDIMENTO).
     */
    async iniciarAtendimento({ senhaId, atendenteId, perfil = null, ipOrigem = null }) {
      await assertTicketOwnership(senhaId, { id: atendenteId, perfil })
      const result = await tickets.iniciarAtendimento({ senhaId, atendenteId })

      if (result.error === 'TICKET_NOT_FOUND') throw new NotFoundError('Senha nao encontrada.')
      if (result.error === 'INVALID_TRANSITION') {
        throw new ConflictError(
          'Transicao de estado invalida: a senha nao esta em CHAMADA ou CHAMADA_NOVAMENTE.',
          'INVALID_TRANSITION',
        )
      }

      await audit.registrarEvento({
        usuarioId: atendenteId,
        senhaId: result.senha.id,
        guicheId: result.senha.guicheId ?? result.senha.guiche_id,
        acao: 'SENHA_ATENDIMENTO_INICIADO',
        detalhes: { codigo: result.senha.codigo },
        ipOrigem,
      })

      return result.senha
    },

    /**
     * Finaliza atendimento (EM_ATENDIMENTO -> ATENDIDA).
     */
    async finalizarAtendimento({ senhaId, atendenteId, perfil = null, ipOrigem = null }) {
      await assertTicketOwnership(senhaId, { id: atendenteId, perfil })
      const result = await tickets.finalizarAtendimento({ senhaId, atendenteId })

      if (result.error === 'TICKET_NOT_FOUND') throw new NotFoundError('Senha nao encontrada.')
      if (result.error === 'INVALID_TRANSITION') {
        throw new ConflictError(
          'Transicao de estado invalida: a senha nao esta EM_ATENDIMENTO.',
          'INVALID_TRANSITION',
        )
      }

      await audit.registrarEvento({
        usuarioId: atendenteId,
        senhaId: result.senha.id,
        guicheId: result.senha.guicheId ?? result.senha.guiche_id,
        acao: 'SENHA_ATENDIMENTO_FINALIZADO',
        detalhes: {
          codigo: result.senha.codigo,
          tempoSegundos:
            result.senha.tempoAtendimentoSegundos ?? result.senha.tempo_atendimento_segundos,
        },
        ipOrigem,
      })

      return result.senha
    },

    /**
     * Registra nao comparecimento (CHAMADA_NOVAMENTE -> NAO_COMPARECEU).
     */
    async registrarNaoCompareceu({ senhaId, atendenteId, perfil = null, ipOrigem = null }) {
      await assertTicketOwnership(senhaId, { id: atendenteId, perfil })
      const result = await tickets.registrarNaoCompareceu({ senhaId, atendenteId })

      if (result.error === 'TICKET_NOT_FOUND') throw new NotFoundError('Senha nao encontrada.')
      if (result.error === 'INVALID_TRANSITION') {
        throw new ConflictError(
          'Transicao de estado invalida: a senha nao esta em CHAMADA_NOVAMENTE.',
          'INVALID_TRANSITION',
        )
      }

      await audit.registrarEvento({
        usuarioId: atendenteId,
        senhaId: result.senha.id,
        guicheId: result.senha.guicheId ?? result.senha.guiche_id,
        acao: 'SENHA_NAO_COMPARECEU',
        detalhes: { codigo: result.senha.codigo },
        ipOrigem,
      })

      return result.senha
    },

    /**
     * Descarta todas as senhas pendentes do dia (encerramento de expediente).
     */
    async descartarSenhasPendentes({ data = null, atendenteId = null, ipOrigem = null } = {}) {
      const result = await tickets.descartarSenhasPendentes({
        dataReferencia: data,
        atendenteId,
      })

      await audit.registrarEvento({
        usuarioId: atendenteId,
        acao: 'SENHAS_DESCARTADAS',
        detalhes: { dataReferencia: result.dataReferencia, quantidade: result.descartadas },
        ipOrigem,
      })

      return result
    },

    /**
     * Atualizacao direta de status com validacao estrita da maquina de estados.
     * Utiliza `domain.podeTransitar` quando integrado ao Dev 2.
     */
    async atualizarStatusPersistencia(id, payload, actor) {
      const ticket = await this.buscarSenhaPorId(id)
      await assertTicketOwnership(id, actor)
      const novoStatus = String(payload.status || '').trim().toUpperCase()

      if (!STATUS_SENHA.includes(novoStatus)) {
        throw new ValidationError('Status de senha invalido.')
      }

      if (!podeTransitar(ticket.status, novoStatus)) {
        throw new ConflictError(
          `Transicao de estado invalida: ${ticket.status} -> ${novoStatus}.`,
          'INVALID_TRANSITION',
        )
      }

      if (novoStatus === 'CHAMADA' && !payload.guicheId && !ticket.guiche_id) {
        throw new ValidationError('Parametro "guicheId" e obrigatorio para chamar uma senha.')
      }

      const fields = { status: novoStatus }
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
        guicheId: updated.guicheId ?? updated.guiche_id ?? null,
        acao: 'SENHA_STATUS_ATUALIZADO',
        detalhes: { statusAnterior: ticket.status, status: updated.status },
        ipOrigem: actor?.ipOrigem ?? null,
      })

      return updated
    },
  }
}

export const ticketService = createTicketService()
