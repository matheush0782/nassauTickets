import { AppError } from '../errors/AppError.js'

export function notFoundHandler(req, res) {
  res.status(404).json({
    erro: 'Rota nao encontrada.',
    codigo: 'ROUTE_NOT_FOUND',
    caminho: req.originalUrl,
  })
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      erro: 'JSON invalido no corpo da requisicao.',
      codigo: 'INVALID_JSON',
    })
  }

  if (err?.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      erro: 'Registro duplicado no banco de dados.',
      codigo: 'DUPLICATE_ENTRY',
    })
  }

  if (err?.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      erro: 'Referencia informada nao existe no banco de dados.',
      codigo: 'INVALID_REFERENCE',
    })
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      erro: err.message,
      codigo: err.code,
    })
  }

  console.error('[errorHandler]', err)
  return res.status(500).json({
    erro: 'Erro interno do servidor.',
    codigo: 'INTERNAL_ERROR',
  })
}
