import { query, withTransaction } from '../config/database.js'
import { auditRepository } from './auditRepository.js'
import { mapTicket } from '../utils/mappers.js'

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

async function lockGuicheParaReserva(connection, { guicheId, atendenteId, dataReferencia }) {
  const [guicheRows] = await connection.execute(
    'SELECT id, numero, ativo, atendente_atual_id FROM guiches WHERE id = ? FOR UPDATE',
    [guicheId],
  )
  const guiche = guicheRows[0]
  if (!guiche) return { error: 'GUICHE_NOT_FOUND' }
  if (!guiche.ativo) return { error: 'GUICHE_INACTIVE' }
  if (guiche.atendente_atual_id && guiche.atendente_atual_id !== atendenteId) {
    return { error: 'GUICHE_OCCUPIED_BY_OTHER' }
  }

  const [ativos] = await connection.execute(
    `SELECT id FROM senhas
     WHERE guiche_id = ? AND data_referencia = ?
       AND status IN ('CHAMADA', 'CHAMADA_NOVAMENTE', 'EM_ATENDIMENTO')
     LIMIT 1
     FOR UPDATE`,
    [guicheId, dataReferencia],
  )
  if (ativos.length > 0) {
    return { error: 'GUICHE_HAS_ACTIVE_TICKET' }
  }

  return { error: null, guiche }
}

