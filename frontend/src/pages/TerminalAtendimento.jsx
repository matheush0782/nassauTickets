import { useCallback, useState } from 'react'
import {
  atendimentoAtual,
  chamarNovamente,
  chamarProxima,
  encerrarExpediente,
  finalizarAtendimento,
  iniciarAtendimento,
  reabrirExpediente,
  registrarNaoComparecimento,
  resumoFila,
} from '../services/api.js'
import { useAtualizacaoAutomatica } from '../hooks/useAtualizacaoAutomatica.js'
import AvisoConexao from '../components/AvisoConexao.jsx'
import BadgeTipo from '../components/BadgeTipo.jsx'
import CartaoIndicador from '../components/CartaoIndicador.jsx'
import Mensagem from '../components/Mensagem.jsx'
import { STATUS_SENHA, TIPOS_SENHA, formatarHora } from '../utils/formatacao.js'
import './TerminalAtendimento.css'

const GUICHES = [1, 2, 3, 4, 5]

/*
 * Terminal do Agente Atendente (AA) no guiche.
 * Fluxo: Chamar proxima -> (Chamar novamente) -> Iniciar -> Finalizar
 * Apos a segunda chamada sem comparecimento: Registrar "Nao compareceu".
 */
function TerminalAtendimento({ sessao }) {
  const [guiche, setGuiche] = useState(null)

  if (!guiche) {
    return (
      <section className="terminal pagina">
        <h2>Terminal de atendimento</h2>
        <p>Olá, {sessao.nome}. Selecione o guichê em que você está atendendo:</p>
        <div className="terminal-guiches">
          {GUICHES.map((g) => (
            <button key={g} type="button" className="terminal-guiche-botao" onClick={() => setGuiche(g)}>
              Guichê {g}
            </button>
          ))}
        </div>
      </section>
    )
  }

  return <PainelGuiche guiche={guiche} sessao={sessao} onTrocarGuiche={() => setGuiche(null)} />
}

