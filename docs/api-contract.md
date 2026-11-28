# Contrato da API REST — nassauTickets (v1.1)

Documento de alinhamento técnico da API REST para integração entre **Backend Base (Desenvolvedor 1)**, **Regras de Negócio e Fila (Desenvolvedor 2 — Matheus Kastberg)**, **Frontend React (Desenvolvedor 3)** e **Documentação (Samuel Nikolas)**.

---

## 1. Convenções Gerais

- **Base URL:** `http://localhost:3001/api`
- **Formato:** `application/json; charset=utf-8`
- **Padrão de nomes de campos (JSON request e response):** `camelCase`
- **Autenticação:** JWT enviado no cabeçalho HTTP:
  ```http
  Authorization: Bearer <token>
  ```
- **Perfis de acesso (RBAC):**
  - `publico`: Totem anônimo (AC) e Painel de Chamadas
  - `atendente`: Agente Atendente (AA)
  - `gestor`: Agente Atendente único com perfil adicional de Gestor

---

## 2. Envelope Padronizado de Resposta

### Sucesso (`2xx`)
```json
{
  "sucesso": true,
  "dados": {}
}
```

### Erro (`4xx` / `5xx`)
```json
{
  "sucesso": false,
  "erro": "Mensagem legível descrevendo o erro.",
  "mensagem": "Mensagem legível descrevendo o erro.",
  "codigo": "CODIGO_PADRAO_DO_ERRO"
}
```

Códigos HTTP utilizados:
- `200 OK` / `201 Created` — Operação concluída
- `400 Bad Request` (`VALIDATION_ERROR`, `INVALID_JSON`, `INVALID_REFERENCE`) — Dados ou parâmetros inválidos
- `401 Unauthorized` (`UNAUTHORIZED`) — Token ausente, inválido, expirado ou credenciais inválidas
- `403 Forbidden` (`FORBIDDEN`) — Perfil sem permissão para o recurso
- `404 Not Found` (`NOT_FOUND`, `ROUTE_NOT_FOUND`, `EMPTY_QUEUE`) — Recurso ou fila vazia
- `409 Conflict` (`CONFLICT`, `DUPLICATE_ENTRY`, `SINGLE_GESTOR_LIMIT`, `TICKET_ALREADY_RESERVED`, `INVALID_TRANSITION`) — Conflito de estado ou concorrência
- `503 Service Unavailable` (`DATABASE_UNAVAILABLE`) — Banco MySQL indisponível

---

## 3. Endpoints

### Infraestrutura e Autenticação

| Método | Rota | Acesso | Entrada | Saída (dentro de `dados`) | Erros possíveis |
|---|---|---|---|---|---|
| `GET` | `/api/health` | Público | — | `{ status, servico, bancoDados, timestamp }` | `503` MySQL offline |
| `POST` | `/api/auth/login` | Público | `{ login, senha }` ou `{ usuario, senha }` | `{ token, usuario: { id, nome, login, email, perfil }, nome, perfil }` | `400` campos vazios, `401` credenciais inválidas/inativo |
| `GET` | `/api/auth/me` | `atendente`, `gestor` | — | `{ usuario: { id, nome, login, email, perfil, ativo } }` | `401` token ausente/inválido |

### Usuários (Cadastro pelo Gestor)

| Método | Rota | Acesso | Entrada | Saída (dentro de `dados`) | Erros possíveis |
|---|---|---|---|---|---|
| `GET` | `/api/usuarios` | `gestor` | Query: `?perfil=atendente\|gestor&ativo=true\|false` | `{ usuarios: [...] }` | `401`, `403` |
| `GET` | `/api/usuarios/:id` | `gestor` | — | `{ usuario }` | `404` |
| `POST` | `/api/usuarios` | `gestor` | `{ nome, login, email?, senha, perfil }` | `{ usuario }` | `400` validação, `409` login duplicado/limite gestor |
| `PUT` | `/api/usuarios/:id` | `gestor` | `{ nome?, email?, perfil?, senha? }` | `{ usuario }` | `400`, `404`, `409` |
| `PATCH` | `/api/usuarios/:id/status` | `gestor` | `{ ativo: boolean }` | `{ usuario }` | `400`, `404` |

### Guichês

| Método | Rota | Acesso | Entrada | Saída (dentro de `dados`) | Erros possíveis |
|---|---|---|---|---|---|
| `GET` | `/api/guiches` | `atendente`, `gestor` | Query: `?ativos=true` | `{ guiches: [...] }` | `401` |
| `POST` | `/api/guiches` | `gestor` | `{ numero, descricao?, ativo? }` | `{ guiche }` | `400`, `409` duplicado |
| `PUT` | `/api/guiches/:id` | `gestor` | `{ numero?, descricao?, ativo? }` | `{ guiche }` | `400`, `404`, `409` |
| `POST` | `/api/guiches/:id/ocupar` | `atendente`, `gestor` | — | `{ guiche }` | `400` inativo, `404`, `409` ocupado |
| `POST` | `/api/guiches/:id/liberar` | `atendente`, `gestor` | — | `{ guiche }` | `403` outro dono, `404` |
| `GET` | `/api/guiches/:id/atendimento-atual` | `atendente`, `gestor` | — | `{ senha \| null }` | `401` |

