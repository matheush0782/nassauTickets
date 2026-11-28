import './Home.css'

function Home({ onEmitirSenha }) {
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

        <button type="button" className="botao-primario" onClick={onEmitirSenha}>
          Emitir senha
        </button>
      </div>
    </section>
  )
}

export default Home
