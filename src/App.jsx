import { useState } from 'react'
import './App.css'
import Home from './pages/Home.jsx'
import EmissaoSenha from './pages/EmissaoSenha.jsx'
import PainelChamadas from './pages/PainelChamadas.jsx'

function dataAtual() {
  const agora = new Date()
  const ano = String(agora.getFullYear()).slice(-2)
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${ano}${mes}${dia}`
}

// Guichês disponíveis: rotaciona entre 1, 2 e 3
function proximoGuiche(totalChamadas) {
  return (totalChamadas % 3) + 1
}

function App() {
  const [pagina, setPagina] = useState('home')
  const [sequencias, setSequencias] = useState({ SP: 0, SG: 0, SE: 0 })
  // fila: senhas emitidas aguardando chamada (FIFO — índice 0 é a mais antiga)
  const [fila, setFila] = useState([])
  // chamadas: senhas já chamadas pelo atendente (índice 0 é a mais recente)
  const [chamadas, setChamadas] = useState([])

  function handleEmitirSenha(codigo) {
    const novaSeq = sequencias[codigo] + 1
    const seq = String(novaSeq).padStart(3, '0')
    const senha = `${dataAtual()}-${codigo}${seq}`

    setSequencias((prev) => ({ ...prev, [codigo]: novaSeq }))
    // Entra no final da fila (a mais nova); guichê ainda não atribuído
    setFila((prev) => [...prev, { senha, tipo: codigo.toLowerCase() }])

    return senha // devolvido para EmissaoSenha exibir localmente
  }

  function handleChamarProxima() {
    if (fila.length === 0) return
    const proxima = fila[0]
    const guiche = proximoGuiche(chamadas.length)

    setFila((prev) => prev.slice(1))
    setChamadas((prev) => [{ ...proxima, guiche }, ...prev])
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          nassau<span>Tickets</span>
        </h1>
        <p>Laboratório de Análises Clínicas</p>
        <nav className="app-nav">
          <button
            type="button"
            className={`app-nav-link${pagina === 'painel' ? ' ativo' : ''}`}
            onClick={() => setPagina('painel')}
          >
            Painel
          </button>
        </nav>
      </header>
      <main className="app-main">
        {pagina === 'home' && (
          <Home
            onEmitirSenha={() => setPagina('emissao')}
            onAbrirPainel={() => setPagina('painel')}
          />
        )}
        {pagina === 'emissao' && (
          <EmissaoSenha onEmitirSenha={handleEmitirSenha} />
        )}
        {pagina === 'painel' && (
          <PainelChamadas
            chamadas={chamadas}
            filaTamanho={fila.length}
            onChamarProxima={handleChamarProxima}
          />
        )}
      </main>
    </div>
  )
}

export default App
