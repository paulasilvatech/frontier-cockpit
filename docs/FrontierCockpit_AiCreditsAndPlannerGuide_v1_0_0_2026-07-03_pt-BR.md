---
title: "Guia de AI Credits e Planner do Frontier Cockpit"
description: "Guia passo a passo sobre GitHub Copilot AI Credits, allowances por plano, melhores práticas de eficiência de tokens e o Planner de workspace com justificativa de overage e de modelos frontier."
author: "Frontier Cockpit Team"
date: "2026-07-03"
version: "1.0.0"
status: "approved"
language: "pt-BR"
tags: ["github-copilot", "ai-credits", "planner", "token-efficiency", "local"]
---

<!-- markdownlint-disable MD025 -->

# Guia de AI Credits e Planner do Frontier Cockpit

Esta é a tradução para português (Brasil). A versão em inglês é a padrão e fonte da verdade: `FrontierCockpit_AiCreditsAndPlannerGuide_v1_0_0_2026-07-03_en.md`. Também existe versão em espanhol (`..._es.md`).

Este guia é para a pessoa desenvolvedora que usa o dashboard local em `http://localhost:3300`. Ele explica como funciona o billing por AI Credits do GitHub Copilot, como configurar sua licença real no cockpit, como trabalhar dentro do allowance incluído e como usar a view Planner para prever um projeto e justificar um pedido de overage ou o uso de modelos frontier.

## Histórico de Alterações

| Versão | Data | Autor | Alterações |
| --- | --- | --- | --- |
| 1.0.0 | 2026-07-03 | Frontier Cockpit Team | Guia trilíngue inicial de AI Credits, eficiência de tokens e a view Planner. |

## Sumário

