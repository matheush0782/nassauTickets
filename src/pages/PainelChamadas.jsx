import './PainelChamadas.css'

const labelTipo = {
  sp: 'Prioritária',
  sg: 'Geral',
  se: 'Exames',
}

function PainelChamadas({ chamadas, filaTamanho, onChamarProxima }) {
  const atual = chamadas[0] ?? null
  const historico = chamadas.slice(1, 6)

  return (
    <section className="painel pagina">
      <h2>Painel de chamadas</h2>

      {/* Barra de ação do atendente */}
      <div className="painel-acao">
        <span className="painel-fila-badge">
          {filaTamanho === 0
            ? 'Fila vazia'
            : `${filaTamanho} na fila`}
        </span>
        <button
          type="button"
          className="painel-btn-chamar"
          onClick={onChamarProxima}
          disabled={filaTamanho === 0}
        >
          Chamar próxima
        </button>
      </div>

      <div className="painel-destaque">
        {atual ? (
          <>
            <div className="painel-destaque-info">
              <span className="painel-label">Senha em atendimento</span>
              <strong className={`painel-senha painel-senha-${atual.tipo}`}>
                {atual.senha}
              </strong>
              <span className="painel-tipo">{labelTipo[atual.tipo]}</span>
            </div>

            <div className="painel-guiche">
              <span className="painel-label">Guichê</span>
              <strong className="painel-guiche-numero">{atual.guiche}</strong>
            </div>
          </>
        ) : (
          <div className="painel-vazio">
            <span>Nenhuma senha chamada ainda.</span>
          </div>
        )}
      </div>

      <div className="painel-historico">
        <h3>Últimas chamadas</h3>
        {historico.length > 0 ? (
          <ul className="painel-lista">
            {historico.map((item, i) => (
              <li key={i} className={`painel-item painel-item-${item.tipo}`}>
                <span className="painel-item-senha">{item.senha}</span>
                <span className="painel-item-meta">
                  {labelTipo[item.tipo]} &mdash; Guichê {item.guiche}
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

