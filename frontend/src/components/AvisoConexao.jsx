import './Componentes.css'

// Exibido quando o backend (ou o banco de dados) nao responde.
// A tela continua mostrando os ultimos dados recebidos.
function AvisoConexao({ erro }) {
  if (!erro) return null
  return (
    <div className="aviso-conexao" role="alert">
      <strong>Sem comunicação com o servidor.</strong>{' '}
      Exibindo as últimas informações disponíveis. Tentando reconectar...
    </div>
  )
}

export default AvisoConexao
