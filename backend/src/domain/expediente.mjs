/**
 * Módulo de Expediente — nassauTickets
 *
 * Controla a abertura e o fechamento do expediente, verificando se
 * operações (emissão, chamada, finalização) são permitidas com base
 * no horário local (America/Recife) e no encerramento manual pelo gestor.
 *
 * Regras atendidas: RN19, RN20, RN21, RN28, RN29.
 *
 * Uso:
 *   import { ControleExpediente } from './expediente.mjs';
 *   const exp = new ControleExpediente();
 *   const { aberto, motivo } = exp.estaAberto();
 */

import { ESTADOS, transitar } from './estados.mjs';

// ---------------------------------------------------------------------------
// Constantes exportáveis
// ---------------------------------------------------------------------------


/** Hora de início do expediente (inclusive). */
export const HORA_INICIO = 7;

/** Hora de fim do expediente (exclusive — 17:00 já está fechado). */
export const HORA_FIM = 17;

/** Fuso horário padrão do sistema. */
export const FUSO_HORARIO = 'America/Recife';

// ---------------------------------------------------------------------------
// Funções internas de fuso horário
// ---------------------------------------------------------------------------

/**
 * Extrai a hora local (0–23) de um `Date` no fuso horário especificado,
 * usando a API `Intl` nativa (sem dependências externas).
 *
 * @param {Date}   data
 * @param {string} fusoHorario
 * @returns {number} Hora (0–23).
 */
function horaLocal(data, fusoHorario) {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: fusoHorario,
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(data);
  return parseInt(partes.find(p => p.type === 'hour').value, 10);
}

/**
 * Gera uma string que identifica o dia local (YYYY-MM-DD) no fuso especificado.
 * Usada para detectar virada de dia.
 *
 * @param {Date}   data
 * @param {string} fusoHorario
 * @returns {string} Dia no formato 'YYYY-MM-DD'.
 */
function diaLocal(data, fusoHorario) {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: fusoHorario,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(data);
  const ano = partes.find(p => p.type === 'year').value;
  const mes = partes.find(p => p.type === 'month').value;
  const dia = partes.find(p => p.type === 'day').value;
  return `${ano}-${mes}-${dia}`;
}

// ---------------------------------------------------------------------------
// Classe principal
// ---------------------------------------------------------------------------

export class ControleExpediente {
  /**
   * @param {Object}      [opcoes]
   * @param {() => Date}  [opcoes.agora] - Função que retorna a data/hora atual.
   *   Permite injetar datas simuladas para facilitar os testes.
   * @param {string}      [opcoes.fusoHorario='America/Recife'] - Fuso horário IANA.
   */
  constructor({ agora, fusoHorario } = {}) {
    /** @private */
    this._agora = agora || (() => new Date());
    /** @private */
    this._fusoHorario = fusoHorario || FUSO_HORARIO;
    /** @private — flag de encerramento manual (RN29) */
    this._encerradoManualmente = false;
    /** @private — dia (YYYY-MM-DD) em que o encerramento manual ocorreu */
    this._diaEncerramento = null;
  }

  // -------------------------------------------------------------------------
  // Virada de dia (RN28)
  // -------------------------------------------------------------------------

