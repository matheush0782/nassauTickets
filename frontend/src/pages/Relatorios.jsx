import { useCallback, useEffect, useMemo, useState } from 'react'
import { listarSenhasDoPeriodo } from '../services/api.js'
import BadgeTipo from '../components/BadgeTipo.jsx'
import CartaoIndicador from '../components/CartaoIndicador.jsx'
import Mensagem from '../components/Mensagem.jsx'
import TabelaDados from '../components/TabelaDados.jsx'
import { STATUS_SENHA, TIPOS_SENHA, formatarDataHora, formatarDuracao, formatarHora, hojeISO } from '../utils/formatacao.js'
import './Relatorios.css'

const ABAS = [
  { id: 'resumo', titulo: 'Resumo' },
  { id: 'detalhado', titulo: 'Detalhado' },
  { id: 'tm', titulo: 'Tempo médio (TM)' },
  { id: 'auditoria', titulo: 'Auditoria' },
  { id: 'desempenho', titulo: 'Desempenho' },
]

function media(valores) {
  if (valores.length === 0) return null
  return valores.reduce((a, b) => a + b, 0) / valores.length
}

function duracaoAtendimento(s) {
  return s.inicioEm && s.fimEm ? new Date(s.fimEm) - new Date(s.inicioEm) : null
}

function tempoEspera(s) {
  return s.chamadas.length ? new Date(s.chamadas[0]) - new Date(s.emitidaEm) : null
}

// Calcula todos os indicadores a partir da lista de senhas do periodo
function calcularIndicadores(senhas) {
  const atendidas = senhas.filter((s) => s.status === 'ATENDIDA')
  const porTipo = Object.keys(TIPOS_SENHA).map((tipo) => {
    const emitidasTipo = senhas.filter((s) => s.tipo === tipo)
    const atendidasTipo = atendidas.filter((s) => s.tipo === tipo)
    return {
      id: tipo,
      tipo,
      emitidas: emitidasTipo.length,
      atendidas: atendidasTipo.length,
      naoCompareceu: emitidasTipo.filter((s) => s.status === 'NAO_COMPARECEU').length,
      descartadas: emitidasTipo.filter((s) => s.status === 'DESCARTADA').length,
      tm: media(atendidasTipo.map(duracaoAtendimento).filter((v) => v != null)),
      espera: media(emitidasTipo.map(tempoEspera).filter((v) => v != null)),
    }
  })

  const porAtendente = {}
  atendidas.forEach((s) => {
    const chave = s.atendente ?? '—'
    porAtendente[chave] ??= { id: chave, atendente: chave, quantidade: 0, duracoes: [] }
    porAtendente[chave].quantidade++
    porAtendente[chave].duracoes.push(duracaoAtendimento(s))
  })

  return {
    emitidas: senhas.length,
    atendidas: atendidas.length,
    naoCompareceu: senhas.filter((s) => s.status === 'NAO_COMPARECEU').length,
    porTipo,
    tmGeral: media(atendidas.map(duracaoAtendimento).filter((v) => v != null)),
    esperaGeral: media(senhas.map(tempoEspera).filter((v) => v != null)),
    porAtendente: Object.values(porAtendente).map((a) => ({ ...a, tm: media(a.duracoes) })),
  }
}

