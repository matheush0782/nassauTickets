# Contrato da API REST — nassauTickets (v1)

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

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/api/health` | Público | Verifica disponibilidade da API e conexão com o MySQL 8 |
| `POST` | `/api/auth/login` | Público | Autentica usuário (`{ login, senha }`) e retorna `{ token, tipoToken, usuario, guicheAtual }` |
| `GET` | `/api/auth/me` | `atendente`, `gestor` | Retorna perfil autenticado e `{ usuario, guicheAtual }` |

### Usuários (Cadastro pelo Gestor)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/api/usuarios` | `gestor` | Lista usuários (filtros opcionais: `?perfil=atendente\|gestor&ativo=true\|false`) |
| `GET` | `/api/usuarios/:id` | `gestor` | Detalha um usuário |
| `POST` | `/api/usuarios` | `gestor` | Cria usuário (`{ nome, login, email?, senha, perfil }`) — permite apenas 1 `gestor` ativo |
| `PUT` | `/api/usuarios/:id` | `gestor` | Atualiza dados do usuário |
| `PATCH` | `/api/usuarios/:id/status` | `gestor` | Ativa ou desativa usuário (`{ ativo: boolean }`) |

### Guichês

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/api/guiches` | `atendente`, `gestor` | Lista guichês (`?ativos=true` opcional) |
| `POST` | `/api/guiches` | `gestor` | Cadastra guichê (`{ numero, descricao?, ativo? }`) |
| `PUT` | `/api/guiches/:id` | `gestor` | Atualiza guichê |
| `POST` | `/api/guiches/:id/ocupar` | `atendente`, `gestor` | Aloca o usuário autenticado ao guichê de forma transacional |
| `POST` | `/api/guiches/:id/liberar` | `atendente`, `gestor` | Libera o guichê |

### Senhas, Fila e Chamadas

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `POST` | `/api/senhas` | Público (Totem AC) | Emite senha no padrão `YYMMDD-PPSQ` (`{ tipo: "SP" \| "SG" \| "SE" }`) |
| `GET` | `/api/senhas/painel` | Público (Painel) | Retorna últimas chamadas (`?limit=5`) |
| `GET` | `/api/senhas/fila` | `atendente`, `gestor` | Retorna `{ aguardando, contagem: { SP, SG, SE, total }, ultimaChamada }` |
| `GET` | `/api/senhas` | `atendente`, `gestor` | Lista senhas (`?data=YYYY-MM-DD&tipo=&status=&limit=&offset=`) |
| `GET` | `/api/senhas/:id` | `atendente`, `gestor` | Consulta detalhes de uma senha |
| `POST` | `/api/senhas/reservar-proxima` | `atendente`, `gestor` | Reserva atomicamente (`FOR UPDATE SKIP LOCKED`) a próxima senha aguardando para `{ guicheId, tiposPrioritarios? }` |
| `POST` | `/api/senhas/:id/reservar` | `atendente`, `gestor` | Reserva atomicamente uma senha específica para `{ guicheId }` |
| `POST` | `/api/senhas/:id/chamar-novamente` | `atendente`, `gestor` | Registra 2ª chamada (`CHAMADA` → `CHAMADA_NOVAMENTE`) |
| `POST` | `/api/senhas/:id/iniciar` | `atendente`, `gestor` | Inicia atendimento (`CHAMADA`/`CHAMADA_NOVAMENTE` → `EM_ATENDIMENTO`) |
| `POST` | `/api/senhas/:id/finalizar` | `atendente`, `gestor` | Finaliza atendimento (`EM_ATENDIMENTO` → `ATENDIDA`) e calcula duração |
| `POST` | `/api/senhas/:id/nao-compareceu` | `atendente`, `gestor` | Registra abandono após 2ª chamada (`CHAMADA_NOVAMENTE` → `NAO_COMPARECEU`) |
| `POST` | `/api/senhas/descartar-pendentes` | `gestor` | Descarta senhas pendentes ao fim do expediente (`{ data? }`) |
| `PATCH` | `/api/senhas/:id/status` | `atendente`, `gestor` | Atualização direta de persistência (`{ status, guicheId?, atendenteId? }`) |

### Auditoria

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/api/auditoria` | `gestor` | Lista eventos persistidos (`?limite=50&offset=0&acao=&usuarioId=`) |

---

## 4. Modelos de Dados (`camelCase`)

- **Usuário:** `{ id, nome, login, email, perfil, ativo, criadoEm, atualizadoEm }` (`senha_hash` nunca é exposto).
- **Guichê:** `{ id, numero, descricao, ativo, atendenteAtualId, atendenteNome, atendenteLogin, criadoEm, atualizadoEm }`.
- **Senha:** `{ id, codigo, tipo, dataReferencia, sequencial, status, guicheId, guicheNumero, atendenteId, atendenteNome, atendenteLogin, emitidaEm, primeiraChamadaEm, segundaChamadaEm, inicioAtendimentoEm, fimAtendimentoEm, tempoAtendimentoSegundos, atualizadoEm }`.
- **Evento de Auditoria:** `{ id, usuarioId, usuarioLogin, usuarioNome, senhaId, senhaCodigo, guicheId, guicheNumero, acao, detalhes, ipOrigem, criadoEm }`.
