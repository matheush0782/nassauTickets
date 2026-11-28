import bcrypt from 'bcryptjs'
import { env } from '../config/env.js'
import { PERFIS } from '../constants/domain.js'
import { ConflictError, NotFoundError, ValidationError } from '../errors/AppError.js'
import { auditRepository } from '../repositories/auditRepository.js'
import { userRepository } from '../repositories/userRepository.js'

const VALID_PERFIS = Object.values(PERFIS)

export function createUserService({
  users = userRepository,
  audit = auditRepository,
  saltRounds = env.bcryptSaltRounds,
} = {}) {
  async function assertSingleActiveGestor(perfil, excludeUserId = null) {
    if (perfil !== PERFIS.GESTOR) return
    const activeGestores = await users.countActiveGestores(excludeUserId)
    if (activeGestores > 0) {
      throw new ConflictError(
        'Ja existe um usuario ativo com perfil de gestor no sistema.',
        'SINGLE_GESTOR_LIMIT',
      )
    }
  }

  return {
    async listUsers(filters) {
      return users.listAll(filters)
    },

    async getUserById(id) {
      const user = await users.findById(id)
      if (!user) {
        throw new NotFoundError('Usuario nao encontrado.')
      }
      return user
    },

    async createUser({ nome, login, email = null, senha, perfil = PERFIS.ATENDENTE }, actor) {
      const nomeLimpo = String(nome || '').trim()
      const loginLimpo = String(login || '').trim()
      const emailLimpo = email ? String(email).trim() : null
      const senhaTexto = String(senha || '')

      if (!nomeLimpo || !loginLimpo || senhaTexto.length < 6) {
        throw new ValidationError(
          'Nome, login e senha (minimo 6 caracteres) sao obrigatorios.',
        )
      }

      if (!VALID_PERFIS.includes(perfil)) {
        throw new ValidationError('Perfil invalido. Use "atendente" ou "gestor".')
      }

      const existing = await users.findByLogin(loginLimpo)
      if (existing) {
        throw new ConflictError('Ja existe um usuario com este login.')
      }

      await assertSingleActiveGestor(perfil)

      const senhaHash = await bcrypt.hash(senhaTexto, saltRounds)
      const created = await users.create({
        nome: nomeLimpo,
        login: loginLimpo,
        email: emailLimpo,
        senhaHash,
        perfil,
      })

      await audit.registrarEvento({
        usuarioId: actor?.id ?? null,
        acao: 'USUARIO_CRIADO',
        detalhes: { alvoId: created.id, login: created.login, perfil: created.perfil },
        ipOrigem: actor?.ipOrigem ?? null,
      })

      return created
    },

    async updateUser(id, payload, actor) {
      const current = await this.getUserById(id)
      const updates = {}

      if (payload.nome !== undefined) {
        const nomeLimpo = String(payload.nome).trim()
        if (!nomeLimpo) throw new ValidationError('Nome nao pode ser vazio.')
        updates.nome = nomeLimpo
      }

      if (payload.email !== undefined) {
        updates.email = payload.email ? String(payload.email).trim() : null
      }

      if (payload.perfil !== undefined) {
        if (!VALID_PERFIS.includes(payload.perfil)) {
          throw new ValidationError('Perfil invalido. Use "atendente" ou "gestor".')
        }
        if (current.ativo) {
          await assertSingleActiveGestor(payload.perfil, current.id)
        }
        updates.perfil = payload.perfil
      }

      if (payload.senha !== undefined) {
        const senhaTexto = String(payload.senha)
        if (senhaTexto.length < 6) {
          throw new ValidationError('Senha deve ter no minimo 6 caracteres.')
        }
        updates.senhaHash = await bcrypt.hash(senhaTexto, saltRounds)
      }

      const updated = await users.update(id, updates)

      await audit.registrarEvento({
        usuarioId: actor?.id ?? null,
        acao: 'USUARIO_ATUALIZADO',
        detalhes: { alvoId: updated.id, campos: Object.keys(updates) },
        ipOrigem: actor?.ipOrigem ?? null,
      })

      return updated
    },

    async setUserStatus(id, ativo, actor) {
      const current = await this.getUserById(id)
      const nextActive = Boolean(ativo)

      if (actor?.id === current.id && !nextActive) {
        throw new ValidationError('Nao e permitido desativar o proprio usuario autenticado.')
      }

      if (nextActive && current.perfil === PERFIS.GESTOR) {
        await assertSingleActiveGestor(PERFIS.GESTOR, current.id)
      }

      const updated = await users.setActive(id, nextActive)

      await audit.registrarEvento({
        usuarioId: actor?.id ?? null,
        acao: nextActive ? 'USUARIO_ATIVADO' : 'USUARIO_DESATIVADO',
        detalhes: { alvoId: updated.id },
        ipOrigem: actor?.ipOrigem ?? null,
      })

      return updated
    },
  }
}

export const userService = createUserService()
