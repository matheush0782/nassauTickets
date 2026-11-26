# Status das Funcionalidades — nassauTickets

Documento mantido pelo **Documentador 2** e atualizado a cada entrega, para manter a documentação sincronizada com o sistema.

**Última atualização:** 26/11/2026, após as correções da revisão (reinício diário da prioridade, bloqueio do expediente encerrado e limpeza do repositório).

Legenda: ✅ Implementado e testado · 🟡 Parcial · ⬜ Pendente

## Resumo do estado real

| Camada | Situação |
|---|---|
| Frontend (React 19 + Vite, em `frontend/`) | ✅ Funcional. Executa com `npm install` e `npm run dev`; `npm run build` e `npm run lint` passam sem erros. |
| Regras de negócio | ✅ Implementadas no **simulador do frontend** (`frontend/src/services/simulador.js`), que guarda os dados no `localStorage` do navegador. |
| Backend / API REST | ⬜ **Não implementado.** A pasta `backend/` contém apenas `.gitkeep` e um `package-lock.json` vazio. |
| Banco de dados MySQL | ⬜ **Não implementado.** |
| Integração frontend ↔ backend | 🟡 A camada `services/api.js` já está pronta para consumir a API (basta definir `VITE_API_URL`), mas ainda não existe backend para conectar. |

> Enquanto o backend não existir, o sistema funciona em **modo simulação**: os dados ficam em cada navegador e não são compartilhados entre computadores diferentes.

## Frontend

| Funcionalidade | Requisito | Status | Observação |
|---|---|---|---|
| Estrutura React (components, pages, services, hooks, utils) | RNF29 | ✅ | `frontend/src` |
| Arquivos de inicialização do Vite/React em `frontend/` | — | ✅ | `index.html`, `package.json`, `package-lock.json`, `vite.config.js`, `eslint.config.js`, `public/favicon.svg`, `src/main.jsx`, `src/index.css` restaurados em 26/11 |
| Totem de emissão de senhas SP, SG e SE | RF01–RF03 | ✅ | Bloqueado quando o expediente está fechado |
| Numeração YYMMDD-PPSQ com sequência diária por tipo | RF02 / RN03 | ✅ | |
| Painel com as 5 últimas chamadas, sem exibir a próxima | RF12 | ✅ | |
| Indicação "Última chamada" no painel | RF08 | ✅ | |
| Atualização automática do painel, terminal e totem | RF13 | ✅ | Consulta a cada 2–5 s + sincronização entre abas do mesmo navegador |
| Aviso de falha de comunicação com o servidor | RNF07 | ✅ | `AvisoConexao.jsx` |
| Login do atendente e do gestor | RF05 | 🟡 | Funciona com usuários fixos do simulador; autenticação real depende do backend |
| Terminal do atendente (guichê, chamar, rechamar, iniciar, finalizar, não compareceu) | RF06–RF11 | ✅ | |
| Prioridade SP → SE \| SG → SP | RN04–RN08 | ✅ | |
| **Reinício diário da prioridade das filas** | RN28 | ✅ | **Corrigido em 26/11.** Cada dia começa por SP e as senhas de dias anteriores são descartadas |
| Horário de expediente (7h às 17h) | RF15 / RN19 | ✅ | |
| **Encerramento manual do expediente bloqueia novas chamadas** | RF15 / RN21 / RN29 | ✅ | **Corrigido em 26/11.** Antes só descartava a fila; agora bloqueia chamadas e emissões até o dia seguinte. O gestor pode reabrir |
| Relatórios diário/mensal (resumo, prioridade, detalhado, TM, auditoria, desempenho) | RF16–RF21 | ✅ | Calculados sobre os dados do simulador |
| Exportação CSV e impressão | RF22 | ✅ | |
| Controle de acesso por perfil na interface | RF23 | ✅ | Deve ser validado também no backend |
| Áudio na chamada e na rechamada | RF14 | ⬜ | Desenvolvedor 2 |
| Cadastros de atendentes e guichês | RF24 | ⬜ | Depende do backend |

## Backend e regras no servidor

