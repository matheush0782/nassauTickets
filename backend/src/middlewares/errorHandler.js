import { AppError } from '../errors/AppError.js'

export function notFoundHandler(req, res) {
  res.status(404).json({
    sucesso: false,
    erro: 'Rota nao encontrada.',
    codigo: 'ROUTE_NOT_FOUND',
    detalhes: { caminho: req.originalUrl },
  })
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      sucesso: false,
      erro: 'JSON invalido no corpo da requisicao.',
      codigo: 'INVALID_JSON',
    })
  }

  if (err?.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      sucesso: false,
      erro: 'Registro duplicado no banco de dados.',
      codigo: 'DUPLICATE_ENTRY',
    })
  }

  if (err?.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      sucesso: false,
      erro: 'Referencia informada nao existe no banco de dados.',
      codigo: 'INVALID_REFERENCE',
    })
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      sucesso: false,
      erro: err.message,
      codigo: err.code,
    })
  }

  console.error('[errorHandler]', err)
  return res.status(500).json({
    sucesso: false,
    erro: 'Erro interno do servidor.',
    codigo: 'INTERNAL_ERROR',
  })
}
