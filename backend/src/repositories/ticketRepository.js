import { query, withTransaction } from '../config/database.js'

const SENHA_SELECT = `
  SELECT s.id, s.codigo, s.tipo, s.data_referencia, s.sequencial, s.status,
         s.guiche_id, g.numero AS guiche_numero,
         s.atendente_id, u.nome AS atendente_nome, u.login AS atendente_login,
         s.emitida_em, s.primeira_chamada_em, s.segunda_chamada_em,
         s.inicio_atendimento_em, s.fim_atendimento_em,
         s.tempo_atendimento_segundos, s.atualizado_em
  FROM senhas s
  LEFT JOIN guiches g ON g.id = s.guiche_id
  LEFT JOIN usuarios u ON u.id = s.atendente_id
`

/**
 * Formata uma data local YYYY-MM-DD e gera codigo no padrao YYMMDD-PPSQ.
 */
export function formatarDataReferencia(date = new Date()) {
  const ano = String(date.getFullYear())
  const mes = String(date.getMonth() + 1).padStart(2, '0')
  const dia = String(date.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export function formatarCodigoSenha(dataReferencia, tipo, sequencial) {
  const [ano, mes, dia] = dataReferencia.split('-')
  const yy = ano.slice(-2)
  const seq = String(sequencial).padStart(3, '0')
  return `${yy}${mes}${dia}-${tipo}${seq}`
}

export const ticketRepository = {
  async findById(id) {
    const rows = await query(`${SENHA_SELECT} WHERE s.id = ? LIMIT 1`, [id])
    return rows[0] || null
  },

  async findByCodigo(codigo) {
    const rows = await query(`${SENHA_SELECT} WHERE s.codigo = ? LIMIT 1`, [codigo])
    return rows[0] || null
  },

  async createTicket({ tipo, status = 'AGUARDANDO', dataReferencia = null }) {
    const refDate = dataReferencia || formatarDataReferencia()

    const insertedId = await withTransaction(async (connection) => {
      const [rows] = await connection.execute(
        `SELECT COALESCE(MAX(sequencial), 0) AS ultimo
         FROM senhas
         WHERE data_referencia = ? AND tipo = ?
         FOR UPDATE`,
        [refDate, tipo],
      )

      const sequencial = Number(rows[0]?.ultimo || 0) + 1
      const codigo = formatarCodigoSenha(refDate, tipo, sequencial)

      const [result] = await connection.execute(
        `INSERT INTO senhas (codigo, tipo, data_referencia, sequencial, status)
         VALUES (?, ?, ?, ?, ?)`,
        [codigo, tipo, refDate, sequencial, status],
      )
      return result.insertId
    })

    return this.findById(insertedId)
  },

  async list({
    dataReferencia = null,
    tipo = null,
    status = null,
    limit = 100,
    offset = 0,
  } = {}) {
    const conditions = []
    const params = []

    if (dataReferencia) {
      conditions.push('s.data_referencia = ?')
      params.push(dataReferencia)
    }
    if (tipo) {
      conditions.push('s.tipo = ?')
      params.push(tipo)
    }
    if (status) {
      conditions.push('s.status = ?')
      params.push(status)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500)
    const safeOffset = Math.max(Number(offset) || 0, 0)

    return query(
      `${SENHA_SELECT}
       ${where}
       ORDER BY s.emitida_em ASC, s.id ASC
       LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      params,
    )
  },

  async listPainelChamadas({ limit = 5, dataReferencia = null } = {}) {
    const refDate = dataReferencia || formatarDataReferencia()
    const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 20)

    return query(
      `${SENHA_SELECT}
       WHERE s.data_referencia = ?
         AND s.primeira_chamada_em IS NOT NULL
         AND s.status IN ('CHAMADA', 'CHAMADA_NOVAMENTE', 'EM_ATENDIMENTO', 'ATENDIDA', 'NAO_COMPARECEU')
       ORDER BY COALESCE(s.segunda_chamada_em, s.primeira_chamada_em) DESC, s.id DESC
       LIMIT ${safeLimit}`,
      [refDate],
    )
  },

  async updateById(id, fields) {
    const allowedMap = {
      status: 'status',
      guicheId: 'guiche_id',
      atendenteId: 'atendente_id',
      primeiraChamadaEm: 'primeira_chamada_em',
      segundaChamadaEm: 'segunda_chamada_em',
      inicioAtendimentoEm: 'inicio_atendimento_em',
      fimAtendimentoEm: 'fim_atendimento_em',
      tempoAtendimentoSegundos: 'tempo_atendimento_segundos',
    }

    const updates = []
    const params = []

    for (const [key, column] of Object.entries(allowedMap)) {
      if (fields[key] !== undefined) {
        updates.push(`${column} = ?`)
        params.push(fields[key])
      }
    }

    if (updates.length === 0) {
      return this.findById(id)
    }

    params.push(id)
    await query(`UPDATE senhas SET ${updates.join(', ')} WHERE id = ?`, params)
    return this.findById(id)
  },
}
