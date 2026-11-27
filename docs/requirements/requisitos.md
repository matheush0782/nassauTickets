# Requisitos do Sistema — nassauTickets

**Sistema de Controle de Atendimento para Laboratório de Análises Clínicas**

| Versão | Data | Responsável | Descrição |
|---|---|---|---|
| 1.0 | 25/11/2026 | Documentador 2 | Versão inicial dos requisitos funcionais e não funcionais |

Documento-base: `Sistema para controle de atendimento.pdf` (nesta mesma pasta).

---

## 1. Atores (Agentes)

| Sigla | Agente | Descrição |
|---|---|---|
| **AS** | Agente Sistema | Ente computacional que executa as ações de sistema, acessa o banco de dados, emite senhas, atualiza o painel e responde aos comandos dos demais agentes. |
| **AA** | Agente Atendente | Pessoa que, no guichê, aciona o sistema para chamar a próxima senha e realiza o atendimento. Um dos AA possui perfil adicional de **Gestor**. |
| **AC** | Agente Cliente | Pessoa que emite sua senha no totem (de forma anônima) e aguarda a chamada no painel. |

## 2. Requisitos Funcionais (RF)

Prioridade: **E** = Essencial, **I** = Importante, **D** = Desejável.

| ID | Requisito | Ator | Prioridade |
|---|---|---|---|
| RF01 | O sistema deve permitir que o cliente emita uma senha no totem escolhendo o tipo **SP** (Prioritária), **SG** (Geral) ou **SE** (Retirada de Exames). | AC | E |
| RF02 | O sistema deve gerar a numeração da senha no formato **YYMMDD-PPSQ** (ano, mês, dia, tipo e sequência de 3 dígitos por tipo, reiniciada diariamente). | AS | E |
| RF03 | O sistema deve exibir ao cliente o número da senha emitida e a data/hora de emissão. | AS | E |
| RF04 | O sistema deve manter uma fila de senhas aguardando atendimento, separada por tipo. | AS | E |
| RF05 | O sistema deve permitir que o atendente faça login com usuário e senha. | AA | E |
| RF06 | O sistema deve permitir que o atendente selecione o guichê em que está atendendo. | AA | E |
| RF07 | O sistema deve permitir que o atendente **chame a próxima senha**, respeitando as regras de prioridade (RN04 a RN07). | AA | E |
| RF08 | O sistema deve permitir que o atendente **chame novamente** uma senha já chamada, sinalizando “Última chamada” no painel. | AA | E |
| RF09 | O sistema deve permitir que o atendente **inicie o atendimento** quando o cliente comparecer ao guichê. | AA | E |
| RF10 | O sistema deve permitir que o atendente **finalize o atendimento**. | AA | E |
| RF11 | O sistema deve permitir registrar a senha como **não compareceu** após a segunda chamada sem comparecimento. | AA | E |
| RF12 | O sistema deve exibir no painel **somente as 5 últimas senhas chamadas**, com número, tipo e guichê, sem exibir a próxima senha. | AS | E |
| RF13 | O painel e o terminal devem ser **atualizados automaticamente**, sem ação manual do usuário. | AS | E |
| RF14 | O sistema deve anunciar por **áudio** a senha, a prioridade e o guichê no momento da chamada, e repetir o áudio com a indicação “Última chamada” na rechamada. | AS | I |
| RF15 | O sistema deve controlar o expediente: chamadas somente das **7h às 17h**; ao encerrar o expediente, as senhas que permanecerem na fila devem ser descartadas. | AS / Gestor | E |
| RF16 | O sistema deve gerar **relatório diário e mensal** com o quantitativo geral de senhas emitidas e atendidas. | Gestor | E |
| RF17 | O sistema deve gerar o quantitativo de senhas emitidas e atendidas **por prioridade**. | Gestor | E |
| RF18 | O sistema deve gerar **relatório detalhado** das senhas: número, tipo, data/hora de emissão, data/hora de atendimento e guichê (campos de atendimento em branco quando não atendida). | Gestor | E |
| RF19 | O sistema deve gerar **relatório de Tempo Médio (TM)** de atendimento por tipo de senha. | Gestor | E |
| RF20 | O sistema deve gerar **relatório de auditoria**: atendente, guichê, senha, horário da 1ª chamada, da 2ª chamada (se houver), do início e da finalização do atendimento. | Gestor | E |
| RF21 | O sistema deve apresentar **indicadores de desempenho** (taxa de atendimento, taxa de abandono, tempo médio de espera, atendimentos por atendente). | Gestor | I |
| RF22 | O sistema deve permitir **exportar** os relatórios (CSV) e imprimi-los. | Gestor | D |
| RF23 | O sistema deve restringir os relatórios e o encerramento de expediente ao perfil **Gestor**. | AS | E |
| RF24 | O gestor deve poder realizar os **cadastros** (atendentes e guichês). | Gestor | I |

## 3. Requisitos Não Funcionais (RNF)

### 3.1 Segurança

