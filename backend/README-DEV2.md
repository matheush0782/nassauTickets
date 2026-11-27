# nassauTickets — Documentação de Implementação (Desenvolvedor 2)

**Responsável:** Desenvolvedor 2  
**Escopo:** Implementação das regras de negócio (domínio) e testes automatizados.  
**Branch:** `feature/dev2`  
**Ambiente:** Node.js v24 (mínimo v22) — ESM nativo, sem dependências externas (`node:test`, `node:assert/strict`).

---

## 1. Visão Geral dos Módulos

Os módulos foram desenhados seguindo os princípios de **Domain-Driven Design (DDD)** e arquitetura limpa: lógica pura, desacoplada de frameworks web (Express/FastAPI), banco de dados (MySQL) e interface (React).

```
backend/
├── package.json                           # Configuração ESM e scripts de teste
├── README-DEV2.md                         # Esta documentação
├── src/
│   └── domain/
│       ├── estados.mjs                    # Máquina de estados das senhas
│       ├── prioridade.mjs                 # Algoritmo de alternância e prioridade das filas
│       └── expediente.mjs                 # Regras de horário, encerramento e fuso horário
└── tests/
    ├── estados.test.mjs                   # 21 testes unitários da máquina de estados
    ├── prioridade.test.mjs                # 16 testes unitários do algoritmo de prioridade
    ├── expediente.test.mjs                # 14 testes unitários do expediente
    └── integracao-regras.test.mjs         # 7 testes integrando os três módulos em cenários reais
```

---

## 2. Detalhamento dos Módulos e Regras Atendidas

### 2.1 Máquina de Estados (`src/domain/estados.mjs`)

Implementa as transições válidas e restrições conforme o diagrama de estados oficial da documentação.

* **Estados Válidos:** `EMITIDA`, `AGUARDANDO`, `CHAMADA`, `CHAMADA_NOVAMENTE`, `EM_ATENDIMENTO`, `ATENDIDA`, `NAO_COMPARECEU`, `DESCARTADA`.
* **Transições Permitidas:**
  * `EMITIDA → AGUARDANDO`: Entrada na fila após geração no totem.
  * `AGUARDANDO → CHAMADA`: Atendente chama a próxima senha.
  * `AGUARDANDO → DESCARTADA`: Senha descartada no fim do expediente (**RN21**).
  * `CHAMADA → CHAMADA_NOVAMENTE`: Rechamada da senha com indicação de "Última chamada" (**RN14**).
  * `CHAMADA → EM_ATENDIMENTO`: Cliente compareceu na 1ª chamada (**RN17**).
  * `CHAMADA_NOVAMENTE → EM_ATENDIMENTO`: Cliente compareceu na 2ª chamada (**RN17**).
  * `CHAMADA_NOVAMENTE → NAO_COMPARECEU`: Cliente não compareceu após 2 chamadas (**RN15**, **RN16**).
  * `EM_ATENDIMENTO → ATENDIDA`: Atendimento concluído com sucesso (**RN20**).
* **Restrições Validadas:**
  * Bloqueio de 3ª chamada (`CHAMADA_NOVAMENTE` não pode ir para `CHAMADA` ou `CHAMADA_NOVAMENTE`).
  * Bloqueio de salto de estados (ex.: `EMITIDA → CHAMADA` ou `AGUARDANDO → EM_ATENDIMENTO`).
  * Bloqueio de saída de estados terminais (`ATENDIDA`, `NAO_COMPARECEU`, `DESCARTADA` são finais).
* **Regras Atendidas:** **RN14**, **RN15**, **RN17**, **RN20**, **RN21**.

### 2.2 Controle de Prioridade (`src/domain/prioridade.mjs`)

Responsável por determinar a ordem das senhas a serem atendidas.

* **Sequência de Alternância:** `[SP] → [SE | SG] → [SP] → [SE | SG]` (**RN07**).
  * Maior prioridade: **SP** (**RN04**).
  * Prioridade especial pós-SP: **SE** (**RN05**).
  * Menor prioridade: **SG** (**RN06**).
* **Ordem de Busca:**
  * Se o último tipo chamado foi `SP` → busca `SE → SG → SP`.
  * Se o último tipo foi `null` (início do dia), `SE` ou `SG` → busca `SP → SE → SG`.
* **Critério de Desempate:** FIFO (First-In, First-Out) rigoroso pelo timestamp de emissão dentro de cada tipo (**RN08**).
* **Guichês Universais:** Qualquer guichê pode atender qualquer tipo de senha (**RN02**).
* **Reinício Diário:** O primeiro atendimento de cada dia começa sempre por `SP`, mesmo que o dia anterior tenha terminado em `SP` (**RN28**).
* **Regras Atendidas:** **RN02**, **RN04**, **RN05**, **RN06**, **RN07**, **RN08**, **RN18**, **RN27**, **RN28**.

