import { TIPOS_SENHA } from '../utils/formatacao.js'
import './Componentes.css'

function BadgeTipo({ tipo }) {
  const info = TIPOS_SENHA[tipo]
  if (!info) return null
  return (
    <span className={`badge-tipo badge-tipo-${info.classe}`} title={info.nome}>
      {info.codigo}
    </span>
  )
}

export default BadgeTipo
