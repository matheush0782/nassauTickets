import './Componentes.css'

/*
 * Tabela generica reutilizada nos relatorios.
 * colunas: [{ chave, titulo, render?(linha) }]
 */
function TabelaDados({ colunas, linhas, vazio = 'Nenhum registro encontrado.' }) {
  if (linhas.length === 0) return <p className="tabela-vazia">{vazio}</p>
  return (
    <div className="tabela-container">
      <table className="tabela">
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c.chave} scope="col">
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, i) => (
            <tr key={linha.id ?? i}>
              {colunas.map((c) => (
                <td key={c.chave}>{c.render ? c.render(linha) : linha[c.chave]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default TabelaDados
