import { testConnection } from '../config/database.js'
import { sendSuccess } from '../utils/http.js'

export function createHealthController({ checkDb = testConnection } = {}) {
  return {
    async check(_req, res) {
      let dbConnected = false
      try {
        dbConnected = await checkDb()
      } catch {
        dbConnected = false
      }

      const dados = {
        status: dbConnected ? 'ok' : 'degraded',
        servico: 'nassauTickets-api',
        bancoDados: dbConnected ? 'conectado' : 'indisponivel',
        timestamp: new Date().toISOString(),
      }

      if (!dbConnected) {
        return res.status(503).json({
          sucesso: false,
          erro: 'Banco de dados indisponivel.',
          codigo: 'DATABASE_UNAVAILABLE',
          dados,
        })
      }

      return sendSuccess(res, dados)
    },
  }
}

export const healthController = createHealthController()
