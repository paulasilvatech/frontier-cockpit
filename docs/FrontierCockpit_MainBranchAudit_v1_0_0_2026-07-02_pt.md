---
title: "Frontier Cockpit Auditoria da Main e Propostas de Melhoria"
description: "Auditoria completa da branch main como produto entregavel para cliente: achados, novas metricas, naming, opcoes de integracao Azure e roadmap."
author: "Frontier Cockpit Team"
date: "2026-07-02"
version: "1.2.0"
status: "draft"
tags: ["frontier-cockpit", "auditoria", "roadmap", "metricas", "azure"]
---

# Auditoria da Main e Propostas de Melhoria

Este documento consolida uma auditoria completa da branch `main` do repositorio Frontier Cockpit, com foco em quatro perguntas:

1. O que precisa melhorar para a `main` servir como modelo de entrega para cliente?
2. Quais outras metricas o cockpit deveria oferecer?
3. Como nomear e posicionar o cockpit local, e como evoluir o produto?
4. Como estruturar as opcoes de integracao com Azure?

A auditoria cobriu a stack local (`local-otel/`), a integracao Azure (`local-otel/azure/` e `local-otel/github-enterprise/`), a documentacao (`docs/`, `workshop/`, `README.md`, `llms.txt`) e os primitivos de automacao (`.github/`).

## 1. Sumario Executivo

O produto tem uma base tecnica forte: stack local completa (Collector, Aspire, Prometheus, Tempo, Loki, Grafana, mini app), pipeline de sanitizacao para Azure com defesa em profundidade, materializacao rica de sessoes do GitHub Copilot e um conjunto de KPIs ja avancado (AIU, AI Credits, cache, contexto, coach com 10 regras).

Os principais bloqueios para a `main` ser um modelo de entrega para cliente sao:

- **Conteudo nao relacionado ao produto dentro de `.github/`** (plugin RHDH/Backstage completo, pipeline Specky SDD com 18 hooks ativos, cluster de code-modernization, skills de design e video). Isso infla o repositorio, confunde o cliente e, no caso dos hooks Specky, executa automacao no repositorio do cliente.
- **Postura de seguranca local fraca por padrao**: Grafana `admin/admin` com acesso anonimo, Postgres exposto em `0.0.0.0:5432`, Collector/Prometheus/Tempo/Loki em `0.0.0.0`, captura de conteudo (prompts e trechos de codigo) ligada por padrao.
- **Documentacao com dois modelos de instalacao contraditorios**: o README novo usa `local-otel/`, mas os Labs 00 a 05 e varios guias ainda usam o caminho legado `~/.copilot-otel/`, que o fluxo de cliente nao cria.
- **Azure hybrid com recursos mortos e autenticacao fraca**: identidade gerenciada provisionada mas nunca usada, Azure Monitor workspace (Managed Prometheus) implantado sem nenhum dado, token bearer estatico sem rotacao, sem Key Vault, sem VNet ou private endpoints.
- **Zero testes e CI que nao cobre o produto**: o workflow valida apenas primitivos de documentacao; nao compila a API nem o front, nao valida o compose, nao roda shellcheck nem secret scanning.
- **Governanca incompleta**: CODEOWNERS com placeholder `@your-org`, sem LICENSE na raiz, sem contato de seguranca.

## 2. Achados por Area

### 2.1 Higiene do repositorio para entrega a cliente (P0)

