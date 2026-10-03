import { useState } from 'react'
import './EmissaoSenha.css'

const tipos = [
  { codigo: 'SP', nome: 'Senha Prioritária', classe: 'sp' },
  { codigo: 'SG', nome: 'Senha Geral', classe: 'sg' },
  { codigo: 'SE', nome: 'Retirada de Exames', classe: 'se' },
]

function dataAtual() {
  const agora = new Date()
  const ano = String(agora.getFullYear()).slice(-2)
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${ano}${mes}${dia}`
}

function EmissaoSenha() {
  const [sequencias, setSequencias] = useState({ SP: 0, SG: 0, SE: 0 })
  const [senhaEmitida, setSenhaEmitida] = useState(null)

  function emitirSenha(codigo) {
    const novaSequencia = sequencias[codigo] + 1
    setSequencias({ ...sequencias, [codigo]: novaSequencia })
    const sequencia = String(novaSequencia).padStart(3, '0')
    setSenhaEmitida(`${dataAtual()}-${codigo}${sequencia}`)
  }

  return (
    <section className="emissao pagina">
      <h2>Emissão de senha</h2>
      <p>Toque no tipo de atendimento desejado para retirar sua senha.</p>

      <div className="emissao-opcoes">
        {tipos.map((tipo) => (
          <button
            key={tipo.codigo}
            type="button"
            className={`emissao-botao emissao-botao-${tipo.classe}`}
            onClick={() => emitirSenha(tipo.codigo)}
          >
            <strong>{tipo.codigo}</strong>
            <span>{tipo.nome}</span>
          </button>
        ))}
      </div>

      {senhaEmitida && (
        <div className="senha-emitida">
          <p>Sua senha</p>
          <strong>{senhaEmitida}</strong>
          <span>Aguarde a chamada no painel.</span>
        </div>
      )}
    </section>
  )
}

export default EmissaoSenha
