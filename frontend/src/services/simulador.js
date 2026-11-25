/*
 * Simulador local do backend (Agente Sistema - AS).
 *
 * Usado SOMENTE enquanto a API REST do backend nao estiver disponivel
 * (variavel VITE_API_URL nao configurada). Os dados ficam no localStorage
 * do navegador, o que permite abrir o Totem, o Painel e o Terminal em abas
 * diferentes e ver a sincronizacao entre elas.
 *
 * Quando o backend (Desenvolvedores 1 e 2) estiver pronto, basta definir
 * VITE_API_URL no arquivo frontend/.env e o frontend passara a consumir a API.
 */

const CHAVE = 'nassauTickets:dados'
export const CHAVE_SESSAO = 'nassauTickets:sessao'

export const HORA_INICIO = 7
export const HORA_FIM = 17

const USUARIOS = [
  { usuario: 'atendente1', senha: '1234', nome: 'Atendente 1', perfil: 'ATENDENTE' },
  { usuario: 'atendente2', senha: '1234', nome: 'Atendente 2', perfil: 'ATENDENTE' },
  { usuario: 'gestor', senha: 'admin123', nome: 'Gestor', perfil: 'GESTOR' },
]

const ignorarExpediente = import.meta.env.VITE_IGNORAR_EXPEDIENTE === 'true'

function estadoInicial() {
  return { senhas: [], sequencias: {}, ultimoTipoChamado: null, proximoId: 1 }
}

function ler() {
  try {
    const bruto = localStorage.getItem(CHAVE)
    return bruto ? JSON.parse(bruto) : estadoInicial()
  } catch {
    return estadoInicial()
  }
}

function salvar(dados) {
  localStorage.setItem(CHAVE, JSON.stringify(dados))
}

