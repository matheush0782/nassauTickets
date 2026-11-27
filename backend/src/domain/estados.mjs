/**
 * Máquina de Estados — nassauTickets
 *
 * Define os estados válidos de uma senha e as transições permitidas,
 * conforme o diagrama de estados em docs/requirements/regras-de-negocio.md.
 *
 * Regras atendidas: RN14, RN15, RN17, RN20, RN21.
 *
 * Uso:
 *   import { ESTADOS, transitar, podeTransitar } from './estados.mjs';
 *   transitar(senha, ESTADOS.AGUARDANDO); // EMITIDA → AGUARDANDO
 */

// ---------------------------------------------------------------------------
// Enum de estados
// ---------------------------------------------------------------------------

/** Todos os estados válidos de uma senha. */
export const ESTADOS = Object.freeze({
  EMITIDA:           'EMITIDA',
  AGUARDANDO:        'AGUARDANDO',
  CHAMADA:           'CHAMADA',
  CHAMADA_NOVAMENTE: 'CHAMADA_NOVAMENTE',
  EM_ATENDIMENTO:    'EM_ATENDIMENTO',
  ATENDIDA:          'ATENDIDA',
  NAO_COMPARECEU:    'NAO_COMPARECEU',
  DESCARTADA:        'DESCARTADA',
});

// ---------------------------------------------------------------------------
// Mapa de transições permitidas
// ---------------------------------------------------------------------------

/**
 * Para cada estado, lista os estados para os quais a transição é válida.
 *
 * EMITIDA           → AGUARDANDO
 * AGUARDANDO        → CHAMADA | DESCARTADA
 * CHAMADA           → CHAMADA_NOVAMENTE | EM_ATENDIMENTO
 * CHAMADA_NOVAMENTE → EM_ATENDIMENTO | NAO_COMPARECEU
 * EM_ATENDIMENTO    → ATENDIDA
 * ATENDIDA          → (nenhuma — estado final)
 * NAO_COMPARECEU    → (nenhuma — estado final)
 * DESCARTADA        → (nenhuma — estado final)
 */
const TRANSICOES = Object.freeze({
  [ESTADOS.EMITIDA]:           [ESTADOS.AGUARDANDO],
  [ESTADOS.AGUARDANDO]:        [ESTADOS.CHAMADA, ESTADOS.DESCARTADA],
  [ESTADOS.CHAMADA]:           [ESTADOS.CHAMADA_NOVAMENTE, ESTADOS.EM_ATENDIMENTO],
  [ESTADOS.CHAMADA_NOVAMENTE]: [ESTADOS.EM_ATENDIMENTO, ESTADOS.NAO_COMPARECEU],
  [ESTADOS.EM_ATENDIMENTO]:    [ESTADOS.ATENDIDA],
  [ESTADOS.ATENDIDA]:          [],
  [ESTADOS.NAO_COMPARECEU]:    [],
  [ESTADOS.DESCARTADA]:        [],
});

// ---------------------------------------------------------------------------
// Conjuntos auxiliares
// ---------------------------------------------------------------------------

/** Estados finais — a senha não pode mais mudar de estado. */
const ESTADOS_FINAIS = new Set([
  ESTADOS.ATENDIDA,
  ESTADOS.NAO_COMPARECEU,
  ESTADOS.DESCARTADA,
]);

/** Estados que indicam que o guichê está ocupado (senha em andamento). */
const ESTADOS_ATIVOS = new Set([
  ESTADOS.CHAMADA,
  ESTADOS.CHAMADA_NOVAMENTE,
  ESTADOS.EM_ATENDIMENTO,
]);

// ---------------------------------------------------------------------------
// Funções públicas
// ---------------------------------------------------------------------------

/**
 * Verifica se a transição de `estadoAtual` para `novoEstado` é permitida.
 *
 * @param {string} estadoAtual - Estado atual da senha.
 * @param {string} novoEstado  - Estado desejado.
 * @returns {boolean} `true` se a transição é válida.
 */
export function podeTransitar(estadoAtual, novoEstado) {
  const permitidos = TRANSICOES[estadoAtual];
  if (!permitidos) return false;
  return permitidos.includes(novoEstado);
}