| Achado | Evidencia | Acao proposta |
| --- | --- | --- |
| Plugin RHDH/Backstage completo vendorizado (repo estrangeiro com LICENSE, testes, CI proprio) | `.github/plugins/rhdh-plugin/`, skills `rhdh*`, `create-plugin`, `overlay`, `backstage-plugin-builder` | Remover da entrega; mover para repositorio interno de autoria |
| Pipeline Specky SDD com 18 hooks shell registrados como PreToolUse/PostToolUse | `.github/hooks/specky/`, 20+ prompts `specky-*`, 13 agentes | Remover; hooks disparariam automacao dentro do repo do cliente |
| Cluster code-modernization (agentes, prompts, plugin) sem relacao com observabilidade | `.github/plugins/code-modernization-plugin/`, prompts `modernize-*` | Remover ou mover |
| Skills de design e midia | `canvas-design`, `svg-professional`, `web-artifacts-builder`, `ms-demo-video-editor.skill` | Remover |
| Dois bundles `.skill` binarios (ZIP) soltos e fora do inventario | `.github/skills/monthly-insights.skill`, `ms-demo-video-editor.skill` | Remover ambos da entrega. `monthly-insights` e skill interna de autoria e nao deve ser incorporada ao produto |
| CODEOWNERS 100% placeholder | `.github/CODEOWNERS` (`@your-org` em 11 linhas) | Definir owners reais ou remover o arquivo |
| Sem LICENSE na raiz | apenas `LICENSE` dentro de plugins | Adicionar licenca do produto |
| Arquivos de erro commitados | `local-otel/github-enterprise/audit.err`, `copilot-metrics.err` | `git rm` |
| Frontmatter dos agentes embute allowlists de ferramentas com acesso a terminal, edicao e Azure MCP | ex. `release-engineer.agent.md`, `azure-principal-architect.agent.md` | Revisar permissoes antes da entrega |

### 2.2 Seguranca e privacidade da stack local (P0)

| Achado | Evidencia | Acao proposta |
| --- | --- | --- |
| Grafana `admin/admin` e viewer anonimo habilitado | `stack/docker-compose.yml:137-139` | Senha gerada no bootstrap (como ja e feito para a Aspire API key); desligar anonimo |
| Postgres `grafana/grafana` exposto em `0.0.0.0:5432` | `stack/docker-compose.yml:116-128` | Remover publicacao da porta; rede interna do compose basta |
| Collector, Prometheus, Tempo e Loki em `0.0.0.0`; apenas web e Aspire em `127.0.0.1` | `stack/docker-compose.yml` | Padronizar bind em `127.0.0.1` (OTLP local nao precisa aceitar trafego externo) |
| Captura de conteudo ligada por padrao (prompts, caminhos, argumentos de ferramentas vao para o Loki) | `client.env.example:36`, `client-bootstrap.sh:109` | Default `FRONTIER_ENABLE_CONTENT_CAPTURE=false`; opt-in explicito com aviso |
| Aspire dashboard anonimo | `stack/docker-compose.yml:10` | Aceitavel local, documentar; ou proteger com a API key ja gerada |
| Imagem `aspire-dashboard:latest` sem pin | `stack/docker-compose.yml:5` | Pinar tag ou digest (todas as outras ja sao pinadas) |
| Sem healthcheck em 6 dos 10 containers | aspire, collector, tempo, loki, prometheus, grafana | Adicionar healthchecks e `depends_on: condition: service_healthy` |
| Sem limites de recursos | compose inteiro | Adicionar `mem_limit`/`cpus` para maquinas de workshop |

### 2.3 Documentacao e workshop (P1)