| ID | Requisito |
|---|---|
| RNF01 | As senhas de acesso dos atendentes devem ser armazenadas com *hash* seguro (ex.: bcrypt), nunca em texto puro. |
| RNF02 | As rotas do terminal e dos relatórios devem exigir autenticação por token (ex.: JWT) com expiração. |
| RNF03 | O controle de acesso deve ser baseado em perfil (Atendente / Gestor), validado no backend. |
| RNF04 | A comunicação em produção deve utilizar HTTPS. |
| RNF05 | Entradas do usuário devem ser validadas no backend para evitar injeção de SQL e dados inválidos. |

### 3.2 Disponibilidade e tolerância a falhas

| ID | Requisito |
|---|---|
| RNF06 | O sistema deve estar disponível durante todo o expediente (7h às 17h), com meta de 99% de disponibilidade nesse período. |
| RNF07 | Em caso de falha do backend ou do banco de dados, o painel e o terminal devem exibir um aviso de “Sem comunicação com o servidor”, manter as últimas informações válidas e tentar reconectar automaticamente. |
| RNF08 | Nenhuma ação do atendente deve ser considerada concluída sem confirmação do servidor. |

### 3.3 Auditoria

| ID | Requisito |
|---|---|
| RNF09 | Toda mudança de estado de uma senha deve registrar data/hora, atendente e guichê responsáveis. |
| RNF10 | Os registros de auditoria não devem poder ser alterados ou excluídos pelos usuários. |

### 3.4 Desempenho

| ID | Requisito |
|---|---|
| RNF11 | A emissão de uma senha deve ser concluída em até 2 segundos. |
| RNF12 | O painel deve refletir uma nova chamada em até 3 segundos. |
| RNF13 | Os relatórios mensais devem ser gerados em até 10 segundos. |

### 3.5 Concorrência

| ID | Requisito |
|---|---|
| RNF14 | Quando dois ou mais atendentes chamarem a próxima senha praticamente ao mesmo tempo, cada senha deve ser entregue a **um único** guichê. O backend deve usar transação com bloqueio de linha (ex.: `SELECT ... FOR UPDATE` no MySQL) ou fila atômica. |
| RNF15 | Um guichê não pode possuir mais de uma senha em andamento simultaneamente. |
| RNF16 | A sequência numérica das senhas não pode ser duplicada, mesmo com emissões simultâneas. |

### 3.6 LGPD (Lei nº 13.709/2018)

| ID | Requisito |
|---|---|
| RNF17 | O cliente (AC) interage de forma **anônima**: o totem não coleta nome, CPF ou qualquer dado pessoal. |
| RNF18 | Os dados pessoais tratados limitam-se aos dos atendentes (nome e usuário), usados apenas para autenticação e auditoria (finalidade e necessidade). |
| RNF19 | O acesso aos relatórios que identificam atendentes deve ser restrito ao Gestor. |
| RNF20 | Deve ser definida política de retenção dos dados de atendimento (sugestão: 12 meses) e descarte seguro após esse prazo. |

### 3.7 Acessibilidade

| ID | Requisito |
|---|---|
| RNF21 | As telas devem seguir as diretrizes **WCAG 2.1 nível AA** quanto a contraste de cores. |
| RNF22 | O painel deve usar fontes grandes e legíveis à distância, e a chamada deve ter **áudio**, atendendo pessoas com deficiência visual. |
| RNF23 | Todos os botões devem ser acessíveis por teclado, com foco visível. |
| RNF24 | O painel deve usar `aria-live` para que leitores de tela anunciem novas chamadas. |
| RNF25 | O tipo de senha não deve ser indicado apenas por cor: deve haver também o texto (SP/SG/SE). |

### 3.8 Usabilidade, compatibilidade e manutenibilidade

| ID | Requisito |
|---|---|
| RNF26 | O totem deve permitir a emissão de uma senha com **um único toque**. |
| RNF27 | A interface deve ser responsiva e funcionar nos navegadores Chrome, Edge e Firefox atuais. |
| RNF28 | O frontend deve ser desenvolvido em **React 19**; o backend em Node.js 22 (Express), Java 21 (Spring Boot) ou Python 3.14 (Flask/FastAPI); o banco em **MySQL 8.0**. |
| RNF29 | O código deve passar no ESLint sem erros e seguir a organização em `components/`, `pages/`, `services/`, `hooks/` e `utils/`. |

## 4. Rastreabilidade (Requisito → Tela)

| Requisito | Tela / componente |
|---|---|
| RF01–RF03 | `EmissaoSenha.jsx` (Totem) |
| RF05, RF23 | `Login.jsx`, `App.jsx` |
| RF06–RF11, RF15 | `TerminalAtendimento.jsx` |
| RF12, RF13, RNF07, RNF24 | `PainelChamadas.jsx`, `useAtualizacaoAutomatica.js`, `AvisoConexao.jsx` |
| RF16–RF22 | `Relatorios.jsx` |
