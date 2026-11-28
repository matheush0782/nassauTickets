import { Router } from 'express'
import { healthController } from '../controllers/healthController.js'

export function createHealthRoutes({ controller = healthController } = {}) {
  const router = Router()
  router.get('/', controller.check)
  return router
}
