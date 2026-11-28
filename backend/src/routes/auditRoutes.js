import { Router } from 'express'
import { PERFIS } from '../constants/domain.js'
import { auditController } from '../controllers/auditController.js'
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js'

export function createAuditRoutes({
  controller = auditController,
  auth = { authenticate, authorizeRoles },
} = {}) {
  const router = Router()
  router.get('/', auth.authenticate, auth.authorizeRoles(PERFIS.GESTOR), controller.list)
  return router
}
