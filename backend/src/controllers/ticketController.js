import { ticketService } from '../services/ticketService.js'
import { mapTicket } from '../utils/mappers.js'

function getActor(req) {
  return { id: req.user?.id ?? null, perfil: req.user?.perfil, ipOrigem: req.ip }
}

export function createTicketController({ service = ticketService } = {}) {
  return {
    /**
     * POST /api/senhas — emissao anonima no totem (AC).
     */
    async create(req, res, next) {
      try {
        const senha = await service.emitirSenha({
          tipo: req.body?.tipo,
          ipOrigem: req.ip,
        })
        const mapped = mapTicket(senha)
        res.status(201).json({ sucesso: true, dados: { senha: mapped }, senha: mapped })
      } catch (error) {
        next(error)
      }
    },

    /**
     * GET /api/senhas — lista senhas com filtros (autenticado).
     */
    async list(req, res, next) {
      try {
        const senhas = await service.listarSenhas(req.query || {})
        const mapped = senhas.map(mapTicket)
        res.status(200).json({ sucesso: true, dados: { senhas: mapped }, senhas: mapped })
      } catch (error) {
        next(error)
      }
    },

    /**
     * GET /api/senhas/painel — painel de chamadas (publico).
     */
    async painel(req, res, next) {
      try {
        const limit = req.query?.limit ?? req.query?.limite
        const chamadas = await service.obterPainelChamadas({ limit: limit ? Number(limit) : 5 })
        const mapped = chamadas.map(mapTicket)
        res.status(200).json({ sucesso: true, dados: { chamadas: mapped }, chamadas: mapped })
      } catch (error) {
        next(error)
      }
    },

    /**
     * GET /api/relatorios/senhas — relatorio por periodo (gestor).
     */
    async relatorio(req, res, next) {
      try {
        const senhas = await service.listarPorPeriodo({
          periodo: req.query?.periodo || 'diario',
          referencia: req.query?.referencia || null,
        })
        const mapped = senhas.map(mapTicket)
        res.status(200).json({ sucesso: true, dados: { senhas: mapped }, senhas: mapped })
      } catch (error) {
        next(error)
      }
    },

    /**
     * GET /api/senhas/fila — resumo da fila (autenticado).
     */
    async fila(req, res, next) {
      try {
        const tipo = req.query?.tipo || null
        const result = await service.consultarFila({ tipo })
        const aguardando = result.aguardando.map(mapTicket)
        const ultimaChamada = result.ultimaChamada ? mapTicket(result.ultimaChamada) : null
        res.status(200).json({
          sucesso: true,
          dados: {
            aguardando,
            contagem: result.contagem,
            ultimaChamada,
            ...result.contagem,
          },
          aguardando,
          contagem: result.contagem,
          ultimaChamada,
          ...result.contagem,
        })
      } catch (error) {
        next(error)
      }
    },

    /**
     * GET /api/senhas/:id — detalhes de uma senha (autenticado).
     */
    async getById(req, res, next) {
      try {
        const senha = await service.buscarSenhaPorId(Number(req.params.id))
        const mapped = mapTicket(senha)
        res.status(200).json({ sucesso: true, dados: { senha: mapped }, senha: mapped })
      } catch (error) {
        next(error)
      }
    },

    /**
     * POST /api/senhas/reservar-proxima — reserva atomica (autenticado).
     * A prioridade e determinada exclusivamente no servidor.
     */
    async reservarProxima(req, res, next) {
      try {
        const actor = getActor(req)
        const senha = await service.reservarProximaSenha({
          guicheId: req.body?.guicheId ?? req.body?.guiche,
          atendenteId: actor.id,
          ipOrigem: actor.ipOrigem,
        })
        const mapped = mapTicket(senha)
        res.status(200).json({ sucesso: true, dados: { senha: mapped }, senha: mapped })
      } catch (error) {
        next(error)
      }
    },

    /**
     * POST /api/senhas/:id/reservar — reserva atomica de senha especifica (autenticado).
     */
    async reservarPorId(req, res, next) {
      try {
        const actor = getActor(req)
        const senha = await service.reservarSenhaPorId({
          senhaId: Number(req.params.id),
          guicheId: req.body?.guicheId,
          atendenteId: actor.id,
          ipOrigem: actor.ipOrigem,
        })
        const mapped = mapTicket(senha)
        res.status(200).json({ sucesso: true, dados: { senha: mapped }, senha: mapped })
      } catch (error) {
        next(error)
      }
    },

    /**
     * POST /api/senhas/:id/chamar-novamente — segunda chamada (autenticado).
     */
    async chamarNovamente(req, res, next) {
      try {
        const actor = getActor(req)
        const senha = await service.registrarSegundaChamada({
          senhaId: Number(req.params.id),
          atendenteId: actor.id,
          perfil: actor.perfil,
          ipOrigem: actor.ipOrigem,
        })
        const mapped = mapTicket(senha)
        res.status(200).json({ sucesso: true, dados: { senha: mapped }, senha: mapped })
      } catch (error) {
        next(error)
      }
    },

    /**
     * POST /api/senhas/:id/iniciar — inicia atendimento (autenticado).
     */
    async iniciar(req, res, next) {
      try {
        const actor = getActor(req)
        const senha = await service.iniciarAtendimento({
          senhaId: Number(req.params.id),
          atendenteId: actor.id,
          perfil: actor.perfil,
          ipOrigem: actor.ipOrigem,
        })
        const mapped = mapTicket(senha)
        res.status(200).json({ sucesso: true, dados: { senha: mapped }, senha: mapped })
      } catch (error) {
        next(error)
      }
    },

    /**
     * POST /api/senhas/:id/finalizar — finaliza atendimento (autenticado).
     */
    async finalizar(req, res, next) {
      try {
        const actor = getActor(req)
        const senha = await service.finalizarAtendimento({
          senhaId: Number(req.params.id),
          atendenteId: actor.id,
          perfil: actor.perfil,
          ipOrigem: actor.ipOrigem,
        })
        const mapped = mapTicket(senha)
        res.status(200).json({ sucesso: true, dados: { senha: mapped }, senha: mapped })
      } catch (error) {
        next(error)
      }
    },

    /**
     * POST /api/senhas/:id/nao-compareceu — registra nao comparecimento (autenticado).
     */
    async naoCompareceu(req, res, next) {
      try {
        const actor = getActor(req)
        const senha = await service.registrarNaoCompareceu({
          senhaId: Number(req.params.id),
          atendenteId: actor.id,
          perfil: actor.perfil,
          ipOrigem: actor.ipOrigem,
        })
        const mapped = mapTicket(senha)
        res.status(200).json({ sucesso: true, dados: { senha: mapped }, senha: mapped })
      } catch (error) {
        next(error)
      }
    },

    /**
     * POST /api/senhas/descartar-pendentes — gestor descarta senhas na fila (autenticado).
     */
    async descartarPendentes(req, res, next) {
      try {
        const actor = getActor(req)
        const result = await service.descartarSenhasPendentes({
          data: req.body?.data || null,
          atendenteId: actor.id,
          ipOrigem: actor.ipOrigem,
        })
        res.status(200).json({
          sucesso: true,
          dados: result,
          ...result,
        })
      } catch (error) {
        next(error)
      }
    },

    /**
     * PATCH /api/senhas/:id/status — atualizacao direta com validacao de maquina de estados.
     */
    async updateStatus(req, res, next) {
      try {
        const senha = await service.atualizarStatusPersistencia(
          Number(req.params.id),
          req.body || {},
          getActor(req),
        )
        const mapped = mapTicket(senha)
        res.status(200).json({ sucesso: true, dados: { senha: mapped }, senha: mapped })
      } catch (error) {
        next(error)
      }
    },
  }
}

export const ticketController = createTicketController()
