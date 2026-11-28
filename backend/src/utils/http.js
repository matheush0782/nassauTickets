import { ValidationError } from '../errors/AppError.js'

export function sendSuccess(res, dados, { statusCode = 200, mensagem = null } = {}) {
  const payload = {
    sucesso: true,
    dados,
  }
  if (mensagem) {
    payload.mensagem = mensagem
  }
  return res.status(statusCode).json(payload)
}

export function parsePositiveInt(value, fieldName = 'id') {
  const num = Number(value)
  if (!Number.isInteger(num) || num <= 0) {
    throw new ValidationError(`Parametro "${fieldName}" deve ser um inteiro positivo.`)
  }
  return num
}