| Achado | Evidencia | Acao proposta |
| --- | --- | --- |
| Dois modelos de caminho contraditorios: README usa `local-otel/`, Labs 00 a 05 e guias usam `~/.copilot-otel/` | ex. `Lab_01`, `LocalLinksGuide`, `OperationsRunbook`, `AzureEnterpriseGuide` | Migrar todos os docs para o modelo `local-otel/` do cliente |
| ParticipantChecklist mistura os dois modelos e pede dois bootstraps (`client.env` e `workshop.env`) | `ParticipantChecklist` linhas 45-65 | Unificar em um unico env e bootstrap |
| Marca antiga "Control Tower" sobrevive no workshop e nos diagramas | `Lab_05`, `DashboardUXGuide`, `diagrams/*.svg`, `diagrams/*.drawio` | Resolvido nesta branch: renomeado para o padrao Frontier Cockpit Local / Hybrid e Azure Monitor |
| README documenta branch `develop` que nao existe mais | `README.md:287-292` | Remover a linha da tabela |
| Convencao de nome de arquivo com versao e data que ninguem atualiza | `ParticipantChecklist_v1_0_0_2026-06-18` com frontmatter `1.0.2` de `2026-07-02` | Tirar versao e data do nome do arquivo; manter apenas no frontmatter e num CHANGELOG |
| `llms.txt` indexa 13 de 15 docs | faltam `DockerDesktopFrontendRequirements` e `PythonAspireLocalArchitecture` | Regenerar indice |
| `stream_id: 7222` e `md/` sao restos do ambiente de autoria | `Lab_05:114`, `Lab_02:31` | Substituir por placeholders |
| Labs sem estimativa de duracao; Lab_06 (mini app, entregavel principal) vem depois dos labs opcionais de Azure e Enterprise | `workshop/` | Adicionar duracao por lab; renumerar Lab_06 para antes dos opcionais |
| App e trilingue (EN/PT/ES) mas docs sao apenas `_en` | `frontend/web/src/i18n.tsx` vs `docs/` | Priorizar traducao pt-BR do README, ParticipantChecklist e Labs 01/06 |
| Docs de cliente ausentes | sem uninstall, upgrade, FAQ, suporte/SLA, CHANGELOG | Criar guia de desinstalacao (scripts ja existem), politica de upgrade e FAQ |
| Guia Firecrawl MCP orfao (nao usado pelo runtime) | `docs/FrontierCockpit_FirecrawlMCPGuide_*` | Remover da entrega |

### 2.4 Stack local: engenharia (P1)

| Achado | Evidencia | Acao proposta |
| --- | --- | --- |
| Zero testes automatizados; matematica de AIU, creditos, cache, orcamento e coach sem verificacao | `frontend/api`, `frontend/web` sem script `test` | Vitest para a API (funcoes puras de KPI) e smoke test de compose no CI |
| CI nao cobre o produto (so audita primitivos de markdown) | `.github/workflows/validate.yml` | Adicionar: build/typecheck api e web, `docker compose config`, shellcheck, markdownlint com link check, gitleaks, e ligar `validate-dashboards.sh` (existe mas nao esta no workflow) |
| ~13 scripts com PATH Homebrew hardcoded e defaults macOS | `daily-rollup.sh:9`, `materialize-copilot-sessions.sh:10`, `ingest-*.sh` etc. | Detectar plataforma; remover PATH fixo; documentar systemd timers e Task Scheduler como equivalentes dos LaunchAgents |
| Logica duplicada entre `client-bootstrap.sh` (577 linhas) e `client-bootstrap.ps1` (343 linhas), com divergencias reais (precisao de timestamp, persistencia de env) | `local-otel/client-bootstrap.*` | Extrair o nucleo para Python (ja e pre-requisito) e deixar os wrappers finos |
| Precos e multiplicadores de modelos hardcoded, incluindo rotulos especulativos | `seed-model-prices.sh:31-44`, `seed-model-multipliers.sh:52-81` | Mover para um arquivo `model-catalog.json` versionado e editavel pelo cliente |
| Allowances de AI Credits duplicadas em dois lugares (API e front) | `server.ts:101-112` e `App.tsx:661-678` | Front consumir o valor da API (fonte unica) |
| URLs `localhost:3000/18888` hardcoded no front | `App.tsx:847-848,1356-1357` | Derivar de configuracao como o restante |
| Muitos entrypoints legados sobrepostos (auto-start, demo-ready, workshop-ready, check-otel-local vs check-workshop-local) | `local-otel/` | Consolidar em um CLI unico (ver secao 5) |
| Alertas so existem quando alguem abre a pagina; sem Prometheus rules nem Alertmanager | `prometheus.yml` sem `rule_files` | Adicionar regras basicas (queda de coleta, estouro de orcamento) e notificacao opcional |
| Retencao fixa (30d Prometheus, 720h Tempo/Loki); export DuckDB cresce sem limite | `tempo.yaml:22`, `loki.yaml:34`, `export-otel-duckdb.sh` | Tornar retencao configuravel via `client.env` |

