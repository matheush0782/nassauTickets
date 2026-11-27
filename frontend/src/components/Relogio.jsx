import { useEffect, useState } from 'react'
import './Componentes.css'

function Relogio() {
  const [agora, setAgora] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="relogio" aria-label="Data e hora atuais">
      <strong>{agora.toLocaleTimeString('pt-BR')}</strong>
      <span>{agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</span>
    </div>
  )
}

export default Relogio
