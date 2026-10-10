# Norte · mapa de carreiras e caminhos de renda

Webapp fullstack para explorar possibilidades de trabalho no Brasil. Next.js 16, React 19, TypeScript, Canvas 2D + D3 e PostgreSQL. Preparado para Vercel e Supabase; funciona localmente sem conta nesses serviços.

## Rodar localmente

Pré-requisitos: Node.js 22.16+ (recomendado 24), npm, Python 3 e PostgreSQL 16+ com `initdb`, `pg_ctl`, `psql` e `createdb` no PATH.

```sh
cd ~/mapa-carreiras
npm ci
bash scripts/start-local.sh
```

Abra **http://127.0.0.1:3000**. O script cria uma instância isolada do PostgreSQL em `.local/postgres`, escutando somente em `127.0.0.1:55432`, e importa o catálogo. Essa configuração local usa autenticação `trust`; não a exponha em outra interface de rede. Não modifica o banco padrão da máquina.

Para modo de produção local:

```sh
bash scripts/start-local.sh --production
```

Para encerrar o servidor em primeiro plano, use Ctrl+C. Para encerrar a instância de banco e o servidor em segundo plano entregue nesta sessão, execute `bash scripts/stop-local.sh`.

## O que está implementado

- Mapa em tela cheia, com controles flutuantes compactos e grupos abertos em 14 áreas próximas por afinidade. Títulos grandes no centro das áreas desaparecem suavemente durante o zoom, dando lugar aos nomes dentro dos círculos. Todos os círculos existem desde o início; a geometria permanece estável durante a navegação. Clique no título de uma área aproxima a câmera sem filtrar. Inclui arraste, zoom por dois dedos e minimapa.
- Busca por títulos, códigos e 7.778 sinônimos oficiais, além de nomes alternativos dos caminhos digitais.
- Filtros que removem registros do mapa: áreas, intervalo de salário com duas alças e campos numéricos, seis interesses RIASEC, formação de referência, potencial remoto e tipo de caminho. Dentro de uma categoria, a seleção é uma união; entre categorias, uma interseção.
- Temas claro e escuro neutros, alternados por um ícone de lua/sol, com preferência persistida. Filtros abrem e fecham pelo mesmo botão e mantêm o mapa interativo. Salvos e guia têm botões diretos; fontes ficam junto da contagem no rodapé.
- Lista com filtros fixos na lateral esquerda, ordenação, carregamento incremental, detalhes com tarefas oficiais, referências, percentis salariais e amostra.
- Salvos e comparação de até três opções, persistidos neste navegador. O botão de comparar aparece na parte inferior central apenas com alguma opção adicionada. Exploração inicial por interesses e URLs compartilháveis com os filtros.
- Página `/sobre` com cobertura, metodologia, fontes e limitações.
- APIs `/api/catalog`, `/api/occupations/:code` e `/api/health`, consultando PostgreSQL real.

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
npm run db:setup
```

`data/manifest.json` registra URLs, data e SHA-256 das fontes CSV. `data/raw/mei-activities.json` inclui a proveniência do PDF e a página de cada atividade. `data/processed/quality-report.json` registra contagens, dados ausentes e códigos sem correspondência. A atualização é manual; os rótulos de período e as verificações de cobertura devem ser revisados quando a versão das bases mudar. Os scripts abortam diante de falhas de download em vez de inventar dados.

## Vercel + Supabase

1. Crie um projeto Supabase e obtenha a conexão PostgreSQL. Para a importação, use a conexão direta ou o pooler de sessão com uma credencial que possa criar tabelas.
2. Configure `DATABASE_URL` e `DATABASE_SSL=true` em `.env.local` ou no ambiente. Execute `npm run db:setup`: as migrações em `supabase/migrations` e o seed são idempotentes.
3. Importe este diretório em um projeto Vercel. O framework é Next.js; `vercel.json` define instalação e build.
4. Configure `DATABASE_URL` com a URL do **transaction pooler** Supabase e `DATABASE_SSL=true` na Vercel. A URL é usada exclusivamente no servidor; não use prefixo `NEXT_PUBLIC_`. O cliente `pg` utiliza pool pequeno e consultas parametrizadas sem prepared statements nomeados.
5. Faça o deploy e confira `/api/health`.

As tabelas têm RLS habilitado e políticas públicas somente de leitura; os papéis anônimos do Supabase não recebem permissão de escrita. Não há cadastro, autenticação ou sincronização de salvos entre dispositivos nesta versão.

Documentação de referência: [conexões Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres) e [Next.js na Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs).

## Verificação

```sh
npm run typecheck
npm test
npm run build
# Com o app e o banco em execução:
npx playwright install chromium
npm run test:e2e
```

Para reutilizar um Chromium existente, defina `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Os testes verificam a base, semântica dos filtros, ausência de imputação salarial, API PostgreSQL, busca, salvos, comparação, guia de interesses, URLs e layout móvel. As capturas ficam em `test-results/`.

## Estrutura

```text
src/app/                 Páginas, APIs e estilos
src/components/          Exploração, visualização Canvas e diálogos
src/lib/                 Tipos, filtros e consultas PostgreSQL
data/raw/                Snapshots das fontes
data/processed/          Catálogo e relatório de qualidade
data/editorial-paths.json Curadoria adicional rastreável
scripts/                 Coleta, normalização, seed e execução local
supabase/migrations/     Schema PostgreSQL e políticas RLS
tests/                   Testes de dados, filtros e navegação
```

As fontes DM Sans e Manrope são servidas localmente; suas licenças OFL estão em `public/fonts`. Dados salariais: Futuro das Carreiras, CC BY 4.0, com transformações descritas em DATA.md. As referências do Vagas são inspiração de navegação; nenhum dado privado ou conteúdo de currículos foi coletado.