function exportarCSV(nomeArquivo, colunas, linhas) {
  const escapar = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const conteudo = [
    colunas.map((c) => escapar(c.titulo)).join(';'),
    ...linhas.map((l) => colunas.map((c) => escapar(c.texto ? c.texto(l) : l[c.chave])).join(';')),
  ].join('\n')
  const blob = new Blob([`\uFEFF${conteudo}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  link.click()
  URL.revokeObjectURL(url)
}

function Relatorios() {
  const [periodo, setPeriodo] = useState('diario')
  const [data, setData] = useState(hojeISO())
  const [aba, setAba] = useState('resumo')
  const [senhas, setSenhas] = useState([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const referencia = periodo === 'mensal' ? data.slice(0, 7) : data

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      setSenhas(await listarSenhasDoPeriodo(periodo, referencia))
    } catch (e) {
      setErro(e.message)
    } finally {
      setCarregando(false)
    }
  }, [periodo, referencia])

  useEffect(() => {
    const id = setTimeout(carregar, 0)
    return () => clearTimeout(id)
  }, [carregar])

  const ind = useMemo(() => calcularIndicadores(senhas), [senhas])

  const colunasDetalhado = [
    { chave: 'numero', titulo: 'Senha' },
    { chave: 'tipo', titulo: 'Tipo', render: (s) => <BadgeTipo tipo={s.tipo} />, texto: (s) => s.tipo },
    { chave: 'emitidaEm', titulo: 'Emissão', render: (s) => formatarDataHora(s.emitidaEm), texto: (s) => formatarDataHora(s.emitidaEm) },
    {
      chave: 'atendimento',
      titulo: 'Atendimento',
      render: (s) => (s.status === 'ATENDIDA' ? formatarDataHora(s.inicioEm) : ''),
      texto: (s) => (s.status === 'ATENDIDA' ? formatarDataHora(s.inicioEm) : ''),
    },
    {
      chave: 'guiche',
      titulo: 'Guichê',
      render: (s) => (s.status === 'ATENDIDA' ? s.guiche : ''),
      texto: (s) => (s.status === 'ATENDIDA' ? s.guiche : ''),
    },
    { chave: 'status', titulo: 'Situação', render: (s) => STATUS_SENHA[s.status], texto: (s) => STATUS_SENHA[s.status] },
  ]

  const auditoria = senhas.filter((s) => s.chamadas.length > 0)
  const colunasAuditoria = [
    { chave: 'atendente', titulo: 'Atendente' },
    { chave: 'guiche', titulo: 'Guichê' },
    { chave: 'numero', titulo: 'Senha' },
    { chave: 'c1', titulo: '1ª chamada', render: (s) => formatarHora(s.chamadas[0]), texto: (s) => formatarHora(s.chamadas[0]) },
    { chave: 'c2', titulo: '2ª chamada', render: (s) => formatarHora(s.chamadas[1]), texto: (s) => formatarHora(s.chamadas[1]) },
    { chave: 'inicio', titulo: 'Início', render: (s) => formatarHora(s.inicioEm), texto: (s) => formatarHora(s.inicioEm) },
    { chave: 'fim', titulo: 'Finalização', render: (s) => formatarHora(s.fimEm), texto: (s) => formatarHora(s.fimEm) },
  ]

  const colunasTipo = [
    { chave: 'tipo', titulo: 'Prioridade', render: (l) => <><BadgeTipo tipo={l.tipo} /> {TIPOS_SENHA[l.tipo].nome}</> },
    { chave: 'emitidas', titulo: 'Emitidas' },
    { chave: 'atendidas', titulo: 'Atendidas' },
    { chave: 'naoCompareceu', titulo: 'Não compareceu' },
    { chave: 'descartadas', titulo: 'Descartadas' },
  ]

  const colunasTM = [
    { chave: 'tipo', titulo: 'Prioridade', render: (l) => <><BadgeTipo tipo={l.tipo} /> {TIPOS_SENHA[l.tipo].nome}</> },
    { chave: 'atendidas', titulo: 'Atendimentos' },
    { chave: 'tm', titulo: 'TM real', render: (l) => formatarDuracao(l.tm) },
    { chave: 'espera', titulo: 'Espera média', render: (l) => formatarDuracao(l.espera) },
  ]

  const taxaAtendimento = ind.emitidas ? Math.round((ind.atendidas / ind.emitidas) * 100) : 0
  const taxaAbandono = ind.emitidas ? Math.round((ind.naoCompareceu / ind.emitidas) * 100) : 0

  return (
    <section className="relatorios pagina">
      <div className="relatorios-topo">
        <h2>Relatórios</h2>
        <div className="relatorios-acoes-topo">
          <button type="button" className="botao-secundario" onClick={carregar} disabled={carregando}>
            Atualizar
          </button>
          <button type="button" className="botao-secundario" onClick={() => window.print()}>
            Imprimir
          </button>
        </div>
      </div>

      <form className="relatorios-filtros" onSubmit={(e) => e.preventDefault()}>
        <fieldset>
          <legend>Período</legend>
          <label>
            <input type="radio" name="periodo" value="diario" checked={periodo === 'diario'} onChange={() => setPeriodo('diario')} />
            Diário
          </label>
          <label>
            <input type="radio" name="periodo" value="mensal" checked={periodo === 'mensal'} onChange={() => setPeriodo('mensal')} />
            Mensal
          </label>
        </fieldset>
        <label className="relatorios-data">
          {periodo === 'mensal' ? 'Mês' : 'Data'}
          {periodo === 'mensal' ? (
            <input type="month" value={data.slice(0, 7)} onChange={(e) => e.target.value && setData(`${e.target.value}-01`)} />
          ) : (
            <input type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
          )}
        </label>
      </form>

      <Mensagem tipo="erro">{erro}</Mensagem>

      <div className="relatorios-abas" role="tablist">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            className={`relatorios-aba${aba === a.id ? ' ativa' : ''}`}
            onClick={() => setAba(a.id)}
          >
            {a.titulo}
          </button>
        ))}
      </div>

      {aba === 'resumo' && (
        <>
          <div className="relatorios-cartoes">
            <CartaoIndicador titulo="Senhas emitidas" valor={ind.emitidas} destaque />
            <CartaoIndicador titulo="Senhas atendidas" valor={ind.atendidas} />
            <CartaoIndicador titulo="Não compareceram" valor={ind.naoCompareceu} />
            <CartaoIndicador titulo="TM geral" valor={formatarDuracao(ind.tmGeral)} />
          </div>
          <h3>Quantitativo por prioridade</h3>
          <TabelaDados colunas={colunasTipo} linhas={ind.porTipo} />
        </>
      )}

      {aba === 'detalhado' && (
        <>
          <div className="relatorios-linha-acao">
            <h3>Relatório detalhado das senhas</h3>
            <button
              type="button"
              className="botao-secundario"
              onClick={() => exportarCSV(`detalhado-${referencia}.csv`, colunasDetalhado, senhas)}
              disabled={senhas.length === 0}
            >
              Exportar CSV
            </button>
          </div>
          <TabelaDados colunas={colunasDetalhado} linhas={senhas} vazio="Nenhuma senha emitida no período." />
        </>
      )}

      {aba === 'tm' && (
        <>
          <h3>Tempo médio de atendimento por prioridade</h3>
          <p className="relatorios-nota">
            TM de referência: SP 15 min (±5), SG 5 min (±3), SE até 2 min. O TM real é calculado entre o início e a
            finalização de cada atendimento.
          </p>
          <TabelaDados colunas={colunasTM} linhas={ind.porTipo} />
        </>
      )}

      {aba === 'auditoria' && (
        <>
          <div className="relatorios-linha-acao">
            <h3>Relatório de auditoria</h3>
            <button
              type="button"
              className="botao-secundario"
              onClick={() => exportarCSV(`auditoria-${referencia}.csv`, colunasAuditoria, auditoria)}
              disabled={auditoria.length === 0}
            >
              Exportar CSV
            </button>
          </div>
          <TabelaDados colunas={colunasAuditoria} linhas={auditoria} vazio="Nenhuma chamada registrada no período." />
        </>
      )}

      {aba === 'desempenho' && (
        <>
          <div className="relatorios-cartoes">
            <CartaoIndicador titulo="Taxa de atendimento" valor={`${taxaAtendimento}%`} detalhe="atendidas / emitidas" destaque />
            <CartaoIndicador titulo="Taxa de abandono" valor={`${taxaAbandono}%`} detalhe="não compareceu / emitidas" />
            <CartaoIndicador titulo="Espera média" valor={formatarDuracao(ind.esperaGeral)} detalhe="emissão até 1ª chamada" />
            <CartaoIndicador titulo="TM geral" valor={formatarDuracao(ind.tmGeral)} detalhe="início até finalização" />
          </div>
          <h3>Atendimentos por atendente</h3>
          <TabelaDados
            colunas={[
              { chave: 'atendente', titulo: 'Atendente' },
              { chave: 'quantidade', titulo: 'Atendimentos' },
              { chave: 'tm', titulo: 'TM', render: (l) => formatarDuracao(l.tm) },
            ]}
            linhas={ind.porAtendente}
            vazio="Nenhum atendimento finalizado no período."
          />
        </>
      )}
    </section>
  )
}

export default Relatorios
