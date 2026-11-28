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
  const isAtendenteOuGestor = [
    auth.authenticate,
    auth.authorizeRoles(PERFIS.ATENDENTE, PERFIS.GESTOR),
  ]

  router.get('/fila', ...isAtendenteOuGestor, controller.fila)
  router.post('/reservar-proxima', ...isAtendenteOuGestor, controller.reservarProxima)
  router.post(
    '/descartar-pendentes',
    auth.authenticate,
    auth.authorizeRoles(PERFIS.GESTOR),
    controller.descartarPendentes,
  )

  router.get('/', ...isAtendenteOuGestor, controller.list)
  router.get('/:id', ...isAtendenteOuGestor, controller.getById)
  router.post('/:id/reservar', ...isAtendenteOuGestor, controller.reservarPorId)
  router.post('/:id/chamar-novamente', ...isAtendenteOuGestor, controller.chamarNovamente)
  router.post('/:id/iniciar', ...isAtendenteOuGestor, controller.iniciarAtendimento)
  router.post('/:id/finalizar', ...isAtendenteOuGestor, controller.finalizarAtendimento)
  router.post('/:id/nao-compareceu', ...isAtendenteOuGestor, controller.naoCompareceu)
  router.patch('/:id/status', ...isAtendenteOuGestor, controller.updateStatus)

  return router
}
