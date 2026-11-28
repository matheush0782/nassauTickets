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

function defaultOrdemDeBusca(ultimoTipo) {
  if (ultimoTipo === 'SP') return ['SE', 'SG', 'SP']
  return ['SP', 'SE', 'SG']
}

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

  /**
   * Busca atendimento ativo (CHAMADA, CHAMADA_NOVAMENTE, EM_ATENDIMENTO) de um guiche.
   * Aceita ID ou numero do guiche para compatibilidade com o frontend.
   */
  async findAtendimentoAtualByGuiche(guicheIdOrNumero) {
    const rows = await query(
      `${SENHA_SELECT}
       WHERE (s.guiche_id = ? OR g.numero = ?)
         AND s.status IN ('CHAMADA', 'CHAMADA_NOVAMENTE', 'EM_ATENDIMENTO')
       ORDER BY s.primeira_chamada_em DESC, s.id DESC
       LIMIT 1`,
      [guicheIdOrNumero, guicheIdOrNumero],
    )
    return rows[0] || null
  },

  /**
   * Cria uma nova senha com numeracao atomica (FOR UPDATE evita duplicacao).
   */
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

  /**
   * Lista senhas por periodo ('diario' = YYYY-MM-DD, 'mensal' = YYYY-MM) para relatorios.
   */
  async listByPeriodo({ periodo = 'diario', referencia }) {
    if (periodo === 'mensal') {
      return query(
        `${SENHA_SELECT}
         WHERE DATE_FORMAT(s.data_referencia, '%Y-%m') = ?
         ORDER BY s.emitida_em ASC, s.id ASC`,
        [referencia],
      )
    }
    return query(
      `${SENHA_SELECT}
       WHERE s.data_referencia = ?
       ORDER BY s.emitida_em ASC, s.id ASC`,
      [referencia],
    )
  },

  /**
   * Consulta senhas aguardando atendimento (fila), opcionalmente filtradas por tipo.
   */
  async consultarFila({ tipo = null, dataReferencia = null } = {}) {
    const refDate = dataReferencia || formatarDataReferencia()
    const conditions = ["s.status = 'AGUARDANDO'", 's.data_referencia = ?']
    const params = [refDate]

    if (tipo) {
      conditions.push('s.tipo = ?')
      params.push(tipo)
    }

    return query(
      `${SENHA_SELECT}
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.emitida_em ASC, s.id ASC`,
      params,
    )
  },

  /**
   * Contagem de senhas aguardando por tipo (SP, SG, SE) e total.
   */
  async contarFilaPorTipo({ dataReferencia = null } = {}) {
    const refDate = dataReferencia || formatarDataReferencia()
    const rows = await query(
      `SELECT tipo, COUNT(*) AS total
       FROM senhas
       WHERE status = 'AGUARDANDO' AND data_referencia = ?
       GROUP BY tipo`,
      [refDate],
    )
    const contagem = { SP: 0, SG: 0, SE: 0, total: 0 }
    for (const row of rows) {
      const count = Number(row.total)
      contagem[row.tipo] = count
      contagem.total += count
    }
    return contagem
  },

  /**
   * Busca a ultima senha chamada no dia (para o painel).
   */
  async buscarUltimaChamada({ dataReferencia = null } = {}) {
    const refDate = dataReferencia || formatarDataReferencia()
    const rows = await query(
      `${SENHA_SELECT}
       WHERE s.data_referencia = ? AND s.primeira_chamada_em IS NOT NULL
       ORDER BY COALESCE(s.segunda_chamada_em, s.primeira_chamada_em) DESC, s.id DESC
       LIMIT 1`,
      [refDate],
    )
    return rows[0] || null
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

  /**
   * Reserva atomicamente a proxima senha da fila para um guiche.
   * - Bloqueia `expediente_diario` (FOR UPDATE) para ler e atualizar a prioridade global
   *   (`ultimo_tipo_chamado`) e verificar se o expediente esta aberto.
   * - Bloqueia `guiches` (FOR UPDATE) e verifica se ha senha ativa no guiche.
   * - Usa `FOR UPDATE SKIP LOCKED` em `senhas` para garantir atomicidade sob concorrencia.
   */
  async reservarProximaSenha({
    guicheId,
    atendenteId,
    resolverOrdemDeBusca = defaultOrdemDeBusca,
  }) {
    const refDate = formatarDataReferencia()

    return withTransaction(async (connection) => {
      // 1. Garante registro diario e bloqueia estado global de prioridade + expediente
      await connection.execute(
        `INSERT IGNORE INTO expediente_diario (data_referencia) VALUES (?)`,
        [refDate],
      )
      const [expRows] = await connection.execute(
        `SELECT encerrado_manualmente, ultimo_tipo_chamado
         FROM expediente_diario
         WHERE data_referencia = ?
         FOR UPDATE`,
        [refDate],
      )
      const exp = expRows[0]
      if (exp?.encerrado_manualmente) {
        return { error: 'EXPEDIENTE_ENCERRADO' }
      }

      // 2. Verifica guiche (aceita id ou numero)
      const [gRows] = await connection.execute(
        'SELECT id, ativo, atendente_atual_id FROM guiches WHERE id = ? OR numero = ? LIMIT 1 FOR UPDATE',
        [guicheId, guicheId],
      )
      const guiche = gRows[0]
      if (!guiche) return { error: 'GUICHE_NOT_FOUND' }
      if (!guiche.ativo) return { error: 'GUICHE_INACTIVE' }
      if (guiche.atendente_atual_id && guiche.atendente_atual_id !== atendenteId) {
        return { error: 'GUICHE_OCCUPIED_BY_OTHER' }
      }

      // 3. Verifica se guiche ja possui senha ativa (RN18)
      const [activeRows] = await connection.execute(
        `SELECT id FROM senhas
         WHERE guiche_id = ? AND status IN ('CHAMADA', 'CHAMADA_NOVAMENTE', 'EM_ATENDIMENTO')
         LIMIT 1`,
        [guiche.id],
      )
      if (activeRows.length > 0) return { error: 'GUICHE_HAS_ACTIVE_TICKET' }

      // 4. Determina ordem de busca no servidor usando o ultimo tipo persistido
      const ordem = resolverOrdemDeBusca(exp?.ultimo_tipo_chamado ?? null)
      let target = null

      for (const tipo of ordem) {
        const [rows] = await connection.execute(
          `SELECT id, tipo FROM senhas
           WHERE status = 'AGUARDANDO' AND data_referencia = ? AND tipo = ?
           ORDER BY emitida_em ASC, id ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED`,
          [refDate, tipo],
        )
        if (rows.length > 0) {
          target = rows[0]
          break
        }
      }

      if (!target) return { error: 'EMPTY_QUEUE' }

      const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
      await connection.execute(
        `UPDATE senhas
         SET status = 'CHAMADA', guiche_id = ?, atendente_id = ?, primeira_chamada_em = ?
         WHERE id = ?`,
        [guiche.id, atendenteId, now, target.id],
      )

      // 5. Atualiza controle global de prioridade na mesma transacao
      await connection.execute(
        `UPDATE expediente_diario SET ultimo_tipo_chamado = ? WHERE data_referencia = ?`,
        [target.tipo, refDate],
      )

      return { error: null, senhaId: target.id, guicheId: guiche.id }
    }).then(async (res) => {
      if (res.error) return res
      const senha = await this.findById(res.senhaId)
      return { error: null, senha }
    })
  },

  /**
   * Reserva atomicamente uma senha especifica para um guiche.
   * Valida guiche livre (RN18), expediente aberto e status AGUARDANDO.
   */
  async reservarSenhaPorId({ senhaId, guicheId, atendenteId }) {
    const refDate = formatarDataReferencia()

    return withTransaction(async (connection) => {
      await connection.execute(
        `INSERT IGNORE INTO expediente_diario (data_referencia) VALUES (?)`,
        [refDate],
      )
      const [expRows] = await connection.execute(
        `SELECT encerrado_manualmente FROM expediente_diario WHERE data_referencia = ? FOR UPDATE`,
        [refDate],
      )
      if (expRows[0]?.encerrado_manualmente) {
        return { error: 'EXPEDIENTE_ENCERRADO' }
      }

      // Bloqueia a senha
      const [sRows] = await connection.execute(
        'SELECT id, tipo, status FROM senhas WHERE id = ? FOR UPDATE',
        [senhaId],
      )
      const senha = sRows[0]
      if (!senha) return { error: 'TICKET_NOT_FOUND' }
      if (senha.status !== 'AGUARDANDO') return { error: 'TICKET_NOT_AVAILABLE' }

      // Verifica guiche
      const [gRows] = await connection.execute(
        'SELECT id, ativo, atendente_atual_id FROM guiches WHERE id = ? FOR UPDATE',
        [guicheId],
      )
      const guiche = gRows[0]
      if (!guiche) return { error: 'GUICHE_NOT_FOUND' }
      if (!guiche.ativo) return { error: 'GUICHE_INACTIVE' }
      if (guiche.atendente_atual_id && guiche.atendente_atual_id !== atendenteId) {
        return { error: 'GUICHE_OCCUPIED_BY_OTHER' }
      }

      // Verifica se guiche ja possui senha ativa (RN18)
      const [activeRows] = await connection.execute(
        `SELECT id FROM senhas
         WHERE guiche_id = ? AND status IN ('CHAMADA', 'CHAMADA_NOVAMENTE', 'EM_ATENDIMENTO')
         LIMIT 1`,
        [guiche.id],
      )
      if (activeRows.length > 0) return { error: 'GUICHE_HAS_ACTIVE_TICKET' }

      const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
      await connection.execute(
        `UPDATE senhas
         SET status = 'CHAMADA', guiche_id = ?, atendente_id = ?, primeira_chamada_em = ?
         WHERE id = ?`,
        [guiche.id, atendenteId, now, senhaId],
      )

      await connection.execute(
        `UPDATE expediente_diario SET ultimo_tipo_chamado = ? WHERE data_referencia = ?`,
        [senha.tipo, refDate],
      )

      return { error: null, senhaId }
    }).then(async (res) => {
      if (res.error) return res
      const senha = await this.findById(res.senhaId)
      return { error: null, senha }
    })
  },

  /**
   * Registra segunda chamada (CHAMADA -> CHAMADA_NOVAMENTE).
   */
  async registrarSegundaChamada({ senhaId }) {
    return withTransaction(async (connection) => {
      const [rows] = await connection.execute(
        'SELECT id, status FROM senhas WHERE id = ? FOR UPDATE',
        [senhaId],
      )
      const senha = rows[0]
      if (!senha) return { error: 'TICKET_NOT_FOUND' }
      if (senha.status !== 'CHAMADA') return { error: 'INVALID_TRANSITION' }

      const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
      await connection.execute(
        `UPDATE senhas SET status = 'CHAMADA_NOVAMENTE', segunda_chamada_em = ? WHERE id = ?`,
        [now, senhaId],
      )
      return { error: null, senhaId }
    }).then(async (res) => {
      if (res.error) return res
      return { error: null, senha: await this.findById(res.senhaId) }
    })
  },

  /**
   * Inicia atendimento (CHAMADA/CHAMADA_NOVAMENTE -> EM_ATENDIMENTO).
   */
  async iniciarAtendimento({ senhaId, atendenteId }) {
    return withTransaction(async (connection) => {
      const [rows] = await connection.execute(
        'SELECT id, status FROM senhas WHERE id = ? FOR UPDATE',
        [senhaId],
      )
      const senha = rows[0]
      if (!senha) return { error: 'TICKET_NOT_FOUND' }
      if (!['CHAMADA', 'CHAMADA_NOVAMENTE'].includes(senha.status)) {
        return { error: 'INVALID_TRANSITION' }
      }

      const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
      await connection.execute(
        `UPDATE senhas SET status = 'EM_ATENDIMENTO', atendente_id = ?, inicio_atendimento_em = ? WHERE id = ?`,
        [atendenteId, now, senhaId],
      )
      return { error: null, senhaId }
    }).then(async (res) => {
      if (res.error) return res
      return { error: null, senha: await this.findById(res.senhaId) }
    })
  },

  /**
   * Finaliza atendimento (EM_ATENDIMENTO -> ATENDIDA) e calcula duracao.
   */
  async finalizarAtendimento({ senhaId }) {
    return withTransaction(async (connection) => {
      const [rows] = await connection.execute(
        'SELECT id, status, inicio_atendimento_em FROM senhas WHERE id = ? FOR UPDATE',
        [senhaId],
      )
      const senha = rows[0]
      if (!senha) return { error: 'TICKET_NOT_FOUND' }
      if (senha.status !== 'EM_ATENDIMENTO') return { error: 'INVALID_TRANSITION' }

      const now = new Date()
      const nowStr = now.toISOString().slice(0, 19).replace('T', ' ')
      const inicio = new Date(senha.inicio_atendimento_em)
      const tempoSegundos = Math.max(0, Math.round((now.getTime() - inicio.getTime()) / 1000))

      await connection.execute(
        `UPDATE senhas
         SET status = 'ATENDIDA', fim_atendimento_em = ?, tempo_atendimento_segundos = ?
         WHERE id = ?`,
        [nowStr, tempoSegundos, senhaId],
      )
      return { error: null, senhaId }
    }).then(async (res) => {
      if (res.error) return res
      return { error: null, senha: await this.findById(res.senhaId) }
    })
  },

  /**
   * Registra nao comparecimento (CHAMADA_NOVAMENTE -> NAO_COMPARECEU).
   */
  async registrarNaoCompareceu({ senhaId }) {
    return withTransaction(async (connection) => {
      const [rows] = await connection.execute(
        'SELECT id, status FROM senhas WHERE id = ? FOR UPDATE',
        [senhaId],
      )
      const senha = rows[0]
      if (!senha) return { error: 'TICKET_NOT_FOUND' }
      if (senha.status !== 'CHAMADA_NOVAMENTE') return { error: 'INVALID_TRANSITION' }

      const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
      await connection.execute(
        `UPDATE senhas SET status = 'NAO_COMPARECEU', fim_atendimento_em = ? WHERE id = ?`,
        [now, senhaId],
      )
      return { error: null, senhaId }
    }).then(async (res) => {
      if (res.error) return res
      return { error: null, senha: await this.findById(res.senhaId) }
    })
  },

  /**
   * Descarta senhas pendentes (EMITIDA/AGUARDANDO -> DESCARTADA) para o dia informado.
   */
  async descartarSenhasPendentes({ dataReferencia = null } = {}) {
    const refDate = dataReferencia || formatarDataReferencia()

    const result = await query(
      `UPDATE senhas
       SET status = 'DESCARTADA', fim_atendimento_em = NOW()
       WHERE data_referencia = ? AND status IN ('EMITIDA', 'AGUARDANDO')`,
      [refDate],
    )

    return { dataReferencia: refDate, descartadas: result.affectedRows || 0 }
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
