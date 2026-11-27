/**
 * Módulo de Prioridade — nassauTickets
 *
 * Determina qual senha deve ser chamada com base nas regras de prioridade,
 * respeitando a alternância SP → SE|SG → SP → SE|SG e a ordem FIFO.
 *
 * Regras atendidas: RN02, RN04, RN05, RN06, RN07, RN08, RN18, RN27, RN28.
 *
 * Uso:
 *   import { ControlePrioridade } from './prioridade.mjs';
 *   const ctrl = new ControlePrioridade();
 *   const senha = ctrl.selecionarProxima(senhasAguardando);
 */

import { validarGuicheLivre } from './estados.mjs';

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

/**
 * Gera o prefixo de data no formato YYMMDD, usando o fuso horário informado.
 *
 * @param {Date}   [data=new Date()]           - Data de referência.
 * @param {string} [fusoHorario='America/Recife'] - Fuso horário IANA.
 * @returns {string} Prefixo no formato YYMMDD (ex.: '261127').
 */
export function prefixoDia(data = new Date(), fusoHorario = 'America/Recife') {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: fusoHorario,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(data);

  const ano = partes.find(p => p.type === 'year').value.slice(-2);
  const mes = partes.find(p => p.type === 'month').value;
  const dia = partes.find(p => p.type === 'day').value;
  return `${ano}${mes}${dia}`;
}

/**
 * Determina a ordem de busca com base no último tipo chamado.
 *
 * | Último tipo chamado            | Ordem de busca           |
 * |--------------------------------|--------------------------|
 * | Nenhum (início do dia), SE, SG | SP → SE → SG             |
 * | SP                             | SE → SG → SP             |
 *
 * @param {string|null} ultimoTipo - Último tipo chamado ('SP', 'SE', 'SG' ou null).
 * @returns {string[]} Ordem de preferência.
 */
export function ordemDeBusca(ultimoTipo) {
  if (ultimoTipo === 'SP') return ['SE', 'SG', 'SP'];
  return ['SP', 'SE', 'SG']; // null, 'SE' ou 'SG'
}

// ---------------------------------------------------------------------------
// Classe principal
// ---------------------------------------------------------------------------

export class ControlePrioridade {
  /**
   * @param {Object}       [opcoes]
   * @param {() => string} [opcoes.obterDia] - Função que retorna o dia atual
   *   no formato YYMMDD. Padrão: usa `prefixoDia()` com fuso America/Recife.
   *   Permite injetar um dia fixo para facilitar os testes.
   */
  constructor({ obterDia } = {}) {
    /** @private */
    this._obterDia = obterDia || (() => prefixoDia());
    /** @private */
    this._diaAtual = this._obterDia();
    /** @private */
    this._ultimoTipoChamado = null;
  }

  // -------------------------------------------------------------------------
  // Virada de dia (RN28)
  // -------------------------------------------------------------------------

