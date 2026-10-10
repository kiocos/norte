# Norte · mapa de carreiras e caminhos de renda

Webapp estático para explorar possibilidades de trabalho no Brasil. Next.js 16, React 19, TypeScript e Canvas 2D + D3. Páginas e dados publicados na CDN da Vercel, sem banco de dados, funções de servidor ou consultas às fontes externas durante o uso.

**Publicado:** https://norte-carreiras.vercel.app · **Código:** https://github.com/kiocos/norte

## Rodar localmente

Pré-requisitos: Node.js 24 e npm. Python é necessário somente para atualizar os snapshots das fontes.

```sh
cd ~/mapa-carreiras
npm ci
bash scripts/start-local.sh
```

Abra **http://127.0.0.1:3000**. O catálogo incluído no repositório é convertido automaticamente em arquivos públicos antes de iniciar. Não exige `.env.local`, credenciais nem banco de dados.

Para modo de produção local:

```sh
bash scripts/start-local.sh --production
```

Para encerrar o servidor em primeiro plano, use Ctrl+C. Para encerrar o servidor em segundo plano entregue nesta sessão, execute `bash scripts/stop-local.sh`.

## O que está implementado

- Mapa em tela cheia, com controles flutuantes compactos e grupos abertos em 14 áreas próximas por afinidade. Títulos grandes no centro das áreas desaparecem suavemente durante o zoom, dando lugar aos nomes dentro dos círculos. Todos os círculos existem desde o início; a geometria permanece estável durante a navegação. Clique no título de uma área aproxima a câmera sem filtrar. Inclui arraste, zoom por dois dedos e minimapa.
- Busca por títulos, códigos e 7.778 sinônimos oficiais, além de nomes alternativos dos caminhos digitais.
- Filtros que removem registros do mapa: áreas, intervalo de salário com duas alças e campos numéricos, seis interesses RIASEC, formação de referência, potencial remoto e tipo de caminho. Dentro de uma categoria, a seleção é uma união; entre categorias, uma interseção.
- Temas claro e escuro neutros, alternados por um ícone de lua/sol, com preferência persistida. Filtros abrem e fecham pelo mesmo botão e mantêm o mapa interativo. Salvos e guia têm botões diretos; fontes ficam junto da contagem no rodapé.
- Lista com filtros fixos na lateral esquerda, ordenação, carregamento incremental, detalhes com tarefas oficiais, referências, percentis salariais e amostra.
- Salvos e comparação de até três opções, persistidos neste navegador. O botão de comparar aparece na parte inferior central apenas com alguma opção adicionada. Exploração inicial por interesses e URLs compartilháveis com os filtros.
- Página `/sobre` com cobertura, metodologia, fontes e limitações.
- Catálogo inicial de aproximadamente 240 KB com gzip, detalhes individuais sob demanda e arquivos versionados pelo conteúdo, com cache imutável. `/health.json` informa a versão e a cobertura publicadas.

## Cobertura desta versão

| Base                                          |                         Registros | Uso                                              |
| --------------------------------------------- | --------------------------------: | ------------------------------------------------ |
| CBO / Ministério do Trabalho e Emprego        |                             2.694 | Ocupações, famílias, sinônimos e tarefas         |
| Lista MEI / Receita Federal                   |                               471 | Atividades econômicas das tabelas A e B          |
| Curadoria de caminhos de atuação              |                                58 | SaaS, criadores, freelancers e negócios próprios |
| RAIS 2025, agregado por Futuro das Carreiras  | 2.484 CBOs com amostra suficiente | Mediana mensal, média, quartis e vínculos        |
| Novo CAGED, agregado por Futuro das Carreiras |                Por CBO disponível | Admissões, desligamentos e salário de admissão   |

**3.223 opções não equivalem a 3.223 profissões únicas.** Uma atividade MEI e um caminho empreendedor podem se sobrepor a uma ocupação CBO. Não é possível garantir uma lista de todas as formas existentes de ganhar dinheiro; a cobertura é definida pelas fontes e pela curadoria versionada.

