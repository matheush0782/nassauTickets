import { query } from '../config/database.js'
import { PERFIS } from '../constants/domain.js'
import { mapUser } from '../utils/mappers.js'

const USER_PUBLIC_FIELDS =
  'id, nome, login, email, perfil, ativo, criado_em, atualizado_em'

export const userRepository = {
  async findAuthByLogin(login) {
    const rows = await query(
      `SELECT id, nome, login, email, senha_hash, perfil, ativo, criado_em, atualizado_em
       FROM usuarios
       WHERE login = ?
       LIMIT 1`,
      [login],
    )
    return rows[0] || null
  },

  async findByLogin(login) {
    const rows = await query(
      `SELECT ${USER_PUBLIC_FIELDS}
       FROM usuarios
       WHERE login = ?
       LIMIT 1`,
      [login],
    )
    return mapUser(rows[0])
  },

  async findById(id) {
    const rows = await query(
      `SELECT ${USER_PUBLIC_FIELDS}
       FROM usuarios
       WHERE id = ?
       LIMIT 1`,
      [id],
    )
    return mapUser(rows[0])
  },

  async countActiveGestores(excludeUserId = null) {
    const params = [PERFIS.GESTOR]
    let sql = 'SELECT COUNT(*) AS total FROM usuarios WHERE perfil = ? AND ativo = 1'
    if (excludeUserId !== null) {
      sql += ' AND id <> ?'
      params.push(excludeUserId)
    }
    const rows = await query(sql, params)
    return Number(rows[0]?.total || 0)
  },

  async listAll({ perfil = null, ativo = null } = {}) {
    const conditions = []
    const params = []

    if (perfil) {
      conditions.push('perfil = ?')
      params.push(perfil)
    }
    if (ativo !== null && ativo !== undefined) {
      conditions.push('ativo = ?')
      params.push(ativo ? 1 : 0)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const rows = await query(
      `SELECT ${USER_PUBLIC_FIELDS}
       FROM usuarios
       ${where}
       ORDER BY id ASC`,
      params,
    )
    return rows.map(mapUser)
  },

  async create({ nome, login, email = null, senhaHash, perfil = PERFIS.ATENDENTE }) {
    const result = await query(
      `INSERT INTO usuarios (nome, login, email, senha_hash, perfil, ativo)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [nome, login, email, senhaHash, perfil],
    )
    return this.findById(result.insertId)
  },

  async update(id, { nome, email, perfil, senhaHash = null }) {
    const updates = []
    const params = []

    if (nome !== undefined) {
      updates.push('nome = ?')
      params.push(nome)
    }
    if (email !== undefined) {
      updates.push('email = ?')
      params.push(email)
    }
    if (perfil !== undefined) {
      updates.push('perfil = ?')
      params.push(perfil)
    }
    if (senhaHash) {
      updates.push('senha_hash = ?')
      params.push(senhaHash)
    }

    if (updates.length === 0) {
      return this.findById(id)
    }

    params.push(id)
    await query(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`, params)
    return this.findById(id)
  },

  async setActive(id, ativo) {
    await query('UPDATE usuarios SET ativo = ? WHERE id = ?', [ativo ? 1 : 0, id])
    return this.findById(id)
  },
}
