import { Router } from 'express'
import { PERFIS } from '../constants/domain.js'
import { ticketController } from '../controllers/ticketController.js'
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js'

export function createTicketRoutes({
  controller = ticketController,
  auth = { authenticate, authorizeRoles },
} = {}) {
  const router = Router()

  // Rotas publicas (Totem de emissao anonima do AC e Painel publico)
  router.post('/', controller.create)
  router.get('/painel', controller.painel)

  // Rotas protegidas para atendentes (AA) e gestor
  router.get('/', auth.authenticate, auth.authorizeRoles(PERFIS.ATENDENTE, PERFIS.GESTOR), controller.list)
  router.get('/:id', auth.authenticate, auth.authorizeRoles(PERFIS.ATENDENTE, PERFIS.GESTOR), controller.getById)
  router.patch(
    '/:id/status',
    auth.authenticate,
    auth.authorizeRoles(PERFIS.ATENDENTE, PERFIS.GESTOR),
    controller.updateStatus,
  )

  return router
}
