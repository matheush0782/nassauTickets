import './Home.css'

function Home({ onEmitirSenha, onAbrirPainel }) {
  return (
    <section className="home pagina">
      <div className="home-conteudo">
        <h2>Sistema de atendimento</h2>
        <p>
          O nassauTickets organiza a fila de atendimento do Laboratório de
          Análises Clínicas por meio de senhas. Emita sua senha e acompanhe a
          chamada no painel.
        </p>

        <ul className="home-tipos">
          <li>
            <strong>SP</strong> Senha Prioritária
          </li>
          <li>
            <strong>SG</strong> Senha Geral
          </li>
          <li>
            <strong>SE</strong> Retirada de Exames
          </li>
        </ul>

        <div className="home-acoes">
          <button type="button" className="home-card" onClick={onEmitirSenha}>
            <span className="home-card-icone" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="3" width="16" height="18" rx="2" />
                <line x1="9" y1="8" x2="15" y2="8" />
                <line x1="9" y1="12" x2="15" y2="12" />
                <line x1="9" y1="16" x2="12" y2="16" />
              </svg>
            </span>
            <span className="home-card-titulo">Emitir senha</span>
            <span className="home-card-desc">Retire sua senha para atendimento</span>
          </button>

          <button type="button" className="home-card home-card-secundario" onClick={onAbrirPainel}>
            <span className="home-card-icone" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </span>
            <span className="home-card-titulo">Painel de chamadas</span>
            <span className="home-card-desc">Acompanhe a senha em atendimento</span>
          </button>
        </div>
      </div>
    </section>
  )
}

export default Home