### Expediente Diário

| Método | Rota | Acesso | Entrada | Saída (dentro de `dados`) | Erros possíveis |
|---|---|---|---|---|---|
| `GET` | `/api/expediente` | Público | Query: `?data=YYYY-MM-DD` | `{ dataReferencia, encerradoManualmente, expedienteEncerrado, expedienteAberto, ultimoTipoChamado }` | — |
| `POST` | `/api/expediente/encerrar` | `gestor` | `{ data? }` | `{ dataReferencia, expedienteEncerrado, expedienteAberto, descartadas }` | `401`, `403`, `409` já encerrado |
| `POST` | `/api/expediente/reabrir` | `gestor` | `{ data? }` | `{ dataReferencia, expedienteEncerrado, expedienteAberto }` | `401`, `403`, `409` não encerrado |

### Senhas, Fila e Chamadas

| Método | Rota | Acesso | Entrada | Saída (dentro de `dados`) | Erros possíveis |
|---|---|---|---|---|---|
| `POST` | `/api/senhas` | Público (Totem AC) | `{ tipo: "SP" \| "SG" \| "SE" }` | `{ senha }` | `400` tipo inválido |
| `GET` | `/api/senhas/painel` | Público (Painel) | Query: `?limit=5` | `{ chamadas: [...] }` | — |
| `GET` | `/api/senhas/fila` | `atendente`, `gestor` | Query: `?tipo=SP` | `{ aguardando, contagem: { SP, SG, SE, total }, ultimaChamada }` | `401` |
| `GET` | `/api/senhas` | `atendente`, `gestor` | Query: `?data=YYYY-MM-DD&tipo=&status=&limit=&offset=` | `{ senhas: [...] }` | `400` filtro inválido, `401` |
| `GET` | `/api/senhas/:id` | `atendente`, `gestor` | — | `{ senha }` | `401`, `404` |
| `POST` | `/api/senhas/reservar-proxima` | `atendente`, `gestor` | `{ guicheId }` (ou `{ guiche }`) | `{ senha }` | `400` guichê inativo, `404` fila vazia/guichê, `409` guichê com senha ativa / expediente encerrado |
| `POST` | `/api/senhas/:id/reservar` | `atendente`, `gestor` | `{ guicheId }` | `{ senha }` | `404`, `409` senha indisponível |
| `POST` | `/api/senhas/:id/chamar-novamente` | `atendente`, `gestor` | — | `{ senha }` | `404`, `409 INVALID_TRANSITION` |
| `POST` | `/api/senhas/:id/iniciar` | `atendente`, `gestor` | — | `{ senha }` | `404`, `409 INVALID_TRANSITION` |
| `POST` | `/api/senhas/:id/finalizar` | `atendente`, `gestor` | — | `{ senha }` | `404`, `409 INVALID_TRANSITION` |
| `POST` | `/api/senhas/:id/nao-compareceu` | `atendente`, `gestor` | — | `{ senha }` | `404`, `409 INVALID_TRANSITION` |
| `POST` | `/api/senhas/descartar-pendentes` | `gestor` | `{ data? }` | `{ dataReferencia, descartadas }` | `401`, `403` |
| `PATCH` | `/api/senhas/:id/status` | `atendente`, `gestor` | `{ status, guicheId?, atendenteId? }` | `{ senha }` | `400`, `404`, `409 INVALID_TRANSITION` |

### Auditoria e Relatórios

| Método | Rota | Acesso | Entrada | Saída (dentro de `dados`) | Erros possíveis |
|---|---|---|---|---|---|
| `GET` | `/api/auditoria` | `gestor` | Query: `?limite=50&offset=0&acao=&usuarioId=` | `{ eventos: [...] }` | `401`, `403` |
| `GET` | `/api/relatorios/senhas` | `gestor` | Query: `?periodo=diario\|mensal&referencia=...` | `{ senhas: [...] }` | `400`, `401`, `403` |

### Aliases de Compatibilidade (Frontend Dev 3)

| Alias no Backend | Rota Canônica | Acesso |
|---|---|---|
| `GET /api/painel/ultimas-chamadas` | `GET /api/senhas/painel` | Público |
| `GET /api/fila/resumo` | `GET /api/senhas/fila` | `atendente`, `gestor` |
| `POST /api/atendimentos/chamar-proxima` | `POST /api/senhas/reservar-proxima` | `atendente`, `gestor` |

