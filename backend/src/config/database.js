import mysql from 'mysql2/promise'
import { env } from './env.js'

let pool = null

/**
 * Retorna (e cria sob demanda) o pool de conexoes MySQL 8.0.
 */
export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
      waitForConnections: true,
      connectionLimit: env.db.connectionLimit,
      queueLimit: 0,
      timezone: 'Z',
    })
  }
  return pool
}

/**
 * Permite injetar um pool customizado (util em testes automatizados).
 */
export function setPool(customPool) {
  pool = customPool
}

/**
 * Executa uma consulta SQL parametrizada usando o pool.
 */
export async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params)
  return rows
}

/**
 * Executa um callback dentro de uma transacao MySQL (BEGIN / COMMIT / ROLLBACK).
 */
export async function withTransaction(callback) {
  const connection = await getPool().getConnection()
  try {
    await connection.beginTransaction()
    const result = await callback(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

/**
 * Verifica conectividade ativa com o banco MySQL.
 */
export async function testConnection() {
  const [rows] = await getPool().query('SELECT 1 AS ok')
  return rows[0]?.ok === 1
}

/**
 * Fecha o pool de conexoes no desligamento gracioso.
 */
export async function closePool() {
  if (pool) {
    await pool.end()
    pool = null
  }
}
