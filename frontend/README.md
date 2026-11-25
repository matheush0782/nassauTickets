# nassauTickets — Frontend

Interface web do nassauTickets, desenvolvida em **React 19 + Vite**.

## Como executar

```bash
cd frontend
npm install
npm run dev
```

Acesse o endereço exibido no terminal (normalmente `http://localhost:5173`).

Outros comandos:

| Comando | Descrição |
|---|---|
| `npm run build` | Gera a versão de produção em `dist/` |
| `npm run lint` | Executa o ESLint |
| `npm run preview` | Serve localmente a versão gerada pelo build |

## Configuração (`.env`)

Copie `.env.example` para `.env`:

| Variável | Descrição |
|---|---|
| `VITE_API_URL` | URL base da API REST (ex.: `http://localhost:3000/api`). **Se não for definida, o frontend funciona em modo simulação**, com os dados no `localStorage` do navegador. |
| `VITE_IGNORAR_EXPEDIENTE` | `true` libera chamadas fora do horário 7h–17h (somente para testes). |

### Modo simulação

Enquanto o backend não estiver pronto, o arquivo `src/services/simulador.js` reproduz as regras do Agente Sistema (numeração `YYMMDD-PPSQ`, prioridade `SP → SE|SG → SP`, máquina de estados, expediente). Abra **Totem**, **Painel** e **Atendimento** em abas diferentes para ver a sincronização automática.

Usuários de teste do simulador:

| Usuário | Senha | Perfil |
|---|---|---|
| `atendente1` | `1234` | Atendente |
| `atendente2` | `1234` | Atendente |
| `gestor` | `admin123` | Gestor (acessa relatórios e encerra o expediente) |

## Estrutura

```
src/
├── components/   # Componentes reutilizáveis (AvisoConexao, BadgeTipo, CartaoIndicador, Mensagem, Relogio, TabelaDados)
├── hooks/        # useAtualizacaoAutomatica (polling + sincronização entre abas)
├── pages/        # Home, EmissaoSenha (totem), PainelChamadas, Login, TerminalAtendimento, Relatorios
├── services/     # api.js (fetch para a API REST) e simulador.js (backend simulado)
├── utils/        # formatacao.js (datas, durações, rótulos de tipos e estados)
├── App.jsx       # Navegação e controle de acesso por perfil
└── main.jsx
```

## Telas

| Tela | Acesso | Descrição |
|---|---|---|
| Início | Público | Apresentação e atalhos |
| Totem | Público (anônimo) | Emissão das senhas SP, SG e SE |
| Painel | Público | Exibe **apenas as 5 últimas senhas chamadas** (nunca a próxima), com destaque para a atual e indicação de “Última chamada” |
| Atendimento | Atendente / Gestor | Seleção de guichê; Chamar próxima, Chamar novamente, Iniciar, Finalizar, Não compareceu; encerrar expediente (gestor) |
| Relatórios | Gestor | Diário/mensal: resumo, por prioridade, detalhado, TM, auditoria e desempenho; exportação CSV e impressão |

## Contrato esperado da API REST

Todas as respostas em JSON. Em caso de erro, o backend deve responder com status HTTP 4xx/5xx e o corpo `{ "mensagem": "texto do erro" }`. Rotas protegidas recebem `Authorization: Bearer <token>`.

**Objeto Senha**

```json
{
  "id": 1,
  "numero": "261125-SP001",
  "tipo": "SP",
  "status": "AGUARDANDO",
  "emitidaEm": "2026-11-25T10:00:00.000Z",
  "chamadas": ["2026-11-25T10:05:00.000Z"],
  "guiche": 1,
  "atendente": "Atendente 1",
  "inicioEm": null,
  "fimEm": null
}
```

`status`: `EMITIDA`, `AGUARDANDO`, `CHAMADA`, `CHAMADA_NOVAMENTE`, `EM_ATENDIMENTO`, `ATENDIDA`, `NAO_COMPARECEU`, `DESCARTADA`.

| Método | Rota | Corpo | Retorno |
|---|---|---|---|
| POST | `/auth/login` | `{ usuario, senha }` | `{ usuario, nome, perfil, token }` |
| POST | `/senhas` | `{ tipo }` | Senha emitida |
| GET | `/painel/ultimas-chamadas?limite=5` | — | Lista de Senhas (mais recente primeiro) |
| GET | `/fila/resumo` | — | `{ total, SP, SE, SG, expedienteAberto }` |
| GET | `/guiches/:guiche/atendimento-atual` | — | Senha ou `null` |
| POST | `/atendimentos/chamar-proxima` | `{ guiche }` | Senha chamada (o backend aplica a prioridade e trata a concorrência) |
| POST | `/senhas/:id/chamar-novamente` | — | Senha |
| POST | `/senhas/:id/iniciar` | — | Senha |
| POST | `/senhas/:id/finalizar` | — | Senha |
| POST | `/senhas/:id/nao-compareceu` | — | Senha |
| POST | `/expediente/encerrar` | — | `{ descartadas }` |
| GET | `/relatorios/senhas?periodo=diario&referencia=AAAA-MM-DD` | — | Lista de Senhas do período (`periodo=mensal&referencia=AAAA-MM`) |
