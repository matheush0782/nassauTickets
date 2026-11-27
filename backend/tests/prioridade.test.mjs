import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ControlePrioridade,
  ordemDeBusca,
  prefixoDia,
} from '../src/domain/prioridade.mjs';

describe('Módulo de Prioridade — Testes Unitários', () => {
  let controle;

  beforeEach(() => {
    controle = new ControlePrioridade({ obterDia: () => '261127' });
  });

  describe('Funções Utilitárias', () => {
    it('ordemDeBusca deve retornar SP → SE → SG quando último tipo for null, SE ou SG', () => {
      assert.deepEqual(ordemDeBusca(null), ['SP', 'SE', 'SG']);
      assert.deepEqual(ordemDeBusca('SE'), ['SP', 'SE', 'SG']);
      assert.deepEqual(ordemDeBusca('SG'), ['SP', 'SE', 'SG']);
    });

    it('ordemDeBusca deve retornar SE → SG → SP quando último tipo for SP', () => {
      assert.deepEqual(ordemDeBusca('SP'), ['SE', 'SG', 'SP']);
    });

    it('prefixoDia deve formatar a data como YYMMDD no fuso especificado', () => {
      // 2026-11-27 10:00:00 UTC = 2026-11-27 07:00:00 em America/Recife
      const data = new Date('2026-11-27T10:00:00.000Z');
      assert.equal(prefixoDia(data, 'America/Recife'), '261127');
    });
  });

  describe('Regras de Prioridade e Alternância (RN04, RN05, RN06, RN07, RN08)', () => {
    it('Existência simultânea de SP, SE e SG: SP é chamada primeiro no início do dia', () => {
      const fila = [
        { id: 1, numero: '261127-SG001', tipo: 'SG', emitidaEm: '2026-11-27T08:00:00.000Z' },
        { id: 2, numero: '261127-SE001', tipo: 'SE', emitidaEm: '2026-11-27T08:01:00.000Z' },
        { id: 3, numero: '261127-SP001', tipo: 'SP', emitidaEm: '2026-11-27T08:02:00.000Z' },
      ];

      const escolhida = controle.selecionarProxima(fila);
      assert.ok(escolhida);
      assert.equal(escolhida.tipo, 'SP');
      assert.equal(escolhida.numero, '261127-SP001');
      assert.equal(controle.ultimoTipoChamado, 'SP');
    });

    it('Preferência de SE sobre SG: após SP, SE é chamada antes de SG', () => {
      const fila = [
        { id: 1, numero: '261127-SG001', tipo: 'SG', emitidaEm: '2026-11-27T08:00:00.000Z' },
        { id: 2, numero: '261127-SE001', tipo: 'SE', emitidaEm: '2026-11-27T08:01:00.000Z' },
        { id: 3, numero: '261127-SP001', tipo: 'SP', emitidaEm: '2026-11-27T08:02:00.000Z' },
      ];

      // 1ª chamada: SP
      const chamada1 = controle.selecionarProxima(fila);
      assert.equal(chamada1.numero, '261127-SP001');

      // 2ª chamada (com SP removida da fila): deve escolher SE
      const filaRestante = fila.filter(s => s.id !== chamada1.id);
      const chamada2 = controle.selecionarProxima(filaRestante);
      assert.equal(chamada2.tipo, 'SE');
      assert.equal(chamada2.numero, '261127-SE001');
      assert.equal(controle.ultimoTipoChamado, 'SE');
    });

    it('Fila SP vazia: sistema escolhe SE se disponível', () => {
      const fila = [
        { id: 1, numero: '261127-SG001', tipo: 'SG', emitidaEm: '2026-11-27T08:00:00.000Z' },
        { id: 2, numero: '261127-SE001', tipo: 'SE', emitidaEm: '2026-11-27T08:01:00.000Z' },
      ];

      const escolhida = controle.selecionarProxima(fila);
      assert.equal(escolhida.tipo, 'SE');
      assert.equal(escolhida.numero, '261127-SE001');
    });

    it('Fila SP e SE vazias: sistema escolhe SG', () => {
      const fila = [
        { id: 1, numero: '261127-SG001', tipo: 'SG', emitidaEm: '2026-11-27T08:00:00.000Z' },
        { id: 2, numero: '261127-SG002', tipo: 'SG', emitidaEm: '2026-11-27T08:01:00.000Z' },
      ];

      const escolhida = controle.selecionarProxima(fila);
      assert.equal(escolhida.tipo, 'SG');
      assert.equal(escolhida.numero, '261127-SG001');
    });

    it('Fila SE vazia no turno não prioritário: chama SG', () => {
      // Forçar último tipo para SP
      controle._ultimoTipoChamado = 'SP';

      const fila = [
        { id: 1, numero: '261127-SP002', tipo: 'SP', emitidaEm: '2026-11-27T08:05:00.000Z' },
        { id: 2, numero: '261127-SG001', tipo: 'SG', emitidaEm: '2026-11-27T08:00:00.000Z' },
      ];

      const escolhida = controle.selecionarProxima(fila);
      assert.equal(escolhida.tipo, 'SG');
      assert.equal(escolhida.numero, '261127-SG001');
    });

    it('Fila SG vazia: atende perfeitamente alternando entre SP e SE', () => {
      let fila = [
        { id: 1, numero: '261127-SP001', tipo: 'SP', emitidaEm: '2026-11-27T08:00:00.000Z' },
        { id: 2, numero: '261127-SE001', tipo: 'SE', emitidaEm: '2026-11-27T08:01:00.000Z' },
        { id: 3, numero: '261127-SP002', tipo: 'SP', emitidaEm: '2026-11-27T08:02:00.000Z' },
      ];

      const c1 = controle.selecionarProxima(fila);
      assert.equal(c1.numero, '261127-SP001');
      fila = fila.filter(s => s.id !== c1.id);

      const c2 = controle.selecionarProxima(fila);
      assert.equal(c2.numero, '261127-SE001');
      fila = fila.filter(s => s.id !== c2.id);

      const c3 = controle.selecionarProxima(fila);
      assert.equal(c3.numero, '261127-SP002');
    });

    it('Todas as filas vazias: retorna null com segurança', () => {
      assert.equal(controle.selecionarProxima([]), null);
      assert.equal(controle.selecionarProxima(null), null);
    });

    it('Ordem FIFO: dentro do mesmo tipo, a senha emitida antes deve ser chamada primeiro', () => {
      // Array propositalmente desordenado na entrada
      const fila = [
        { id: 3, numero: '261127-SP003', tipo: 'SP', emitidaEm: '2026-11-27T08:15:00.000Z' },
        { id: 1, numero: '261127-SP001', tipo: 'SP', emitidaEm: '2026-11-27T08:05:00.000Z' },
        { id: 2, numero: '261127-SP002', tipo: 'SP', emitidaEm: '2026-11-27T08:10:00.000Z' },
      ];

      const c1 = controle.selecionarProxima(fila);
      assert.equal(c1.numero, '261127-SP001');

      const fila2 = fila.filter(s => s.id !== c1.id);
      // Forçar turno de SP para checar a próxima SP
      controle._ultimoTipoChamado = 'SG';
      const c2 = controle.selecionarProxima(fila2);
      assert.equal(c2.numero, '261127-SP002');

      const fila3 = fila2.filter(s => s.id !== c2.id);
      controle._ultimoTipoChamado = 'SG';
      const c3 = controle.selecionarProxima(fila3);
      assert.equal(c3.numero, '261127-SP003');
    });

    it('Exemplo completo da documentação oficial (RN08)', () => {
      // "Exemplo: fila emitida na ordem SG001, SG002, SP001, SE001, SP002, SG003
      // → chamada: SP001, SE001, SP002, SG001, SG002, SG003."
      let fila = [
        { id: 1, numero: '261127-SG001', tipo: 'SG', emitidaEm: '2026-11-27T08:01:00.000Z' },
        { id: 2, numero: '261127-SG002', tipo: 'SG', emitidaEm: '2026-11-27T08:02:00.000Z' },
        { id: 3, numero: '261127-SP001', tipo: 'SP', emitidaEm: '2026-11-27T08:03:00.000Z' },
        { id: 4, numero: '261127-SE001', tipo: 'SE', emitidaEm: '2026-11-27T08:04:00.000Z' },
        { id: 5, numero: '261127-SP002', tipo: 'SP', emitidaEm: '2026-11-27T08:05:00.000Z' },
        { id: 6, numero: '261127-SG003', tipo: 'SG', emitidaEm: '2026-11-27T08:06:00.000Z' },
      ];

      const ordemEsperada = [
        '261127-SP001',
        '261127-SE001',
        '261127-SP002',
        '261127-SG001',
        '261127-SG002',
        '261127-SG003',
      ];

      const chamadasRealizadas = [];
      while (fila.length > 0) {
        const escolhida = controle.selecionarProxima(fila);
        assert.ok(escolhida);
        chamadasRealizadas.push(escolhida.numero);
        fila = fila.filter(s => s.id !== escolhida.id);
      }

      assert.deepEqual(chamadasRealizadas, ordemEsperada);
    });
  });

  describe('Concorrência Sequencial e Chamadas Duplicadas (RN18, RN27)', () => {
    it('Duas chamadas consecutivas não selecionam a mesma senha utilizando idsExcluidos', () => {
      const fila = [
        { id: 1, numero: '261127-SP001', tipo: 'SP', emitidaEm: '2026-11-27T08:00:00.000Z' },
        { id: 2, numero: '261127-SP002', tipo: 'SP', emitidaEm: '2026-11-27T08:01:00.000Z' },
        { id: 3, numero: '261127-SE001', tipo: 'SE', emitidaEm: '2026-11-27T08:02:00.000Z' },
      ];

      // Guichê 1 chama próxima
      const chamadaG1 = controle.selecionarProxima(fila);
      assert.equal(chamadaG1.id, 1);

      // Guichê 2 chama próxima quase em seguida (senha 1 ainda aguarda confirmação/está excluída)
      const excluidos = new Set([chamadaG1.id]);
      const chamadaG2 = controle.selecionarProxima(fila, excluidos);

      // Guichê 2 deve receber uma senha DIFERENTE (SE001, pois último tipo foi SP)
      assert.notEqual(chamadaG2.id, chamadaG1.id);
      assert.equal(chamadaG2.numero, '261127-SE001');
    });

    it('Qualquer guichê pode atender qualquer tipo de senha (RN02)', () => {
      // Guichê 1 atende SP, Guichê 2 atende SE, Guichê 3 atende SG
      const fila = [
        { id: 1, numero: '261127-SP001', tipo: 'SP', emitidaEm: '2026-11-27T08:00:00.000Z' },
        { id: 2, numero: '261127-SE001', tipo: 'SE', emitidaEm: '2026-11-27T08:01:00.000Z' },
        { id: 3, numero: '261127-SG001', tipo: 'SG', emitidaEm: '2026-11-27T08:02:00.000Z' },
      ];

      const s1 = controle.selecionarProxima(fila);
      assert.equal(s1.tipo, 'SP'); // atribuível ao guichê 1

      const s2 = controle.selecionarProxima(fila.filter(s => s.id !== s1.id));
      assert.equal(s2.tipo, 'SE'); // atribuível ao guichê 2

      const s3 = controle.selecionarProxima(fila.filter(s => s.id !== s1.id && s.id !== s2.id));
      assert.equal(s3.tipo, 'SG'); // atribuível ao guichê 3
    });

    it('selecionarProxima deve lançar erro se o guichê informado estiver ocupado (RN18)', () => {
      const senhasTotais = [
        { id: 1, numero: '261127-SP001', guiche: 1, status: 'EM_ATENDIMENTO', tipo: 'SP', emitidaEm: '2026-11-27T08:00:00.000Z' },
        { id: 2, numero: '261127-SG001', guiche: null, status: 'AGUARDANDO', tipo: 'SG', emitidaEm: '2026-11-27T08:05:00.000Z' },
      ];

      // Guichê 1 já possui senha em andamento
      assert.throws(
        () => controle.selecionarProxima(senhasTotais, { guiche: 1, senhasTotais }),
        /O guichê 1 já possui a senha 261127-SP001 em andamento/
      );

      // Guichê 2 está livre, deve selecionar com sucesso
      const selecionada = controle.selecionarProxima(senhasTotais, { guiche: 2, senhasTotais });
      assert.equal(selecionada.id, 2);
    });

    it('selecionarProxima deve ignorar senhas com status diferente de AGUARDANDO (prevenção de duplicata)', () => {
      const listaMista = [
        { id: 1, numero: '261127-SP001', status: 'CHAMADA', tipo: 'SP', emitidaEm: '2026-11-27T08:00:00.000Z' },
        { id: 2, numero: '261127-SP002', status: 'ATENDIDA', tipo: 'SP', emitidaEm: '2026-11-27T08:01:00.000Z' },
        { id: 3, numero: '261127-SG001', status: 'AGUARDANDO', tipo: 'SG', emitidaEm: '2026-11-27T08:02:00.000Z' },
      ];

      // Apenas a senha AGUARDANDO pode ser selecionada
      const escolhida = controle.selecionarProxima(listaMista);
      assert.equal(escolhida.id, 3);
      assert.equal(escolhida.numero, '261127-SG001');
    });

    it('selecionarProxima deve aceitar idsExcluidos como Array ou Set', () => {
      const fila = [
        { id: 1, numero: '261127-SP001', tipo: 'SP', status: 'AGUARDANDO', emitidaEm: '2026-11-27T08:00:00.000Z' },
        { id: 2, numero: '261127-SE001', tipo: 'SE', status: 'AGUARDANDO', emitidaEm: '2026-11-27T08:01:00.000Z' },
      ];

      // Passando como Array
      const escolhida = controle.selecionarProxima(fila, [1]);
      assert.equal(escolhida.id, 2);
    });
  });

  describe('Reinício Diário da Prioridade (RN28)', () => {
    it('reiniciarDia deve resetar ultimoTipoChamado para null', () => {
      controle._ultimoTipoChamado = 'SP';
      controle.reiniciarDia();
      assert.equal(controle.ultimoTipoChamado, null);
    });

    it('Virada de dia detectada automaticamente reseta a alternância para iniciar por SP', () => {
      let diaAtualSimulado = '261127';
      const controleComDia = new ControlePrioridade({
        obterDia: () => diaAtualSimulado,
      });

      // No dia 261127, atende uma SP (próximo turno seria SE/SG)
      const filaDia1 = [
        { id: 1, numero: '261127-SP001', tipo: 'SP', emitidaEm: '2026-11-27T16:50:00.000Z' },
      ];
      const s1 = controleComDia.selecionarProxima(filaDia1);
      assert.equal(s1.numero, '261127-SP001');
      assert.equal(controleComDia.ultimoTipoChamado, 'SP');

      // Virada do dia: agora é 261128
      diaAtualSimulado = '261128';

      // No novo dia, existem SE e SP na fila
      const filaDia2 = [
        { id: 2, numero: '261128-SE001', tipo: 'SE', emitidaEm: '2026-11-28T07:05:00.000Z' },
        { id: 3, numero: '261128-SP001', tipo: 'SP', emitidaEm: '2026-11-28T07:06:00.000Z' },
      ];

      // Se não houvesse reinício diário, após SP chamaria SE.
      // MAS, como é um novo dia (RN28), o dia DEVE começar procurando por SP!
      const s2 = controleComDia.selecionarProxima(filaDia2);
      assert.equal(s2.tipo, 'SP');
      assert.equal(s2.numero, '261128-SP001');
      assert.equal(controleComDia.diaAtual, '261128');
    });
  });
});
