import { Router } from 'express'
import { PERFIS } from '../constants/domain.js'
import { userController } from '../controllers/userController.js'
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js'

export function createUserRoutes({
  controller = userController,
  auth = { authenticate, authorizeRoles },
} = {}) {
  const router = Router()

  router.use(auth.authenticate, auth.authorizeRoles(PERFIS.GESTOR))

  router.get('/', controller.list)
  router.get('/:id', controller.getById)
  router.post('/', controller.create)
  router.put('/:id', controller.update)
  router.patch('/:id/status', controller.setStatus)

  return router
}