### 2.3 Controle de Expediente (`src/domain/expediente.mjs`)

Controla janelas operacionais de emissão e atendimento.

* **Horário:** Aberto das 07h00 (inclusive) até antes das 17h00 (exclusive) (**RN19**).
  * Exemplo: 06h59 = fechado; 07h00 = aberto; 16h59 = aberto; 17h00 = fechado.
* **Fuso Horário:** `America/Recife` (UTC−3), tratado de forma agnóstica via API nativa `Intl.DateTimeFormat`.
* **Continuidade de Atendimentos:** Atendimentos iniciados antes das 17h00 podem ser finalizados normalmente após o encerramento (**RN20**).
* **Descarte de Senhas:** Senhas em `AGUARDANDO` no momento do encerramento passam para `DESCARTADA` (**RN21**).
* **Encerramento Manual pelo Gestor:** Bloqueia novas emissões e chamadas no mesmo dia (**RN29**).
* **Reabertura pelo Gestor:** Permite desfazer um encerramento feito por engano no mesmo dia (**RN29**).
* **Virada do Dia:** Reseta automaticamente o flag de encerramento manual e descarta senhas de dias anteriores (**RN28**).
* **Regras Atendidas:** **RN19**, **RN20**, **RN21**, **RN28**, **RN29**.

---

## 3. Matriz de Rastreabilidade de Regras de Negócio

| Regra | Descrição resumida | Módulo Responsável | Testes Cobertos |
|---|---|---|---|
| **RN02** | Qualquer guichê atende qualquer tipo | `prioridade.mjs` | `prioridade.test.mjs`, `integracao-regras.test.mjs` |
| **RN04** | SP tem maior prioridade | `prioridade.mjs` | `prioridade.test.mjs` |
| **RN05** | SE tem preferência sobre SG após SP | `prioridade.mjs` | `prioridade.test.mjs` |
| **RN06** | SG tem menor prioridade | `prioridade.mjs` | `prioridade.test.mjs` |
| **RN07** | Alternância SP → SE/SG → SP | `prioridade.mjs` | `prioridade.test.mjs` |
| **RN08** | Fila vazia busca próximo tipo; FIFO | `prioridade.mjs` | `prioridade.test.mjs` |
| **RN14** | Rechamada (indica última chamada) | `estados.mjs` | `estados.test.mjs`, `integracao-regras.test.mjs` |
| **RN15** | Abandono após 2 chamadas (NAO_COMPARECEU) | `estados.mjs` | `estados.test.mjs`, `integracao-regras.test.mjs` |
| **RN17** | Início do atendimento com cliente presente | `estados.mjs` | `estados.test.mjs`, `integracao-regras.test.mjs` |
| **RN18** | Guichê ocupado impede nova chamada | `prioridade.mjs`, `estados.mjs` | `prioridade.test.mjs`, `integracao-regras.test.mjs` |
| **RN19** | Expediente das 07h às 17h (America/Recife) | `expediente.mjs` | `expediente.test.mjs` |
| **RN20** | Finalizar atendimentos após fim do expediente | `expediente.mjs`, `estados.mjs` | `expediente.test.mjs`, `integracao-regras.test.mjs` |
| **RN21** | Descarte de senhas aguardando ao encerrar | `expediente.mjs`, `estados.mjs` | `expediente.test.mjs`, `integracao-regras.test.mjs` |
| **RN27** | Concorrência entre guichês na chamada | `prioridade.mjs` | `prioridade.test.mjs`, `integracao-regras.test.mjs` |
| **RN28** | Reinício diário de prioridade e virada de dia | `prioridade.mjs`, `expediente.mjs` | `prioridade.test.mjs`, `expediente.test.mjs`, `integracao-regras.test.mjs` |
| **RN29** | Encerramento manual e reabertura pelo gestor | `expediente.mjs` | `expediente.test.mjs`, `integracao-regras.test.mjs` |

---

## 4. Como Executar os Testes

Todos os testes utilizam o test runner oficial do Node.js (`node:test`), sem necessidade de instalar pacotes via `npm install`.

### Executar todos os testes (58 testes):
```bash
cd backend
npm test
```

### Executar testes por suíte individual:
```bash
cd backend
npm run test:estados       # 21 testes da máquina de estados
npm run test:prioridade    # 16 testes do algoritmo de prioridade
npm run test:expediente    # 14 testes do expediente
npm run test:integracao    # 7 testes integrados
```

---

## 5. Diretrizes para a Futura Integração (Dev 1 / API REST e Banco de Dados)

