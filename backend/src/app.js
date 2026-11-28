import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { PERFIS } from './constants/domain.js'
import { ticketController } from './controllers/ticketController.js'
import { authenticate, authorizeRoles } from './middlewares/authMiddleware.js'
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js'
import { createAuditRoutes } from './routes/auditRoutes.js'
import { createAuthRoutes } from './routes/authRoutes.js'
import { createExpedienteRoutes } from './routes/expedienteRoutes.js'
import { createGuicheRoutes } from './routes/guicheRoutes.js'
import { createHealthRoutes } from './routes/healthRoutes.js'
import { createTicketRoutes } from './routes/ticketRoutes.js'
import { createUserRoutes } from './routes/userRoutes.js'

export function createApp({
  healthRouter = createHealthRoutes(),
  authRouter = createAuthRoutes(),
  userRouter = createUserRoutes(),
  guicheRouter = createGuicheRoutes(),
  ticketRouter = createTicketRoutes(),
  expedienteRouter = createExpedienteRoutes(),
  auditRouter = createAuditRoutes(),
  compatTickets = ticketController,
  compatAuth = { authenticate, authorizeRoles },
} = {}) {
  const app = express()

  app.use(helmet())
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '1mb' }))

  app.use('/api/health', healthRouter)
  app.use('/api/auth', authRouter)
  app.use('/api/usuarios', userRouter)
  app.use('/api/guiches', guicheRouter)
  app.use('/api/senhas', ticketRouter)
  app.use('/api/expediente', expedienteRouter)
  app.use('/api/auditoria', auditRouter)

  // Aliases de compatibilidade com o frontend (frontend/src/services/api.js)
  app.get('/api/painel/ultimas-chamadas', compatTickets.painel)
  app.get(
    '/api/fila/resumo',
    compatAuth.authenticate,
    compatAuth.authorizeRoles(PERFIS.ATENDENTE, PERFIS.GESTOR),
    compatTickets.fila,
  )
  app.post(
    '/api/atendimentos/chamar-proxima',
    compatAuth.authenticate,
    compatAuth.authorizeRoles(PERFIS.ATENDENTE, PERFIS.GESTOR),
    compatTickets.reservarProxima,
  )
  app.get(
    '/api/relatorios/senhas',
    compatAuth.authenticate,
    compatAuth.authorizeRoles(PERFIS.GESTOR),
    compatTickets.relatorio,
  )

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
