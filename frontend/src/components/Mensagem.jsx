import './Componentes.css'

// Mensagem de retorno de uma acao (sucesso ou erro)
function Mensagem({ tipo = 'info', children, onFechar }) {
  if (!children) return null
  return (
    <div className={`mensagem mensagem-${tipo}`} role={tipo === 'erro' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onFechar && (
        <button type="button" className="mensagem-fechar" onClick={onFechar} aria-label="Fechar mensagem">
          ×
        </button>
      )}
    </div>
  )
}

export default Mensagem