/**
 * Realiza a transição de estado em um objeto senha.
 *
 * Lança um `Error` com mensagem descritiva em português se a transição
 * não for permitida ou se os parâmetros forem inválidos.
 *
 * @param {Object} senha      - Objeto com ao menos `{ status: string }`.
 * @param {string} novoEstado - Estado destino.
 * @returns {Object} O mesmo objeto `senha`, com `status` atualizado.
 * @throws {Error} Se a transição for inválida.
 */
export function transitar(senha, novoEstado) {
  // --- Validações de entrada ---
  if (!senha || typeof senha.status !== 'string') {
    throw new Error('Objeto senha inválido: deve possuir a propriedade "status".');
  }

  const todosEstados = Object.values(ESTADOS);

  if (!todosEstados.includes(senha.status)) {
    throw new Error(`Estado atual "${senha.status}" não é um estado válido.`);
  }

  if (!todosEstados.includes(novoEstado)) {
    throw new Error(`Estado "${novoEstado}" não é um estado válido.`);
  }

  // --- Validação da transição ---
  if (!podeTransitar(senha.status, novoEstado)) {
    const id = senha.numero || senha.id || '(desconhecida)';
    const permitidos = TRANSICOES[senha.status];
    const listaPermitidos = permitidos.length > 0
      ? permitidos.join(', ')
      : 'nenhuma (estado final)';

    throw new Error(
      `Transição não permitida: ${senha.status} → ${novoEstado} ` +
      `(senha ${id}). ` +
      `Transições válidas a partir de ${senha.status}: ${listaPermitidos}.`,
    );
  }

  senha.status = novoEstado;
  return senha;
}

/**
 * Verifica se o estado é final (ATENDIDA, NAO_COMPARECEU ou DESCARTADA).
 * Uma senha em estado final não pode mais mudar de estado.
 *
 * @param {string} estado
 * @returns {boolean}
 */
export function ehEstadoFinal(estado) {
  return ESTADOS_FINAIS.has(estado);
}

/**
 * Verifica se o estado indica que o guichê está ocupado
 * (CHAMADA, CHAMADA_NOVAMENTE ou EM_ATENDIMENTO).
 *
 * @param {string} estado
 * @returns {boolean}
 */
export function ehEstadoAtivo(estado) {
  return ESTADOS_ATIVOS.has(estado);
}

// ---------------------------------------------------------------------------
// Controle de Ocupação de Guichê (RN18)
// ---------------------------------------------------------------------------

/**
 * Localiza a senha em andamento no guichê especificado (CHAMADA, CHAMADA_NOVAMENTE ou EM_ATENDIMENTO).
 * Retorna o objeto senha ou `null` se o guichê estiver livre.
 *
 * @param {Array}  senhas   - Lista de senhas.
 * @param {number|string} guiche - Identificador do guichê.
 * @returns {Object|null}
 */
export function obterAtendimentoAtualDoGuiche(senhas, guiche) {
  if (!Array.isArray(senhas)) return null;
  return senhas.find(
    s => s && s.guiche === guiche && ehEstadoAtivo(s.status)
  ) ?? null;
}

/**
 * Verifica se um determinado guichê possui atendimento em andamento (RN18).
 *
 * @param {Array}  senhas   - Lista de senhas.
 * @param {number|string} guiche - Identificador do guichê.
 * @returns {boolean} `true` se o guichê estiver ocupado.
 */
export function guicheEstaOcupado(senhas, guiche) {
  return obterAtendimentoAtualDoGuiche(senhas, guiche) !== null;
}

/**
 * Valida se o guichê está livre para realizar uma nova chamada (RN18).
 * Lança um `Error` caso o guichê já possua senha em andamento.
 *
 * @param {Array}  senhas   - Lista de senhas.
 * @param {number|string} guiche - Identificador do guichê.
 * @returns {boolean} `true` se estiver livre.
 * @throws {Error} Se o guichê já possuir senha em andamento.
 */
export function validarGuicheLivre(senhas, guiche) {
  const ocupado = obterAtendimentoAtualDoGuiche(senhas, guiche);
  if (ocupado) {
    const num = ocupado.numero || ocupado.id || '';
    throw new Error(`O guichê ${guiche} já possui a senha ${num} em andamento.`);
  }
  return true;
}

