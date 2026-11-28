import { createApp } from './app.js'
import { closePool, testConnection } from './config/database.js'
import { env } from './config/env.js'

const app = createApp()

const server = app.listen(env.port, async () => {
  console.log(`[server] API nassauTickets ouvindo na porta ${env.port} (${env.nodeEnv}).`)
  try {
    await testConnection()
    console.log('[server] Conexao com MySQL validada com sucesso.')
  } catch (error) {
    console.warn(
      `[server] Aviso: MySQL indisponivel no boot (${error.message}). Verifique o .env e o servico MySQL.`,
    )
  }
})

async function shutdown(signal) {
  console.log(`[server] Sinal ${signal} recebido. Encerrando servidor...`)
  server.close(async () => {
    await closePool()
    process.exit(0)
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