---

## 4. Modelos de Dados (`camelCase`)

- **Usuário:** `{ id, nome, login, email, perfil, ativo, criadoEm, atualizadoEm }` (`senha_hash` nunca é exposto).
- **Guichê:** `{ id, numero, descricao, ativo, atendenteAtualId, atendenteNome, atendenteLogin, criadoEm, atualizadoEm }`.
- **Senha:** `{ id, codigo, numero, tipo, dataReferencia, sequencial, status, guicheId, guicheNumero, guiche, atendenteId, atendenteNome, atendenteLogin, atendente, emitidaEm, primeiraChamadaEm, segundaChamadaEm, chamadas, inicioAtendimentoEm, inicioEm, fimAtendimentoEm, fimEm, tempoAtendimentoSegundos, atualizadoEm }`.
- **Evento de Auditoria:** `{ id, usuarioId, usuarioLogin, usuarioNome, senhaId, senhaCodigo, guicheId, guicheNumero, acao, detalhes, ipOrigem, criadoEm }`.

> **Nota de compatibilidade:** O modelo de Senha expõe aliases (`numero`/`codigo`, `guiche`/`guicheNumero`, `atendente`/`atendenteNome`, `inicioEm`/`inicioAtendimentoEm`, `fimEm`/`fimAtendimentoEm`, `chamadas`) para manter compatibilidade com o frontend do Samuel que usa os nomes mais curtos oriundos do simulador local.

---

## 5. Máquina de Estados

Transições válidas validadas pelo backend no `PATCH /api/senhas/:id/status`:

| Estado Atual | Transições Permitidas |
|---|---|
| `EMITIDA` | → `AGUARDANDO` |
| `AGUARDANDO` | → `CHAMADA`, `DESCARTADA` |
| `CHAMADA` | → `CHAMADA_NOVAMENTE`, `EM_ATENDIMENTO` |
| `CHAMADA_NOVAMENTE` | → `EM_ATENDIMENTO`, `NAO_COMPARECEU` |
| `EM_ATENDIMENTO` | → `ATENDIDA` |
| `ATENDIDA` | (estado final) |
| `NAO_COMPARECEU` | (estado final) |
| `DESCARTADA` | (estado final) |

As rotas dedicadas (`/reservar`, `/chamar-novamente`, `/iniciar`, `/finalizar`, `/nao-compareceu`) já validam a transição internamente. O `PATCH /api/senhas/:id/status` também valida contra a máquina de estados.

---

## 6. Pontos de Integração com o Desenvolvedor 2

| Ponto | O que o Dev 1 fornece | O que o Dev 2 deve fornecer |
|---|---|---|
| `POST /api/senhas/reservar-proxima` | Aceita `tiposPrioritarios: string[]` para definir a ordem de busca | A ordem baseada em `prioridade.mjs` (RN04-RN08) |
| Tabela `expediente_diario` | Schema com persistência de encerramento/reabertura | Lógica de horário e bloqueio (`expediente.mjs`) |
| Transições de estado | Validação no repositório e service | Regras adicionais de `estados.mjs` |
| Controle global de prioridade | Campo `ultimoTipoChamado` pode ser persistido na tabela `expediente_diario` ou em memória | Alternância SP→SE/SG→SP conforme `prioridade.mjs` |

---

## 7. Decisões Pendentes de Alinhamento

> **⚠️ Estas decisões precisam ser confirmadas com Samuel (Dev 3) e Kastberg (Dev 2) antes de serem consideradas concluídas.**

1. **Rotas canônicas vs Aliases:** O backend agora expõe aliases (`/api/painel/ultimas-chamadas`, `/api/fila/resumo`, `/api/atendimentos/chamar-proxima`, `/api/relatorios/senhas`, `/api/guiches/:id/atendimento-atual`, `/api/expediente/*`) para compatibilidade imediata com `frontend/src/services/api.js`. Confirmar com a equipe se os aliases devem ser mantidos ou se o frontend migrará para `/api/senhas/*`.
2. **Perfil `GESTOR` vs `gestor`:** O frontend do simulador usa maiúsculas (`GESTOR`, `ATENDENTE`); o backend usa minúsculas (`gestor`, `atendente`). Confirmar normalização com Samuel.
3. **Integração dos módulos de domínio (PR #6):** Confirmar com Kastberg a injeção de `podeTransitar` (`estados.mjs`), `ordemDeBusca` (`prioridade.mjs`) e `ControleExpediente` (`expediente.mjs`) em `createTicketService` e `createExpedienteService` após o merge do PR #6.
4. **Validação em MySQL 8 real:** Executar `npm run db:init`, `npm run db:seed` e `npm run test:mysql` em uma instância MySQL 8 real (não disponível neste ambiente).
