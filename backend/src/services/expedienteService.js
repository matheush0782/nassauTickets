import { ConflictError } from '../errors/AppError.js'
import { auditRepository } from '../repositories/auditRepository.js'
import { expedienteRepository } from '../repositories/expedienteRepository.js'

function mapExpediente(row) {
  if (!row) return null
  const encerradoManualmente = Boolean(row.encerrado_manualmente)
  return {
    dataReferencia:
      row.data_referencia instanceof Date
        ? row.data_referencia.toISOString().slice(0, 10)
        : row.data_referencia,
    encerradoManualmente,
    expedienteEncerrado: encerradoManualmente,
    encerradoEm: row.encerrado_em ?? null,
    encerradoPor: row.encerrado_por ?? null,
    reabertoEm: row.reaberto_em ?? null,
    reabertoPor: row.reaberto_por ?? null,
    ultimoTipoChamado: row.ultimo_tipo_chamado ?? null,
  }
}

/**
 * Servico de persistencia do expediente diario (Dev 1).
 *
 * Ponto de integracao com o Desenvolvedor 2 (src/domain/expediente.mjs):
 * Pode receber um adapter `domainExpediente` (ex.: { verificarSituacao })
 * para combinar a regra de horario (07h-17h, fuso America/Recife) com o
 * estado persistido em `expediente_diario`.
 */
export function createExpedienteService({
  expedientes = expedienteRepository,
  audit = auditRepository,
  domainExpediente = null,
} = {}) {
  return {
    async consultarExpediente({ dataReferencia = null } = {}) {
      const row = await expedientes.getOrCreateDia(dataReferencia)
      const mapped = mapExpediente(row)

      if (domainExpediente?.estaAberto) {
        const resHorario = domainExpediente.estaAberto()
        const abertoHorario = typeof resHorario === 'boolean' ? resHorario : Boolean(resHorario?.aberto)
        const motivoHorario = typeof resHorario === 'object' ? resHorario?.motivo : null
        const aberto = !mapped.encerradoManualmente && abertoHorario
        return {
          ...mapped,
          expedienteAberto: aberto,
          motivoExpediente: mapped.encerradoManualmente
            ? 'Expediente encerrado manualmente pelo gestor.'
            : !abertoHorario
              ? motivoHorario || 'Fora do horario de expediente (07h as 17h, America/Recife).'
              : null,
        }
      }

      if (domainExpediente?.verificarSituacao) {
        const situacao = domainExpediente.verificarSituacao(mapped)
        return { ...mapped, ...situacao }
      }

      return {
        ...mapped,
        expedienteAberto: !mapped.encerradoManualmente,
        motivoExpediente: mapped.encerradoManualmente
          ? 'Expediente encerrado manualmente pelo gestor.'
          : null,
      }
    },

    async encerrarExpediente({ dataReferencia = null, actor = null } = {}) {
      const result = await expedientes.encerrarDia({
        dataReferencia,
        usuarioId: actor?.id ?? null,
      })

      if (result.error === 'ALREADY_CLOSED') {
        throw new ConflictError('O expediente de hoje ja foi encerrado.')
      }

      const mapped = mapExpediente(result.expediente)

      await audit.registrarEvento({
        usuarioId: actor?.id ?? null,
        acao: 'EXPEDIENTE_ENCERRADO',
        detalhes: {
          dataReferencia: mapped.dataReferencia,
          descartadas: result.descartadas,
        },
        ipOrigem: actor?.ipOrigem ?? null,
      })

      return {
        ...mapped,
        expedienteAberto: false,
        descartadas: result.descartadas,
      }
    },

    async reabrirExpediente({ dataReferencia = null, actor = null } = {}) {
      const result = await expedientes.reabrirDia({
        dataReferencia,
        usuarioId: actor?.id ?? null,
      })

      if (result.error === 'NOT_CLOSED') {
        throw new ConflictError('O expediente nao esta encerrado.')
      }

      const mapped = mapExpediente(result.expediente)

      await audit.registrarEvento({
        usuarioId: actor?.id ?? null,
        acao: 'EXPEDIENTE_REABERTO',
        detalhes: {
          dataReferencia: mapped.dataReferencia,
        },
        ipOrigem: actor?.ipOrigem ?? null,
      })

      return {
        ...mapped,
        expedienteAberto: true,
      }
    },
  }
}

export const expedienteService = createExpedienteService()
