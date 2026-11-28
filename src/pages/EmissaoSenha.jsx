import { useState } from 'react'
import './EmissaoSenha.css'

const tipos = [
  { codigo: 'SP', nome: 'Senha Prioritária', classe: 'sp' },
  { codigo: 'SG', nome: 'Senha Geral', classe: 'sg' },
  { codigo: 'SE', nome: 'Retirada de Exames', classe: 'se' },
]

function EmissaoSenha({ onEmitirSenha }) {
  const [senhaEmitida, setSenhaEmitida] = useState(null)

  function handleClick(codigo) {
    const senha = onEmitirSenha(codigo)
    setSenhaEmitida(senha)
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
            onClick={() => handleClick(tipo.codigo)}
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
