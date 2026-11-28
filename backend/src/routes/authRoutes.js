import { Router } from 'express'
import { authController } from '../controllers/authController.js'
import { authenticate } from '../middlewares/authMiddleware.js'

export function createAuthRoutes({
  controller = authController,
  auth = { authenticate },
} = {}) {
  const router = Router()
  router.post('/login', controller.login)
  router.get('/me', auth.authenticate, controller.me)
  return router
}
