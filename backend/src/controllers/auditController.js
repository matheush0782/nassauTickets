import { auditRepository } from '../repositories/auditRepository.js'
import { sendSuccess } from '../utils/http.js'

export function createAuditController({ audit = auditRepository } = {}) {
  return {
    async list(req, res, next) {
      try {
        const eventos = await audit.listarEventos({
          limite: req.query?.limite,
          offset: req.query?.offset,
          acao: req.query?.acao || null,
          usuarioId: req.query?.usuarioId || null,
        })
        return sendSuccess(res, { eventos })
      } catch (error) {
        return next(error)
      }
    },
  }
}

export const auditController = createAuditController()
