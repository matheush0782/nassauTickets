import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ESTADOS,
  transitar,
  ehEstadoAtivo,
  ehEstadoFinal,
  validarGuicheLivre,
  guicheEstaOcupado,
  obterAtendimentoAtualDoGuiche,
} from '../src/domain/estados.mjs';
import { ControlePrioridade, prefixoDia } from '../src/domain/prioridade.mjs';
import {
  ControleExpediente,
  descartarSenhasAguardando,
  descartarSenhasDiasAnteriores,
  podeConcluirAtendimento,
} from '../src/domain/expediente.mjs';

function criarDataRecife(ano, mes, dia, hora, minuto = 0) {
  return new Date(Date.UTC(ano, mes - 1, dia, hora + 3, minuto, 0));
}

describe('Testes de Integração das Regras de Negócio', () => {
  it('Cenário 1: Ciclo de vida completo da senha (Emissão → Aguardo → Chamada → Atendimento → Finalização)', () => {
    let horaAtual = criarDataRecife(2026, 11, 27, 8, 30);
    const expediente = new ControleExpediente({ agora: () => horaAtual });
    const prioridade = new ControlePrioridade({ obterDia: () => '261127' });

    // 1. Verificar se pode emitir
    assert.equal(expediente.podeEmitir().permitido, true);

    // 2. Emissão da senha no totem: nasce EMITIDA e imediatamente vai para AGUARDANDO na fila
    const senha = {
      id: 1,
      numero: '261127-SP001',
      tipo: 'SP',
      status: ESTADOS.EMITIDA,
      emitidaEm: horaAtual.toISOString(),
      chamadas: [],
      guiche: null,
      atendente: null,
      inicioEm: null,
      fimEm: null,
    };
    transitar(senha, ESTADOS.AGUARDANDO);
    assert.equal(senha.status, ESTADOS.AGUARDANDO);

    const filaAguardando = [senha];

    // 3. Guichê 1 chama a próxima senha
    assert.equal(expediente.podeChamar().permitido, true);
    const selecionada = prioridade.selecionarProxima(filaAguardando);
    assert.equal(selecionada.id, senha.id);

    // Transita para CHAMADA e vincula guichê e atendente
    transitar(selecionada, ESTADOS.CHAMADA);
    selecionada.guiche = 1;
    selecionada.atendente = 'Atendente 1';
    horaAtual = criarDataRecife(2026, 11, 27, 8, 32);
    selecionada.chamadas.push(horaAtual.toISOString());

    assert.equal(selecionada.status, ESTADOS.CHAMADA);
    assert.equal(ehEstadoAtivo(selecionada.status), true);

    // 4. Cliente comparece: atendente inicia o atendimento
    horaAtual = criarDataRecife(2026, 11, 27, 8, 33);
    transitar(selecionada, ESTADOS.EM_ATENDIMENTO);
    selecionada.inicioEm = horaAtual.toISOString();
    assert.equal(selecionada.status, ESTADOS.EM_ATENDIMENTO);

    // 5. Atendente finaliza o atendimento
    horaAtual = criarDataRecife(2026, 11, 27, 8, 45);
    transitar(selecionada, ESTADOS.ATENDIDA);
    selecionada.fimEm = horaAtual.toISOString();

    assert.equal(selecionada.status, ESTADOS.ATENDIDA);
    assert.equal(ehEstadoFinal(selecionada.status), true);
    assert.equal(ehEstadoAtivo(selecionada.status), false); // Guichê agora está livre
  });

  it('Cenário 2: Rechamada e Não Comparecimento após 2 chamadas', () => {
    let horaAtual = criarDataRecife(2026, 11, 27, 9, 0);
    const prioridade = new ControlePrioridade({ obterDia: () => '261127' });

    const senha = {
      id: 2,
      numero: '261127-SG001',
      tipo: 'SG',
      status: ESTADOS.AGUARDANDO,
      emitidaEm: horaAtual.toISOString(),
      chamadas: [],
      guiche: null,
      atendente: null,
    };

    // 1ª Chamada
    const escolhida = prioridade.selecionarProxima([senha]);
    transitar(escolhida, ESTADOS.CHAMADA);
    escolhida.guiche = 2;
    escolhida.chamadas.push(horaAtual.toISOString());

    // Cliente não comparece: Atendente chama novamente
    horaAtual = criarDataRecife(2026, 11, 27, 9, 3);
    transitar(escolhida, ESTADOS.CHAMADA_NOVAMENTE);
    escolhida.chamadas.push(horaAtual.toISOString());
    assert.equal(escolhida.status, ESTADOS.CHAMADA_NOVAMENTE);
    assert.equal(escolhida.chamadas.length, 2);

    // Tentativa inválida de uma terceira chamada deve falhar
    assert.throws(
      () => transitar(escolhida, ESTADOS.CHAMADA),
      /Transição não permitida/
    );

    // Após 2 chamadas sem comparecimento, registra NAO_COMPARECEU
    horaAtual = criarDataRecife(2026, 11, 27, 9, 5);
    transitar(escolhida, ESTADOS.NAO_COMPARECEU);
    assert.equal(escolhida.status, ESTADOS.NAO_COMPARECEU);
    assert.equal(ehEstadoFinal(escolhida.status), true);
    assert.equal(ehEstadoAtivo(escolhida.status), false);
  });

  it('Cenário 3: Impedir novas chamadas em guichê com senha em andamento via funções do domínio (RN18)', () => {
    const todasSenhas = [
      {
        id: 10,
        numero: '261127-SP001',
        tipo: 'SP',
        status: ESTADOS.EM_ATENDIMENTO,
        guiche: 1,
      },
      {
        id: 11,
        numero: '261127-SG001',
        tipo: 'SG',
        status: ESTADOS.AGUARDANDO,
        emitidaEm: '2026-11-27T08:00:00.000Z',
      },
    ];

    // 1. Verificação direta usando funções exportadas do domínio
    assert.equal(guicheEstaOcupado(todasSenhas, 1), true);
    assert.equal(guicheEstaOcupado(todasSenhas, 2), false);

    assert.throws(
      () => validarGuicheLivre(todasSenhas, 1),
      /O guichê 1 já possui a senha 261127-SP001 em andamento/
    );
    assert.equal(validarGuicheLivre(todasSenhas, 2), true);

    // 2. Verificação integrada em selecionarProxima({ guiche: 1 })
    const prioridade = new ControlePrioridade({ obterDia: () => '261127' });
    assert.throws(
      () => prioridade.selecionarProxima(todasSenhas, { guiche: 1, senhasTotais: todasSenhas }),
      /O guichê 1 já possui a senha 261127-SP001 em andamento/
    );

    // Finalizar atendimento do guichê 1 libera o guichê
    transitar(todasSenhas[0], ESTADOS.ATENDIDA);
    assert.equal(guicheEstaOcupado(todasSenhas, 1), false);
    assert.equal(validarGuicheLivre(todasSenhas, 1), true);

    // Agora o guichê 1 consegue chamar
    const novaChamada = prioridade.selecionarProxima(todasSenhas, { guiche: 1, senhasTotais: todasSenhas });
    assert.equal(novaChamada.id, 11);
  });

  it('Cenário 4: Atendimento iniciado às 16h59 e finalizado após 17h00 com descarte de senhas restantes (RN20, RN21)', () => {
    let horaAtual = criarDataRecife(2026, 11, 27, 16, 59);
    const expediente = new ControleExpediente({ agora: () => horaAtual });
    const prioridade = new ControlePrioridade({ obterDia: () => '261127' });

    const fila = [
      { id: 20, numero: '261127-SP010', tipo: 'SP', status: ESTADOS.AGUARDANDO, emitidaEm: '2026-11-27T16:55:00.000Z' },
      { id: 21, numero: '261127-SG020', tipo: 'SG', status: ESTADOS.AGUARDANDO, emitidaEm: '2026-11-27T16:56:00.000Z' },
    ];

    // Às 16h59: expediente aberto, chama a SP010
    assert.equal(expediente.podeChamar().permitido, true);
    const chamada = prioridade.selecionarProxima(fila);
    assert.equal(chamada.numero, '261127-SP010');
    transitar(chamada, ESTADOS.CHAMADA);
    chamada.guiche = 1;

    // Remove da fila de aguardando e inicia atendimento
    const filaRestante = fila.filter(s => s.id !== chamada.id);
    transitar(chamada, ESTADOS.EM_ATENDIMENTO);

    // Passou das 17h00 (ex: 17h00 exatamente)
    horaAtual = criarDataRecife(2026, 11, 27, 17, 0);
    assert.equal(expediente.estaAberto().aberto, false);
    assert.equal(expediente.podeChamar().permitido, false);
    assert.equal(expediente.podeEmitir().permitido, false);

    // Senhas que permaneceram aguardando são descartadas usando função reutilizável (RN21)
    const { descartadas } = descartarSenhasAguardando(filaRestante);
    assert.equal(descartadas, 1);
    assert.equal(filaRestante[0].status, ESTADOS.DESCARTADA);

    // O atendimento em andamento pode ser finalizado às 17h15 (RN20)
    horaAtual = criarDataRecife(2026, 11, 27, 17, 15);
    assert.equal(expediente.podeFinalizarAtendimento(), true);
    assert.equal(podeConcluirAtendimento(chamada.status), true);
    transitar(chamada, ESTADOS.ATENDIDA);
    assert.equal(chamada.status, ESTADOS.ATENDIDA);
  });

  it('Cenário 5: Encerramento manual, bloqueio de emissão/chamada e reabertura pelo gestor (RN29)', () => {
    const horaAtual = criarDataRecife(2026, 11, 27, 13, 0);
    const expediente = new ControleExpediente({ agora: () => horaAtual });

    // Gestor encerra o expediente
    expediente.encerrar();
    assert.equal(expediente.podeEmitir().permitido, false);
    assert.equal(expediente.podeChamar().permitido, false);

    // Gestor reabre o expediente no mesmo dia
    expediente.reabrir();
    assert.equal(expediente.podeEmitir().permitido, true);
    assert.equal(expediente.podeChamar().permitido, true);
  });

  it('Cenário 6: Virada do dia completa (descarte de senhas de ontem, reset de prioridade e reabertura) (RN28)', () => {
    let diaSimulado = '261127';
    let horaSimulada = criarDataRecife(2026, 11, 27, 16, 50);

    const expediente = new ControleExpediente({ agora: () => horaSimulada });
    const prioridade = new ControlePrioridade({ obterDia: () => diaSimulado });

    // Dia 27: atende uma SP
    const filaDia27 = [
      { id: 30, numero: '261127-SP001', tipo: 'SP', status: ESTADOS.AGUARDANDO, emitidaEm: '2026-11-27T16:40:00.000Z' },
      { id: 31, numero: '261127-SE001', tipo: 'SE', status: ESTADOS.AGUARDANDO, emitidaEm: '2026-11-27T16:45:00.000Z' },
    ];
    const s1 = prioridade.selecionarProxima(filaDia27);
    assert.equal(s1.numero, '261127-SP001');
    assert.equal(prioridade.ultimoTipoChamado, 'SP');

    // Gestor encerra o dia 27
    expediente.encerrar();
    assert.equal(expediente.encerradoManualmente, true);

    // VIRADA DO DIA: passa para o dia 28 às 07h10
    diaSimulado = '261128';
    horaSimulada = criarDataRecife(2026, 11, 28, 7, 10);

    // 1. Expediente deve estar aberto (reset automático do encerramento manual)
    assert.equal(expediente.estaAberto().aberto, true);
    assert.equal(expediente.encerradoManualmente, false);

    // 2. Senhas do dia anterior são descartadas usando função de domínio reutilizável
    const senhasNaBase = [
      filaDia27[1], // 261127-SE001 (ficou na fila de ontem)
      { id: 32, numero: '261128-SG001', tipo: 'SG', status: ESTADOS.AGUARDANDO, emitidaEm: '2026-11-28T07:05:00.000Z' },
      { id: 33, numero: '261128-SP001', tipo: 'SP', status: ESTADOS.AGUARDANDO, emitidaEm: '2026-11-28T07:06:00.000Z' },
    ];

    const { descartadas } = descartarSenhasDiasAnteriores(senhasNaBase, diaSimulado);
    assert.equal(descartadas, 1);
    assert.equal(senhasNaBase[0].status, ESTADOS.DESCARTADA);

    // 3. Prioridade no novo dia: deve começar por SP, ignorando que o dia anterior terminou em SP
    const filaAtivaHoje = senhasNaBase.filter(s => s.status === ESTADOS.AGUARDANDO);
    const primeiraChamadaDia28 = prioridade.selecionarProxima(filaAtivaHoje);
    assert.equal(primeiraChamadaDia28.tipo, 'SP');
    assert.equal(primeiraChamadaDia28.numero, '261128-SP001');
  });

  it('Cenário 7: Operação de múltiplos guichês simultâneos com prevenção de duplicação (RN02, RN27)', () => {
    const prioridade = new ControlePrioridade({ obterDia: () => '261127' });

    const fila = [
      { id: 40, numero: '261127-SP001', tipo: 'SP', status: ESTADOS.AGUARDANDO, emitidaEm: '2026-11-27T08:00:00.000Z' },
      { id: 41, numero: '261127-SE001', tipo: 'SE', status: ESTADOS.AGUARDANDO, emitidaEm: '2026-11-27T08:01:00.000Z' },
      { id: 42, numero: '261127-SG001', tipo: 'SG', status: ESTADOS.AGUARDANDO, emitidaEm: '2026-11-27T08:02:00.000Z' },
    ];

    // Guichê 1 e Guichê 2 requisitam a próxima senha
    // Guichê 1 é processado primeiro: recebe SP001
    const chamadaG1 = prioridade.selecionarProxima(fila);
    assert.equal(chamadaG1.numero, '261127-SP001');
    transitar(chamadaG1, ESTADOS.CHAMADA);
    chamadaG1.guiche = 1;

    // Guichê 2 é processado em seguida (excluindo senhas já chamadas/ativas)
    const senhasAguardandoRestantes = fila.filter(s => s.status === ESTADOS.AGUARDANDO);
    const chamadaG2 = prioridade.selecionarProxima(senhasAguardandoRestantes);
    assert.equal(chamadaG2.numero, '261127-SE001');
    transitar(chamadaG2, ESTADOS.CHAMADA);
    chamadaG2.guiche = 2;

    // Guichê 3 é processado em seguida
    const senhasAguardandoG3 = fila.filter(s => s.status === ESTADOS.AGUARDANDO);
    const chamadaG3 = prioridade.selecionarProxima(senhasAguardandoG3);
    assert.equal(chamadaG3.numero, '261127-SG001');
    transitar(chamadaG3, ESTADOS.CHAMADA);
    chamadaG3.guiche = 3;

    // Todas foram chamadas sem duplicação e qualquer guichê atendeu qualquer tipo
    assert.deepEqual(
      fila.map(s => ({ numero: s.numero, status: s.status, guiche: s.guiche })),
      [
        { numero: '261127-SP001', status: ESTADOS.CHAMADA, guiche: 1 },
        { numero: '261127-SE001', status: ESTADOS.CHAMADA, guiche: 2 },
        { numero: '261127-SG001', status: ESTADOS.CHAMADA, guiche: 3 },
      ]
    );
  });
});
