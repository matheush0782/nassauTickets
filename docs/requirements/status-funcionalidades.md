# Status das Funcionalidades — nassauTickets

Documento mantido pelo **Documentador 2** e atualizado a cada entrega, para manter a documentação sincronizada com o sistema.

**Última atualização:** 25/11/2026

Legenda: ✅ Implementado · 🟡 Parcial / em andamento · ⬜ Pendente

## Frontend (Desenvolvedor 3)

| Funcionalidade | Requisito | Status | Observação |
|---|---|---|---|
| Estrutura React (componentes, páginas, serviços, hooks, utils) | RNF29 | ✅ | `frontend/src` |
| Totem de emissão de senhas SP, SG e SE | RF01–RF03 | ✅ | `EmissaoSenha.jsx` |
| Painel com as 5 últimas chamadas, sem exibir a próxima | RF12 | ✅ | `PainelChamadas.jsx` |
| Indicação “Última chamada” no painel | RF08 | ✅ | |
| Atualização automática do painel e do terminal | RF13 | ✅ | Polling de 2 s + sincronização entre abas |
| Aviso de falha do backend | RNF07 | ✅ | `AvisoConexao.jsx` |
| Tela de login | RF05 | ✅ | Validação real depende do backend |
| Terminal do atendente (selecionar guichê, chamar, rechamar, iniciar, finalizar, não compareceu) | RF06–RF11 | ✅ | `TerminalAtendimento.jsx` |
| Encerrar expediente (gestor) | RF15 | ✅ | |
| Relatórios diário/mensal (resumo, prioridade, detalhado, TM, auditoria, desempenho) | RF16–RF21 | ✅ | `Relatorios.jsx` |
| Exportação CSV e impressão | RF22 | ✅ | |
| Controle de acesso por perfil na interface | RF23 | ✅ | Deve ser validado também no backend |
| Camada de API REST (`services/api.js`) | — | ✅ | Contrato em `frontend/README.md` |
| Simulador local (enquanto não há backend) | — | ✅ | `services/simulador.js` |

## Backend e regras (Desenvolvedores 1 e 2)

| Funcionalidade | Requisito | Status | Observação |
|---|---|---|---|
| Limpeza das pastas duplicadas na raiz e em `frontend/frontend` | — | ⬜ | Desenvolvedor 1 |
| API REST seguindo o contrato do frontend | — | ⬜ | Desenvolvedor 1 |
| Banco de dados MySQL 8.0 | RNF28 | ⬜ | Desenvolvedor 1 |
| Autenticação com hash e token | RNF01–RNF03 | ⬜ | Desenvolvedor 1 |
| Regra de prioridade no backend | RN04–RN08 | 🟡 | Implementada no simulador; falta no backend (Desenvolvedor 2) |
| Máquina de estados no backend | RN — seção 10 | 🟡 | Implementada no simulador; falta no backend |
| Tratamento de concorrência | RNF14–RNF16 | ⬜ | Desenvolvedor 2 |
| Áudio na chamada e na rechamada | RF14 | ⬜ | Desenvolvedor 2 |
| Simulação do TM aleatório e dos 5% de abandono | RN09–RN11, RN16 | ⬜ | Desenvolvedor 2 |
| Cadastros de atendentes e guichês | RF24 | ⬜ | Depende do backend |

## Documentação

| Artefato | Responsável | Status |
|---|---|---|
| Requisitos funcionais e não funcionais (`requisitos.md`) | Documentador 2 | ✅ |
| Regras de negócio (`regras-de-negocio.md`) | Documentador 2 | ✅ |
| Casos de uso (`casos-de-uso.md`) | Documentador 2 | ✅ |
| Mockups das telas (`docs/mockups`) | Documentador 2 | ✅ |
| Identidade visual (`docs/branding`) | Documentador 2 | ✅ |
| README, arquitetura e instalação | Documentador 1 | 🟡 |
| Diagramas UML (`docs/models/uml`) | Documentador 1 | ⬜ |
| MER (`docs/mer`) | Documentador 1 | ⬜ |
| Plano e relatório de testes | Testador | 🟡 |
