import { Router } from 'express'
import { PERFIS } from '../constants/domain.js'
import { guicheController } from '../controllers/guicheController.js'
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js'

export function createGuicheRoutes({
  controller = guicheController,
  auth = { authenticate, authorizeRoles },
} = {}) {
  const router = Router()

  router.use(auth.authenticate)

  router.get('/', auth.authorizeRoles(PERFIS.ATENDENTE, PERFIS.GESTOR), controller.list)
  router.post('/', auth.authorizeRoles(PERFIS.GESTOR), controller.create)
  router.put('/:id', auth.authorizeRoles(PERFIS.GESTOR), controller.update)
  router.post(
    '/:id/ocupar',
    auth.authorizeRoles(PERFIS.ATENDENTE, PERFIS.GESTOR),
    controller.ocupar,
  )
  router.post(
    '/:id/liberar',
    auth.authorizeRoles(PERFIS.ATENDENTE, PERFIS.GESTOR),
    controller.liberar,
  )

  return router
}
