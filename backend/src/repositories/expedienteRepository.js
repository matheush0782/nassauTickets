import { query, withTransaction } from '../config/database.js'
import { formatarDataReferencia } from './ticketRepository.js'

export const expedienteRepository = {
  /**
   * Busca (ou inicializa) o registro de expediente diario para a data informada.
   */
  async getOrCreateDia(dataReferencia = null) {
    const refDate = dataReferencia || formatarDataReferencia()
    await query(
      `INSERT IGNORE INTO expediente_diario (data_referencia) VALUES (?)`,
      [refDate],
    )
    const rows = await query(
      `SELECT data_referencia, encerrado_manualmente, encerrado_em, encerrado_por,
              reaberto_em, reaberto_por, ultimo_tipo_chamado, criado_em, atualizado_em
       FROM expediente_diario
       WHERE data_referencia = ?
       LIMIT 1`,
      [refDate],
    )
    return rows[0] || null
  },

  /**
   * Encerra manualmente o expediente do dia e descarta senhas pendentes (RN21, RN29)
   * de forma atomica dentro de uma unica transacao MySQL.
   */
  async encerrarDia({ dataReferencia = null, usuarioId = null } = {}) {
    const refDate = dataReferencia || formatarDataReferencia()

    return withTransaction(async (connection) => {
      await connection.execute(
        `INSERT IGNORE INTO expediente_diario (data_referencia) VALUES (?)`,
        [refDate],
      )

      const [rows] = await connection.execute(
        `SELECT data_referencia, encerrado_manualmente
         FROM expediente_diario
         WHERE data_referencia = ?
         FOR UPDATE`,
        [refDate],
      )

      const atual = rows[0]
      if (atual?.encerrado_manualmente) {
        return { error: 'ALREADY_CLOSED' }
      }

      await connection.execute(
        `UPDATE expediente_diario
         SET encerrado_manualmente = 1, encerrado_em = NOW(), encerrado_por = ?
         WHERE data_referencia = ?`,
        [usuarioId, refDate],
      )

      const [descarteResult] = await connection.execute(
        `UPDATE senhas
         SET status = 'DESCARTADA', fim_atendimento_em = NOW()
         WHERE data_referencia = ? AND status IN ('EMITIDA', 'AGUARDANDO')`,
        [refDate],
      )

      const [updatedRows] = await connection.execute(
        `SELECT data_referencia, encerrado_manualmente, encerrado_em, encerrado_por,
                reaberto_em, reaberto_por, ultimo_tipo_chamado, criado_em, atualizado_em
         FROM expediente_diario
         WHERE data_referencia = ?
         LIMIT 1`,
        [refDate],
      )

      return {
        error: null,
        expediente: updatedRows[0],
        descartadas: descarteResult.affectedRows || 0,
      }
    })
  },

  /**
   * Reabre o expediente do dia caso tenha sido encerrado manualmente (RN29).
   */
  async reabrirDia({ dataReferencia = null, usuarioId = null } = {}) {
    const refDate = dataReferencia || formatarDataReferencia()

    return withTransaction(async (connection) => {
      await connection.execute(
        `INSERT IGNORE INTO expediente_diario (data_referencia) VALUES (?)`,
        [refDate],
      )

      const [rows] = await connection.execute(
        `SELECT data_referencia, encerrado_manualmente
         FROM expediente_diario
         WHERE data_referencia = ?
         FOR UPDATE`,
        [refDate],
      )

      const atual = rows[0]
      if (!atual?.encerrado_manualmente) {
        return { error: 'NOT_CLOSED' }
      }

      await connection.execute(
        `UPDATE expediente_diario
         SET encerrado_manualmente = 0, reaberto_em = NOW(), reaberto_por = ?
         WHERE data_referencia = ?`,
        [usuarioId, refDate],
      )

      const [updatedRows] = await connection.execute(
        `SELECT data_referencia, encerrado_manualmente, encerrado_em, encerrado_por,
                reaberto_em, reaberto_por, ultimo_tipo_chamado, criado_em, atualizado_em
         FROM expediente_diario
         WHERE data_referencia = ?
         LIMIT 1`,
        [refDate],
      )

      return {
        error: null,
        expediente: updatedRows[0],
      }
    })
  },
}
