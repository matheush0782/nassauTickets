import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { UnauthorizedError, ValidationError } from '../errors/AppError.js'
import { auditRepository } from '../repositories/auditRepository.js'
import { userRepository } from '../repositories/userRepository.js'

export function createAuthService({
  users = userRepository,
  audit = auditRepository,
  jwtConfig = env.jwt,
} = {}) {
  return {
    async login({ login, senha, ipOrigem = null }) {
      const loginNormalizado = String(login || '').trim()
      const senhaTexto = String(senha || '')

      if (!loginNormalizado || !senhaTexto) {
        throw new ValidationError('Login e senha sao obrigatorios.')
      }

      const user = await users.findByLogin(loginNormalizado)
      if (!user || !user.ativo) {
        throw new UnauthorizedError('Credenciais invalidas.')
      }

      const senhaValida = await bcrypt.compare(senhaTexto, user.senha_hash)
      if (!senhaValida) {
        throw new UnauthorizedError('Credenciais invalidas.')
      }

      const token = jwt.sign(
        {
          sub: user.id,
          login: user.login,
          perfil: user.perfil,
        },
        jwtConfig.secret,
        { expiresIn: jwtConfig.expiresIn },
      )

      await audit.registrarEvento({
        usuarioId: user.id,
        acao: 'LOGIN',
        detalhes: { login: user.login, perfil: user.perfil },
        ipOrigem,
      })

      return {
        token,
        usuario: {
          id: user.id,
          nome: user.nome,
          login: user.login,
          email: user.email,
          perfil: user.perfil,
        },
      }
    },

    async getProfile(userId) {
      const user = await users.findById(userId)
      if (!user || !user.ativo) {
        throw new UnauthorizedError('Usuario nao encontrado ou inativo.')
      }
      return user
    },
  }
}

export const authService = createAuthService()
