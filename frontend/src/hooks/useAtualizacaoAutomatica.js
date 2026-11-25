import { useCallback, useEffect, useState } from 'react'

/*
 * Executa uma funcao assincrona ao montar o componente e a repete a cada
 * `intervaloMs`. Tambem recarrega quando outra aba altera o localStorage
 * (sincronizacao do simulador entre Totem, Painel e Terminal).
 *
 * Em caso de falha, mantem os ultimos dados validos e expoe o erro, para que
 * a tela continue exibindo informacoes mesmo com o backend fora do ar.
 */
export function useAtualizacaoAutomatica(buscar, intervaloMs = 2000) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(true)

  const recarregar = useCallback(async () => {
    try {
      const resultado = await buscar()
      setDados(resultado)
      setErro(null)
    } catch (e) {
      setErro(e)
    } finally {
      setCarregando(false)
    }
  }, [buscar])

  useEffect(() => {
    let ativo = true
    const executar = () => {
      if (ativo) recarregar()
    }
    const primeira = setTimeout(executar, 0)
    const id = setInterval(executar, intervaloMs)
    window.addEventListener('storage', executar)
    return () => {
      ativo = false
      clearTimeout(primeira)
      clearInterval(id)
      window.removeEventListener('storage', executar)
    }
  }, [recarregar, intervaloMs])

  return { dados, erro, carregando, recarregar }
}
