import './Componentes.css'

function CartaoIndicador({ titulo, valor, detalhe, destaque = false }) {
  return (
    <div className={`cartao-indicador${destaque ? ' cartao-indicador-destaque' : ''}`}>
      <span className="cartao-indicador-titulo">{titulo}</span>
      <strong className="cartao-indicador-valor">{valor}</strong>
      {detalhe && <span className="cartao-indicador-detalhe">{detalhe}</span>}
    </div>
  )
}

export default CartaoIndicador
