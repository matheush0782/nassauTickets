import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ControleExpediente,
  HORA_INICIO,
  HORA_FIM,
  FUSO_HORARIO,
  descartarSenhasAguardando,
  descartarSenhasDiasAnteriores,
  podeConcluirAtendimento,
} from '../src/domain/expediente.mjs';

// Utilitário para criar uma data ISO considerando o fuso de Recife (UTC-3)
// Horário em Recife = Horário UTC - 3h, portanto:
// horaRecife = horaUTC - 3 => horaUTC = horaRecife + 3
function criarDataRecife(ano, mes, dia, hora, minuto = 0) {
  const d = new Date(Date.UTC(ano, mes - 1, dia, hora + 3, minuto, 0));
  return d;
}

describe('Módulo de Expediente — Testes Unitários', () => {
  describe('Constantes de Configuração', () => {
    it('deve ter HORA_INICIO = 7 e HORA_FIM = 17', () => {
      assert.equal(HORA_INICIO, 7);
      assert.equal(HORA_FIM, 17);
      assert.equal(FUSO_HORARIO, 'America/Recife');
    });
  });

  describe('Validação de Horários (RN19) — Fuso America/Recife', () => {
    it('Expediente antes das 07h00 (06h59) deve estar fechado', () => {
      const dataSimulada = criarDataRecife(2026, 11, 27, 6, 59);
      const exp = new ControleExpediente({ agora: () => dataSimulada });

      const status = exp.estaAberto();
      assert.equal(status.aberto, false);
      assert.match(status.motivo, /Fora do horário de expediente/);

      assert.equal(exp.podeEmitir().permitido, false);
      assert.equal(exp.podeChamar().permitido, false);
    });

    it('Expediente exatamente às 07h00 deve estar aberto', () => {
      const dataSimulada = criarDataRecife(2026, 11, 27, 7, 0);
      const exp = new ControleExpediente({ agora: () => dataSimulada });

      const status = exp.estaAberto();
      assert.equal(status.aberto, true);
      assert.equal(status.motivo, null);

      assert.equal(exp.podeEmitir().permitido, true);
      assert.equal(exp.podeChamar().permitido, true);
    });

    it('Expediente às 16h59 deve estar aberto', () => {
      const dataSimulada = criarDataRecife(2026, 11, 27, 16, 59);
      const exp = new ControleExpediente({ agora: () => dataSimulada });

      const status = exp.estaAberto();
      assert.equal(status.aberto, true);
      assert.equal(status.motivo, null);

      assert.equal(exp.podeEmitir().permitido, true);
      assert.equal(exp.podeChamar().permitido, true);
    });

    it('Expediente exatamente às 17h00 deve estar fechado', () => {
      const dataSimulada = criarDataRecife(2026, 11, 27, 17, 0);
      const exp = new ControleExpediente({ agora: () => dataSimulada });

      const status = exp.estaAberto();
      assert.equal(status.aberto, false);
      assert.match(status.motivo, /Fora do horário de expediente/);

      assert.equal(exp.podeEmitir().permitido, false);
      assert.equal(exp.podeChamar().permitido, false);
    });

    it('Expediente às 17h01 ou à noite deve estar fechado', () => {
      const dataSimulada = criarDataRecife(2026, 11, 27, 17, 1);
      const exp = new ControleExpediente({ agora: () => dataSimulada });
      assert.equal(exp.estaAberto().aberto, false);

      const noite = criarDataRecife(2026, 11, 27, 21, 30);
      const expNoite = new ControleExpediente({ agora: () => noite });
      assert.equal(expNoite.estaAberto().aberto, false);
    });
  });

  describe('Conclusão de Atendimentos após o Expediente (RN20)', () => {
    it('podeFinalizarAtendimento deve retornar true mesmo após as 17h00', () => {
      // Atendimento iniciado às 16h59 e atendente finaliza às 17h15
      const aposFim = criarDataRecife(2026, 11, 27, 17, 15);
      const exp = new ControleExpediente({ agora: () => aposFim });

      assert.equal(exp.estaAberto().aberto, false);
      assert.equal(exp.podeChamar().permitido, false);
      assert.equal(exp.podeEmitir().permitido, false);
      // Mas pode finalizar o atendimento em andamento
      assert.equal(exp.podeFinalizarAtendimento(), true);
    });
  });

  describe('Encerramento Manual e Reabertura pelo Gestor (RN21, RN29)', () => {
    it('Encerramento manual deve bloquear emissões e chamadas no mesmo dia', () => {
      const duranteExpediente = criarDataRecife(2026, 11, 27, 11, 0);
      const exp = new ControleExpediente({ agora: () => duranteExpediente });

      assert.equal(exp.estaAberto().aberto, true);

      // Gestor encerra o expediente
      const res = exp.encerrar();
      assert.equal(res.encerrado, true);
      assert.equal(exp.encerradoManualmente, true);

      // Agora deve estar fechado com motivo de encerramento pelo gestor
      const status = exp.estaAberto();
      assert.equal(status.aberto, false);
      assert.match(status.motivo, /Expediente encerrado pelo gestor/);

      assert.equal(exp.podeEmitir().permitido, false);
      assert.equal(exp.podeChamar().permitido, false);
      // Finalização de atendimento ainda é permitida
      assert.equal(exp.podeFinalizarAtendimento(), true);
    });

    it('Tentar encerrar expediente já encerrado manualmente deve lançar erro', () => {
      const duranteExpediente = criarDataRecife(2026, 11, 27, 12, 0);
      const exp = new ControleExpediente({ agora: () => duranteExpediente });

      exp.encerrar();
      assert.throws(() => exp.encerrar(), /O expediente já foi encerrado/);
    });

    it('Reabertura pelo gestor deve liberar novas emissões e chamadas durante o expediente', () => {
      const duranteExpediente = criarDataRecife(2026, 11, 27, 14, 0);
      const exp = new ControleExpediente({ agora: () => duranteExpediente });

      exp.encerrar();
      assert.equal(exp.estaAberto().aberto, false);

      // Gestor reabre
      exp.reabrir();
      assert.equal(exp.encerradoManualmente, false);
      assert.equal(exp.estaAberto().aberto, true);
      assert.equal(exp.podeEmitir().permitido, true);
      assert.equal(exp.podeChamar().permitido, true);
    });

    it('Reabertura FORA do horário de expediente NÃO libera novas emissões ou chamadas', () => {
      // Cenário: gestor encerrou às 16h00 e tenta reabrir às 20h00
      let horaAtual = criarDataRecife(2026, 11, 27, 16, 0);
      const exp = new ControleExpediente({ agora: () => horaAtual });

      exp.encerrar();
      assert.equal(exp.estaAberto().aberto, false);

      // Passa para 20h00 (fora do expediente) e gestor reabre
      horaAtual = criarDataRecife(2026, 11, 27, 20, 0);
      exp.reabrir();

      assert.equal(exp.encerradoManualmente, false);
      // Embora o flag manual tenha sido resetado, o horário NÃO permite!
      const status = exp.estaAberto();
      assert.equal(status.aberto, false);
      assert.match(status.motivo, /Fora do horário de expediente \(7h às 17h\)/);

      assert.equal(exp.podeEmitir().permitido, false);
      assert.equal(exp.podeChamar().permitido, false);
    });

    it('Tentar reabrir expediente que não foi encerrado deve lançar erro', () => {
      const duranteExpediente = criarDataRecife(2026, 11, 27, 14, 0);
      const exp = new ControleExpediente({ agora: () => duranteExpediente });

      assert.throws(() => exp.reabrir(), /O expediente não está encerrado/);
    });

    it('Descarte de senhas que permaneceram aguardando via descartarSenhasAguardando (RN21)', () => {
      const fila = [
        { id: 1, numero: '261127-SP001', status: 'AGUARDANDO' },
        { id: 2, numero: '261127-SG001', status: 'AGUARDANDO' },
        { id: 3, numero: '261127-SP002', status: 'CHAMADA' },        // já chamada
        { id: 4, numero: '261127-SE001', status: 'EM_ATENDIMENTO' }, // em andamento
      ];

      const resultado = descartarSenhasAguardando(fila);
      assert.equal(resultado.descartadas, 2);
      assert.equal(fila[0].status, 'DESCARTADA');
      assert.equal(fila[1].status, 'DESCARTADA');
      assert.equal(fila[2].status, 'CHAMADA');        // não descartada
      assert.equal(fila[3].status, 'EM_ATENDIMENTO'); // não descartada
    });

    it('encerrar(senhas) deve descartar automaticamente as senhas AGUARDANDO', () => {
      const fila = [
        { id: 1, numero: '261127-SP001', status: 'AGUARDANDO' },
        { id: 2, numero: '261127-SG001', status: 'EM_ATENDIMENTO' },
      ];

      const exp = new ControleExpediente({ agora: () => criarDataRecife(2026, 11, 27, 16, 30) });
      const res = exp.encerrar(fila);

      assert.equal(res.encerrado, true);
      assert.equal(res.descartadas, 1);
      assert.equal(fila[0].status, 'DESCARTADA');
      assert.equal(fila[1].status, 'EM_ATENDIMENTO');
    });

    it('Comportamento das senhas já chamadas após encerramento (RN20, RN29)', () => {
      // Senhas já chamadas ou em atendimento podem ser concluídas normalmente
      assert.equal(podeConcluirAtendimento('CHAMADA'), true);
      assert.equal(podeConcluirAtendimento('CHAMADA_NOVAMENTE'), true);
      assert.equal(podeConcluirAtendimento('EM_ATENDIMENTO'), true);

      // Estados não ativos não estão em andamento para conclusão
      assert.equal(podeConcluirAtendimento('AGUARDANDO'), false);
      assert.equal(podeConcluirAtendimento('ATENDIDA'), false);
      assert.equal(podeConcluirAtendimento('DESCARTADA'), false);
    });
  });

  describe('Virada do Dia (RN28)', () => {
    it('Virada de dia deve resetar automaticamente o encerramento manual', () => {
      let dataAtual = criarDataRecife(2026, 11, 27, 15, 0);
      const exp = new ControleExpediente({ agora: () => dataAtual });

      // Encerra no dia 27
      exp.encerrar();
      assert.equal(exp.encerradoManualmente, true);

      // Passa para o dia 28 às 08h00
      dataAtual = criarDataRecife(2026, 11, 28, 8, 0);

      // Ao consultar a situação, deve detectar a virada e resetar o encerramento
      assert.equal(exp.encerradoManualmente, false);
      const status = exp.estaAberto();
      assert.equal(status.aberto, true);
      assert.equal(status.motivo, null);
    });

    it('Descarte de senhas de dias anteriores via descartarSenhasDiasAnteriores (RN28)', () => {
      const diaHoje = '261128';
      const senhas = [
        { id: 1, numero: '261127-SP001', status: 'AGUARDANDO' }, // Ontem
        { id: 2, numero: '261127-SG002', status: 'AGUARDANDO' }, // Ontem
        { id: 3, numero: '261128-SP001', status: 'AGUARDANDO' }, // Hoje
        { id: 4, numero: '261127-SP002', status: 'ATENDIDA' },   // Ontem já atendida
      ];

      const res = descartarSenhasDiasAnteriores(senhas, diaHoje);
      assert.equal(res.descartadas, 2);
      assert.equal(senhas[0].status, 'DESCARTADA');
      assert.equal(senhas[1].status, 'DESCARTADA');
      assert.equal(senhas[2].status, 'AGUARDANDO');
      assert.equal(senhas[3].status, 'ATENDIDA');
    });
  });
});

