import { auditRepository } from '../repositories/auditRepository.js'

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
        res.status(200).json({ eventos })
      } catch (error) {
        next(error)
      }
    },
  }
}

export const auditController = createAuditController()
