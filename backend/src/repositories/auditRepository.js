import { query } from '../config/database.js'

export const auditRepository = {
  async registrarEvento({
    usuarioId = null,
    senhaId = null,
    guicheId = null,
    acao,
    detalhes = null,
    ipOrigem = null,
  }) {
    const detalhesJson = detalhes ? JSON.stringify(detalhes) : null
    const result = await query(
      `INSERT INTO auditoria_eventos (usuario_id, senha_id, guiche_id, acao, detalhes, ip_origem)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [usuarioId, senhaId, guicheId, acao, detalhesJson, ipOrigem],
    )
    return result.insertId
  },

  async listarEventos({ limite = 50, offset = 0, acao = null, usuarioId = null } = {}) {
    const conditions = []
    const params = []

    if (acao) {
      conditions.push('a.acao = ?')
      params.push(acao)
    }
    if (usuarioId) {
      conditions.push('a.usuario_id = ?')
      params.push(Number(usuarioId))
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const safeLimit = Math.min(Math.max(Number(limite) || 50, 1), 200)
    const safeOffset = Math.max(Number(offset) || 0, 0)

    return query(
      `SELECT a.id, a.usuario_id, u.login AS usuario_login, u.nome AS usuario_nome,
              a.senha_id, s.codigo AS senha_codigo, a.guiche_id, g.numero AS guiche_numero,
              a.acao, a.detalhes, a.ip_origem, a.criado_em
       FROM auditoria_eventos a
       LEFT JOIN usuarios u ON u.id = a.usuario_id
       LEFT JOIN senhas s ON s.id = a.senha_id
       LEFT JOIN guiches g ON g.id = a.guiche_id
       ${where}
       ORDER BY a.criado_em DESC, a.id DESC
       LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      params,
    )
  },
}
