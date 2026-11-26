/*
 * Camada de comunicacao com o backend (API REST + JSON).
 *
 * - Se VITE_API_URL estiver definida (ex.: http://localhost:3000/api),
 *   todas as chamadas sao feitas via fetch para o backend real.
 * - Caso contrario, usa o simulador local (services/simulador.js),
 *   permitindo desenvolver e testar o frontend sem o backend.
 *
 * O contrato esperado de cada rota esta documentado em frontend/README.md.
 */
import * as simulador from './simulador.js'

const API_URL = import.meta.env.VITE_API_URL
export const usandoSimulador = !API_URL

function tokenAtual() {
  try {
    return JSON.parse(sessionStorage.getItem(simulador.CHAVE_SESSAO))?.token ?? null
  } catch {
    return null
  }
}

async function requisicao(caminho, opcoes = {}) {
  const token = tokenAtual()
  let resposta
  try {
    resposta = await fetch(`${API_URL}${caminho}`, {
      ...opcoes,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opcoes.headers,
      },
      body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
    })
  } catch {
    const falha = new Error('Nao foi possivel conectar ao servidor.')
    falha.offline = true
    throw falha
  }
  const corpo = await resposta.json().catch(() => null)
  if (!resposta.ok) {
    throw new Error(corpo?.mensagem ?? `Erro ${resposta.status} ao comunicar com o servidor.`)
  }
  return corpo
}

// Executa a funcao do simulador garantindo que erros sincronos virem Promise rejeitada
async function simular(fn, ...args) {
  return fn(...args)
}

/* -------- Totem -------- */
export function emitirSenha(tipo) {
  return usandoSimulador
    ? simular(simulador.emitirSenha, tipo)
    : requisicao('/senhas', { method: 'POST', body: { tipo } })
}

/* -------- Painel -------- */
export function listarUltimasChamadas() {
  return usandoSimulador
    ? simular(simulador.listarUltimasChamadas, 5)
    : requisicao('/painel/ultimas-chamadas?limite=5')
}

/* -------- Terminal do atendente -------- */
export function resumoFila() {
  return usandoSimulador ? simular(simulador.resumoFila) : requisicao('/fila/resumo')
}

export function atendimentoAtual(guiche) {
  return usandoSimulador
    ? simular(simulador.atendimentoAtual, guiche)
    : requisicao(`/guiches/${guiche}/atendimento-atual`)
}

export function chamarProxima(guiche, atendente) {
  return usandoSimulador
    ? simular(simulador.chamarProxima, { guiche, atendente })
    : requisicao('/atendimentos/chamar-proxima', { method: 'POST', body: { guiche } })
}

export function chamarNovamente(id) {
  return usandoSimulador
    ? simular(simulador.chamarNovamente, id)
    : requisicao(`/senhas/${id}/chamar-novamente`, { method: 'POST' })
}

export function iniciarAtendimento(id) {
  return usandoSimulador
    ? simular(simulador.iniciarAtendimento, id)
    : requisicao(`/senhas/${id}/iniciar`, { method: 'POST' })
}

export function finalizarAtendimento(id) {
  return usandoSimulador
    ? simular(simulador.finalizarAtendimento, id)
    : requisicao(`/senhas/${id}/finalizar`, { method: 'POST' })
}

export function registrarNaoComparecimento(id) {
  return usandoSimulador
    ? simular(simulador.registrarNaoComparecimento, id)
    : requisicao(`/senhas/${id}/nao-compareceu`, { method: 'POST' })
}

export function encerrarExpediente() {
  return usandoSimulador
    ? simular(simulador.encerrarExpediente)
    : requisicao('/expediente/encerrar', { method: 'POST' })
}

export function reabrirExpediente() {
  return usandoSimulador
    ? simular(simulador.reabrirExpediente)
    : requisicao('/expediente/reabrir', { method: 'POST' })
}

export function consultarExpediente() {
  return usandoSimulador ? simular(simulador.consultarExpediente) : requisicao('/expediente')
}

/* -------- Login -------- */
export async function login(usuario, senha) {
  const dados = usandoSimulador
    ? await simular(simulador.login, usuario, senha)
    : await requisicao('/auth/login', { method: 'POST', body: { usuario, senha } })
  sessionStorage.setItem(simulador.CHAVE_SESSAO, JSON.stringify(dados))
  return dados
}

export function logout() {
  sessionStorage.removeItem(simulador.CHAVE_SESSAO)
}

export function sessaoAtual() {
  try {
    return JSON.parse(sessionStorage.getItem(simulador.CHAVE_SESSAO))
  } catch {
    return null
  }
}

/* -------- Relatorios -------- */
export function listarSenhasDoPeriodo(periodo, referencia) {
  return usandoSimulador
    ? simular(simulador.listarSenhasDoPeriodo, periodo, referencia)
    : requisicao(`/relatorios/senhas?periodo=${periodo}&referencia=${referencia}`)
}
