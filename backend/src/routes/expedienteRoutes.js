import { Router } from 'express'
import { PERFIS } from '../constants/domain.js'
import { expedienteController } from '../controllers/expedienteController.js'
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js'

export function createExpedienteRoutes({
  controller = expedienteController,
  auth = { authenticate, authorizeRoles },
} = {}) {
  const router = Router()

  router.get('/', controller.consultar)
  router.post(
    '/encerrar',
    auth.authenticate,
    auth.authorizeRoles(PERFIS.GESTOR),
    controller.encerrar,
  )
  router.post(
    '/reabrir',
    auth.authenticate,
    auth.authorizeRoles(PERFIS.GESTOR),
    controller.reabrir,
  )

  return router
}
