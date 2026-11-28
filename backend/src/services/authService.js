import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { UnauthorizedError, ValidationError } from '../errors/AppError.js'
import { auditRepository } from '../repositories/auditRepository.js'
import { guicheRepository } from '../repositories/guicheRepository.js'
import { userRepository } from '../repositories/userRepository.js'
import { mapUser } from '../utils/mappers.js'

export function createAuthService({
  users = userRepository,
  guiches = guicheRepository,
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

      const authUser = users.findAuthByLogin
        ? await users.findAuthByLogin(loginNormalizado)
        : await users.findByLogin(loginNormalizado)

      if (!authUser || !authUser.ativo) {
        await audit.registrarEvento({
          usuarioId: authUser?.id ?? null,
          acao: 'LOGIN_FALHA',
          detalhes: { login: loginNormalizado, motivo: !authUser ? 'NAO_ENCONTRADO' : 'INATIVO' },
          ipOrigem,
        })
        throw new UnauthorizedError('Credenciais invalidas.')
      }

      const senhaValida = await bcrypt.compare(senhaTexto, authUser.senha_hash)
      if (!senhaValida) {
        await audit.registrarEvento({
          usuarioId: authUser.id,
          acao: 'LOGIN_FALHA',
          detalhes: { login: loginNormalizado, motivo: 'SENHA_INVALIDA' },
          ipOrigem,
        })
        throw new UnauthorizedError('Credenciais invalidas.')
      }

      const token = jwt.sign(
        {
          sub: authUser.id,
          login: authUser.login,
          perfil: authUser.perfil,
        },
        jwtConfig.secret,
        { expiresIn: jwtConfig.expiresIn },
      )

      await audit.registrarEvento({
        usuarioId: authUser.id,
        acao: 'LOGIN',
        detalhes: { login: authUser.login, perfil: authUser.perfil },
        ipOrigem,
      })

      const guicheAtual = guiches?.findByAtendenteId
        ? await guiches.findByAtendenteId(authUser.id)
        : null

      return {
        token,
        tipoToken: 'Bearer',
        usuario: mapUser(authUser),
        guicheAtual,
      }
    },

    async getProfile(userId) {
      const usuario = await users.findById(userId)
      if (!usuario || !usuario.ativo) {
        throw new UnauthorizedError('Usuario nao encontrado ou inativo.')
      }
      const guicheAtual = guiches?.findByAtendenteId
        ? await guiches.findByAtendenteId(userId)
        : null
      return { usuario, guicheAtual }
    },
  }
}

export const authService = createAuthService()
