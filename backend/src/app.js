import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js'
import { createAuditRoutes } from './routes/auditRoutes.js'
import { createAuthRoutes } from './routes/authRoutes.js'
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
  auditRouter = createAuditRoutes(),
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
  app.use('/api/auditoria', auditRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