### 2.5 Azure hybrid (P1)

O desenho conceitual e bom: pipelines `/azure` separados com redacao `transform/azure_redact` no collector local e a mesma redacao reaplicada no collector na nuvem (defesa em profundidade). Os problemas estao na execucao:

| Achado | Evidencia | Acao proposta |
| --- | --- | --- |
| Identidade gerenciada criada e anexada ao collector mas nunca usada (export via connection string) | `containerapp-collector.bicep:20-25`, `collector-config.azure.yaml:90-91` | Usar a identidade para ingestao Entra no Application Insights |
| Azure Monitor workspace (Managed Prometheus) implantado e integrado ao Grafana, mas nada escreve nele | `monitorworkspace.bicep`, `grafana.bicep:22-28` | Exportar metricas via `prometheusremotewrite` para o AMW e apontar paineis de metricas para ele |
| Token bearer estatico unico, sem rotacao, unico controle do endpoint publico de ingestao | `collector-config.azure.yaml:10-12`, `deploy.sh:34-39` | Curto prazo: rotacao automatizada; medio prazo: Entra ID ou APIM na frente do collector |
| Sem Key Vault; segredos como secrets inline do Container App | `containerapp-collector.bicep:42-55` | Key Vault com referencias de secret |
| Tudo publico: ingestao App Insights, query, Grafana, ingress do collector; sem VNet nem private endpoints | `appinsights.bicep:14-15`, `grafana.bicep:18-19` | Perfil "enterprise" com VNet, private endpoints e `publicNetworkAccess: Disabled` |
| Log Analytics via shared key classica no ambiente de Container Apps | `containerappenv.bicep:16-18` | Migrar para identidade gerenciada |
| Storage account do audit streaming fica fora do IaC (criado a mao) | `configure-github-audit-stream.sh:14-31` | Trazer para o Bicep com politica de imutabilidade (WORM) e lifecycle |
| Deploy manual, sem CI/CD, um unico ambiente (`main.bicepparam` dev) | `local-otel/azure/` | Workflow com `what-if` em PR e deploy via OIDC; parametros dev/test/prod |
| Scripts zsh macOS-only (`date -v`, `pbcopy`, PATH Homebrew) | `configure-github-audit-stream.sh:41-42,160` | Portar para bash/az portavel para rodar em CI Linux |
| Docs apontam para `~/.copilot-otel/azure/` (caminho morto) e diagrama diverge do nome real do Grafana | `AzureEnterpriseGuide`, SVG `amg-...-001` vs Bicep `eus01` | Corrigir caminhos e regenerar diagrama |
| Retencao Log Analytics 30 dias, sem camada de arquivo | `main.bicep:62` | Parametrizar; avaliar ADX/Fabric para retencao longa (secao 6) |
| Imagem do collector por tag, sem digest | `containerapp-collector.bicep:12` | Pinar digest |
| Tabelas custom `*_CL` de consolidacao (usage, billing, audit) sao apenas roadmap | `DataConsolidationGuide:159-167` | Explicitar como roadmap na proposta comercial; implementar na fase 2 |

## 3. Metricas: o que existe e o que adicionar

### 3.1 Inventario atual (resumo)

Ja implementado no mini app e nos 8 dashboards Grafana: AIU/AI Credits com orcamento e projecao mensal, tokens (input, output, cache read, cache creation, cold, reasoning), eficiencia de cache (hot/warm/cold), utilizacao de contexto (tipica e pico), mix de modelos com custo estimado, TTFT medio, turnos, aceitacao de edicoes, linhas aceitas, sobrevivencia de edicao sem revert, compactacoes, chamadas de ferramenta, erros, qualidade de dados (cobertura e atribuicao por workspace), score de economia e coach com 10 regras.

E uma base acima da media. As lacunas estao em percentis, tendencias, resultado de engenharia e visao de time.

### 3.2 Novas metricas propostas

**Custo e FinOps (diferencial comercial mais forte)**