  /**
   * Verifica se o dia mudou desde a última operação.
   * Se mudou, reinicia a alternância de prioridade:
   *   - `_ultimoTipoChamado` volta a `null` → primeiro do dia será SP.
   *
   * @returns {boolean} `true` se houve virada de dia.
   */
  verificarViradaDeDia() {
    const hoje = this._obterDia();
    if (hoje !== this._diaAtual) {
      this._diaAtual = hoje;
      this._ultimoTipoChamado = null;
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Seleção da próxima senha (RN04–RN08)
  // -------------------------------------------------------------------------

  /**
   * Seleciona a próxima senha a ser chamada, respeitando as regras:
   *
   * 1. Verifica virada de dia (reinicia a alternância se necessário).
   * 2. Determina a ordem de busca com base no último tipo chamado.
   * 3. Percorre os tipos na ordem e retorna a primeira senha encontrada (FIFO).
   *
   * **Importante sobre concorrência (RN27):**
   * Em chamadas sequenciais, basta que o chamador remova/atualize a senha
   * selecionada antes da próxima chamada. Para concorrência real entre
   * guichês, o chamador deve usar transação com bloqueio no banco de dados
   * (`SELECT … FOR UPDATE`). Consulte o README-DEV2.md para detalhes.
   *
   * @param {Array}  senhasAguardando - Senhas com status AGUARDANDO do dia
   *   atual. Cada objeto deve ter ao menos `{ id, tipo, emitidaEm }`.
   *   O módulo ordena internamente por `emitidaEm` para garantir FIFO.
   * @param {Set|Array|Object} [opcoesOuExcluidos=new Set()] - IDs a excluir da
   *   seleção, ou objeto `{ idsExcluidos, guiche, senhasTotais }`.
   *   Se `guiche` for informado, valida se o guichê está livre (RN18).
   * @returns {Object|null} A senha selecionada, ou `null` se a fila estiver vazia.
   */
  selecionarProxima(senhasAguardando, opcoesOuExcluidos = new Set()) {
    this.verificarViradaDeDia();

    if (!senhasAguardando || senhasAguardando.length === 0) return null;

    let setExcluidos = new Set();
    let guiche = null;
    let senhasTotais = senhasAguardando;

    if (opcoesOuExcluidos instanceof Set) {
      setExcluidos = opcoesOuExcluidos;
    } else if (Array.isArray(opcoesOuExcluidos)) {
      setExcluidos = new Set(opcoesOuExcluidos);
    } else if (opcoesOuExcluidos && typeof opcoesOuExcluidos === 'object') {
      if (opcoesOuExcluidos.idsExcluidos) {
        setExcluidos = opcoesOuExcluidos.idsExcluidos instanceof Set
          ? opcoesOuExcluidos.idsExcluidos
          : new Set(opcoesOuExcluidos.idsExcluidos);
      }
      if (opcoesOuExcluidos.guiche !== undefined) {
        guiche = opcoesOuExcluidos.guiche;
      }
      if (Array.isArray(opcoesOuExcluidos.senhasTotais)) {
        senhasTotais = opcoesOuExcluidos.senhasTotais;
      }
    }

    // Se informado o guichê, validar se ele está livre (RN18)
    if (guiche !== null) {
      validarGuicheLivre(senhasTotais, guiche);
    }

    // Garantir FIFO: ordenar por data de emissão (mais antiga primeiro)
    // e filtrar somente senhas elegíveis (AGUARDANDO e não excluídas)
    const ordenadas = [...senhasAguardando]
      .filter(s => {
        if (!s) return false;
        if (s.status && s.status !== 'AGUARDANDO') return false;
        if (setExcluidos.has(s.id)) return false;
        return true;
      })
      .sort((a, b) => new Date(a.emitidaEm) - new Date(b.emitidaEm));

    if (ordenadas.length === 0) return null;

    // Percorrer os tipos na ordem de prioridade
    const ordem = ordemDeBusca(this._ultimoTipoChamado);

    for (const tipo of ordem) {
      const candidata = ordenadas.find(s => s.tipo === tipo);
      if (candidata) {
        this._ultimoTipoChamado = tipo;
        return candidata;
      }
    }

    // Nenhuma senha encontrada
    return null;
  }

  // -------------------------------------------------------------------------
  // Reinício manual
  // -------------------------------------------------------------------------

  /**
   * Reinicia o controle de prioridade manualmente.
   * Útil em cenários de teste ou quando o integrador detecta a virada de dia
   * por conta própria.
   */
  reiniciarDia() {
    this._ultimoTipoChamado = null;
    this._diaAtual = this._obterDia();
  }

  // -------------------------------------------------------------------------
  // Getters
  // -------------------------------------------------------------------------

  /** Último tipo chamado: `'SP'`, `'SE'`, `'SG'` ou `null` (início do dia). */
  get ultimoTipoChamado() {
    return this._ultimoTipoChamado;
  }

  /** Dia atual no formato YYMMDD. */
  get diaAtual() {
    return this._diaAtual;
  }
}