| Funcionalidade | Requisito | Status | Responsável |
|---|---|---|---|
| API REST seguindo o contrato de `frontend/README.md` | — | ⬜ | Desenvolvedor 1 |
| Banco de dados MySQL 8.0 | RNF28 | ⬜ | Desenvolvedor 1 |
| Autenticação com hash de senha e token | RNF01–RNF03 | ⬜ | Desenvolvedor 1 |
| Prioridade, máquina de estados, reinício diário e expediente no servidor | RN04–RN29 | ⬜ | Desenvolvedor 2 (pode usar o simulador como referência) |
| Tratamento de concorrência entre guichês | RNF14–RNF16 | 🟡 | No simulador as operações são atômicas por navegador; falta a transação no banco |
| Simulação do TM aleatório e dos 5% de não comparecimento | RN09–RN11, RN16 | ⬜ | Desenvolvedor 2 |

## Repositório

| Item | Status | Observação |
|---|---|---|
| Estrutura obrigatória (`backend/`, `docs/…`, `frontend/`, `.gitignore`, `LICENSE`, `README.md`) | ✅ | Restaurados `docs/mer/.gitkeep` e `docs/models/uml/.gitkeep` |
| Remoção das cópias antigas do frontend na raiz (`src/`, `public/`, `index.html`, `package.json`, `package-lock.json`, `vite.config.js`, `eslint.config.js`) | ✅ | Corrigido em 26/11 |
| Remoção da pasta duplicada `frontend/frontend/` e de `frontend/docs/` | ✅ | |
| Remoção dos arquivos `.DS_Store` e inclusão no `.gitignore` | ✅ | Corrigido em 26/11 |
| Documentos em `docs/requirements` (especificação e relatório de testes do painel) | ✅ | PDFs restaurados |
| Branches `main` e `dev` com merge da `dev` para a `main` | 🟡 | Falta o merge final após aceitar o PR #4 |
| Vídeo de apresentação (até 1 minuto) na raiz | ⬜ | Equipe |

## Documentação

| Artefato | Responsável | Status |
|---|---|---|
| Requisitos funcionais e não funcionais (`requisitos.md`) | Documentador 2 | ✅ |
| Regras de negócio (`regras-de-negocio.md`) | Documentador 2 | ✅ (v1.1 com RN28 e RN29) |
| Casos de uso (`casos-de-uso.md`) | Documentador 2 | ✅ |
| Mockups das telas (`docs/mockups`) | Documentador 2 | ✅ |
| Identidade visual (`docs/branding`) | Documentador 2 | ✅ |
| Status das funcionalidades (este documento) | Documentador 2 | ✅ |
| README principal, arquitetura e instalação | Documentador 1 | 🟡 O README ainda descreve um sistema de ingressos e eventos, não o controle de atendimento |
| Diagramas UML (`docs/models/uml`) | Documentador 1 | ⬜ |
| MER (`docs/mer`) | Documentador 1 | ⬜ |
| Plano e relatório de testes | Testador | 🟡 Existe o relatório do painel de chamadas |

## Verificações executadas em 26/11/2026

Comandos executados em `frontend/`: `npm install`, `npm run dev`, `npm run build` e `npm run lint`, todos sem erros.

Testes funcionais no navegador (Chromium), em modo simulação: **25 de 25 verificações aprovadas**.

| Cenário | Resultado |
|---|---|
| Formato YYMMDD-PPSQ e sequência por tipo | ✅ |
| Ordem de chamada SP001 → SE001 → SP002 → SG001 → SG002 → SG003 | ✅ |
| Botão "Chamar próxima" desabilitado com a fila vazia | ✅ |
| Painel exibe somente as 5 últimas chamadas | ✅ |
| Segunda chamada exibe "Última chamada" e permite registrar "Não compareceu" | ✅ |
| Virada de dia: prioridade reiniciada, expediente reaberto e senhas de ontem descartadas | ✅ |
| Primeira chamada do dia é SP, mesmo que o dia anterior tenha terminado em SP | ✅ |
| Encerramento manual: fila descartada, totem bloqueado e chamadas bloqueadas na interface e no serviço | ✅ |
| Reabertura do expediente pelo gestor libera as chamadas | ✅ |
| Atendente não acessa relatórios nem o encerramento; gestor acessa | ✅ |
| Nenhum erro de JavaScript durante os testes | ✅ |
