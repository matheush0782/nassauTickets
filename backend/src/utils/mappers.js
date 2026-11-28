export function mapUser(row) {
  if (!row) return null
  return {
    id: row.id,
    nome: row.nome,
    login: row.login,
    email: row.email ?? null,
    perfil: row.perfil,
    ativo: Boolean(row.ativo),
    criadoEm: row.criado_em ?? null,
    atualizadoEm: row.atualizado_em ?? null,
  }
}

export function mapGuiche(row) {
  if (!row) return null
  return {
    id: row.id,
    numero: row.numero,
    descricao: row.descricao ?? null,
    ativo: Boolean(row.ativo),
    atendenteAtualId: row.atendente_atual_id ?? null,
    atendenteNome: row.atendente_nome ?? null,
    atendenteLogin: row.atendente_login ?? null,
    criadoEm: row.criado_em ?? null,
    atualizadoEm: row.atualizado_em ?? null,
  }
}

export function mapTicket(row) {
  if (!row) return null
  return {
    id: row.id,
    codigo: row.codigo,
    tipo: row.tipo,
    dataReferencia:
      row.data_referencia instanceof Date
        ? row.data_referencia.toISOString().slice(0, 10)
        : row.data_referencia ?? null,
    sequencial: row.sequencial,
    status: row.status,
    guicheId: row.guiche_id ?? null,
    guicheNumero: row.guiche_numero ?? null,
    atendenteId: row.atendente_id ?? null,
    atendenteNome: row.atendente_nome ?? null,
    atendenteLogin: row.atendente_login ?? null,
    emitidaEm: row.emitida_em ?? null,
    primeiraChamadaEm: row.primeira_chamada_em ?? null,
    segundaChamadaEm: row.segunda_chamada_em ?? null,
    inicioAtendimentoEm: row.inicio_atendimento_em ?? null,
    fimAtendimentoEm: row.fim_atendimento_em ?? null,
    tempoAtendimentoSegundos: row.tempo_atendimento_segundos ?? null,
    atualizadoEm: row.atualizado_em ?? null,
  }
}

export function mapAuditEvent(row) {
  if (!row) return null
  let detalhes = row.detalhes ?? null
  if (typeof detalhes === 'string') {
    try {
      detalhes = JSON.parse(detalhes)
    } catch {
      // mantem string original caso nao seja JSON valido
    }
  }
  return {
    id: row.id,
    usuarioId: row.usuario_id ?? null,
    usuarioLogin: row.usuario_login ?? null,
    usuarioNome: row.usuario_nome ?? null,
    senhaId: row.senha_id ?? null,
    senhaCodigo: row.senha_codigo ?? null,
    guicheId: row.guiche_id ?? null,
    guicheNumero: row.guiche_numero ?? null,
    acao: row.acao,
    detalhes,
    ipOrigem: row.ip_origem ?? null,
    criadoEm: row.criado_em ?? null,
  }
}