- Custo por sessao, por repositorio e por dia de desenvolvedor (unit economics), reutilizando os precos do catalogo.
- Creditos economizados por cache: converter o cache read ja medido em creditos e USD evitados (numero de impacto para executivo).
- Custo por linha aceita e tokens por edicao aceita (eficiencia real, nao apenas volume).
- Burn rate diario e previsao de esgotamento do pool de creditos (a projecao mensal ja existe; falta a data estimada de esgotamento e a tendencia semanal).
- Showback por workspace/time no modo hibrido (agregacao sanitizada).

**Experiencia e desempenho**

- TTFT e duracao em p50/p95 (hoje so ha media, que esconde cauda longa).
- Taxa de retry/erro por modelo e por modo (chat, agente, NES).
- Profundidade agentica: chamadas de ferramenta e turnos por sessao, distribuicao (ja ha dados brutos em `mode_bucket` e `tool_calls`).

**Resultado de engenharia (a metrica que o cliente executivo quer)**

- Tendencia semanal de taxa de aceitacao e de sobrevivencia de edicao (existe o valor pontual; falta serie temporal comparavel).
- Sessoes ativas por dia/semana por workspace (proxy local de adocao; no hibrido, DAU/WAU oficial via API de metricas do GitHub).
- Correlacao commit/PR: sessoes atribuidas a branch/commit ja tem labels (`repo`, `branch`, `commit`); cruzar com atividade git local para "sessoes por PR".

**Higiene de prompt e contexto**

- Score de higiene de contexto: frequencia de cold start, pressao de contexto e compactacoes combinadas (o coach ja usa esses sinais; expor como indice unico com meta).
- Tamanho medio de prompt vs resposta por modo (detecta prompt bloat).

**Plataforma e confiabilidade do proprio cockpit**

- Uptime dos coletores, lag de ingestao e ultima materializacao (os gauges `github_enterprise_api_available` ja existem; faltam paineis e alertas).

Recomendacao de apresentacao: organizar o cockpit em quatro paineis de persona: Developer (fluxo, cache, contexto, coach), Tech Lead (times, modelos, qualidade), FinOps (creditos, burn rate, showback, what-if) e Platform (saude da stack, cobertura, qualidade de dados). A estrutura de views do `App.tsx` ja suporta essa divisao.

## 4. Naming e posicionamento

Antes desta auditoria coexistiam tres marcas (`Frontier Cockpit`, `Frontier Developer Cockpit`, `Frontier FinOps Cockpit`) mais o resto legado "Control Tower". Isso dilui a marca e confunde proposta comercial.

**Padrao oficial decidido em 2026-07-02**: uma marca, duas edicoes.

| Nome oficial | Papel | Substitui |
| --- | --- | --- |
| **Frontier Cockpit** | Marca unica do produto e do repositorio | Frontier Cockpit (mantem) |
| **Frontier Cockpit Local** (Developer Edition) | Stack 100% local: privacidade total, zero dependencia de nuvem, foco no desenvolvedor | Frontier Developer Cockpit |
| **Frontier Cockpit Hybrid** (Enterprise Edition) | Local + encaminhamento sanitizado para Azure do cliente: FinOps, governanca, historico | Frontier FinOps Cockpit |

O termo "Control Tower" esta proibido no repositorio e ja foi removido do workshop e dos diagramas nesta branch.

Mensagem de posicionamento: "Frontier Cockpit: observabilidade de IA para engenharia, do desenvolvedor ao FinOps. Local por padrao, Azure por opcao." Os tres pilares de venda: (1) privacidade primeiro (dados brutos nunca saem da maquina), (2) custo sob controle (AI Credits, cache, what-if), (3) coaching acionavel (nao apenas graficos, mas recomendacoes).

Execucao pendente do rebrand: atualizar as ocorrencias de `Frontier Developer Cockpit` e `Frontier FinOps Cockpit` em README, docs, labs, `FRONTIER_DASHBOARD_TITLE` default, strings de i18n do front e titulos dos dashboards Grafana para o padrao acima, e regenerar os SVGs a partir do drawio.

