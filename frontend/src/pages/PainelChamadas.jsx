import { listarUltimasChamadas } from '../services/api.js'
import { useAtualizacaoAutomatica } from '../hooks/useAtualizacaoAutomatica.js'
import AvisoConexao from '../components/AvisoConexao.jsx'
import BadgeTipo from '../components/BadgeTipo.jsx'
import Relogio from '../components/Relogio.jsx'
import { TIPOS_SENHA, formatarHora } from '../utils/formatacao.js'
import './PainelChamadas.css'

/*
 * Painel publico de chamadas.
 * Regras: exibe somente as 5 ultimas senhas chamadas e NUNCA a proxima senha.
 * Atualiza automaticamente a cada 2 segundos.
 */
function PainelChamadas() {
  const { dados, erro, carregando } = useAtualizacaoAutomatica(listarUltimasChamadas, 2000)
  const chamadas = (dados ?? []).slice(0, 5)
  const atual = chamadas[0] ?? null
  const anteriores = chamadas.slice(1)

  return (
    <section className="painel pagina">
      <div className="painel-topo">
        <h2>Painel de chamadas</h2>
        <Relogio />
      </div>

      <AvisoConexao erro={erro} />

      <div className="painel-destaque" aria-live="assertive">
        {carregando && !dados ? (
          <div className="painel-vazio">Carregando...</div>
        ) : atual ? (
          <>
            <div className="painel-destaque-info">
              <span className="painel-label">
                {atual.status === 'CHAMADA_NOVAMENTE' ? 'Última chamada' : 'Senha chamada'}
              </span>
              <strong className={`painel-senha painel-senha-${atual.tipo.toLowerCase()}`}>
                {atual.numero}
              </strong>
              <span className="painel-tipo">{TIPOS_SENHA[atual.tipo]?.nome}</span>
            </div>
            <div className="painel-guiche">
              <span className="painel-label">Guichê</span>
              <strong className="painel-guiche-numero">{atual.guiche}</strong>
            </div>
          </>
        ) : (
          <div className="painel-vazio">Nenhuma senha chamada ainda.</div>
        )}
      </div>

      <div className="painel-historico">
        <h3>Últimas chamadas</h3>
        {anteriores.length > 0 ? (
          <ul className="painel-lista">
            {anteriores.map((item) => (
              <li key={item.id} className={`painel-item painel-item-${item.tipo.toLowerCase()}`}>
                <span className="painel-item-senha">
                  <BadgeTipo tipo={item.tipo} /> {item.numero}
                </span>
                <span className="painel-item-meta">
                  Guichê {item.guiche} &mdash; {formatarHora(item.chamadas[item.chamadas.length - 1])}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="painel-historico-vazio">Nenhum histórico disponível.</p>
        )}
      </div>
    </section>
  )
}

export default PainelChamadas
