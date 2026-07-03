---
title: "Guía de AI Credits y Planner de Frontier Cockpit"
description: "Guía paso a paso sobre GitHub Copilot AI Credits, allowances por plan, mejores prácticas de eficiencia de tokens y el Planner de workspace con justificación de overage y de modelos frontier."
author: "Frontier Cockpit Team"
date: "2026-07-03"
version: "1.2.0"
status: "approved"
language: "es"
tags: ["github-copilot", "ai-credits", "planner", "token-efficiency", "local"]
---

<!-- markdownlint-disable MD025 -->

# Guía de AI Credits y Planner de Frontier Cockpit

Esta es la traducción al español. La versión en inglés es la predeterminada y la fuente de la verdad: `FrontierCockpit_AiCreditsAndPlannerGuide_v1_0_0_2026-07-03_en.md`. También existe versión en portugués de Brasil (`..._pt-BR.md`).

Esta guía es para la persona desarrolladora que usa el dashboard local en `http://localhost:3300`. Explica cómo funciona la facturación por AI Credits de GitHub Copilot, cómo configurar tu licencia real en el cockpit, cómo trabajar dentro del allowance incluido y cómo usar la vista Planner para prever un proyecto y justificar una solicitud de overage o el uso de modelos frontier.

## Historial de Cambios

| Versión | Fecha | Autor | Cambios |
| --- | --- | --- | --- |
| 1.2.0 | 2026-07-03 | Frontier Cockpit Team | La sección 9 ganó los análisis completos del Cache Explorer (acierto de caché ponderado por tokens, pares de requests sanos, tokens recomputados evitables, clasificación de la causa de las rupturas de caché) y la nueva sección 10 cubre la gestión de contexto y el checklist de configuraciones OTel de VS Code. |
| 1.1.0 | 2026-07-03 | Frontier Cockpit Team | Añadida la sección 9: la vista Inspector (log de debug y explorador de caché por sesión) y la importación de exports del Agent Debug Logs de VS Code. |
| 1.0.0 | 2026-07-03 | Frontier Cockpit Team | Guía trilingüe inicial de AI Credits, eficiencia de tokens y la vista Planner. |

## Tabla de Contenidos