function prefixoData(data = new Date()) {
  const ano = String(data.getFullYear()).slice(-2)
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}${mes}${dia}`
}

export function dentroDoExpediente(data = new Date()) {
  if (ignorarExpediente) return true
  const hora = data.getHours()
  return hora >= HORA_INICIO && hora < HORA_FIM
}

function erro(mensagem) {
  return new Error(mensagem)
}

// Simula a latencia de rede para que os estados de "carregando" aparecam
function responder(valor) {
  return new Promise((resolve) => setTimeout(() => resolve(valor), 120))
}

/* ---------------- Totem (AC) ---------------- */

export function emitirSenha(tipo) {
  if (!['SP', 'SG', 'SE'].includes(tipo)) throw erro('Tipo de senha invalido.')
  const dados = ler()
  const dia = prefixoData()
  const chaveSeq = `${dia}-${tipo}`
  const seq = (dados.sequencias[chaveSeq] ?? 0) + 1
  if (seq > 999) throw erro('Limite diario de senhas para este tipo atingido.')
  dados.sequencias[chaveSeq] = seq

  const senha = {
    id: dados.proximoId++,
    numero: `${dia}-${tipo}${String(seq).padStart(3, '0')}`,
    tipo,
    status: 'AGUARDANDO', // EMITIDA -> AGUARDANDO ocorre imediatamente apos a emissao
    emitidaEm: new Date().toISOString(),
    chamadas: [],
    guiche: null,
    atendente: null,
    inicioEm: null,
    fimEm: null,
  }
  dados.senhas.push(senha)
  salvar(dados)
  return responder(senha)
}

/* ---------------- Painel ---------------- */

export function listarUltimasChamadas(limite = 5) {
  const { senhas } = ler()
  const chamadas = senhas
    .filter((s) => s.chamadas.length > 0)
    .sort((a, b) => ultimaChamada(b) - ultimaChamada(a))
    .slice(0, limite)
  return responder(chamadas)
}

function ultimaChamada(senha) {
  return new Date(senha.chamadas[senha.chamadas.length - 1]).getTime()
}

/* ---------------- Terminal do atendente (AA) ---------------- */

export function resumoFila() {
  const { senhas } = ler()
  const aguardando = senhas.filter((s) => s.status === 'AGUARDANDO')
  return responder({
    total: aguardando.length,
    SP: aguardando.filter((s) => s.tipo === 'SP').length,
    SE: aguardando.filter((s) => s.tipo === 'SE').length,
    SG: aguardando.filter((s) => s.tipo === 'SG').length,
    expedienteAberto: dentroDoExpediente(),
  })
}

export function atendimentoAtual(guiche) {
  const { senhas } = ler()
  const atual = senhas.find(
    (s) =>
      s.guiche === guiche &&
      ['CHAMADA', 'CHAMADA_NOVAMENTE', 'EM_ATENDIMENTO'].includes(s.status),
  )
  return responder(atual ?? null)
}

// Ordem de preferencia: [SP] -> [SE|SG] -> [SP] -> [SE|SG]
function ordemDePrioridade(ultimoTipo) {
  if (ultimoTipo === 'SP') return ['SE', 'SG', 'SP']
  return ['SP', 'SE', 'SG']
}

export function chamarProxima({ guiche, atendente }) {
  if (!dentroDoExpediente()) {
    throw erro(`Fora do expediente (${HORA_INICIO}h as ${HORA_FIM}h). Nao e possivel chamar senhas.`)
  }
  const dados = ler()
  const ocupado = dados.senhas.find(
    (s) => s.guiche === guiche && ['CHAMADA', 'CHAMADA_NOVAMENTE', 'EM_ATENDIMENTO'].includes(s.status),
  )
  if (ocupado) throw erro(`O guiche ${guiche} ja possui a senha ${ocupado.numero} em andamento.`)

  let escolhida = null
  for (const tipo of ordemDePrioridade(dados.ultimoTipoChamado)) {
    escolhida = dados.senhas.find((s) => s.status === 'AGUARDANDO' && s.tipo === tipo)
    if (escolhida) break
  }
  if (!escolhida) throw erro('Nao ha senhas aguardando na fila.')

  escolhida.status = 'CHAMADA'
  escolhida.guiche = guiche
  escolhida.atendente = atendente
  escolhida.chamadas.push(new Date().toISOString())
  dados.ultimoTipoChamado = escolhida.tipo
  salvar(dados)
  return responder(escolhida)
}

function alterarSenha(id, alteracao) {
  const dados = ler()
  const senha = dados.senhas.find((s) => s.id === id)
  if (!senha) throw erro('Senha nao encontrada.')
  alteracao(senha)
  salvar(dados)
  return responder(senha)
}

export function chamarNovamente(id) {
  return alterarSenha(id, (s) => {
    if (s.status !== 'CHAMADA') throw erro('Somente uma senha chamada uma vez pode ser chamada novamente.')
    s.status = 'CHAMADA_NOVAMENTE'
    s.chamadas.push(new Date().toISOString())
  })
}

export function iniciarAtendimento(id) {
  return alterarSenha(id, (s) => {
    if (!['CHAMADA', 'CHAMADA_NOVAMENTE'].includes(s.status)) throw erro('A senha nao esta em chamada.')
    s.status = 'EM_ATENDIMENTO'
    s.inicioEm = new Date().toISOString()
  })
}

export function finalizarAtendimento(id) {
  return alterarSenha(id, (s) => {
    if (s.status !== 'EM_ATENDIMENTO') throw erro('O atendimento ainda nao foi iniciado.')
    s.status = 'ATENDIDA'
    s.fimEm = new Date().toISOString()
  })
}

export function registrarNaoComparecimento(id) {
  return alterarSenha(id, (s) => {
    if (s.status !== 'CHAMADA_NOVAMENTE') {
      throw erro('O nao comparecimento so pode ser registrado apos a segunda chamada.')
    }
    s.status = 'NAO_COMPARECEU'
  })
}

export function encerrarExpediente() {
  const dados = ler()
  let descartadas = 0
  dados.senhas.forEach((s) => {
    if (s.status === 'AGUARDANDO') {
      s.status = 'DESCARTADA'
      descartadas++
    }
  })
  salvar(dados)
  return responder({ descartadas })
}

/* ---------------- Login ---------------- */

export function login(usuario, senha) {
  const encontrado = USUARIOS.find((u) => u.usuario === usuario && u.senha === senha)
  if (!encontrado) throw erro('Usuario ou senha invalidos.')
  const { senha: _ignorada, ...semSenha } = encontrado
  void _ignorada
  return responder({ ...semSenha, token: `simulado-${encontrado.usuario}` })
}

/* ---------------- Relatorios (Gestor) ---------------- */

export function listarSenhasDoPeriodo(periodo, referencia) {
  // periodo: 'diario' (referencia = 'AAAA-MM-DD') | 'mensal' (referencia = 'AAAA-MM')
  const { senhas } = ler()
  const filtradas = senhas.filter((s) => {
    const d = new Date(s.emitidaEm)
    const ano = d.getFullYear()
    const mes = String(d.getMonth() + 1).padStart(2, '0')
    const dia = String(d.getDate()).padStart(2, '0')
    return periodo === 'mensal' ? `${ano}-${mes}` === referencia : `${ano}-${mes}-${dia}` === referencia
  })
  return responder(filtradas)
}

export function limparDados() {
  localStorage.removeItem(CHAVE)
  return responder(true)
}
