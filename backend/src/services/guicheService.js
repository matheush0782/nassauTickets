import { PERFIS } from '../constants/domain.js'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors/AppError.js'
import { auditRepository } from '../repositories/auditRepository.js'
import { guicheRepository } from '../repositories/guicheRepository.js'

export function createGuicheService({
  guiches = guicheRepository,
  audit = auditRepository,
} = {}) {
  return {
    async listGuiches({ apenasAtivos = false } = {}) {
      return guiches.listAll({ apenasAtivos })
    },

    async getGuicheById(id) {
      const guiche = await guiches.findById(id)
      if (!guiche) {
        throw new NotFoundError('Guiche nao encontrado.')
      }
      return guiche
    },

    async createGuiche({ numero, descricao = null, ativo = true }, actor) {
      const num = Number(numero)
      if (!Number.isInteger(num) || num <= 0) {
        throw new ValidationError('Numero do guiche deve ser um inteiro positivo.')
      }

      const existing = await guiches.findByNumero(num)
      if (existing) {
        throw new ConflictError('Ja existe um guiche com este numero.')
      }

      const created = await guiches.create({
        numero: num,
        descricao: descricao ? String(descricao).trim() : `Guiche ${String(num).padStart(2, '0')}`,
        ativo: Boolean(ativo),
      })

      await audit.registrarEvento({
        usuarioId: actor?.id ?? null,
        guicheId: created.id,
        acao: 'GUICHE_CRIADO',
        detalhes: { numero: created.numero },
        ipOrigem: actor?.ipOrigem ?? null,
      })

      return created
    },

    async updateGuiche(id, payload, actor) {
      await this.getGuicheById(id)
      const updates = {}

      if (payload.numero !== undefined) {
        const num = Number(payload.numero)
        if (!Number.isInteger(num) || num <= 0) {
          throw new ValidationError('Numero do guiche deve ser um inteiro positivo.')
        }
        const existing = await guiches.findByNumero(num)
        if (existing && existing.id !== Number(id)) {
          throw new ConflictError('Ja existe outro guiche com este numero.')
        }
        updates.numero = num
      }

      if (payload.descricao !== undefined) {
        updates.descricao = payload.descricao ? String(payload.descricao).trim() : null
      }

      if (payload.ativo !== undefined) {
        updates.ativo = Boolean(payload.ativo)
      }

      const updated = await guiches.update(id, updates)

      await audit.registrarEvento({
        usuarioId: actor?.id ?? null,
        guicheId: updated.id,
        acao: 'GUICHE_ATUALIZADO',
        detalhes: updates,
        ipOrigem: actor?.ipOrigem ?? null,
      })

      return updated
    },

    async ocuparGuiche(id, actor) {
      const result = await guiches.assignAtendente(Number(id), actor.id)
      if (result.error === 'NOT_FOUND') throw new NotFoundError('Guiche nao encontrado.')
      if (result.error === 'INACTIVE') throw new ValidationError('Guiche inativo.')
      if (result.error === 'OCCUPIED') {
        throw new ConflictError('Guiche ja esta ocupado por outro atendente.')
      }

      await audit.registrarEvento({
        usuarioId: actor.id,
        guicheId: Number(id),
        acao: 'GUICHE_OCUPADO',
        ipOrigem: actor.ipOrigem ?? null,
      })

      return result.guiche
    },

    async liberarGuiche(id, actor) {
      const isGestor = actor.perfil === PERFIS.GESTOR
      const result = await guiches.releaseAtendente(Number(id), actor.id, { force: isGestor })
      if (result.error === 'NOT_FOUND') throw new NotFoundError('Guiche nao encontrado.')
      if (result.error === 'NOT_OWNER') {
        throw new ForbiddenError('Apenas o atendente alocado ou o gestor pode liberar este guiche.')
      }

      await audit.registrarEvento({
        usuarioId: actor.id,
        guicheId: Number(id),
        acao: 'GUICHE_LIBERADO',
        ipOrigem: actor.ipOrigem ?? null,
      })

      return result.guiche
    },
  }
}

export const guicheService = createGuicheService()