## 5. Como evoluir o produto (roadmap de diferenciacao)

Ideias em ordem de esforco/retorno:

1. **CLI unico `frontier`** (curto prazo): consolidar os ~10 entrypoints shell em um comando com subcomandos `up`, `down`, `status`, `doctor`, `register`, `export`, `hybrid`. Reduz a superficie de manutencao, resolve a duplicacao sh/ps1 (nucleo em Python) e melhora demais a primeira impressao do cliente.
2. **Relatorio semanal automatico**: construir como funcionalidade nativa do produto (por exemplo `frontier report --weekly`), gerando um resumo (markdown/PDF) de creditos, cache, coach e tendencias a partir do export DuckDB. E o artefato que o sponsor executivo encaminha por email. Nao reutilizar skills internas de autoria (`monthly-insights.skill` fica fora do produto e sai do repositorio na limpeza P0).
3. **MCP server do cockpit**: expor `/api/summary`, `/api/sessions` e `/api/coach` como ferramentas MCP. O desenvolvedor pergunta ao proprio GitHub Copilot "quanto gastei hoje? por que meu cache esta frio?" e o coach vira conversacional. Diferencial forte de demo.
4. **Extensao Docker Desktop ou devcontainer feature**: instalacao em um clique para o perfil menos tecnico; devcontainer/Codespaces para times que nao usam Docker Desktop.
5. **Alertas proativos**: Prometheus rules + notificacao (desktop/webhook/Teams) para estouro de orcamento e queda de coleta, em vez de alertas apenas na tela.
6. **Modo time (fase 2)**: agregacao anonima de varios cockpits locais no modo hibrido, com benchmarks de time e gamificacao opcional em workshops.
7. **Badge de status na IDE**: item de status bar do VS Code com creditos restantes e estado do cache (consome a API local).

### 5.1 CLI como interface enterprise

Sim, CLI funciona para enterprise. E o formato padrao de ferramenta corporativa de engenharia (`az`, `gh`, `kubectl`, `docker`): scriptavel, automatizavel em CI, instalavel em silencio por gerenciadores corporativos (Intune, JAMF, winget, Homebrew, apt) e utilizavel em maquinas sem interface grafica e atras de proxy corporativo.

O que torna o CLI `frontier` credivel para enterprise:

- Binario unico assinado, com checksums, SBOM e releases versionadas (em vez de "requer Python 3 e bash").
- Subcomandos estaveis com exit codes documentados: `up`, `down`, `status`, `doctor`, `register`, `report`, `hybrid`.
- Configuracao por arquivo mais variaveis de ambiente (substitui a dupla `client.env`/`workshop.env`).
- Operacao offline por padrao e sem telemetria propria sem opt-in.
- `frontier doctor` cobrindo Docker, portas, VS Code settings e conectividade, substituindo os scripts `check-*` atuais.

Importante: o CLI e o plano de controle, nao substitui o dashboard. O par CLI mais interface web e exatamente o modelo Azure CLI mais Azure Portal. O CLI tambem resolve a duplicacao atual entre `client-bootstrap.sh` e `client-bootstrap.ps1` (nucleo unico, wrappers finos por plataforma).

### 5.2 Consolidacao de containers

Hoje a stack sobe 10 containers. Da para reduzir muito sem perder funcionalidade, em etapas:

| Etapa | Mudanca | Containers |
| --- | --- | --- |
| 0 | Stack atual | 10 |
| 1 | Unir `frontier-dashboard-api` e `web` em um container (Node serve o SPA estatico, elimina o nginx) | 9 |
| 2 | Remover Postgres: Grafana usa SQLite embutido por padrao (Postgres so se justifica em alta disponibilidade); tambem elimina a porta 5432 exposta | 8 |
| 3 | Absorver o sidecar `registry` como tarefa agendada dentro da API | 7 |
| 4 | Substituir Collector, Prometheus, Tempo, Loki e Grafana pela imagem oficial `grafana/otel-lgtm` (all-in-one da Grafana Labs para uso local) e deixar o Aspire como profile opcional | 2 |

