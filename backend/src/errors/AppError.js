export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.code = code
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Dados invalidos.', code = 'VALIDATION_ERROR') {
    super(message, 400, code)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Nao autenticado.', code = 'UNAUTHORIZED') {
    super(message, 401, code)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado para este perfil.', code = 'FORBIDDEN') {
    super(message, 403, code)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso nao encontrado.', code = 'NOT_FOUND') {
    super(message, 404, code)
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflito de dados.', code = 'CONFLICT') {
    super(message, 409, code)
  }
}
