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
  router.get('/fila', auth.authenticate, auth.authorizeRoles(PERFIS.ATENDENTE, PERFIS.GESTOR), controller.fila)
  router.get('/', auth.authenticate, auth.authorizeRoles(PERFIS.ATENDENTE, PERFIS.GESTOR), controller.list)

  // Reservar proxima senha atomicamente (ponto de integracao com Dev 2)
  router.post(
    '/reservar-proxima',
    auth.authenticate,
    auth.authorizeRoles(PERFIS.ATENDENTE, PERFIS.GESTOR),
    controller.reservarProxima,
  )

  // Descartar senhas pendentes (gestor apenas)
  router.post(
    '/descartar-pendentes',
    auth.authenticate,
    auth.authorizeRoles(PERFIS.GESTOR),
    controller.descartarPendentes,
  )

  // Operacoes sobre senha individual
  router.get('/:id', auth.authenticate, auth.authorizeRoles(PERFIS.ATENDENTE, PERFIS.GESTOR), controller.getById)
  router.post('/:id/reservar', auth.authenticate, auth.authorizeRoles(PERFIS.ATENDENTE, PERFIS.GESTOR), controller.reservarPorId)
  router.post('/:id/chamar-novamente', auth.authenticate, auth.authorizeRoles(PERFIS.ATENDENTE, PERFIS.GESTOR), controller.chamarNovamente)
  router.post('/:id/iniciar', auth.authenticate, auth.authorizeRoles(PERFIS.ATENDENTE, PERFIS.GESTOR), controller.iniciar)
  router.post('/:id/finalizar', auth.authenticate, auth.authorizeRoles(PERFIS.ATENDENTE, PERFIS.GESTOR), controller.finalizar)
  router.post('/:id/nao-compareceu', auth.authenticate, auth.authorizeRoles(PERFIS.ATENDENTE, PERFIS.GESTOR), controller.naoCompareceu)

  // Atualizacao direta de status (persistencia) com validacao da maquina de estados
  router.patch(
    '/:id/status',
    auth.authenticate,
    auth.authorizeRoles(PERFIS.ATENDENTE, PERFIS.GESTOR),
    controller.updateStatus,
  )

  return router
}