export const ticketRepository = {
  async findById(id) {
    const rows = await query(`${SENHA_SELECT} WHERE s.id = ? LIMIT 1`, [id])
    return mapTicket(rows[0])
  },

  async findByCodigo(codigo) {
    const rows = await query(`${SENHA_SELECT} WHERE s.codigo = ? LIMIT 1`, [codigo])
    return mapTicket(rows[0])
  },

  async createTicket({ tipo, status = 'AGUARDANDO', dataReferencia = null, ipOrigem = null }) {
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

      await auditRepository.registrarEvento(
        {
          senhaId: result.insertId,
          acao: 'SENHA_EMITIDA',
          detalhes: { codigo, tipo, dataReferencia: refDate },
          ipOrigem,
        },
        connection,
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

    const rows = await query(
      `${SENHA_SELECT}
       ${where}
       ORDER BY s.emitida_em ASC, s.id ASC
       LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      params,
    )
    return rows.map(mapTicket)
  },

  async consultarFila({ dataReferencia = null, tipo = null } = {}) {
    const refDate = dataReferencia || formatarDataReferencia()
    const params = [refDate]
    let tipoCondition = ''
    if (tipo) {
      tipoCondition = 'AND s.tipo = ?'
      params.push(tipo)
    }

    const rows = await query(
      `${SENHA_SELECT}
       WHERE s.data_referencia = ?
         AND s.status = 'AGUARDANDO'
         ${tipoCondition}
       ORDER BY s.emitida_em ASC, s.id ASC`,
      params,
    )
    return rows.map(mapTicket)
  },

  async contarFilaPorTipo({ dataReferencia = null } = {}) {
    const refDate = dataReferencia || formatarDataReferencia()
    const rows = await query(
      `SELECT tipo, COUNT(*) AS total
       FROM senhas
       WHERE data_referencia = ? AND status = 'AGUARDANDO'
       GROUP BY tipo`,
      [refDate],
    )

    const contagem = { SP: 0, SG: 0, SE: 0, total: 0 }
    for (const row of rows) {
      const qty = Number(row.total || 0)
      if (row.tipo in contagem) {
        contagem[row.tipo] = qty
      }
      contagem.total += qty
    }
    return contagem
  },

  async buscarUltimaChamada({ dataReferencia = null } = {}) {
    const refDate = dataReferencia || formatarDataReferencia()
    const rows = await query(
      `${SENHA_SELECT}
       WHERE s.data_referencia = ?
         AND s.primeira_chamada_em IS NOT NULL
       ORDER BY COALESCE(s.segunda_chamada_em, s.primeira_chamada_em) DESC, s.id DESC
       LIMIT 1`,
      [refDate],
    )
    return mapTicket(rows[0])
  },

  async listPainelChamadas({ limit = 5, dataReferencia = null } = {}) {
    const refDate = dataReferencia || formatarDataReferencia()
    const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 20)

    const rows = await query(
      `${SENHA_SELECT}
       WHERE s.data_referencia = ?
         AND s.primeira_chamada_em IS NOT NULL
         AND s.status IN ('CHAMADA', 'CHAMADA_NOVAMENTE', 'EM_ATENDIMENTO', 'ATENDIDA', 'NAO_COMPARECEU')
       ORDER BY COALESCE(s.segunda_chamada_em, s.primeira_chamada_em) DESC, s.id DESC
       LIMIT ${safeLimit}`,
      [refDate],
    )
    return rows.map(mapTicket)
  },

  /**
   * Reserva atomicamente a proxima senha da fila para um guiche usando
   * SELECT ... FOR UPDATE SKIP LOCKED (evita colisao em chamadas simultaneas).
   */
  async reservarProximaSenha({
    tiposPrioritarios = null,
    guicheId,
    atendenteId,
    dataReferencia = null,
    ipOrigem = null,
  }) {
    const refDate = dataReferencia || formatarDataReferencia()

    const outcome = await withTransaction(async (connection) => {
      const lockGuiche = await lockGuicheParaReserva(connection, {
        guicheId,
        atendenteId,
        dataReferencia: refDate,
      })
      if (lockGuiche.error) return lockGuiche

      let targetRow = null
      if (Array.isArray(tiposPrioritarios) && tiposPrioritarios.length > 0) {
        for (const tipo of tiposPrioritarios) {
          const [candidates] = await connection.execute(
            `SELECT id, codigo, tipo FROM senhas
             WHERE data_referencia = ? AND status = 'AGUARDANDO' AND tipo = ?
             ORDER BY emitida_em ASC, id ASC
             LIMIT 1
             FOR UPDATE SKIP LOCKED`,
            [refDate, tipo],
          )
          if (candidates.length > 0) {
            targetRow = candidates[0]
            break
          }
        }
      } else {
        const [candidates] = await connection.execute(
          `SELECT id, codigo, tipo FROM senhas
           WHERE data_referencia = ? AND status = 'AGUARDANDO'
           ORDER BY emitida_em ASC, id ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED`,
          [refDate],
        )
        targetRow = candidates[0] || null
      }

      if (!targetRow) {
        return { error: 'EMPTY_QUEUE' }
      }

      const [updateResult] = await connection.execute(
        `UPDATE senhas
         SET status = 'CHAMADA',
             guiche_id = ?,
             atendente_id = ?,
             primeira_chamada_em = COALESCE(primeira_chamada_em, NOW())
         WHERE id = ? AND status = 'AGUARDANDO'`,
        [guicheId, atendenteId, targetRow.id],
      )

      if (updateResult.affectedRows !== 1) {
        return { error: 'TICKET_NOT_AVAILABLE' }
      }

      await auditRepository.registrarEvento(
        {
          usuarioId: atendenteId,
          senhaId: targetRow.id,
          guicheId,
          acao: 'SENHA_RESERVADA',
          detalhes: {
            codigo: targetRow.codigo,
            tipo: targetRow.tipo,
            guicheNumero: lockGuiche.guiche.numero,
          },
          ipOrigem,
        },
        connection,
      )

      return { error: null, senhaId: targetRow.id }
    })

    if (outcome.error) return outcome
    return { error: null, senha: await this.findById(outcome.senhaId) }
  },

  /**
   * Reserva atomicamente uma senha especifica por ID para um guiche.
   */
  async reservarSenhaPorId({ senhaId, guicheId, atendenteId, ipOrigem = null }) {
    const outcome = await withTransaction(async (connection) => {
      const [rows] = await connection.execute(
        'SELECT id, codigo, tipo, data_referencia, status FROM senhas WHERE id = ? FOR UPDATE',
        [senhaId],
      )
      const ticket = rows[0]
      if (!ticket) return { error: 'TICKET_NOT_FOUND' }
      if (ticket.status !== 'AGUARDANDO') return { error: 'TICKET_NOT_AVAILABLE' }

      const refDate =
        ticket.data_referencia instanceof Date
          ? ticket.data_referencia.toISOString().slice(0, 10)
          : String(ticket.data_referencia)

      const lockGuiche = await lockGuicheParaReserva(connection, {
        guicheId,
        atendenteId,
        dataReferencia: refDate,
      })
      if (lockGuiche.error) return lockGuiche

      const [updateResult] = await connection.execute(
        `UPDATE senhas
         SET status = 'CHAMADA',
             guiche_id = ?,
             atendente_id = ?,
             primeira_chamada_em = COALESCE(primeira_chamada_em, NOW())
         WHERE id = ? AND status = 'AGUARDANDO'`,
        [guicheId, atendenteId, senhaId],
      )

      if (updateResult.affectedRows !== 1) {
        return { error: 'TICKET_NOT_AVAILABLE' }
      }

      await auditRepository.registrarEvento(
        {
          usuarioId: atendenteId,
          senhaId: ticket.id,
          guicheId,
          acao: 'SENHA_RESERVADA',
          detalhes: {
            codigo: ticket.codigo,
            tipo: ticket.tipo,
            guicheNumero: lockGuiche.guiche.numero,
          },
          ipOrigem,
        },
        connection,
      )

      return { error: null, senhaId: ticket.id }
    })

    if (outcome.error) return outcome
    return { error: null, senha: await this.findById(outcome.senhaId) }
  },

  async registrarSegundaChamada({ senhaId, atendenteId, ipOrigem = null }) {
    const outcome = await withTransaction(async (connection) => {
      const [rows] = await connection.execute(
        'SELECT id, codigo, status, guiche_id FROM senhas WHERE id = ? FOR UPDATE',
        [senhaId],
      )
      const ticket = rows[0]
      if (!ticket) return { error: 'TICKET_NOT_FOUND' }
      if (ticket.status !== 'CHAMADA') return { error: 'INVALID_TRANSITION' }

      await connection.execute(
        `UPDATE senhas
         SET status = 'CHAMADA_NOVAMENTE',
             segunda_chamada_em = NOW()
         WHERE id = ?`,
        [senhaId],
      )

      await auditRepository.registrarEvento(
        {
          usuarioId: atendenteId,
          senhaId: ticket.id,
          guicheId: ticket.guiche_id,
          acao: 'SENHA_CHAMADA_NOVAMENTE',
          detalhes: { codigo: ticket.codigo },
          ipOrigem,
        },
        connection,
      )

      return { error: null, senhaId: ticket.id }
    })

    if (outcome.error) return outcome
    return { error: null, senha: await this.findById(outcome.senhaId) }
  },

  async iniciarAtendimento({ senhaId, atendenteId, ipOrigem = null }) {
    const outcome = await withTransaction(async (connection) => {
      const [rows] = await connection.execute(
        'SELECT id, codigo, status, guiche_id FROM senhas WHERE id = ? FOR UPDATE',
        [senhaId],
      )
      const ticket = rows[0]
      if (!ticket) return { error: 'TICKET_NOT_FOUND' }
      if (!['CHAMADA', 'CHAMADA_NOVAMENTE'].includes(ticket.status)) {
        return { error: 'INVALID_TRANSITION' }
      }

      await connection.execute(
        `UPDATE senhas
         SET status = 'EM_ATENDIMENTO',
             atendente_id = ?,
             inicio_atendimento_em = NOW()
         WHERE id = ?`,
        [atendenteId, senhaId],
      )

      await auditRepository.registrarEvento(
        {
          usuarioId: atendenteId,
          senhaId: ticket.id,
          guicheId: ticket.guiche_id,
          acao: 'SENHA_ATENDIMENTO_INICIADO',
          detalhes: { codigo: ticket.codigo },
          ipOrigem,
        },
        connection,
      )

      return { error: null, senhaId: ticket.id }
    })

    if (outcome.error) return outcome
    return { error: null, senha: await this.findById(outcome.senhaId) }
  },

  async finalizarAtendimento({ senhaId, atendenteId, ipOrigem = null }) {
    const outcome = await withTransaction(async (connection) => {
      const [rows] = await connection.execute(
        'SELECT id, codigo, status, guiche_id FROM senhas WHERE id = ? FOR UPDATE',
        [senhaId],
      )
      const ticket = rows[0]
      if (!ticket) return { error: 'TICKET_NOT_FOUND' }
      if (ticket.status !== 'EM_ATENDIMENTO') {
        return { error: 'INVALID_TRANSITION' }
      }

      await connection.execute(
        `UPDATE senhas
         SET status = 'ATENDIDA',
             fim_atendimento_em = NOW(),
             tempo_atendimento_segundos = GREATEST(0, COALESCE(TIMESTAMPDIFF(SECOND, inicio_atendimento_em, NOW()), 0))
         WHERE id = ?`,
        [senhaId],
      )

      await auditRepository.registrarEvento(
        {
          usuarioId: atendenteId,
          senhaId: ticket.id,
          guicheId: ticket.guiche_id,
          acao: 'SENHA_ATENDIMENTO_FINALIZADO',
          detalhes: { codigo: ticket.codigo },
          ipOrigem,
        },
        connection,
      )

      return { error: null, senhaId: ticket.id }
    })

    if (outcome.error) return outcome
    return { error: null, senha: await this.findById(outcome.senhaId) }
  },

  async registrarNaoCompareceu({ senhaId, atendenteId, ipOrigem = null }) {
    const outcome = await withTransaction(async (connection) => {
      const [rows] = await connection.execute(
        'SELECT id, codigo, status, guiche_id FROM senhas WHERE id = ? FOR UPDATE',
        [senhaId],
      )
      const ticket = rows[0]
      if (!ticket) return { error: 'TICKET_NOT_FOUND' }
      if (ticket.status !== 'CHAMADA_NOVAMENTE') {
        return { error: 'INVALID_TRANSITION' }
      }

      await connection.execute(
        `UPDATE senhas
         SET status = 'NAO_COMPARECEU',
             fim_atendimento_em = NOW()
         WHERE id = ?`,
        [senhaId],
      )

      await auditRepository.registrarEvento(
        {
          usuarioId: atendenteId,
          senhaId: ticket.id,
          guicheId: ticket.guiche_id,
          acao: 'SENHA_NAO_COMPARECEU',
          detalhes: { codigo: ticket.codigo },
          ipOrigem,
        },
        connection,
      )

      return { error: null, senhaId: ticket.id }
    })

    if (outcome.error) return outcome
    return { error: null, senha: await this.findById(outcome.senhaId) }
  },

  async descartarSenhasPendentes({ dataReferencia = null, atendenteId = null, ipOrigem = null } = {}) {
    const refDate = dataReferencia || formatarDataReferencia()

    const descartadas = await withTransaction(async (connection) => {
      const [result] = await connection.execute(
        `UPDATE senhas
         SET status = 'DESCARTADA',
             fim_atendimento_em = NOW()
         WHERE data_referencia = ?
           AND status IN ('EMITIDA', 'AGUARDANDO')`,
        [refDate],
      )

      await auditRepository.registrarEvento(
        {
          usuarioId: atendenteId,
          acao: 'SENHAS_DESCARTADAS',
          detalhes: { dataReferencia: refDate, quantidade: result.affectedRows },
          ipOrigem,
        },
        connection,
      )

      return result.affectedRows
    })

    return { dataReferencia: refDate, descartadas }
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