Ou seja: a meta realista de curto prazo e **2 containers** (`frontier-core` com o backend de observabilidade e `frontier-app` com o cockpit), mantendo upgrades e isolamento de falha saudaveis.

Um unico container literal para a stack completa e possivel (supervisord ou s6-overlay), mas e anti-padrao: upgrades acoplados, sem isolamento de memoria e falha entre servicos, healthcheck unico e depuracao pior. Nao recomendado.

A alternativa correta para "1 comando, 1 container" e uma edicao **Frontier Cockpit Local Lite**: um unico container com collector embutido, DuckDB como armazenamento e o mini app, sem Grafana, Prometheus, Tempo e Loki. Exige refatorar a API para ler do DuckDB em vez do Prometheus (esforco medio, o export DuckDB ja existe). O Lite vira o onboarding de um comando para o desenvolvedor, e a stack completa passa a ser o perfil avancado para workshops e power users.

### 5.3 Suporte multiplataforma (macOS, Linux, Windows)

Regra de ouro da portabilidade nesta stack: **tudo que roda dentro do Docker funciona igual nos tres sistemas; tudo que roda no host e por sistema operacional**. O estado atual:

| Camada | macOS | Linux | Windows |
| --- | --- | --- | --- |
| Stack Docker (collector, Prometheus, Tempo, Loki, Grafana, mini app) | Sim | Sim (Docker Engine ou Desktop) | Sim (Docker Desktop com WSL2) |
| Bootstrap e dashboards no navegador | Sim (`client-bootstrap.sh`) | Sim (`client-bootstrap.sh`) | Sim (`client-bootstrap.ps1`) |
| Materializador de sessoes, rollup diario, export DuckDB | Sim, agendado via LaunchAgents | Parcial: execucao manual ou cron, com ajustes de PATH e caminhos do VS Code | Nao nativo: exige WSL2 ou Git Bash, sem equivalente PowerShell |
| Agendamento automatico | LaunchAgents (fornecido) | cron ou systemd (documentado, nao fornecido) | Task Scheduler (documentado, nao fornecido) |
| Ingestao GitHub Enterprise e scripts Azure | Sim (zsh) | Quebra em `date -v`, `pbcopy` e PATH Homebrew | Nao |

Consequencia pratica importante: as metricas `copilot_real_session_*` que alimentam o mini app dependem do materializador rodando periodicamente. Em Linux e Windows, sem agendamento fornecido, o cockpit mostra menos dados do que no macOS. O "suporte a tres plataformas" do README vale para a stack e o bootstrap, mas nao para a camada de automacao.

Correcoes para o suporte valer de ponta a ponta:

1. **Containerizar os jobs** (materializador, rollup, registry, export): um sidecar `frontier-jobs` com scheduler dentro do compose elimina LaunchAgents, cron e Task Scheduler de uma vez. E a correcao estrutural.
2. Portar os scripts zsh para bash portavel (POSIX date, sem `pbcopy`, sem PATH Homebrew hardcoded).
3. Resolver os caminhos do VS Code por sistema no CLI `frontier` (macOS `~/Library/Application Support`, Linux `~/.config`, Windows `%APPDATA%`), que ja e necessario para o bootstrap unico.
4. Matrix de CI com runners `ubuntu-latest`, `macos-latest` e `windows-latest` executando bootstrap e smoke test do compose.

As propostas das secoes 5.1 e 5.2 ja empurram nessa direcao: o CLI unifica o comportamento por sistema e a consolidacao em 2 containers (ou o Lite de 1 container) move quase tudo para dentro do Docker, onde a portabilidade e automatica. Todas as imagens usadas (incluindo `grafana/otel-lgtm`) sao multi-arch amd64 e arm64, entao Apple Silicon e maquinas ARM tambem sao atendidas.

## 6. Integracao com Azure em tres niveis

