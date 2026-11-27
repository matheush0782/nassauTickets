import { useState } from 'react'
import { login, usandoSimulador } from '../services/api.js'
import Mensagem from '../components/Mensagem.jsx'
import './Login.css'

// Login do Agente Atendente (AA). O perfil GESTOR libera os relatorios.
function Login({ onEntrar }) {
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function handleSubmit(evento) {
    evento.preventDefault()
    if (!usuario.trim() || !senha) {
      setErro('Informe usuário e senha.')
      return
    }
    setEnviando(true)
    setErro('')
    try {
      const sessao = await login(usuario.trim(), senha)
      onEntrar(sessao)
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="login pagina">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>Acesso do atendente</h2>
        <p>Entre com suas credenciais para acessar o terminal de atendimento.</p>

        <label htmlFor="usuario">Usuário</label>
        <input
          id="usuario"
          autoComplete="username"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
        />

        <label htmlFor="senha">Senha</label>
        <input
          id="senha"
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        <Mensagem tipo="erro">{erro}</Mensagem>

        <button type="submit" className="botao-primario" disabled={enviando}>
          {enviando ? 'Entrando...' : 'Entrar'}
        </button>

        {usandoSimulador && (
          <p className="login-dica">
            Modo simulação: <code>atendente1 / 1234</code> ou <code>gestor / admin123</code>
          </p>
        )}
      </form>
    </section>
  )
}

export default Login