function PainelGuiche({ guiche, sessao, onTrocarGuiche }) {
  const buscarFila = useCallback(() => resumoFila(), [])
  const buscarAtual = useCallback(() => atendimentoAtual(guiche), [guiche])
  const fila = useAtualizacaoAutomatica(buscarFila, 2000)
  const atual = useAtualizacaoAutomatica(buscarAtual, 2000)

  const [mensagem, setMensagem] = useState(null)
  const [processando, setProcessando] = useState(false)

  const senha = atual.dados
  const resumo = fila.dados

  async function executar(acao, textoSucesso) {
    setProcessando(true)
    setMensagem(null)
    try {
      const resultado = await acao()
      setMensagem({ tipo: 'sucesso', texto: textoSucesso(resultado) })
      await Promise.all([fila.recarregar(), atual.recarregar()])
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: e.message })
    } finally {
      setProcessando(false)
    }
  }

  function handleEncerrarExpediente() {
    if (!window.confirm('Encerrar o expediente? As senhas que ainda estão na fila serão descartadas.')) return
    executar(encerrarExpediente, (r) => `Expediente encerrado. ${r.descartadas} senha(s) descartada(s). Novas chamadas bloqueadas.`)
  }

  function handleReabrirExpediente() {
    if (!window.confirm('Reabrir o expediente de hoje? Novas emissões e chamadas voltarão a ser permitidas.')) return
    executar(reabrirExpediente, () => 'Expediente reaberto.')
  }

  return (
    <section className="terminal pagina">
      <div className="terminal-topo">
        <div>
          <h2>Guichê {guiche}</h2>
          <p>
            Atendente: <strong>{sessao.nome}</strong>
          </p>
        </div>
        <button type="button" className="botao-secundario" onClick={onTrocarGuiche} disabled={!!senha}>
          Trocar guichê
        </button>
      </div>

      <AvisoConexao erro={fila.erro || atual.erro} />

      {resumo && !resumo.expedienteAberto && (
        <Mensagem tipo="info">{resumo.motivoExpediente} Atendimentos já chamados podem ser concluídos.</Mensagem>
      )}

      <div className="terminal-indicadores">
        <CartaoIndicador titulo="Total na fila" valor={resumo?.total ?? '—'} destaque />
        <CartaoIndicador titulo="Prioritárias (SP)" valor={resumo?.SP ?? '—'} />
        <CartaoIndicador titulo="Exames (SE)" valor={resumo?.SE ?? '—'} />
        <CartaoIndicador titulo="Gerais (SG)" valor={resumo?.SG ?? '—'} />
      </div>

      <div className="terminal-atendimento">
        {senha ? (
          <>
            <div className="terminal-senha">
              <span className="terminal-label">Senha atual</span>
              <strong>{senha.numero}</strong>
              <span>
                <BadgeTipo tipo={senha.tipo} /> {TIPOS_SENHA[senha.tipo]?.nome}
              </span>
              <span className={`terminal-status terminal-status-${senha.status.toLowerCase()}`}>
                {STATUS_SENHA[senha.status]}
              </span>
              <ul className="terminal-tempos">
                {senha.chamadas.map((c, i) => (
                  <li key={c}>
                    {i + 1}ª chamada: {formatarHora(c)}
                  </li>
                ))}
                {senha.inicioEm && <li>Início do atendimento: {formatarHora(senha.inicioEm)}</li>}
              </ul>
            </div>

            <div className="terminal-acoes">
              {(senha.status === 'CHAMADA' || senha.status === 'CHAMADA_NOVAMENTE') && (
                <button
                  type="button"
                  className="botao-primario"
                  disabled={processando}
                  onClick={() => executar(() => iniciarAtendimento(senha.id), (s) => `Atendimento da senha ${s.numero} iniciado.`)}
                >
                  Iniciar atendimento
                </button>
              )}
              {senha.status === 'CHAMADA' && (
                <button
                  type="button"
                  className="botao-secundario"
                  disabled={processando}
                  onClick={() => executar(() => chamarNovamente(senha.id), (s) => `Senha ${s.numero} chamada novamente (última chamada).`)}
                >
                  Chamar novamente
                </button>
              )}
              {senha.status === 'CHAMADA_NOVAMENTE' && (
                <button
                  type="button"
                  className="botao-perigo"
                  disabled={processando}
                  onClick={() => executar(() => registrarNaoComparecimento(senha.id), (s) => `Senha ${s.numero} registrada como não compareceu.`)}
                >
                  Não compareceu
                </button>
              )}
              {senha.status === 'EM_ATENDIMENTO' && (
                <button
                  type="button"
                  className="botao-primario"
                  disabled={processando}
                  onClick={() => executar(() => finalizarAtendimento(senha.id), (s) => `Atendimento da senha ${s.numero} finalizado.`)}
                >
                  Finalizar atendimento
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="terminal-livre">
            <p>Guichê livre. Chame a próxima senha conforme a regra de prioridade.</p>
            <button
              type="button"
              className="botao-primario botao-grande"
              disabled={processando || !resumo?.total || !resumo?.expedienteAberto}
              onClick={() => executar(() => chamarProxima(guiche, sessao.nome), (s) => `Senha ${s.numero} chamada para o guichê ${guiche}.`)}
            >
              Chamar próxima senha
            </button>
          </div>
        )}
      </div>

      {mensagem && (
        <Mensagem tipo={mensagem.tipo} onFechar={() => setMensagem(null)}>
          {mensagem.texto}
        </Mensagem>
      )}

      {sessao.perfil === 'GESTOR' && (
        <div className="terminal-gestor">
          <h3>Ações do gestor</h3>
          {resumo?.expedienteEncerrado ? (
            <button type="button" className="botao-secundario" disabled={processando} onClick={handleReabrirExpediente}>
              Reabrir expediente
            </button>
          ) : (
            <button type="button" className="botao-perigo" disabled={processando} onClick={handleEncerrarExpediente}>
              Encerrar expediente e descartar fila
            </button>
          )}
        </div>
      )}
    </section>
  )
}

export default TerminalAtendimento