  /**
   * Verifica se houve virada de dia desde o último encerramento manual.
   * Se o dia mudou, reseta o flag de encerramento.
   *
   * @returns {boolean} `true` se houve virada de dia (encerramento resetado).
   */
  verificarViradaDeDia() {
    if (!this._diaEncerramento) return false;

    const hoje = diaLocal(this._agora(), this._fusoHorario);
    if (this._diaEncerramento !== hoje) {
      this._encerradoManualmente = false;
      this._diaEncerramento = null;
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Verificação de horário
  // -------------------------------------------------------------------------

  /**
   * Verifica se o horário atual está dentro do expediente (7h–17h, America/Recife).
   * @returns {boolean}
   * @private
   */
  _dentroDoHorario() {
    const hora = horaLocal(this._agora(), this._fusoHorario);
    return hora >= HORA_INICIO && hora < HORA_FIM;
  }

  // -------------------------------------------------------------------------
  // Situação do expediente
  // -------------------------------------------------------------------------

  /**
   * Retorna a situação atual do expediente, considerando tanto o horário
   * quanto o encerramento manual.
   *
   * @returns {{ aberto: boolean, motivo: string|null }}
   */
  estaAberto() {
    this.verificarViradaDeDia();

    if (this._encerradoManualmente) {
      return {
        aberto: false,
        motivo: 'Expediente encerrado pelo gestor. Novas chamadas e emissões estão bloqueadas até o próximo dia.',
      };
    }

    if (!this._dentroDoHorario()) {
      return {
        aberto: false,
        motivo: `Fora do horário de expediente (${HORA_INICIO}h às ${HORA_FIM}h).`,
      };
    }

    return { aberto: true, motivo: null };
  }

  // -------------------------------------------------------------------------
  // Verificações de permissão
  // -------------------------------------------------------------------------

  /**
   * Verifica se é permitido emitir novas senhas.
   * Bloqueado fora do horário ou após encerramento manual (RN19, RN29).
   *
   * @returns {{ permitido: boolean, motivo: string|null }}
   */
  podeEmitir() {
    const { aberto, motivo } = this.estaAberto();
    return { permitido: aberto, motivo };
  }

  /**
   * Verifica se é permitido chamar a próxima senha.
   * Bloqueado fora do horário ou após encerramento manual (RN19, RN29).
   *
   * @returns {{ permitido: boolean, motivo: string|null }}
   */
  podeChamar() {
    const { aberto, motivo } = this.estaAberto();
    return { permitido: aberto, motivo };
  }

  /**
   * Verifica se é permitido finalizar um atendimento em andamento.
   *
   * **Sempre retorna `true`**: atendimentos já iniciados podem ser
   * finalizados mesmo após o encerramento do expediente (RN20).
   *
   * @returns {boolean}
   */
  podeFinalizarAtendimento() {
    return true;
  }

  /**
   * Verifica se senhas já chamadas (CHAMADA ou CHAMADA_NOVAMENTE) ou em atendimento
   * podem prosseguir para conclusão mesmo com o expediente encerrado (RN20, RN29).
   *
   * @param {string} status - Status atual da senha.
   * @returns {boolean}
   */
  podeConcluirAtendimento(status) {
    return podeConcluirAtendimento(status);
  }

  // -------------------------------------------------------------------------
  // Encerramento e reabertura (RN29)
  // -------------------------------------------------------------------------

  /**
   * Encerra manualmente o expediente.
   *
   * Após o encerramento:
   * - Novas emissões e chamadas ficam **bloqueadas** até o dia seguinte.
   * - Atendimentos já chamados ou em andamento **podem ser concluídos** (RN20, RN29).
   * - Se uma lista de senhas for informada, descarta automaticamente as que
   *   estiverem em AGUARDANDO (RN21).
   *
   * @param {Array} [senhas] - Opcional. Lista de senhas para descartar as aguardando.
   * @returns {{ encerrado: boolean, descartadas: number, senhasDescartadas: Array }}
   * @throws {Error} Se o expediente já estiver encerrado.
   */
  encerrar(senhas = null) {
    this.verificarViradaDeDia();

    if (this._encerradoManualmente) {
      throw new Error('O expediente já foi encerrado.');
    }

    this._encerradoManualmente = true;
    this._diaEncerramento = diaLocal(this._agora(), this._fusoHorario);

    let descartadas = 0;
    let senhasDescartadas = [];
    if (Array.isArray(senhas)) {
      const res = descartarSenhasAguardando(senhas);
      descartadas = res.descartadas;
      senhasDescartadas = res.senhasDescartadas;
    }

    return { encerrado: true, descartadas, senhasDescartadas };
  }

  /**
   * Reabre o expediente após um encerramento manual feito por engano (RN29).
   * Funciona apenas no mesmo dia do encerramento.
   *
   * @throws {Error} Se o expediente não estiver encerrado.
   */
  reabrir() {
    this.verificarViradaDeDia();

    if (!this._encerradoManualmente) {
      throw new Error('O expediente não está encerrado.');
    }

    this._encerradoManualmente = false;
    this._diaEncerramento = null;
  }

  // -------------------------------------------------------------------------
  // Getter
  // -------------------------------------------------------------------------

  /** Indica se o expediente foi encerrado manualmente no dia atual. */
  get encerradoManualmente() {
    this.verificarViradaDeDia();
    return this._encerradoManualmente;
  }
}

// ---------------------------------------------------------------------------
// Funções Utilitárias Exportáveis de Descarte e Conclusão (RN20, RN21, RN28, RN29)
// ---------------------------------------------------------------------------

/**
 * Descarta todas as senhas que estão no estado AGUARDANDO (RN21).
 * Não altera senhas já chamadas (CHAMADA, CHAMADA_NOVAMENTE) ou em atendimento.
 *
 * @param {Array} senhas - Lista de objetos de senha.
 * @returns {{ descartadas: number, senhasDescartadas: Array }}
 */
export function descartarSenhasAguardando(senhas) {
  if (!Array.isArray(senhas)) return { descartadas: 0, senhasDescartadas: [] };
  const senhasDescartadas = [];
  for (const s of senhas) {
    if (s && s.status === ESTADOS.AGUARDANDO) {
      transitar(s, ESTADOS.DESCARTADA);
      senhasDescartadas.push(s);
    }
  }
  return { descartadas: senhasDescartadas.length, senhasDescartadas };
}

/**
 * Descarta senhas de dias anteriores que permaneceram com status AGUARDANDO (RN28).
 *
 * @param {Array}  senhas   - Lista de objetos de senha.
 * @param {string} diaAtual - Prefixo do dia atual (formato YYMMDD ou YYYY-MM-DD).
 * @returns {{ descartadas: number, senhasDescartadas: Array }}
 */
export function descartarSenhasDiasAnteriores(senhas, diaAtual) {
  if (!Array.isArray(senhas) || !diaAtual) return { descartadas: 0, senhasDescartadas: [] };
  const senhasDescartadas = [];
  for (const s of senhas) {
    if (s && s.status === ESTADOS.AGUARDANDO) {
      const pertenceAoDia = (s.numero && s.numero.startsWith(diaAtual)) ||
                            (s.emitidaEm && s.emitidaEm.startsWith(diaAtual));
      if (!pertenceAoDia) {
        transitar(s, ESTADOS.DESCARTADA);
        senhasDescartadas.push(s);
      }
    }
  }
  return { descartadas: senhasDescartadas.length, senhasDescartadas };
}

/**
 * Verifica se uma senha já chamada ou em atendimento pode prosseguir para conclusão
 * mesmo após o encerramento do expediente (RN20, RN29).
 *
 * Senhas em CHAMADA, CHAMADA_NOVAMENTE ou EM_ATENDIMENTO continuam permitidas
 * a serem atendidas ou finalizadas.
 *
 * @param {string} status - Status atual da senha.
 * @returns {boolean}
 */
export function podeConcluirAtendimento(status) {
  return [ESTADOS.CHAMADA, ESTADOS.CHAMADA_NOVAMENTE, ESTADOS.EM_ATENDIMENTO].includes(status);
}