### 5.1 Concorrência Real e Atomicidade (RN27 / RNF14)

> [!WARNING]
> **Atenção crítica sobre concorrência real e múltiplos processos:**  
> Os testes unitários e de integração deste módulo rodam em memória de forma sequencial. Eles garantem que a **lógica** de seleção não gera duplicatas e respeita a exclusão de IDs e bloqueio de guichê ocupado.
>
> Contudo, em um ambiente de produção real:
> - **Um mutex em memória NÃO garante atomicidade entre múltiplos processos ou servidores**: se o backend for executado com múltiplos workers (ex.: PM2 em modo cluster, réplicas no Docker/Kubernetes, ou escalonamento horizontal com balanceador de carga), a memória **não é compartilhada** entre as instâncias do Node.js. Duas requisições simultâneas de chamadas recebidas por instâncias diferentes ignorarão qualquer mutex local.
> - **A solução obrigatória e robusta é a nível de banco de dados ou lock distribuído**:
>   1. **No MySQL 8.0 (Recomendado):** Transações ACID com nível de isolamento adequado e bloqueio pessimista (`SELECT ... FOR UPDATE`). O banco é o único ponto centralizado de verdade compartilhado entre todas as instâncias da API.
>   2. **Lock Distribuído (Alternativa):** Se houver necessidade de travar fora do banco, deve-se utilizar um lock distribuído centralizado (ex.: Redis com algoritmo Redlock).
>
> **Exemplo de Transação Atômica no MySQL 8.0:**
   ```sql
   START TRANSACTION;

   -- 1. Verificar se o guichê já possui atendimento em andamento (RN18)
   SELECT id, numero, status FROM senhas 
   WHERE guiche_id = ? AND status IN ('CHAMADA', 'CHAMADA_NOVAMENTE', 'EM_ATENDIMENTO')
   FOR UPDATE;

   -- Se retornar algum registro, a API deve abortar e fazer ROLLBACK (guichê ocupado)

   -- 2. Selecionar a próxima senha elegível respeitando a prioridade com bloqueio de linha
   SELECT * FROM senhas
   WHERE status = 'AGUARDANDO' AND tipo = ? AND DATE(emitida_em) = CURDATE()
   ORDER BY emitida_em ASC
   LIMIT 1
   FOR UPDATE;

   -- 3. Atualizar imediatamente o status e vincular guichê e atendente
   UPDATE senhas 
   SET status = 'CHAMADA', guiche_id = ?, atendente_id = ?, chamada_em = NOW()
   WHERE id = ?;

   COMMIT;
   ```

### 5.2 Transição `EMITIDA → AGUARDANDO` na API

Conforme a documentação oficial, a senha nasce como `EMITIDA` e é colocada na fila como `AGUARDANDO`. No endpoint `POST /senhas`, o Dev 1 deve persistir a senha com status inicial `AGUARDANDO` (ou aplicar a transição imediatamente durante o fluxo de emissão).

---

## 6. Roteiro Didático para Apresentação ao Professor

Ao apresentar o projeto para o professor, você pode estruturar sua fala em 4 pontos:

1. **Separação de Responsabilidades (Clean Architecture):**  
   "Minha responsabilidade como Dev 2 foi criar o núcleo do negócio (*domain core*). Ele é 100% independente do banco de dados e do React, o que significa que se amanhã trocarmos o MySQL por PostgreSQL ou o Express por NestJS, toda essa lógica permanece intacta."

2. **A Lógica de Prioridade e o Exemplo Oficial (RN04 a RN08):**  
   "A regra exige uma alternância `[SP] → [SE | SG] → [SP] → [SE | SG]`. Implementei uma máquina de decisão que lembra o último tipo chamado no dia. No nosso teste unitário `Exemplo completo da documentação oficial (RN08)`, reproduzimos a fila do documento: emitidas na ordem `SG001, SG002, SP001, SE001, SP002, SG003`, o sistema selecionou rigorosamente `SP001, SE001, SP002, SG001, SG002, SG003`."

3. **Robustez da Máquina de Estados:**  
   "Nenhuma senha pode ter seu estado alterado sem passar pela função `transitar()`. Se um atendente tentar chamar uma senha pela 3ª vez, tentar atender uma senha já finalizada ou pular direto de emitida para em atendimento, o sistema bloqueia e lança uma exceção com mensagem clara."

4. **Tratamento de Tempo e Fuso Horário:**  
   "O expediente respeita rigidamente o fuso `America/Recife` entre 07h e 17h. Para testar isso sem depender do relógio do computador, criamos uma injeção de data/hora (`agora`), permitindo testar cenários como um atendimento iniciado às 16h59 e finalizado às 17h15, ou a virada da meia-noite resetando o encerramento do expediente."
