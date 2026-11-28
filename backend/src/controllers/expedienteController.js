import { expedienteService } from '../services/expedienteService.js'

function getActor(req) {
  return { id: req.user?.id ?? null, perfil: req.user?.perfil, ipOrigem: req.ip }
}

export function createExpedienteController({ service = expedienteService } = {}) {
  return {
    async consultar(req, res, next) {
      try {
        const dataReferencia = req.query?.data || null
        const expediente = await service.consultarExpediente({ dataReferencia })
        res.status(200).json({
          sucesso: true,
          dados: expediente,
          ...expediente,
        })
      } catch (error) {
        next(error)
      }
    },

    async encerrar(req, res, next) {
      try {
        const result = await service.encerrarExpediente({
          dataReferencia: req.body?.data || null,
          actor: getActor(req),
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

    async reabrir(req, res, next) {
      try {
        const result = await service.reabrirExpediente({
          dataReferencia: req.body?.data || null,
          actor: getActor(req),
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
  }
}

export const expedienteController = createExpedienteController()
