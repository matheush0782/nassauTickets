import { useState } from 'react'
import './App.css'
import Home from './pages/Home.jsx'
import EmissaoSenha from './pages/EmissaoSenha.jsx'

function App() {
  const [pagina, setPagina] = useState('home')

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          nassau<span>Tickets</span>
        </h1>
        <p>Laboratório de Análises Clínicas</p>
      </header>
      <main className="app-main">
        {pagina === 'home' && <Home onEmitirSenha={() => setPagina('emissao')} />}
        {pagina === 'emissao' && <EmissaoSenha />}
      </main>
    </div>
  )
}

export default App
