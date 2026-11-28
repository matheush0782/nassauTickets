import { testConnection } from '../config/database.js'

export function createHealthController({ checkDb = testConnection } = {}) {
  return {
    async check(_req, res) {
      let dbConnected = false
      try {
        dbConnected = await checkDb()
      } catch {
        dbConnected = false
      }

      const statusCode = dbConnected ? 200 : 503
      const info = {
        status: dbConnected ? 'ok' : 'degraded',
        servico: 'nassauTickets-api',
        bancoDados: dbConnected ? 'conectado' : 'indisponivel',
        timestamp: new Date().toISOString(),
      }
      res.status(statusCode).json({
        sucesso: dbConnected,
        dados: info,
        ...info,
      })
    },
  }
}

export const healthController = createHealthController()
