import { useState } from 'react'
import { consultarExpediente, emitirSenha } from '../services/api.js'
import { useAtualizacaoAutomatica } from '../hooks/useAtualizacaoAutomatica.js'
import Mensagem from '../components/Mensagem.jsx'
import { formatarDataHora } from '../utils/formatacao.js'
import './EmissaoSenha.css'

const tipos = [
  { codigo: 'SP', nome: 'Senha Prioritária', descricao: 'Idosos, gestantes, PcD e demais casos legais', classe: 'sp' },
  { codigo: 'SG', nome: 'Senha Geral', descricao: 'Coleta e atendimento geral', classe: 'sg' },
  { codigo: 'SE', nome: 'Retirada de Exames', descricao: 'Entrega de resultados', classe: 'se' },
]

// Totem de autoatendimento (Agente Cliente - AC). Uso anonimo.
function EmissaoSenha() {
  const [senhaEmitida, setSenhaEmitida] = useState(null)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const expediente = useAtualizacaoAutomatica(consultarExpediente, 5000)
  const fechado = expediente.dados && !expediente.dados.expedienteAberto

  async function handleClick(codigo) {
    setEnviando(true)
    setErro('')
    try {
      const senha = await emitirSenha(codigo)
      setSenhaEmitida(senha)
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="emissao pagina">
      <h2>Emissão de senha</h2>
      <p>Toque no tipo de atendimento desejado para retirar sua senha.</p>

      {fechado && <Mensagem tipo="info">{expediente.dados.motivoExpediente} Não é possível emitir senhas.</Mensagem>}

      <div className="emissao-opcoes">
        {tipos.map((tipo) => (
          <button
            key={tipo.codigo}
            type="button"
            className={`emissao-botao emissao-botao-${tipo.classe}`}
            onClick={() => handleClick(tipo.codigo)}
            disabled={enviando || fechado}
          >
            <strong>{tipo.codigo}</strong>
            <span>{tipo.nome}</span>
            <small>{tipo.descricao}</small>
          </button>
        ))}
      </div>

      <Mensagem tipo="erro" onFechar={() => setErro('')}>
        {erro}
      </Mensagem>

      {senhaEmitida && (
        <div className="senha-emitida" aria-live="polite">
          <p>Sua senha</p>
          <strong>{senhaEmitida.numero}</strong>
          <span>Emitida em {formatarDataHora(senhaEmitida.emitidaEm)}</span>
          <span>Aguarde a chamada no painel.</span>
        </div>
      )}
    </section>
  )
}

export default EmissaoSenha