Empacotar a oferta Azure como trilha de maturidade, cada nivel com Bicep proprio:

**Nivel 1: Hybrid Basico endurecido** (corrigir o que ja existe)
- Managed identity em uso real (App Insights via Entra, Log Analytics sem shared key).
- Key Vault para token e connection strings; rotacao automatizada do token.
- Metricas no Azure Monitor workspace via `prometheusremotewrite` (deixa de ser recurso morto) com paineis Grafana correspondentes.
- Digest pinado, diagnostic settings, alertas basicos, tags de cost center.
- CI/CD: `what-if` em PR, deploy por OIDC, parametros dev/test/prod.

**Nivel 2: Plataforma de dados enterprise**
- Retencao longa e barata: Azure Data Explorer ou Microsoft Fabric Eventhouse para telemetria sanitizada de alto volume (Log Analytics fica para operacao, nao para historico).
- Implementar as tabelas de consolidacao do DataConsolidationGuide (usage, billing, audit) cruzando com exports oficiais de billing do GitHub, fechando o ciclo FinOps com dados oficiais.
- Storage de audit streaming no IaC com WORM e lifecycle.

**Nivel 3: Governanca e seguranca de rede**
- APIM AI Gateway na frente do collector: autenticacao Entra, rate limit, quota por time, base futura para governanca de APIs de modelo.
- VNet, private endpoints e `publicNetworkAccess: Disabled` em App Insights, Grafana e ingestao.
- Azure Policy e PSRule no CI; zone redundancy do Grafana para producao.

Essa trilha vira naturalmente proposta comercial: Local (gratuito/POC), Hybrid Nivel 1 (piloto), Niveis 2 e 3 (contrato enterprise).

## 7. Plano de acao priorizado

**P0: bloqueia entrega a cliente (1 a 2 semanas)**
1. Remover conteudo nao relacionado de `.github/` (RHDH, Specky hooks, code-modernization, skills de design, `.skill` ZIPs) para um repo interno.
2. Endurecer defaults locais: senha do Grafana, sem anonimo, Postgres sem porta publicada, binds em `127.0.0.1`, `FRONTIER_ENABLE_CONTENT_CAPTURE=false` por padrao, pin da imagem Aspire, remover `.err` commitados.
3. Corrigir governanca: CODEOWNERS real, LICENSE na raiz, contato em SECURITY.md.
4. Consertar docs: migrar `~/.copilot-otel/` para `local-otel/`, remover branch `develop` do README, unificar `client.env`/`workshop.env` e concluir o rebrand para Frontier Cockpit Local / Hybrid ("Control Tower" ja foi eliminado nesta branch).

**P1: qualidade de produto (2 a 4 semanas)**
5. CI de produto: build/typecheck api e web, `docker compose config`, shellcheck, markdownlint + link check, gitleaks, ligar `validate-dashboards.sh`.
6. Testes das funcoes de KPI (creditos, cache, orcamento, coach).
7. Azure Nivel 1 (identidade, Key Vault, AMW, CI/CD, portabilidade dos scripts).
8. Healthchecks e limites de recursos no compose; catalogo de modelos em JSON como fonte unica.

**P2: diferenciacao (1 a 2 meses)**
9. CLI `frontier`, relatorio semanal, alertas proativos.
10. Traducao pt-BR dos docs principais; duracao por lab; renumerar Lab_06.
11. MCP server do cockpit, extensao Docker Desktop, modo time; Azure Niveis 2 e 3.

## Change Log

| Version | Date | Description |
| --- | --- | --- |
| 1.2.0 | 2026-07-02 | Nova secao 5.3 com matriz de suporte multiplataforma macOS, Linux e Windows e correcoes necessarias. |
| 1.1.0 | 2026-07-02 | Naming oficial decidido (Frontier Cockpit Local e Hybrid), Control Tower removido do repositorio, monthly-insights excluido do produto, novas secoes sobre CLI enterprise e consolidacao de containers. |
| 1.0.0 | 2026-07-02 | Versao inicial da auditoria da main. |