- [1. Como Funciona o Billing do GitHub Copilot Hoje](#1-como-funciona-o-billing-do-github-copilot-hoje)
- [2. AI Credits Incluídos Por Plano](#2-ai-credits-incluídos-por-plano)
- [3. Passo a Passo: Configure Sua Licença no Cockpit](#3-passo-a-passo-configure-sua-licença-no-cockpit)
- [4. Passo a Passo: Trabalhe Dentro dos Créditos Incluídos](#4-passo-a-passo-trabalhe-dentro-dos-créditos-incluídos)
- [5. Passo a Passo: Use a View Planner](#5-passo-a-passo-use-a-view-planner)
- [6. Passo a Passo: Justifique Overage ou Modelos Frontier](#6-passo-a-passo-justifique-overage-ou-modelos-frontier)
- [7. Todos os Valores Configuráveis](#7-todos-os-valores-configuráveis)
- [8. Regras de Honestidade](#8-regras-de-honestidade)

## 1. Como Funciona o Billing do GitHub Copilot Hoje

Desde 1º de junho de 2026, todos os planos do GitHub Copilot usam billing por uso, medido em GitHub AI Credits:

1. **1 AI Credit vale US$0,01.**
2. O uso é medido a partir de **tokens** (entrada, saída e cache) segundo a tarifa de API listada de cada modelo. Não existem mais multiplicadores de premium request; o sistema legado de premium requests foi aposentado.
3. **Autocompletar de código e next edit suggestions são sempre incluídos** e nunca consomem AI Credits.
4. **A seleção automática de modelo (Auto) é faturada com 10% de desconto** nos custos de modelo em planos pagos. O Auto roteia cada prompt para um modelo capaz, reservando modelos de raciocínio caros para problemas complexos.
5. Os allowances **resetam às 00:00 UTC no primeiro dia de cada mês** e créditos não usados **não acumulam**.
6. Quando o allowance incluído acaba, planos pagos podem comprar **uso adicional (overage)** faturado às tarifas de API por modelo no fim do ciclo. Um admin da organização precisa habilitar overages e pode definir orçamentos por usuário.

Fontes: GitHub Docs — "Plans for GitHub Copilot", "Usage-based billing for individuals", "Usage-based billing for organizations and enterprises" e o post do blog do GitHub "GitHub Copilot is moving to usage-based billing". Os valores podem mudar; por isso o cockpit mantém todos os números configuráveis.

## 2. AI Credits Incluídos Por Plano

Allowances de referência publicados no momento da escrita:

| Plano | Preço | AI Credits incluídos / mês | Observações |
| --- | --- | --- | --- |
| Free | US$0 | Não publicado (tratado como 0 localmente) | Somente seleção automática, 2.000 completions |
| Pro | US$10 | 1.500 (1.000 base + 500 flex) | Individual |
| Pro+ | US$39 | 7.000 (3.900 base + 3.100 flex) | Individual |
| Max | US$100 | 20.000 (10.000 base + 10.000 flex) | Individual |
| Business | US$19/usuário | 1.900 por usuário, sem flex | Organização |
| Enterprise | US$39/usuário | 3.900 por usuário, sem flex | Organização |

**Sobre os "3.000 créditos" que você pode ter visto:** clientes existentes de Business e Enterprise recebem um allowance promocional temporário de 1º de junho a 1º de setembro de 2026 — 3.000 créditos por usuário no Business e 7.000 no Enterprise. Não é o allowance padrão. O cockpit só o aplica quando você habilita explicitamente `FRONTIER_AI_CREDITS_USE_PROMO=true`, e volta automaticamente para os valores padrão depois que a janela fecha.

O "flex allotment" dos planos individuais é um valor variável adicional acima dos créditos base, pensado para se adaptar conforme os preços de modelos evoluem.

## 3. Passo a Passo: Configure Sua Licença no Cockpit

1. Copie o template de ambiente, se ainda não fez:

   ```bash
   cp local-otel/workshop.env.example local-otel/workshop.env
   ```

2. Edite `local-otel/workshop.env` e configure sua licença real:

   ```bash
   FRONTIER_COPILOT_PLAN="business"       # free | pro | pro+ | max | business | enterprise
   FRONTIER_COPILOT_SEATS="1"             # planos por assento multiplicam o allowance
   FRONTIER_AI_CREDITS_USE_PROMO="false"  # true SOMENTE se você é cliente existente de Business/Enterprise dentro da janela promocional
   FRONTIER_AI_CREDITS_MONTHLY_ALLOWANCE="" # vazio deriva de plano e assentos; um número sobrescreve
   ```

3. Reinicie a stack para a API ler os valores:

   ```bash
   local-otel/stop-full-stack.sh && local-otel/start-full-stack.sh
   ```

4. Abra `http://localhost:3300` → **Credits**. O painel de orçamento agora mostra seu plano, o allowance incluído correto e se o valor é `standard`, `promotional` ou um `override`. O painel de comparação mostra os seis planos com o seu plano destacado.

5. Verifique pelo terminal (dados reais, não hardcoded):

   ```bash
   curl -s http://localhost:3300/api/plans | python3 -m json.tool
   ```

## 4. Passo a Passo: Trabalhe Dentro dos Créditos Incluídos

O cockpit calcula cada dica a partir da sua telemetria real contra thresholds que você controla. As práticas documentadas por trás das regras do coach:

1. **Prefira a seleção automática (Auto) para trabalho rotineiro.** O Auto escolhe um modelo capaz por prompt e é faturado com 10% de desconto em planos pagos. Reserve um modelo frontier específico para refatorações complexas, arquitetura ou depuração de múltiplas etapas. Observe a view **Coach**: o card "Try Auto model selection" aparece quando modelos de tier frontier dominam sessões de baixa complexidade.
2. **Mantenha um único modelo por sessão.** Trocar de modelo no meio da sessão invalida o cache de prompt, e todo o contexto é reenviado e faturado como entrada nova. O alerta "Cache reuse is low" (threshold padrão: abaixo de 35% de leituras de cache) é o sinal.
3. **Inicie um novo chat ao mudar de assunto.** Caso contrário, o histórico antigo continua sendo reprocessado. O alerta "Context window is filling up" dispara com 70% de utilização de pico (crítico em 90%).
4. **Referencie arquivos em vez de colá-los, e anexe só o que a tarefa precisa.** O alerta "Cold context is high" dispara quando mais de 45% dos tokens de prompt são entrada fria sem cache; a dica "Trim oversized prompts" dispara quando a entrada excede a saída em 20x.
5. **Dê aos agentes tarefas pequenas e delimitadas**, com definição explícita de conclusão. Uma sessão longa de agente com modelo frontier em muitos arquivos custa mais que uma pergunta focada no chat.
6. **Corrija a causa raiz antes de tentar de novo.** O alerta "Sessions reported errors" aponta as tool calls que falharam no Aspire/Tempo; loops de retry queimam créditos sem resultado.
7. **Acompanhe o ritmo do orçamento.** O painel de orçamento projeta o consumo do fim do mês a partir da sua taxa diária real e avisa em 75% (crítico em 90%) do allowance incluído.

Todos os thresholds acima são guardrails locais de planejamento — veja a view **Settings** para a tabela completa com a variável de ambiente exata de cada um.

## 5. Passo a Passo: Use a View Planner

O Planner responde: *meu projeto cabe nos meus créditos incluídos, e eu preciso pedir mais?*

1. Abra `http://localhost:3300` → **Planner**.
2. Escolha o **workspace** no seletor global da barra superior (ou mantenha "Todos os workspaces").
3. Escolha o **lookback** (24h, 7d, 14d, 30d) — a janela usada para medir sua taxa real de consumo. Use pelo menos 7d quando tiver uma semana de telemetria.
4. Escolha o **horizonte** (2, 4, 8 ou 12 semanas) — até onde projetar o consumo do projeto.
5. Leia o painel de previsão:
   - **Observado no escopo**: AI Credits reais consumidos no lookback para este workspace.
   - **Consumo diário**: créditos observados divididos pelos dias do lookback.
   - **Próximas N semanas**: a projeção do horizonte para este workspace.
   - **Projeção do mês (todo o trabalho)** e **Uso projetado do allowance**: sua trajetória mensal total contra o allowance incluído.
6. A linha de veredicto diz "o uso projetado cabe no allowance mensal incluído" ou mostra o **overage projetado em créditos e US$**.
7. Leia o painel **Estratégia de modelos**: seus créditos divididos por tier de preço (frontier / padrão / sem preço), a média de tool calls por tier e o veredicto — `frontier justificado`, `revisar uso de frontier`, `sem uso de frontier` ou `ainda sem dados`.

A classificação de tier é orientada por dados: um modelo conta como frontier quando seu preço de saída registrado está em `PLANNER_FRONTIER_OUTPUT_PRICE_MIN` (padrão US$20 por 1M de tokens de saída) ou acima no registro local de preços (`local-otel/seed-model-prices.sh`). Atualize os preços do registro para a sua fonte da verdade.

## 6. Passo a Passo: Justifique Overage ou Modelos Frontier

1. Na view **Planner**, role até **Rascunho de justificativa de orçamento**.
2. Clique em **Copiar markdown**. O rascunho contém, a partir de telemetria real: seu plano e allowance incluído, créditos e sessões observados no escopo, o consumo diário, as projeções de horizonte e mês, o overage projetado em créditos e US$, e a justificativa da estratégia de modelos.
3. Cole no seu pedido ao tech lead ou admin da organização. Dois cenários:
   - **Pedido de overage**: o rascunho quantifica quantos créditos adicionais o ciclo precisa e lembra quem aprova que overage é faturado às tarifas de API por modelo e exige que um admin habilite uso adicional com orçamento por usuário.
   - **Justificativa de modelo frontier**: quando as sessões frontier são genuinamente complexas (média de tool calls no threshold de complexidade ou acima), o rascunho defende manter modelos frontier nesse trabalho. Quando não são, ele lista as sessões frontier de baixa complexidade e os créditos que poderiam migrar para o Auto — nesse caso a recomendação honesta é mover o trabalho rotineiro para o Auto antes de pedir mais orçamento.
4. O rascunho sempre termina com a ressalva de que a telemetria local é uma estimativa operacional, e os números oficiais vêm do dashboard de uso do GitHub ou dos exports de billing. Nunca remova essa nota — quem aprova precisa saber o que está olhando.

## 7. Todos os Valores Configuráveis

Nada nas dicas, no orçamento ou na matemática do planner é hardcoded. Defina estas variáveis no serviço `frontier-dashboard-api` (via `workshop.env`/`client.env` ou o environment do compose) e reinicie:

| Variável | Padrão | Controla |
| --- | --- | --- |
| `FRONTIER_COPILOT_PLAN` | `business` | Plano usado no allowance e nos painéis de plano |
| `FRONTIER_COPILOT_SEATS` | `1` | Multiplicador de assentos em planos por assento |
| `FRONTIER_AI_CREDITS_USE_PROMO` | `false` | Adere ao allowance promocional de transição |
| `FRONTIER_AI_CREDITS_MONTHLY_ALLOWANCE` | derivado | Override direto do pool mensal de créditos |
| `FRONTIER_AI_CREDITS_PROMO_START` / `_END` | `2026-06-01` / `2026-09-01` | Datas da janela promocional |
| `AI_CREDIT_USD` | `0.01` | Valor em US$ de um AI Credit |
| `AUTO_MODEL_SELECTION_DISCOUNT` | `0.10` | Desconto do Auto usado nas economias what-if |
| `THRESHOLD_AI_CREDITS_WARN` / `_CRIT` | `250` / `500` | Alertas de créditos no período |
| `THRESHOLD_INPUT_TOKENS_WARN` / `_CRIT` | `3000000` / `6000000` | Alertas de tokens de entrada |
| `THRESHOLD_CONTEXT_WARN_PCT` / `_CRIT_PCT` | `70` / `90` | Alertas de pressão de contexto |
| `THRESHOLD_CACHE_EFFICIENCY_WARN` | `0.35` | Piso de reuso de cache |
| `THRESHOLD_COLD_RATIO_WARN` | `0.45` | Teto de entrada fria |
| `THRESHOLD_AI_CREDITS_BUDGET_WARN_PCT` / `_CRIT_PCT` | `75` / `90` | Alertas de ritmo do orçamento |
| `THRESHOLD_MODEL_CONCENTRATION` | `0.6` | Card de concentração de modelo |
| `THRESHOLD_PROMPT_IO_RATIO` | `20` | Card de prompt superdimensionado |
| `COACH_SCORE_BASE` | `55` | Linha de base do score de eficiência |
| `COACH_SCORE_CACHE_WEIGHT` | `45` | Recompensa do score por reuso de cache |
| `COACH_SCORE_COLD_PENALTY` | `30` | Penalidade do score por entrada fria |
| `COACH_SCORE_CONTEXT_PENALTY` | `15` | Penalidade do score por pressão de contexto |
| `COACH_SCORE_ERROR_PENALTY` | `10` | Penalidade do score por taxa de erros |
| `COACH_COLD_SAVINGS_FACTOR` | `0.5` | Fração dos créditos frios contada como economia |
| `COACH_ERROR_SAVINGS_FACTOR` | `0.15` | Fração dos créditos de erro contada como economia |
| `PLANNER_FRONTIER_OUTPUT_PRICE_MIN` | `20` | Piso de preço do tier frontier (US$/1M tokens de saída) |
| `PLANNER_COMPLEX_SESSION_MIN_TOOL_CALLS` | `5` | Régua de complexidade para justificar frontier |

A view **Settings** renderiza todas elas ao vivo, com o valor em vigor.

## 8. Regras de Honestidade

Este dashboard é apenas para o cenário do desenvolvedor local. Ele segue três regras para que o público certo receba os dados certos:

1. **Telemetria local nunca é apresentada como billing oficial.** Todo número de créditos é uma estimativa operacional a partir de sinais AIU do OpenTelemetry; os totais oficiais vêm do dashboard de uso do GitHub, dos exports de billing ou da API de métricas de uso do Copilot.
2. **Os dados de referência dos planos são rotulados com a fonte e continuam configuráveis**, porque allowances, promoções e preços do GitHub mudam.
3. **O planner nunca inventa precisão.** As projeções extrapolam a taxa de consumo observada; o rascunho de justificativa carrega junto os números, o método e a ressalva.
