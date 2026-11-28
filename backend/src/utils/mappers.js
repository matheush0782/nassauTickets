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
  const primeiraChamada = row.primeira_chamada_em ?? row.primeiraChamadaEm ?? null
  const segundaChamada = row.segunda_chamada_em ?? row.segundaChamadaEm ?? null
  const chamadas = Array.isArray(row.chamadas)
    ? row.chamadas
    : [primeiraChamada, segundaChamada].filter(Boolean)

  const guicheNum = row.guiche_numero ?? row.guicheNumero ?? row.guiche ?? null
  const atendenteNome = row.atendente_nome ?? row.atendenteNome ?? row.atendente ?? null

  return {
    id: row.id,
    codigo: row.codigo ?? row.numero,
    numero: row.codigo ?? row.numero,
    tipo: row.tipo,
    dataReferencia:
      row.data_referencia instanceof Date
        ? row.data_referencia.toISOString().slice(0, 10)
        : row.data_referencia ?? row.dataReferencia ?? null,
    sequencial: row.sequencial,
    status: row.status,
    guicheId: row.guiche_id ?? row.guicheId ?? null,
    guicheNumero: guicheNum,
    guiche: guicheNum,
    atendenteId: row.atendente_id ?? row.atendenteId ?? null,
    atendenteNome: atendenteNome,
    atendenteLogin: row.atendente_login ?? row.atendenteLogin ?? null,
    atendente: atendenteNome,
    emitidaEm: row.emitida_em ?? row.emitidaEm ?? null,
    primeiraChamadaEm: primeiraChamada,
    segundaChamadaEm: segundaChamada,
    chamadas,
    inicioAtendimentoEm: row.inicio_atendimento_em ?? row.inicioAtendimentoEm ?? row.inicioEm ?? null,
    inicioEm: row.inicio_atendimento_em ?? row.inicioAtendimentoEm ?? row.inicioEm ?? null,
    fimAtendimentoEm: row.fim_atendimento_em ?? row.fimAtendimentoEm ?? row.fimEm ?? null,
    fimEm: row.fim_atendimento_em ?? row.fimAtendimentoEm ?? row.fimEm ?? null,
    tempoAtendimentoSegundos: row.tempo_atendimento_segundos ?? row.tempoAtendimentoSegundos ?? null,
    atualizadoEm: row.atualizado_em ?? row.atualizadoEm ?? null,
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
