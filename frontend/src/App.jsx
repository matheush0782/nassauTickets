import { useState } from 'react'
import './App.css'
import Home from './pages/Home.jsx'
import EmissaoSenha from './pages/EmissaoSenha.jsx'
import PainelChamadas from './pages/PainelChamadas.jsx'
import Login from './pages/Login.jsx'
import TerminalAtendimento from './pages/TerminalAtendimento.jsx'
import Relatorios from './pages/Relatorios.jsx'
import { logout, sessaoAtual, usandoSimulador } from './services/api.js'

// Paginas e quem pode acessa-las
const PAGINAS = [
  { id: 'home', titulo: 'Início', acesso: 'publico' },
  { id: 'emissao', titulo: 'Totem', acesso: 'publico' },
  { id: 'painel', titulo: 'Painel', acesso: 'publico' },
  { id: 'terminal', titulo: 'Atendimento', acesso: 'ATENDENTE' },
  { id: 'relatorios', titulo: 'Relatórios', acesso: 'GESTOR' },
]

function podeAcessar(pagina, sessao) {
  if (pagina.acesso === 'publico') return true
  if (!sessao) return false
  if (pagina.acesso === 'GESTOR') return sessao.perfil === 'GESTOR'
  return true // ATENDENTE e GESTOR acessam o terminal
}

function App() {
  const [pagina, setPagina] = useState('home')
  const [sessao, setSessao] = useState(() => sessaoAtual())

  const paginaAtual = PAGINAS.find((p) => p.id === pagina)
  const precisaLogin = !podeAcessar(paginaAtual, sessao)

  function handleSair() {
    logout()
    setSessao(null)
    setPagina('home')
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          nassau<span>Tickets</span>
        </h1>
        <p>Laboratório de Análises Clínicas</p>

        <nav className="app-nav" aria-label="Navegação principal">
          {PAGINAS.filter((p) => p.acesso !== 'GESTOR' || sessao?.perfil === 'GESTOR').map((p) => (
            <button
              key={p.id}
              type="button"
              className={`app-nav-link${pagina === p.id ? ' ativo' : ''}`}
              aria-current={pagina === p.id ? 'page' : undefined}
              onClick={() => setPagina(p.id)}
            >
              {p.titulo}
            </button>
          ))}
          {sessao && (
            <button type="button" className="app-nav-link app-nav-sair" onClick={handleSair}>
              Sair ({sessao.nome})
            </button>
          )}
        </nav>
      </header>

      {usandoSimulador && (
        <div className="app-aviso-simulador">
          Modo simulação: os dados ficam salvos neste navegador até o backend ser conectado (VITE_API_URL).
        </div>
      )}

      <main className="app-main">
        {pagina === 'home' && (
          <Home
            onEmitirSenha={() => setPagina('emissao')}
            onAbrirPainel={() => setPagina('painel')}
            onAbrirTerminal={() => setPagina('terminal')}
          />
        )}
        {pagina === 'emissao' && <EmissaoSenha />}
        {pagina === 'painel' && <PainelChamadas />}

        {precisaLogin && sessao && (
          <p className="app-sem-permissao">Seu perfil não tem permissão para acessar esta página.</p>
        )}
        {precisaLogin && !sessao && <Login onEntrar={setSessao} />}

        {!precisaLogin && pagina === 'terminal' && <TerminalAtendimento sessao={sessao} />}
        {!precisaLogin && pagina === 'relatorios' && <Relatorios />}
      </main>
    </div>
  )
}

export default App
