import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import report from "../../../data/processed/quality-report.json";
import { ThemeToggle } from "@/components/ThemeProvider";
export const metadata = { title: "Dados, cobertura e metodologia — Norte" };
export default function About() {
  return (
    <main className="about-page">
      <ThemeToggle className="about-theme" />
      <Link className="about-back" href="/">
        <ArrowLeft size={16} /> Voltar ao mapa
      </Link>
      <div className="eyebrow">DADOS ABERTOS. ESCOLHAS MAIS INFORMADAS.</div>
      <h1>
        Um mapa amplo.
        <br />
        Com as fontes à vista.
      </h1>
      <p>
        O Norte reúne ocupações brasileiras e caminhos de atuação para ajudar
        você a explorar possibilidades. O mapa não promete encontrar uma
        profissão ideal nem esgotar todas as formas de ganhar a vida. Novas
        atividades surgem, e muitas pessoas combinam diferentes trabalhos.
      </p>
      <div className="about-stats">
        <div>
          <strong>{report.occupations.toLocaleString("pt-BR")}</strong>
          <span>ocupações oficiais da CBO</span>
        </div>
        <div>
          <strong>{report.mei_activities}</strong>
          <span>atividades da lista oficial MEI</span>
        </div>
        <div>
          <strong>{report.editorial_paths}</strong>
          <span>caminhos de atuação adicionais</span>
        </div>
      </div>
      <h2>O que cada círculo representa</h2>
      <p>
        Há três tipos de registros, identificados nos detalhes e nos filtros.
        Uma ocupação CBO, uma atividade MEI e um modelo de negócio podem se
        sobrepor. Portanto, {report.total_options.toLocaleString("pt-BR")}{" "}
        opções no catálogo não significam esse número de profissões únicas.
      </p>
      <table>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Origem e significado</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Ocupação CBO</td>
            <td>
              Classificação Brasileira de Ocupações do MTE. Incluímos todas as{" "}
              {report.occupations.toLocaleString("pt-BR")} ocupações do CSV
              consultado, com {report.aliases.toLocaleString("pt-BR")}{" "}
              sinônimos. A CBO não é uma lista de profissões regulamentadas.
            </td>
          </tr>
          <tr>
            <td>Atividade MEI</td>
            <td>
              Anexo XI da Resolução CGSN nº 140/2018, no arquivo disponibilizado
              pela Receita Federal: 467 atividades da tabela A e 4 da tabela B.
              É preciso conferir a descrição e as demais condições legais de
              enquadramento.
            </td>
          </tr>
          <tr>
            <td>Caminho empreendedor</td>
            <td>
              Curadoria editorial: SaaS, produção de conteúdo, trabalho
              freelance, negócios locais e outros modelos. Os nomes e as
              descrições foram redigidos para exploração, a partir de
              referências do Sebrae; não são classificações oficiais.
            </td>
          </tr>
        </tbody>
      </table>
      <h2>Salários: mediana, faixa e cobertura</h2>
      <p>
        Usamos os{" "}
        <a
          href="https://futurodascarreiras.com/indicadores/salarios/"
          target="_blank"
          rel="noreferrer"
        >
          agregados RAIS 2025 e Novo CAGED de Futuro das Carreiras
        </a>
        , disponíveis sob{" "}
        <a
          href="https://futurodascarreiras.com/metodologia/"
          target="_blank"
          rel="noreferrer"
        >
          licença CC BY 4.0
        </a>
        . São dados derivados de registros brasileiros de emprego formal.
        Preservamos a autoria e não apresentamos esse processamento como
        apuração própria do Norte.
      </p>
      <p>
        Na RAIS, o indicador exibido é a mediana da remuneração mensal média no
        ano dos vínculos ativos em 31/12/2025, em reais nominais, antes de
        descontos. A faixa central vai do 25º ao 75º percentil; não é o menor e
        o maior salário possível. O CAGED mostra a mediana salarial nas
        admissões de setembro de 2025 a agosto de 2026. Admissão não significa
        primeiro emprego.
      </p>
      <p>
        Há salário disponível para {report.with_salary.toLocaleString("pt-BR")}{" "}
        ocupações CBO. Ocultamos amostras inferiores a 30 vínculos remunerados e
        mantemos valores ausentes como ausentes. Não aplicamos salários de
        empregados a MEIs, profissionais PJ ou negócios próprios. Receita,
        faturamento, lucro e salário são conceitos diferentes.
      </p>
      <div className="about-notice">
        Limitação de validação: o agregado RAIS do fornecedor soma 60.691.770
        vínculos, enquanto o sumário oficial de maio de 2026 apresenta
        59.970.945. Essa diferença não foi reconciliada; também há diferença
        entre a referência de remuneração média anual do agregado e a de
        dezembro do sumário. Os valores são identificados como agregados de
        terceiros. O reprocessamento dos microdados oficiais é uma etapa futura.
      </div>
      <h2>Interesses e áreas: uma camada orientativa</h2>
      <p>
        As 14 áreas são agrupamentos editoriais, construídos com códigos e
        títulos da CBO e atividades econômicas da lista MEI. Um trabalho pode
        atravessar várias áreas; o mapa usa uma área principal para manter a
        navegação organizada.
      </p>
      <p>
        As seis afinidades seguem a estrutura conceitual{" "}
        <a
          href="https://www.onetcenter.org/IP.html"
          target="_blank"
          rel="noreferrer"
        >
          RIASEC
        </a>
        : prático, investigativo, artístico, social, empreendedor e organizador.
        As associações no Norte são regras editoriais por área e tarefas
        descritas na CBO, com níveis de 1 a 5. Não importamos escores
        ocupacionais dos Estados Unidos como se fossem brasileiros. O exercício
        de interesses não é um teste psicológico validado nem prevê sucesso
        profissional.
      </p>
      <h2>Remoto: possibilidade não é frequência</h2>
      <p>
        O filtro avalia qualitativamente se as tarefas podem ser feitas a
        distância: alto potencial, parte das atividades, principalmente
        presencial ou ainda não avaliado. É uma inferência editorial, sujeita a
        exceções. Não existe na base utilizada uma taxa observada e confiável de
        vagas remotas por CBO.
      </p>
      <p>
        A{" "}
        <a
          href="https://biblioteca.ibge.gov.br/visualizacao/livros/liv102033.pdf"
          target="_blank"
          rel="noreferrer"
        >
          nota técnica do IBGE sobre teletrabalho
        </a>{" "}
        utiliza a classificação domiciliar COD, que não tem equivalência direta
        com cada CBO de seis dígitos. Não fizemos uma junção automática dessas
        classificações nem atribuímos percentuais de grandes grupos a profissões
        individuais.
      </p>
      <h2>Formação: uma referência histórica</h2>
      <p>
        O filtro de formação resume descrições de 615 famílias do banco público
        CBO Consultas do MTE. O arquivo registra uma gravação em 20/11/2014;
        isso não comprova que cada descrição tenha sido atualizada nessa data. O
        catálogo de ocupações e os salários vêm das bases mais recentes citadas
        acima.
      </p>
      <p>
        Classificamos as menções a ensino fundamental, médio, técnico, superior
        e qualificação. Famílias com trajetórias diferentes ficam como formação
        variável. O resumo se aplica à família, não comprova a exigência atual
        de uma profissão específica e não mede custo, experiência ou tempo para
        começar. Caminhos sem referência ficam explícitos. Nos detalhes há o
        resumo, a fonte e o ano do arquivo. O download do Quadro Brasileiro de
        Qualificações foi localizado, mas exige cadastro e não foi incorporado.
      </p>
      <h2>Como os filtros e o mapa funcionam</h2>
      <p>
        Filtros de categorias diferentes são combinados: área, afinidade,
        salário, formação de referência, potencial remoto e tipo de caminho.
        Dentro de áreas, afinidades, formações ou tipos, selecionar vários itens
        aceita qualquer um deles. Uma afinidade selecionada aceita associações
        editoriais de nível 4 ou 5. Ao alterar o salário, registros sem
        informação são excluídos; você pode optar por incluí-los novamente.
      </p>
      <p>
        Todas as opções que passam pelos filtros são desenhadas desde o início.
        O zoom mantém os mesmos círculos e posições; os nomes ficam dentro de
        seus círculos, com espaçamento ampliado e quebra de linhas estável.
        Clicar no fundo de uma área aproxima a câmera sem aplicar filtros. Áreas
        relacionadas ficam próximas, como educação e saúde, ciência e
        tecnologia, construção e indústria. Essa proximidade é editorial, não
        uma distância estatística de carreira. A visualização em lista permite
        percorrer todos os registros com teclado ou leitor de tela. As cores
        identificam áreas. O tamanho dos círculos é ajustado à navegação e não
        representa salário, popularidade ou potencial de sucesso.
      </p>
      <h2>Fontes e atualização</h2>
      <ul>
        <li>
          <a href="https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/cbo/servicos/downloads/downloads">
            MTE: CBO, famílias, sinônimos e perfil ocupacional
          </a>
          .
        </li>
        <li>
          <a href="https://www8.receita.fazenda.gov.br/simplesnacional/arquivos/manual/anexo_xi.pdf">
            Receita Federal: lista de atividades MEI, tabelas A e B
          </a>
          .
        </li>
        <li>
          <a href="https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/cbo/servicos/downloads/cboconsultas-instalador.jar">
            MTE: banco CBO Consultas offline, referência histórica de formação
            por família
          </a>
          .
        </li>
        <li>
          <a href="https://futurodascarreiras.com/metodologia/">
            Futuro das Carreiras: metodologia e licença dos agregados RAIS/CAGED
          </a>
          .
        </li>
        <li>
          <a href="https://sebrae.com.br/subsites/criadores-de-conteudo">
            Sebrae: criadores de conteúdo
          </a>
          ,{" "}
          <a href="https://inteligenciademercado.rj.sebrae.com.br/multissetorial/Modelo-de-Negocio-SaaS">
            modelo SaaS
          </a>{" "}
          e{" "}
          <a href="https://inteligenciademercado.rj.sebrae.com.br/multissetorial/Conheca-os-caminhos-para-os-novos-negocios-Produtos-Digitais">
            produtos digitais
          </a>
          .
        </li>
        <li>
          <a href="https://www.vagas.com.br/mapa-de-carreiras/sobre">
            Vagas: referência de visualização
          </a>
          . O mapa Vagas usa dados dos currículos de sua própria base. Seus
          dados não foram importados.
        </li>
      </ul>
      <p>
        Arquivos coletados em 10/10/2026, preservados no projeto com checksums e
        scripts de normalização. Códigos CBO são guardados como texto, com zeros
        à esquerda. Registros MEI usam identificadores próprios; CNAE não é
        tratado como sinônimo de CBO. Há {report.rais_unmatched_codes.length}{" "}
        códigos do agregado RAIS que não foram encontrados no CSV de ocupações
        consultado; não criamos nomes por suposição para eles.
      </p>
      <h2>Seus dados no app</h2>
      <p>
        Salvos e comparações ficam somente no armazenamento deste navegador. Os
        filtros são mantidos na URL para que uma exploração possa ser
        compartilhada. O app não exige cadastro, não transmite respostas de
        interesses para serviços de análise e não usa rastreadores.
      </p>
      <Link href="/" className="secondary">
        <ArrowLeft size={16} /> Voltar para o mapa
      </Link>
    </main>
  );
}