- [1. Cómo Funciona la Facturación de GitHub Copilot Hoy](#1-cómo-funciona-la-facturación-de-github-copilot-hoy)
- [2. AI Credits Incluidos Por Plan](#2-ai-credits-incluidos-por-plan)
- [3. Paso a Paso: Configura Tu Licencia en el Cockpit](#3-paso-a-paso-configura-tu-licencia-en-el-cockpit)
- [4. Paso a Paso: Trabaja Dentro de los Créditos Incluidos](#4-paso-a-paso-trabaja-dentro-de-los-créditos-incluidos)
- [5. Paso a Paso: Usa la Vista Planner](#5-paso-a-paso-usa-la-vista-planner)
- [6. Paso a Paso: Justifica Overage o Modelos Frontier](#6-paso-a-paso-justifica-overage-o-modelos-frontier)
- [7. Todos los Valores Configurables](#7-todos-los-valores-configurables)
- [8. Reglas de Honestidad](#8-reglas-de-honestidad)
- [9. Paso a Paso: Inspecciona una Sesión (Log de Debug y Explorador de Caché)](#9-paso-a-paso-inspecciona-una-sesión-log-de-debug-y-explorador-de-caché)
- [10. Paso a Paso: Gestiona el Contexto para Ahorrar Tokens y AI Credits](#10-paso-a-paso-gestiona-el-contexto-para-ahorrar-tokens-y-ai-credits)

## 1. Cómo Funciona la Facturación de GitHub Copilot Hoy

Desde el 1 de junio de 2026, todos los planes de GitHub Copilot usan facturación por uso, medida en GitHub AI Credits:

1. **1 AI Credit equivale a US$0,01.**
2. El uso se mide a partir de **tokens** (entrada, salida y caché) según la tarifa de API listada de cada modelo. Ya no existen multiplicadores de premium request; el sistema legado de premium requests fue retirado.
3. **El autocompletado de código y las next edit suggestions siempre están incluidos** y nunca consumen AI Credits.
4. **La selección automática de modelo (Auto) se factura con un 10% de descuento** en los costos de modelo en los planes de pago. Auto enruta cada prompt a un modelo capaz, reservando los modelos de razonamiento caros para problemas complejos.
5. Los allowances **se restablecen a las 00:00 UTC el primer día de cada mes** y los créditos no usados **no se acumulan**.
6. Cuando el allowance incluido se agota, los planes de pago pueden comprar **uso adicional (overage)** facturado a las tarifas de API por modelo al final del ciclo. Un admin de la organización debe habilitar los overages y puede definir presupuestos por usuario.

Fuentes: GitHub Docs — "Plans for GitHub Copilot", "Usage-based billing for individuals", "Usage-based billing for organizations and enterprises" y la publicación del blog de GitHub "GitHub Copilot is moving to usage-based billing". Los valores pueden cambiar; por eso el cockpit mantiene todos los números configurables.

## 2. AI Credits Incluidos Por Plan

Allowances de referencia publicados al momento de escribir:

| Plan | Precio | AI Credits incluidos / mes | Notas |
| --- | --- | --- | --- |
| Free | US$0 | No publicado (tratado como 0 localmente) | Solo selección automática, 2.000 completions |
| Pro | US$10 | 1.500 (1.000 base + 500 flex) | Individual |
| Pro+ | US$39 | 7.000 (3.900 base + 3.100 flex) | Individual |
| Max | US$100 | 20.000 (10.000 base + 10.000 flex) | Individual |
| Business | US$19/usuario | 1.900 por usuario, sin flex | Organización |
| Enterprise | US$39/usuario | 3.900 por usuario, sin flex | Organización |

**Sobre los "3.000 créditos" que quizás viste:** los clientes existentes de Business y Enterprise reciben un allowance promocional temporal del 1 de junio al 1 de septiembre de 2026 — 3.000 créditos por usuario en Business y 7.000 en Enterprise. No es el allowance estándar. El cockpit solo lo aplica cuando habilitas explícitamente `FRONTIER_AI_CREDITS_USE_PROMO=true`, y vuelve automáticamente a los valores estándar cuando la ventana se cierra.

El "flex allotment" de los planes individuales es un monto variable adicional sobre los créditos base, pensado para adaptarse a la evolución de los precios de los modelos.

## 3. Paso a Paso: Configura Tu Licencia en el Cockpit

1. Copia la plantilla de entorno si aún no lo hiciste:

   ```bash
   cp local-otel/workshop.env.example local-otel/workshop.env
   ```

2. Edita `local-otel/workshop.env` y configura tu licencia real:

   ```bash
   FRONTIER_COPILOT_PLAN="business"       # free | pro | pro+ | max | business | enterprise
   FRONTIER_COPILOT_SEATS="1"             # los planes por asiento multiplican el allowance
   FRONTIER_AI_CREDITS_USE_PROMO="false"  # true SOLO si eres cliente existente de Business/Enterprise dentro de la ventana promocional
   FRONTIER_AI_CREDITS_MONTHLY_ALLOWANCE="" # vacío lo deriva del plan y los asientos; un número lo sobrescribe
   ```

3. Reinicia el stack para que la API lea los valores:

   ```bash
   local-otel/stop-full-stack.sh && local-otel/start-full-stack.sh
   ```

   Windows PowerShell:

   ```powershell
   pwsh -File local-otel/stop-full-stack.ps1; pwsh -File local-otel/start-full-stack.ps1
   ```

4. Abre `http://localhost:3300` → **Credits**. El panel de presupuesto ahora muestra tu plan, el allowance incluido correcto y si el valor es `standard`, `promotional` o un `override`. El panel de comparación muestra los seis planes con tu plan resaltado.

5. Verifica desde la terminal (datos reales, no hardcoded):

   ```bash
   curl -s http://localhost:3300/api/plans | python3 -m json.tool
   ```

## 4. Paso a Paso: Trabaja Dentro de los Créditos Incluidos

El cockpit calcula cada consejo a partir de tu telemetría real contra umbrales que tú controlas. Las prácticas documentadas detrás de las reglas del coach:

1. **Prefiere la selección automática (Auto) para el trabajo rutinario.** Auto elige un modelo capaz por prompt y se factura con un 10% de descuento en los planes de pago. Reserva un modelo frontier específico para refactorizaciones complejas, arquitectura o depuración de varios pasos. Observa la vista **Coach**: la tarjeta "Try Auto model selection" aparece cuando los modelos de tier frontier dominan sesiones de baja complejidad.
2. **Mantén un único modelo por sesión.** Cambiar de modelo a mitad de sesión invalida la caché de prompt, y todo el contexto se reenvía y factura como entrada nueva. La alerta "Cache reuse is low" (umbral predeterminado: menos del 35% de lecturas de caché) es la señal.
3. **Inicia un chat nuevo al cambiar de tema.** De lo contrario, el historial antiguo se sigue reprocesando. La alerta "Context window is filling up" se dispara al 70% de utilización pico (crítico al 90%).
4. **Referencia archivos en lugar de pegarlos y adjunta solo lo que la tarea necesita.** La alerta "Cold context is high" se dispara cuando más del 45% de los tokens del prompt son entrada fría sin caché; el consejo "Trim oversized prompts" se dispara cuando la entrada supera a la salida por 20x.
5. **Da a los agentes tareas pequeñas y acotadas**, con una definición explícita de término. Una sesión larga de agente con un modelo frontier en muchos archivos cuesta más que una pregunta enfocada en el chat.
6. **Corrige la causa raíz antes de reintentar.** La alerta "Sessions reported errors" señala las tool calls fallidas en Aspire/Tempo; los bucles de reintento queman créditos sin resultado.
7. **Vigila el ritmo del presupuesto.** El panel de presupuesto proyecta el consumo de fin de mes desde tu tasa diaria real y avisa al 75% (crítico al 90%) del allowance incluido.

Todos los umbrales anteriores son guardrails locales de planificación — mira la vista **Settings** para la tabla completa con la variable de entorno exacta de cada uno.

## 5. Paso a Paso: Usa la Vista Planner

El Planner responde: *¿mi proyecto cabe en mis créditos incluidos, y necesito pedir más?*

1. Abre `http://localhost:3300` → **Planner**.
2. Elige el **workspace** con el selector global de la barra superior (o mantén "Todos los workspaces").
3. Elige el **lookback** (24h, 7d, 14d, 30d) — la ventana usada para medir tu tasa real de consumo. Usa al menos 7d cuando tengas una semana de telemetría.
4. Elige el **horizonte** (2, 4, 8 o 12 semanas) — hasta dónde proyectar el consumo del proyecto.
5. Lee el panel de previsión:
   - **Observado en el alcance**: AI Credits reales consumidos en el lookback para este workspace.
   - **Consumo diario**: créditos observados divididos por los días del lookback.
   - **Próximas N semanas**: la proyección del horizonte para este workspace.
   - **Proyección del mes (todo el trabajo)** y **Uso proyectado del allowance**: tu trayectoria mensual total contra el allowance incluido.
6. La línea de veredicto dice "el uso proyectado cabe dentro del allowance mensual incluido" o muestra el **overage proyectado en créditos y US$**.
7. Lee el panel **Estrategia de modelos**: tus créditos divididos por tier de precio (frontier / estándar / sin precio), el promedio de tool calls por tier y el veredicto — `frontier justificado`, `revisar uso de frontier`, `sin uso de frontier` o `sin datos aún`.

La clasificación de tier está orientada por datos: un modelo cuenta como frontier cuando su precio de salida registrado está en `PLANNER_FRONTIER_OUTPUT_PRICE_MIN` (predeterminado US$20 por 1M de tokens de salida) o por encima en el registro local de precios (`local-otel/seed-model-prices.sh`). Actualiza los precios del registro según tu fuente de la verdad.

## 6. Paso a Paso: Justifica Overage o Modelos Frontier

1. En la vista **Planner**, baja hasta **Borrador de justificación de presupuesto**.
2. Haz clic en **Copiar markdown**. El borrador contiene, desde telemetría real: tu plan y allowance incluido, los créditos y sesiones observados en el alcance, el consumo diario, las proyecciones de horizonte y mes, el overage proyectado en créditos y US$, y la justificación de la estrategia de modelos.
3. Pégalo en tu solicitud al tech lead o admin de la organización. Dos escenarios:
   - **Solicitud de overage**: el borrador cuantifica cuántos créditos adicionales necesita el ciclo y recuerda a quien aprueba que el overage se factura a las tarifas de API por modelo y requiere que un admin habilite el uso adicional con presupuesto por usuario.
   - **Justificación de modelo frontier**: cuando las sesiones frontier son genuinamente complejas (promedio de tool calls en el umbral de complejidad o por encima), el borrador defiende mantener modelos frontier en ese trabajo. Cuando no lo son, lista las sesiones frontier de baja complejidad y los créditos que podrían moverse a Auto — en ese caso la recomendación honesta es mover el trabajo rutinario a Auto antes de pedir más presupuesto.
4. El borrador siempre cierra con la aclaración de que la telemetría local es una estimación operativa y que los números oficiales vienen del dashboard de uso de GitHub o de los exports de billing. Nunca elimines esa nota — quien aprueba necesita saber qué está mirando.

## 7. Todos los Valores Configurables

Nada en los consejos, el presupuesto o la matemática del planner es hardcoded. Define estas variables en el servicio `frontier-dashboard-api` (vía `workshop.env`/`client.env` o el environment del compose) y reinicia:

| Variable | Predeterminado | Controla |
| --- | --- | --- |
| `FRONTIER_COPILOT_PLAN` | `business` | Plan usado en el allowance y en los paneles de plan |
| `FRONTIER_COPILOT_SEATS` | `1` | Multiplicador de asientos en planes por asiento |
| `FRONTIER_AI_CREDITS_USE_PROMO` | `false` | Adhesión al allowance promocional de transición |
| `FRONTIER_AI_CREDITS_MONTHLY_ALLOWANCE` | derivado | Override directo del pool mensual de créditos |
| `FRONTIER_AI_CREDITS_PROMO_START` / `_END` | `2026-06-01` / `2026-09-01` | Fechas de la ventana promocional |
| `AI_CREDIT_USD` | `0.01` | Valor en US$ de un AI Credit |
| `AUTO_MODEL_SELECTION_DISCOUNT` | `0.10` | Descuento de Auto usado en los ahorros what-if |
| `THRESHOLD_AI_CREDITS_WARN` / `_CRIT` | `250` / `500` | Alertas de créditos en el período |
| `THRESHOLD_INPUT_TOKENS_WARN` / `_CRIT` | `3000000` / `6000000` | Alertas de tokens de entrada |
| `THRESHOLD_CONTEXT_WARN_PCT` / `_CRIT_PCT` | `70` / `90` | Alertas de presión de contexto |
| `THRESHOLD_CACHE_EFFICIENCY_WARN` | `0.35` | Piso de reutilización de caché |
| `THRESHOLD_COLD_RATIO_WARN` | `0.45` | Techo de entrada fría |
| `THRESHOLD_AI_CREDITS_BUDGET_WARN_PCT` / `_CRIT_PCT` | `75` / `90` | Alertas de ritmo del presupuesto |
| `THRESHOLD_MODEL_CONCENTRATION` | `0.6` | Tarjeta de concentración de modelo |
| `THRESHOLD_PROMPT_IO_RATIO` | `20` | Tarjeta de prompt sobredimensionado |
| `COACH_SCORE_BASE` | `55` | Línea base del score de eficiencia |
| `COACH_SCORE_CACHE_WEIGHT` | `45` | Recompensa del score por reutilización de caché |
| `COACH_SCORE_COLD_PENALTY` | `30` | Penalización del score por entrada fría |
| `COACH_SCORE_CONTEXT_PENALTY` | `15` | Penalización del score por presión de contexto |
| `COACH_SCORE_ERROR_PENALTY` | `10` | Penalización del score por tasa de errores |
| `COACH_COLD_SAVINGS_FACTOR` | `0.5` | Fracción de los créditos fríos contada como ahorro |
| `COACH_ERROR_SAVINGS_FACTOR` | `0.15` | Fracción de los créditos de error contada como ahorro |
| `PLANNER_FRONTIER_OUTPUT_PRICE_MIN` | `20` | Piso de precio del tier frontier (US$/1M tokens de salida) |
| `PLANNER_COMPLEX_SESSION_MIN_TOOL_CALLS` | `5` | Vara de complejidad para justificar frontier |

La vista **Settings** muestra todas en vivo, con el valor vigente.

## 8. Reglas de Honestidad

Este dashboard es solo para el escenario del desarrollador local. Sigue tres reglas para que la audiencia correcta reciba los datos correctos:

1. **La telemetría local nunca se presenta como facturación oficial.** Toda cifra de créditos es una estimación operativa desde señales AIU de OpenTelemetry; los totales oficiales vienen del dashboard de uso de GitHub, los exports de billing o la API de métricas de uso de Copilot.
2. **Los datos de referencia de los planes se etiquetan con su fuente y siguen siendo configurables**, porque los allowances, promociones y precios de GitHub cambian.
3. **El planner nunca inventa precisión.** Las proyecciones extrapolan la tasa de consumo observada; el borrador de justificación lleva juntos los números, el método y la aclaración.

## 9. Paso a Paso: Inspecciona una Sesión (Log de Debug y Explorador de Caché)

La vista **Inspector** ofrece, por workspace, las mismas señales del panel Agent Debug Log de VS Code y de su Cache Explorer — construidas desde el almacén local de traces, con el contenido crudo sin salir nunca de la máquina.

1. Abre `http://localhost:3300` → **Inspector**.
2. Elige una sesión en el selector (las sesiones se etiquetan por workspace, modelo y créditos) o llega desde la vista Sessions con un trace id.
3. Lee los **tiles de resumen** (como la Summary view de VS Code): duración total, requests LLM, turnos de agente, tool calls, tokens entrada/salida, tasa de acierto de caché, rupturas de caché, **pares de requests sanos**, **recomputo evitable** y errores. Debajo de los tiles, el titular ponderado por tokens es igual al del Cache Explorer de VS Code: "X de Y tokens de caché de prompt se sirvieron desde la caché en N requests LLM".
4. Lee la tabla del **Explorador de caché**: una fila por request LLM con su tasa de acierto (lecturas de caché sobre lecturas más escrituras). Una fila roja marca dónde se rompió el prefijo de la caché de prompt, y la columna de señal nombra la **causa**: `cambio de modelo`, `el system prompt cambió`, `el catálogo de herramientas cambió` o `deriva de prefijo`. Los cambios de modelo siempre son detectables; clasificar cambios de system prompt y de catálogo de herramientas requiere la configuración de VS Code **Chat > Agent Host > Otel: Capture Content** (segura en este stack local — la API expone solo firmas cortas del contenido, nunca el texto). Todo lo posterior a una ruptura se volvió a facturar como entrada nueva.
5. Lee el **Log de eventos**: la línea de tiempo cronológica de spans (requests LLM, turnos de agente, tool calls, hooks) con offsets, duraciones, tokens por evento y errores. Para los payloads completos de atributos, abre el trace id en Aspire o en Grafana Tempo Explore.
6. Aplica las **prácticas de mantener la caché caliente** mostradas en la vista: fija modelo/herramientas antes de empezar, mantén estables los archivos de instrucciones, añade el contexto volátil al final y empieza de cero tras una pausa.

Para analizar una sesión exportada de VS Code (panel Agent Debug Logs → icono Export → OTLP JSON), impórtala desde dentro del repositorio del proyecto para atribuirla al workspace:

```bash
local-otel/import-agent-debug-session.sh sesion-exportada.json
```

Windows PowerShell:

```powershell
pwsh -ExecutionPolicy Bypass -File local-otel/import-agent-debug-session.ps1 -Path sesion-exportada.json
```

La sesión importada es inspeccionable por trace id de inmediato y aparece en las listas de sesiones tras la siguiente pasada del materializador (hasta 5 minutos).

## 10. Paso a Paso: Gestiona el Contexto para Ahorrar Tokens y AI Credits

El contexto es la principal palanca de costo, latencia y calidad de las respuestas. Estos pasos siguen la guía de VS Code "Manage context for AI" y están conectados al cockpit con telemetría real.

1. **Revisa primero las configuraciones OTel de VS Code.** Dos emisores envían telemetría y cada uno tiene su propio endpoint. La configuración que más se olvida es `Chat > Agent Host > Otel: Otlp Endpoint` — sin ella los spans del agent host nunca llegan al stack. El checklist completo (con los valores para este stack) está en `local-otel/README.md`, sección "VS Code OTel settings checklist". Todo cambio exige recargar la ventana.
2. **Adjunta con precisión usando #-mentions.** Escribe `#` para adjuntar archivos, carpetas o símbolos específicos. Reserva `#codebase` para preguntas de descubrimiento ("¿dónde se maneja X?"); para ediciones enfocadas, usa #-mention en los dos o tres archivos que importan. Las alertas de entrada fría en la Overview bajan cuando lo haces.
3. **Vigila el control de la ventana de contexto** en el campo del chat: muestra cuánto de la ventana del modelo está en uso y los AI Credits de la sesión; pasa el cursor para ver el desglose de tokens. El cockpit lo refleja por workspace — la vista Workspaces tiene la columna **Pico de contexto**, coloreada por los guardrails de 70%/90%.
4. **Compacta deliberadamente.** Ejecuta `/compact` en puntos de control naturales, opcionalmente con instrucciones de foco (por ejemplo `/compact céntrate en las decisiones de schema`). El Coach dispara "Compacta antes de que la ventana se llene" cuando el pico de contexto cruza el umbral de aviso con cero compactaciones en el rango, y "Acota el alcance de las sesiones" cuando se ejecutaron más compactaciones que el guardrail `THRESHOLD_CONTEXT_COMPACTIONS_INFO` (por defecto 3) — la compactación automática frecuente significa que las sesiones superan la ventana, y cada compactación también reinicia la caché de prompt.
5. **Una sesión por tarea.** Inicia un chat nuevo para trabajo no relacionado; las conversaciones largas acumulan contexto obsoleto y lo pagan en cada request.
6. **Verifica el efecto en el Inspector.** El contexto estable aparece como pares de requests sanos y un acierto de caché ponderado por tokens más alto; el contexto inestable aparece como rupturas por deriva de prefijo y tokens recomputados evitables.
7. **Lee el Playbook de gestión de contexto** en la vista Coach — muestra estas prácticas con tu pico de contexto y recuento de compactaciones observados en el rango seleccionado.
