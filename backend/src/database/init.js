import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { env } from '../config/env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.resolve(__dirname, '../../database/schema.sql')

async function initDatabase() {
  const sql = await fs.readFile(schemaPath, 'utf-8')
  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true,
  })

  try {
    await connection.query(sql)
    console.log(`[db:init] Schema aplicado com sucesso no banco "${env.db.database}".`)
  } finally {
    await connection.end()
  }
}

initDatabase().catch((error) => {
  console.error('[db:init] Erro ao inicializar banco MySQL:', error.message)
  process.exitCode = 1
})
