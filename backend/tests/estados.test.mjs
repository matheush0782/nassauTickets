import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ESTADOS,
  podeTransitar,
  transitar,
  ehEstadoFinal,
  ehEstadoAtivo,
  obterAtendimentoAtualDoGuiche,
  guicheEstaOcupado,
  validarGuicheLivre,
} from '../src/domain/estados.mjs';

describe('Máquina de Estados — Testes Unitários', () => {
  describe('Constantes e Definições de Estados', () => {
    it('deve conter todos os 8 estados definidos na documentação', () => {
      const estadosEsperados = [
        'EMITIDA',
        'AGUARDANDO',
        'CHAMADA',
        'CHAMADA_NOVAMENTE',
        'EM_ATENDIMENTO',
        'ATENDIDA',
        'NAO_COMPARECEU',
        'DESCARTADA',
      ];
      assert.deepEqual(Object.values(ESTADOS).sort(), estadosEsperados.sort());
    });
  });

  describe('Transições Válidas Permitidas', () => {
    it('EMITIDA → AGUARDANDO', () => {
      assert.equal(podeTransitar(ESTADOS.EMITIDA, ESTADOS.AGUARDANDO), true);
      const senha = { id: 1, numero: '261127-SP001', status: ESTADOS.EMITIDA };
      transitar(senha, ESTADOS.AGUARDANDO);
      assert.equal(senha.status, ESTADOS.AGUARDANDO);
    });

    it('AGUARDANDO → CHAMADA', () => {
      assert.equal(podeTransitar(ESTADOS.AGUARDANDO, ESTADOS.CHAMADA), true);
      const senha = { id: 2, numero: '261127-SP002', status: ESTADOS.AGUARDANDO };
      transitar(senha, ESTADOS.CHAMADA);
      assert.equal(senha.status, ESTADOS.CHAMADA);
    });

    it('AGUARDANDO → DESCARTADA (encerramento do expediente)', () => {
      assert.equal(podeTransitar(ESTADOS.AGUARDANDO, ESTADOS.DESCARTADA), true);
      const senha = { id: 3, numero: '261127-SG001', status: ESTADOS.AGUARDANDO };
      transitar(senha, ESTADOS.DESCARTADA);
      assert.equal(senha.status, ESTADOS.DESCARTADA);
    });

    it('CHAMADA → CHAMADA_NOVAMENTE (rechamada)', () => {
      assert.equal(podeTransitar(ESTADOS.CHAMADA, ESTADOS.CHAMADA_NOVAMENTE), true);
      const senha = { id: 4, numero: '261127-SE001', status: ESTADOS.CHAMADA };
      transitar(senha, ESTADOS.CHAMADA_NOVAMENTE);
      assert.equal(senha.status, ESTADOS.CHAMADA_NOVAMENTE);
    });

    it('CHAMADA → EM_ATENDIMENTO (compareceu na 1ª chamada)', () => {
      assert.equal(podeTransitar(ESTADOS.CHAMADA, ESTADOS.EM_ATENDIMENTO), true);
      const senha = { id: 5, numero: '261127-SP003', status: ESTADOS.CHAMADA };
      transitar(senha, ESTADOS.EM_ATENDIMENTO);
      assert.equal(senha.status, ESTADOS.EM_ATENDIMENTO);
    });

    it('CHAMADA_NOVAMENTE → EM_ATENDIMENTO (compareceu na 2ª chamada)', () => {
      assert.equal(podeTransitar(ESTADOS.CHAMADA_NOVAMENTE, ESTADOS.EM_ATENDIMENTO), true);
      const senha = { id: 6, numero: '261127-SG002', status: ESTADOS.CHAMADA_NOVAMENTE };
      transitar(senha, ESTADOS.EM_ATENDIMENTO);
      assert.equal(senha.status, ESTADOS.EM_ATENDIMENTO);
    });

    it('CHAMADA_NOVAMENTE → NAO_COMPARECEU (não compareceu após 2ª chamada)', () => {
      assert.equal(podeTransitar(ESTADOS.CHAMADA_NOVAMENTE, ESTADOS.NAO_COMPARECEU), true);
      const senha = { id: 7, numero: '261127-SE002', status: ESTADOS.CHAMADA_NOVAMENTE };
      transitar(senha, ESTADOS.NAO_COMPARECEU);
      assert.equal(senha.status, ESTADOS.NAO_COMPARECEU);
    });

    it('EM_ATENDIMENTO → ATENDIDA (finalização do atendimento)', () => {
      assert.equal(podeTransitar(ESTADOS.EM_ATENDIMENTO, ESTADOS.ATENDIDA), true);
      const senha = { id: 8, numero: '261127-SP004', status: ESTADOS.EM_ATENDIMENTO };
      transitar(senha, ESTADOS.ATENDIDA);
      assert.equal(senha.status, ESTADOS.ATENDIDA);
    });
  });

  describe('Transições Inválidas e Restrições de Negócio', () => {
    it('deve impedir terceira chamada (CHAMADA_NOVAMENTE → CHAMADA)', () => {
      assert.equal(podeTransitar(ESTADOS.CHAMADA_NOVAMENTE, ESTADOS.CHAMADA), false);
      const senha = { id: 9, numero: '261127-SG003', status: ESTADOS.CHAMADA_NOVAMENTE };
      assert.throws(
        () => transitar(senha, ESTADOS.CHAMADA),
        /Transição não permitida: CHAMADA_NOVAMENTE → CHAMADA/
      );
    });

    it('deve impedir rechamada sobre rechamada (CHAMADA_NOVAMENTE → CHAMADA_NOVAMENTE)', () => {
      assert.equal(podeTransitar(ESTADOS.CHAMADA_NOVAMENTE, ESTADOS.CHAMADA_NOVAMENTE), false);
      const senha = { id: 10, numero: '261127-SG004', status: ESTADOS.CHAMADA_NOVAMENTE };
      assert.throws(
        () => transitar(senha, ESTADOS.CHAMADA_NOVAMENTE),
        /Transição não permitida: CHAMADA_NOVAMENTE → CHAMADA_NOVAMENTE/
      );
    });

    it('deve impedir pular estados (EMITIDA → CHAMADA diretamente)', () => {
      assert.equal(podeTransitar(ESTADOS.EMITIDA, ESTADOS.CHAMADA), false);
      const senha = { id: 11, numero: '261127-SP005', status: ESTADOS.EMITIDA };
      assert.throws(
        () => transitar(senha, ESTADOS.CHAMADA),
        /Transição não permitida: EMITIDA → CHAMADA/
      );
    });

    it('deve impedir pular chamada (AGUARDANDO → EM_ATENDIMENTO)', () => {
      assert.equal(podeTransitar(ESTADOS.AGUARDANDO, ESTADOS.EM_ATENDIMENTO), false);
      const senha = { id: 12, numero: '261127-SP006', status: ESTADOS.AGUARDANDO };
      assert.throws(
        () => transitar(senha, ESTADOS.EM_ATENDIMENTO),
        /Transição não permitida: AGUARDANDO → EM_ATENDIMENTO/
      );
    });

    it('deve impedir não compareceu na primeira chamada (CHAMADA → NAO_COMPARECEU)', () => {
      assert.equal(podeTransitar(ESTADOS.CHAMADA, ESTADOS.NAO_COMPARECEU), false);
      const senha = { id: 13, numero: '261127-SE003', status: ESTADOS.CHAMADA };
      assert.throws(
        () => transitar(senha, ESTADOS.NAO_COMPARECEU),
        /Transição não permitida: CHAMADA → NAO_COMPARECEU/
      );
    });

    it('deve impedir retorno de senha já ATENDIDA para qualquer outro estado', () => {
      const senha = { id: 14, numero: '261127-SP007', status: ESTADOS.ATENDIDA };
      for (const estado of Object.values(ESTADOS)) {
        assert.equal(podeTransitar(ESTADOS.ATENDIDA, estado), false);
        assert.throws(
          () => transitar(senha, estado),
          /Transição não permitida: ATENDIDA →/
        );
      }
    });

    it('deve impedir transições a partir de NAO_COMPARECEU', () => {
      const senha = { id: 15, numero: '261127-SG005', status: ESTADOS.NAO_COMPARECEU };
      for (const estado of Object.values(ESTADOS)) {
        assert.equal(podeTransitar(ESTADOS.NAO_COMPARECEU, estado), false);
        assert.throws(
          () => transitar(senha, estado),
          /Transição não permitida: NAO_COMPARECEU →/
        );
      }
    });

    it('deve impedir transições a partir de DESCARTADA', () => {
      const senha = { id: 16, numero: '261127-SG006', status: ESTADOS.DESCARTADA };
      for (const estado of Object.values(ESTADOS)) {
        assert.equal(podeTransitar(ESTADOS.DESCARTADA, estado), false);
        assert.throws(
          () => transitar(senha, estado),
          /Transição não permitida: DESCARTADA →/
        );
      }
    });

    it('deve rejeitar objeto de senha inválido ou sem status', () => {
      assert.throws(() => transitar(null, ESTADOS.AGUARDANDO), /Objeto senha inválido/);
      assert.throws(() => transitar({}, ESTADOS.AGUARDANDO), /Objeto senha inválido/);
      assert.throws(() => transitar({ status: 123 }, ESTADOS.AGUARDANDO), /Objeto senha inválido/);
    });

    it('deve rejeitar estado atual ou novo estado desconhecido', () => {
      assert.throws(
        () => transitar({ status: 'INVALIDO' }, ESTADOS.AGUARDANDO),
        /Estado atual "INVALIDO" não é um estado válido/
      );
      assert.throws(
        () => transitar({ status: ESTADOS.EMITIDA }, 'DESCONHECIDO'),
        /Estado "DESCONHECIDO" não é um estado válido/
      );
    });
  });

  describe('Identificação de Estados Finais e Ativos', () => {
    it('ehEstadoFinal deve retornar true para ATENDIDA, NAO_COMPARECEU e DESCARTADA', () => {
      assert.equal(ehEstadoFinal(ESTADOS.ATENDIDA), true);
      assert.equal(ehEstadoFinal(ESTADOS.NAO_COMPARECEU), true);
      assert.equal(ehEstadoFinal(ESTADOS.DESCARTADA), true);

      assert.equal(ehEstadoFinal(ESTADOS.EMITIDA), false);
      assert.equal(ehEstadoFinal(ESTADOS.AGUARDANDO), false);
      assert.equal(ehEstadoFinal(ESTADOS.CHAMADA), false);
      assert.equal(ehEstadoFinal(ESTADOS.CHAMADA_NOVAMENTE), false);
      assert.equal(ehEstadoFinal(ESTADOS.EM_ATENDIMENTO), false);
    });

    it('ehEstadoAtivo deve retornar true para CHAMADA, CHAMADA_NOVAMENTE e EM_ATENDIMENTO', () => {
      assert.equal(ehEstadoAtivo(ESTADOS.CHAMADA), true);
      assert.equal(ehEstadoAtivo(ESTADOS.CHAMADA_NOVAMENTE), true);
      assert.equal(ehEstadoAtivo(ESTADOS.EM_ATENDIMENTO), true);

      assert.equal(ehEstadoAtivo(ESTADOS.EMITIDA), false);
      assert.equal(ehEstadoAtivo(ESTADOS.AGUARDANDO), false);
      assert.equal(ehEstadoAtivo(ESTADOS.ATENDIDA), false);
      assert.equal(ehEstadoAtivo(ESTADOS.NAO_COMPARECEU), false);
      assert.equal(ehEstadoAtivo(ESTADOS.DESCARTADA), false);
    });
  });

  describe('Controle de Ocupação de Guichê (RN18)', () => {
    it('obterAtendimentoAtualDoGuiche deve retornar a senha ativa do guichê ou null se livre', () => {
      const senhas = [
        { id: 1, numero: '261127-SP001', guiche: 1, status: ESTADOS.EM_ATENDIMENTO },
        { id: 2, numero: '261127-SE001', guiche: 2, status: ESTADOS.ATENDIDA },
        { id: 3, numero: '261127-SG001', guiche: 3, status: ESTADOS.CHAMADA_NOVAMENTE },
      ];

      assert.equal(obterAtendimentoAtualDoGuiche(senhas, 1)?.id, 1);
      assert.equal(obterAtendimentoAtualDoGuiche(senhas, 2), null); // ATENDIDA é final
      assert.equal(obterAtendimentoAtualDoGuiche(senhas, 3)?.id, 3);
      assert.equal(obterAtendimentoAtualDoGuiche(senhas, 4), null); // Guichê sem senhas
      assert.equal(obterAtendimentoAtualDoGuiche(null, 1), null);
    });

    it('guicheEstaOcupado deve retornar true se houver senha ativa no guichê', () => {
      const senhas = [
        { id: 1, numero: '261127-SP001', guiche: 1, status: ESTADOS.CHAMADA },
        { id: 2, numero: '261127-SG001', guiche: 2, status: ESTADOS.ATENDIDA },
      ];

      assert.equal(guicheEstaOcupado(senhas, 1), true);
      assert.equal(guicheEstaOcupado(senhas, 2), false);
    });

    it('validarGuicheLivre deve lançar erro se o guichê estiver ocupado (RN18)', () => {
      const senhas = [
        { id: 1, numero: '261127-SP001', guiche: 1, status: ESTADOS.EM_ATENDIMENTO },
      ];

      assert.throws(
        () => validarGuicheLivre(senhas, 1),
        /O guichê 1 já possui a senha 261127-SP001 em andamento/
      );

      // Guichê 2 está livre
      assert.equal(validarGuicheLivre(senhas, 2), true);
    });
  });
});

