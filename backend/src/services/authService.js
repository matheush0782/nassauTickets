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
    async login({ login, usuario, senha, ipOrigem = null }) {
      const loginInformado = login || usuario || ''
      const loginNormalizado = String(loginInformado).trim()
      const senhaTexto = String(senha || '')

      if (!loginNormalizado || !senhaTexto) {
        throw new ValidationError('Login e senha sao obrigatorios.')
      }

      const findUser = users.findAuthByLogin
        ? users.findAuthByLogin.bind(users)
        : users.findByLogin.bind(users)

      const user = await findUser(loginNormalizado)
      if (!user || !user.ativo) {
        if (audit?.registrarEvento) {
          await audit
            .registrarEvento({
              acao: 'LOGIN_FALHA',
              detalhes: {
                login: loginNormalizado,
                motivo: !user ? 'USUARIO_INEXISTENTE' : 'USUARIO_INATIVO',
              },
              ipOrigem,
            })
            .catch(() => {})
        }
        throw new UnauthorizedError('Credenciais invalidas.')
      }

      const hashParaComparar = user.senha_hash || user.senhaHash
      if (!hashParaComparar) {
        throw new UnauthorizedError('Credenciais invalidas.')
      }

      const senhaValida = await bcrypt.compare(senhaTexto, hashParaComparar)
      if (!senhaValida) {
        if (audit?.registrarEvento) {
          await audit
            .registrarEvento({
              usuarioId: user.id,
              acao: 'LOGIN_FALHA',
              detalhes: { login: loginNormalizado, motivo: 'SENHA_INCORRETA' },
              ipOrigem,
            })
            .catch(() => {})
        }
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

      const usuarioPublico = {
        id: user.id,
        nome: user.nome,
        login: user.login,
        usuario: user.login,
        email: user.email,
        perfil: user.perfil,
      }

      return {
        token,
        usuario: usuarioPublico,
        nome: user.nome,
        perfil: user.perfil,
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