Os salários são agregados brasileiros de terceiros atribuídos, não estimativas produzidas pelo app. Rendimentos de autônomos e empreendedores permanecem ausentes. Os perfis RIASEC e a possibilidade de trabalho remoto são classificações editoriais, não escores psicométricos nem frequência observada de vagas. Consulte [DATA.md](DATA.md).

A formação resume referências históricas de 615 famílias CBO. O banco de origem foi gravado em 20/11/2014; não é uma verificação de requisitos legais atuais. Caminhos sem referência e famílias com trajetórias diferentes ficam identificados.

## Reproduzir os dados

Os arquivos originais e o catálogo normalizado estão incluídos, portanto não é necessário baixar nada para iniciar.

```sh
python3 scripts/fetch_data.py
python3 -m venv .venv
.venv/bin/pip install -r requirements-data.txt
.venv/bin/python scripts/fetch_mei.py
.venv/bin/python scripts/fetch_training.py
python3 scripts/normalize.py
npm run data:publish
```

`data/manifest.json` registra URLs, data e SHA-256 das fontes CSV. `data/raw/mei-activities.json` inclui a proveniência do PDF e a página de cada atividade. `data/processed/quality-report.json` registra contagens, dados ausentes e códigos sem correspondência. A atualização é manual; os rótulos de período e as verificações de cobertura devem ser revisados quando a versão das bases mudar. Os scripts abortam diante de falhas de download em vez de inventar dados.

## Publicar na Vercel

1. Importe o repositório na Vercel com o framework Next.js. `vercel.json` define instalação, build e cache dos dados. A integração Next.js detecta a exportação estática automaticamente; mantenha o Output Directory padrão da Vercel.
2. Execute `npm run build` ou publique um commit no branch `main`. O build gera os JSONs a partir de `data/processed/catalog.json` e exporta todas as páginas como arquivos estáticos.
3. Confira `/health.json`, o mapa e os detalhes de uma profissão. Nenhuma variável de ambiente é necessária.

O navegador carrega um catálogo compacto para mapa, busca e filtros, e baixa os detalhes de uma opção apenas quando ela é aberta. Os dados completos não fazem parte do bundle JavaScript. URLs com hash permitem cache de um ano sem manter dados antigos após uma atualização: um novo snapshot gera novos endereços. Os arquivos gerados não são versionados no Git; os snapshots e o exportador são.

As fontes externas só são consultadas pelos scripts de atualização manual; indisponibilidade delas não interrompe o app nem o build. Não há cadastro, autenticação ou sincronização de salvos entre dispositivos nesta versão.

Documentação de referência: [exportação estática do Next.js](https://nextjs.org/docs/app/guides/static-exports) e [Next.js na Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs).

## Verificação

```sh
npm run typecheck
npm test
npm run build
# Com o app em execução:
npx playwright install chromium
npm run test:e2e
```

Para reutilizar um Chromium existente, defina `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Os testes verificam a integridade dos arquivos estáticos, carregamento dos detalhes sob demanda, base, filtros, ausência de imputação salarial, busca, salvos, comparação, guia de interesses, URLs e layout móvel. As capturas ficam em `test-results/`.

## Estrutura

```text
src/app/                 Páginas e estilos
src/components/          Exploração, visualização Canvas e diálogos
src/lib/                 Tipos, filtros e referência aos arquivos da versão
data/raw/                Snapshots das fontes
data/processed/          Catálogo e relatório de qualidade
data/editorial-paths.json Curadoria adicional rastreável
scripts/                 Coleta, normalização, exportação e execução local
public/data/             Catálogo compacto e detalhes gerados no build
out/                     Site estático pronto para publicação
tests/                   Testes de dados, filtros e navegação
```

As fontes DM Sans e Manrope são servidas localmente; suas licenças OFL estão em `public/fonts`. Dados salariais: Futuro das Carreiras, CC BY 4.0, com transformações descritas em DATA.md. As referências do Vagas são inspiração de navegação; nenhum dado privado ou conteúdo de currículos foi coletado.
