import { query, withTransaction } from '../config/database.js'

const GUICHE_SELECT = `
  SELECT g.id, g.numero, g.descricao, g.ativo, g.atendente_atual_id,
         u.nome AS atendente_nome, u.login AS atendente_login,
         g.criado_em, g.atualizado_em
  FROM guiches g
  LEFT JOIN usuarios u ON u.id = g.atendente_atual_id
`

export const guicheRepository = {
  async listAll({ apenasAtivos = false } = {}) {
    const where = apenasAtivos ? 'WHERE g.ativo = 1' : ''
    return query(`${GUICHE_SELECT} ${where} ORDER BY g.numero ASC`)
  },

  async findById(id) {
    const rows = await query(`${GUICHE_SELECT} WHERE g.id = ? LIMIT 1`, [id])
    return rows[0] || null
  },

  async findByNumero(numero) {
    const rows = await query(`${GUICHE_SELECT} WHERE g.numero = ? LIMIT 1`, [numero])
    return rows[0] || null
  },

  async create({ numero, descricao = null, ativo = true }) {
    const result = await query(
      `INSERT INTO guiches (numero, descricao, ativo)
       VALUES (?, ?, ?)`,
      [numero, descricao, ativo ? 1 : 0],
    )
    return this.findById(result.insertId)
  },

  async update(id, { numero, descricao, ativo }) {
    const updates = []
    const params = []

    if (numero !== undefined) {
      updates.push('numero = ?')
      params.push(numero)
    }
    if (descricao !== undefined) {
      updates.push('descricao = ?')
      params.push(descricao)
    }
    if (ativo !== undefined) {
      updates.push('ativo = ?')
      params.push(ativo ? 1 : 0)
    }

    if (updates.length === 0) {
      return this.findById(id)
    }

    params.push(id)
    await query(`UPDATE guiches SET ${updates.join(', ')} WHERE id = ?`, params)
    return this.findById(id)
  },

  async assignAtendente(guicheId, usuarioId) {
    return withTransaction(async (connection) => {
      const [rows] = await connection.execute(
        'SELECT id, ativo, atendente_atual_id FROM guiches WHERE id = ? FOR UPDATE',
        [guicheId],
      )
      const guiche = rows[0]
      if (!guiche) {
        return { error: 'NOT_FOUND' }
      }
      if (!guiche.ativo) {
        return { error: 'INACTIVE' }
      }
      if (guiche.atendente_atual_id && guiche.atendente_atual_id !== usuarioId) {
        return { error: 'OCCUPIED' }
      }

      // Libera eventual guiche anterior ocupado pelo mesmo atendente
      await connection.execute(
        'UPDATE guiches SET atendente_atual_id = NULL WHERE atendente_atual_id = ? AND id <> ?',
        [usuarioId, guicheId],
      )
      await connection.execute(
        'UPDATE guiches SET atendente_atual_id = ? WHERE id = ?',
        [usuarioId, guicheId],
      )
      return { error: null }
    }).then(async (res) => {
      if (res.error) return res
      return { error: null, guiche: await this.findById(guicheId) }
    })
  },

  async releaseAtendente(guicheId, usuarioId, { force = false } = {}) {
    return withTransaction(async (connection) => {
      const [rows] = await connection.execute(
        'SELECT id, atendente_atual_id FROM guiches WHERE id = ? FOR UPDATE',
        [guicheId],
      )
      const guiche = rows[0]
      if (!guiche) {
        return { error: 'NOT_FOUND' }
      }
      if (
        !force &&
        guiche.atendente_atual_id !== null &&
        guiche.atendente_atual_id !== usuarioId
      ) {
        return { error: 'NOT_OWNER' }
      }

      await connection.execute(
        'UPDATE guiches SET atendente_atual_id = NULL WHERE id = ?',
        [guicheId],
      )
      return { error: null }
    }).then(async (res) => {
      if (res.error) return res
      return { error: null, guiche: await this.findById(guicheId) }
    })
  },
}
