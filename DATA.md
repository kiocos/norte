# Proveniência, transformação e limitações

Snapshot coletado em 10 de outubro de 2026. A cobertura exata está em `data/processed/quality-report.json`.

## Fontes escolhidas

- **MTE/CBO:** [página de downloads oficial](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/cbo/servicos/downloads/downloads). Seis CSVs preservados em `data/raw`. Ocupação é a chave do catálogo oficial; códigos são strings de seis dígitos, com zeros à esquerda. A consulta encontrou 2.694 ocupações, 626 famílias e 7.778 sinônimos. A presença na CBO não prova regulamentação legal.
- **Receita/MEI:** [Anexo XI](https://www8.receita.fazenda.gov.br/simplesnacional/arquivos/manual/anexo_xi.pdf), 43 páginas, 471 atividades, 351 CNAEs. As tabelas A e B são preservadas nas descrições. A atividade específica importa: um CNAE isolado não comprova enquadramento. As páginas HTML por letra resultaram em 469 registros; preferiu-se o PDF oficial completo.
- **Futuro das Carreiras/RAIS:** [CSV RAIS 2025](https://futurodascarreiras.com/profissao/dados/rais/rais_cbo6_2025.csv), 2.707 códigos. Mediana, média e quantis da remuneração mensal média no ano, em vínculos ativos em 31/12/2025; processamento declarado em 17/09/2026.
- **Futuro das Carreiras/CAGED:** [CSV CAGED](https://futurodascarreiras.com/profissao/dados/caged/caged_cbo6_12m.csv), 2.673 códigos. Admissões de 09/2025 a 08/2026, processamento declarado em 05/10/2026.
- **Licença salarial:** [metodologia do fornecedor](https://futurodascarreiras.com/metodologia/), CC BY 4.0. Atribuição exibida junto aos salários. O Norte normaliza códigos, filtra amostras e cruza a base; não reprocessou os microdados oficiais.
- **Caminhos adicionais:** `data/editorial-paths.json`, 58 descrições originais, com URLs do Sebrae por grupo de referência. São inferências editoriais e exemplos de modelos de negócio, não nomes oficiais registrados nem recomendações individuais. Não equivalem a permissões MEI.

## Alternativas investigadas

O [mapa Vagas](https://www.vagas.com.br/mapa-de-carreiras/sobre) usa cargos e trajetórias informados em currículos da própria plataforma. Não é baseado em uma lista oficial exaustiva. A tentativa de coleta direta retornou HTTP 403; não se contornou a restrição. Sua lista de cargos não foi importada.

O [PDET/MTE](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/estatisticas-trabalho/microdados-rais-e-caged) oferece microdados primários RAIS/CAGED. Reprocessá-los exige baixar e tratar grandes arquivos. A implementação atual prioriza agregados já publicados com licença e método declarados; o reprocessamento é uma melhoria futura, não uma tarefa já concluída.

O [IBGE](https://biblioteca.ibge.gov.br/visualizacao/livros/liv102033.pdf) publica aptidão para teletrabalho com códigos COD, diferentes da CBO. Dados por grandes grupos e resultados amostrais não foram transformados em taxas de cada profissão.

Também foram consultados o [State of Data Brazil no Kaggle](https://www.kaggle.com/datasets/datahackers/state-of-data-2022) e o [mercado-ti-gold no Hugging Face](https://huggingface.co/datasets/Gianpedro/mercado-ti-gold). São recortes especializados em dados/tecnologia, úteis para uma futura camada setorial, mas insuficientes como fonte de comparação de todas as áreas. Nenhum valor dessas bases foi misturado ao indicador nacional.

## Normalização

1. Preservação dos bytes originais e SHA-256; decodificação UTF-8 ou CP1252, conforme o arquivo.
2. Normalização Unicode NFC e de espaços; preservação de acentos e nomes oficiais. Semicolons não escapados no último campo de atividades são reunidos novamente.
3. Deduplicação de sinônimos e atividades dentro de cada CBO. Competências pessoais do grupo Z não são usadas como atividades do dia a dia.
4. Junção exata por código CBO, nunca por similaridade de nome ou conversão CNAE automática. O relatório lista os 36 códigos RAIS ausentes na lista CBO consultada; eles não recebem títulos inventados.
5. Preservação de `null`. Medianas e quartis são mostrados somente quando a amostra remunerada é pelo menos 30. Não houve imputação de salário por família, área ou profissão semelhante.
6. MEIs recebem um identificador estável derivado de título, CNAE e tabela. A apresentação usa caixa de frase; o nome original fica nos aliases. Não são deduplicados contra CBO, porque representam outra entidade. Os dois tipos ficam visíveis e filtráveis.
7. Caminhos editoriais usam prefixo `path-`, MEIs usam `mei-`; CBOs mantêm seu código original. Somente registros CBO têm observações salariais.

## Salários e discrepância não reconciliada

RAIS representa vínculos formais, não pessoas únicas, renda familiar, faturamento nem renda total dos profissionais. CAGED representa movimentos de emprego. Ambas deixam de cobrir muitos autônomos, empreendedores e trabalhadores informais.

O agregado RAIS soma 60.691.770 vínculos. O [sumário oficial RAIS 2025 publicado em maio de 2026](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/estatisticas-trabalho/rais/rais-2025/SumrioExecutivo_RAIS20251.pdf) apresenta 59.970.945. A diferença não foi reconciliada; não presumimos que seja apenas revisão. O sumário salarial usa dezembro, enquanto o agregado declara média anual. Por isso o app atribui cada estatística ao agregador e explicita essa limitação em `/sobre`.

Não são feitos ajustes por inflação, jornada, região, experiência ou regime. A mediana nacional não prevê o rendimento de uma pessoa e não é salário de entrada. Percentis P25/P75 descrevem a faixa central, não mínimos e máximos.

## Interesses, remoto e área principal

`scripts/normalize.py` contém regras versionadas e reproduzíveis. Áreas são definidas por prefixos CBO e palavras de títulos, com ajustes específicos; MEIs também usam setores CNAE. Podem existir atribuições imperfeitas. Cada opção recebe uma área principal para a visualização; isso não exclui relações com outras áreas.

Perfis editoriais RIASEC partem de níveis por área e palavras encontradas nas tarefas oficiais. A referência é a [estrutura de seis interesses do O*NET](https://www.onetcenter.org/IP.html), sem importar estatísticas ocupacionais americanas. Níveis 4 e 5 ativam o filtro da afinidade. Eles não são medidas psicométricas, testes validados, aconselhamento profissional ou probabilidades de sucesso.

Potencial remoto é inferido qualitativamente a partir de funções e tarefas; onde faltam elementos, permanece `nao_avaliado`. Não é participação de trabalho remoto nem frequência de vagas. Não há percentuais sintéticos.

## Próximas melhorias de dados

- Reprocessar RAIS/CAGED primários e reconciliar os totais antes de tratar o agregado como verificado.
- Revisar agrupamentos por especialistas e versionar correções por código.
- Expandir a curadoria de novos caminhos sem misturá-los com classificações oficiais.
- Integrar pesquisas nacionais de autônomos e renda empresarial somente com unidade, amostra e comparabilidade claras.
- Atualizar a referência histórica de formação com dados atuais do QBQ e acrescentar certificações e exigências legais verificadas por profissão.

## Referência histórica de formação

O banco oficial [CBO Consultas offline](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/cbo/servicos/downloads/cboconsultas-instalador.jar) contém descrições de formação e experiência para 615 famílias. `scripts/fetch_training.py` extrai apenas bytes de arquivos e valores SQL; não executa o instalador, código Java ou SQL da fonte. O arquivo CBO.properties registra gravação em 20/11/2014; não há data individual de atualização preenchida. Dez famílias foram conferidas nos livros CBO de 2010, com diferenças documentadas.

`data/raw/cbo-training.json` preserva as descrições para análise local, checksums, metadados e cobertura. A interface exibe somente resumos factuais curtos, link da fonte e ano histórico. `scripts/preparation.py` classifica menções explícitas a níveis de formação; múltiplos níveis ou acesso variável ficam como `variavel`. Menção a ensino médio junto de técnico é tratada como formação técnica. Ausência de correspondência não significa ausência de requisitos. O resumo é da família, compartilhado com suas ocupações atuais, que podem ter requisitos específicos ou ter sido criadas depois do snapshot.

Cobertura de referência: 615/626 famílias e 2.659/2.694 ocupações. A classificação pode permanecer desconhecida mesmo com texto disponível quando não se identifica um nível de formação. MEIs e caminhos editoriais ficam sem referência; a modalidade de negócio não prova habilitação. O QBQ disponibiliza download condicionado a cadastro/login, não obtido nesta sessão. Este filtro não mede custo, duração, experiência nem exigência legal atual.

## Geografia do mapa

`src/lib/map-layout.ts` organiza áreas por âncoras editoriais de afinidade de atividade: educação perto de saúde e criação; ciência perto de tecnologia; construção perto de indústria; negócios perto de comércio. Relaxamento de colisões separa as áreas e suas profissões. A proximidade não é uma distância estatística nem mede transições de carreira. Todos os círculos têm o mesmo raio lógico; os nomes ficam ancorados dentro do próprio círculo, com quebra de linhas fixa e legibilidade progressiva. Não há seleção dinâmica de rótulos ao passar o mouse. A escala e a câmera não alteram quais profissões pertencem ao mapa. Clicar em uma área aproxima a câmera, sem modificar filtros.
