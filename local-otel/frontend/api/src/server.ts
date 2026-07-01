import http from "node:http";
import net from "node:net";
import { URL } from "node:url";

type ServiceStatus = "ok" | "degraded" | "unavailable";
type MetricStatus = "ok" | "unavailable";

interface ServiceHealth {
  id: string;
  name: string;
  status: ServiceStatus;
  detail: string;
  checkedAt: string;
}

interface PrometheusVectorResult {
  metric: Record<string, string>;
  value: [number, string];
}

interface PrometheusResponse {
  status: "success" | "error";
  data?: {
    resultType: string;
    result: PrometheusVectorResult[];
  };
  error?: string;
  errorType?: string;
}

interface ScalarMetric {
  status: MetricStatus;
  value: number | null;
  query: string;
  message?: string;
}

interface SeriesPoint {
  labels: Record<string, string>;
  value: number;
}

interface SeriesMetric {
  status: MetricStatus;
  points: SeriesPoint[];
  query: string;
  message?: string;
}

const port = Number.parseInt(process.env.PORT ?? "8080", 10);
const prometheusUrl = process.env.PROMETHEUS_URL ?? "http://prometheus:9090";
const tempoUrl = process.env.TEMPO_URL ?? "http://tempo:3200";
const lokiUrl = process.env.LOKI_URL ?? "http://loki:3100";
const grafanaInternalUrl = process.env.GRAFANA_URL ?? "http://grafana:3000";
const aspireInternalUrl = process.env.ASPIRE_URL ?? "http://aspire-dashboard:18888";
const collectorMetricsUrl = process.env.COLLECTOR_METRICS_URL ?? "http://otel-collector:9464/metrics";
const postgresHost = process.env.POSTGRES_HOST ?? "postgres";
const postgresPort = Number.parseInt(process.env.POSTGRES_PORT ?? "5432", 10);
const publicGrafanaUrl = process.env.PUBLIC_GRAFANA_URL ?? "http://localhost:3000";
const publicAspireUrl = process.env.PUBLIC_ASPIRE_URL ?? "http://localhost:18888";
const publicPrometheusUrl = process.env.PUBLIC_PROMETHEUS_URL ?? "http://localhost:9090";
const publicTempoUrl = process.env.PUBLIC_TEMPO_URL ?? "http://localhost:3200";
const publicLokiUrl = process.env.PUBLIC_LOKI_URL ?? "http://localhost:3100";
const allowedRanges = new Set(["1h", "6h", "24h", "7d"]);

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Local warning thresholds. These are local planning guardrails, not official
// GitHub limits or AI Credit allowances. Override any of them with environment
// variables when you want stricter or looser local alerts.
const thresholds = {
  aiCreditsWarn: numberFromEnv("THRESHOLD_AI_CREDITS_WARN", 250),
  aiCreditsCrit: numberFromEnv("THRESHOLD_AI_CREDITS_CRIT", 500),
  inputTokensWarn: numberFromEnv("THRESHOLD_INPUT_TOKENS_WARN", 3_000_000),
  inputTokensCrit: numberFromEnv("THRESHOLD_INPUT_TOKENS_CRIT", 6_000_000),
  contextWarnPct: numberFromEnv("THRESHOLD_CONTEXT_WARN_PCT", 70),
  contextCritPct: numberFromEnv("THRESHOLD_CONTEXT_CRIT_PCT", 90),
  cacheEfficiencyWarn: numberFromEnv("THRESHOLD_CACHE_EFFICIENCY_WARN", 0.35),
  coldRatioWarn: numberFromEnv("THRESHOLD_COLD_RATIO_WARN", 0.45),
  budgetWarnPct: numberFromEnv("THRESHOLD_AI_CREDITS_BUDGET_WARN_PCT", 75),
  budgetCritPct: numberFromEnv("THRESHOLD_AI_CREDITS_BUDGET_CRIT_PCT", 90)
};

function lowerFromEnv(name: string, fallback: string): string {
  return stringFromEnv(name, fallback).toLowerCase();
}

// GitHub Copilot usage-based billing is measured in GitHub AI Credits. These
// defaults follow the current GitHub documentation and remain configurable
// because plan allowances and promotional periods can change.
// Sources: GitHub Copilot usage-based billing for individuals and for
// organizations and enterprises.
const standardAiCreditsByPlan: Record<string, number> = {
  pro: 1500,
  "pro+": 7000,
  max: 20000,
  business: 1900,
  enterprise: 3900
};

const promotionalAiCreditsByPlan: Record<string, number> = {
  business: 3000,
  enterprise: 7000
};

const copilotPlan = lowerFromEnv("FRONTIER_COPILOT_PLAN", "business");
const copilotSeats = numberFromEnv("FRONTIER_COPILOT_SEATS", 1);
const usePromotionalAllowance = lowerFromEnv("FRONTIER_AI_CREDITS_USE_PROMO", "true") === "true";
const defaultAiCreditsPerSeat =
  (usePromotionalAllowance ? promotionalAiCreditsByPlan[copilotPlan] : undefined) ??
  standardAiCreditsByPlan[copilotPlan] ??
  standardAiCreditsByPlan.business;
const aiCreditsMonthlyAllowance = numberFromEnv(
  "FRONTIER_AI_CREDITS_MONTHLY_ALLOWANCE",
  defaultAiCreditsPerSeat * copilotSeats
);

// Participant identity makes the local cockpit a reusable workshop template.
// Each participant sets these via environment variables (see workshop.env).
// They only label the local dashboard chrome and are never sent to Azure and
// are not official GitHub billing identity.
interface ParticipantIdentity {
  name: string;
  role: string;
  email: string;
  team: string;
  customerName: string;
  dashboardTitle: string;
}

function stringFromEnv(name: string, fallback: string): string {
  const raw = (process.env[name] ?? "").trim();
  return raw.length > 0 ? raw : fallback;
}

function participantIdentity(): ParticipantIdentity {
  return {
    name: stringFromEnv("FRONTIER_PARTICIPANT_NAME", "Workshop Participant"),
    role: stringFromEnv("FRONTIER_PARTICIPANT_ROLE", "Developer"),
    email: stringFromEnv("FRONTIER_PARTICIPANT_EMAIL", ""),
    team: stringFromEnv("FRONTIER_PARTICIPANT_TEAM", ""),
    customerName: stringFromEnv("FRONTIER_CUSTOMER_NAME", ""),
    dashboardTitle: stringFromEnv("FRONTIER_DASHBOARD_TITLE", "Frontier Developer Cockpit")
  };
}

interface HistoryShape {
  stepSeconds: number;
  windowLiteral: string;
}

const historyShapeByRange: Record<string, HistoryShape> = {
  "1h": { stepSeconds: 300, windowLiteral: "5m" },
  "6h": { stepSeconds: 900, windowLiteral: "15m" },
  "24h": { stepSeconds: 3600, windowLiteral: "1h" },
  "7d": { stepSeconds: 21600, windowLiteral: "6h" }
};

const rangeToSeconds: Record<string, number> = {
  "1h": 3600,
  "6h": 21600,
  "24h": 86400,
  "7d": 604800
};

function jsonResponse(response: http.ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function textResponse(response: http.ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(body);
}

function errorResponse(response: http.ServerResponse, statusCode: number, message: string): void {
  jsonResponse(response, statusCode, { error: message });
}

function rangeFromUrl(url: URL): string {
  const requested = url.searchParams.get("range") ?? "1h";
  return allowedRanges.has(requested) ? requested : "1h";
}

function repoFromUrl(url: URL): string | null {
  const repo = url.searchParams.get("repo");
  if (!repo || repo === "all") {
    return null;
  }
  return repo;
}

function escapePrometheusLabel(value: string): string {
  const backslash = String.fromCodePoint(92);
  const quote = String.fromCodePoint(34);
  return value
    .replaceAll(backslash, `${backslash}${backslash}`)
    .replaceAll(quote, `${backslash}${quote}`)
    .replaceAll("\n", `${backslash}n`);
}

function repoMatcher(repo: string | null): string {
  return repo ? `,repo="${escapePrometheusLabel(repo)}"` : "";
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 4000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function queryPrometheus(query: string): Promise<PrometheusVectorResult[]> {
  const queryUrl = new URL("/api/v1/query", prometheusUrl);
  queryUrl.searchParams.set("query", query);
  const response = await fetchWithTimeout(queryUrl.toString());
  if (!response.ok) {
    throw new Error(`Prometheus returned HTTP ${response.status}`);
  }
  const payload = (await response.json()) as PrometheusResponse;
  if (payload.status !== "success" || !payload.data) {
    throw new Error(payload.error ?? "Prometheus query failed");
  }
  if (payload.data.resultType !== "vector") {
    throw new Error(`Prometheus returned ${payload.data.resultType}, expected vector`);
  }
  return payload.data.result;
}

interface PrometheusMatrixResult {
  metric: Record<string, string>;
  values: [number, string][];
}

async function queryPrometheusRange(
  query: string,
  startSec: number,
  endSec: number,
  stepSec: number
): Promise<PrometheusMatrixResult[]> {
  const queryUrl = new URL("/api/v1/query_range", prometheusUrl);
  queryUrl.searchParams.set("query", query);
  queryUrl.searchParams.set("start", String(startSec));
  queryUrl.searchParams.set("end", String(endSec));
  queryUrl.searchParams.set("step", String(stepSec));
  const response = await fetchWithTimeout(queryUrl.toString(), {}, 6000);
  if (!response.ok) {
    throw new Error(`Prometheus returned HTTP ${response.status}`);
  }
  const payload = (await response.json()) as {
    status: string;
    data?: { resultType: string; result: PrometheusMatrixResult[] };
    error?: string;
  };
  if (payload.status !== "success" || !payload.data) {
    throw new Error(payload.error ?? "Prometheus range query failed");
  }
  return payload.data.result;
}

function numericValue(result: PrometheusVectorResult): number | null {
  const value = Number.parseFloat(result.value[1]);
  return Number.isFinite(value) ? value : null;
}

async function scalarMetric(query: string): Promise<ScalarMetric> {
  try {
    const results = await queryPrometheus(query);
    const firstValue = results.length > 0 ? numericValue(results[0]) : null;
    return {
      status: firstValue === null ? "unavailable" : "ok",
      value: firstValue,
      query,
      message: firstValue === null ? "No matching local telemetry is available for the selected range." : undefined
    };
  } catch (error) {
    return {
      status: "unavailable",
      value: null,
      query,
      message: error instanceof Error ? error.message : "Prometheus query failed"
    };
  }
}

async function seriesMetric(query: string): Promise<SeriesMetric> {
  try {
    const results = await queryPrometheus(query);
    const points = results.flatMap((result) => {
      const value = numericValue(result);
      return value === null ? [] : [{ labels: result.metric, value }];
    });
    return {
      status: points.length > 0 ? "ok" : "unavailable",
      points,
      query,
      message: points.length > 0 ? undefined : "No matching local telemetry is available for the selected range."
    };
  } catch (error) {
    return {
      status: "unavailable",
      points: [],
      query,
      message: error instanceof Error ? error.message : "Prometheus query failed"
    };
  }
}

async function httpHealth(id: string, name: string, url: string): Promise<ServiceHealth> {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetchWithTimeout(url, { method: "GET" }, 2500);
    if (response.ok) {
      return { id, name, status: "ok", detail: `HTTP ${response.status}`, checkedAt };
    }
    return { id, name, status: "degraded", detail: `HTTP ${response.status}`, checkedAt };
  } catch (error) {
    return {
      id,
      name,
      status: "unavailable",
      detail: error instanceof Error ? error.message : "Endpoint did not respond",
      checkedAt
    };
  }
}

async function tcpHealth(id: string, name: string, host: string, checkPort: number): Promise<ServiceHealth> {
  const checkedAt = new Date().toISOString();
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port: checkPort });
    const finish = (status: ServiceStatus, detail: string): void => {
      socket.destroy();
      resolve({ id, name, status, detail, checkedAt });
    };
    socket.setTimeout(2500);
    socket.once("connect", () => finish("ok", `TCP ${host}:${checkPort} reachable`));
    socket.once("timeout", () => finish("unavailable", `TCP ${host}:${checkPort} timed out`));
    socket.once("error", (error) => finish("unavailable", error.message));
  });
}

async function registryHealth(): Promise<ServiceHealth> {
  const checkedAt = new Date().toISOString();
  try {
    const prices = await queryPrometheus("count(copilot_model_price_usd_per_million_ratio)");
    const priceCount = prices.length > 0 ? numericValue(prices[0]) ?? 0 : 0;
    if (priceCount > 0) {
      return {
        id: "copilot-otel-registry",
        name: "Model price registry sidecar",
        status: "ok",
        detail: `${priceCount} model price series are live for local AI Credits estimates.`,
        checkedAt
      };
    }
    return {
      id: "copilot-otel-registry",
      name: "Model price registry sidecar",
      status: "degraded",
      detail: "Model price metrics are not live yet in Prometheus.",
      checkedAt
    };
  } catch (error) {
    return {
      id: "copilot-otel-registry",
      name: "Model price registry sidecar",
      status: "unavailable",
      detail: error instanceof Error ? error.message : "Model price registry metrics could not be checked.",
      checkedAt
    };
  }
}

async function stackHealth(): Promise<ServiceHealth[]> {
  return Promise.all([
    httpHealth("otel-collector", "OpenTelemetry Collector", collectorMetricsUrl),
    httpHealth("prometheus", "Prometheus", `${prometheusUrl}/-/ready`),
    httpHealth("grafana", "Grafana", `${grafanaInternalUrl}/api/health`),
    httpHealth("tempo", "Tempo", `${tempoUrl}/ready`),
    httpHealth("loki", "Loki", `${lokiUrl}/ready`),
    tcpHealth("postgres", "PostgreSQL", postgresHost, postgresPort),
    httpHealth("aspire-dashboard", "Aspire Dashboard", aspireInternalUrl),
    registryHealth(),
    Promise.resolve({
      id: "frontier-dashboard-api",
      name: "Frontier Dashboard API",
      status: "ok" as const,
      detail: "API process is serving requests.",
      checkedAt: new Date().toISOString()
    })
  ]);
}

async function repositories(range = "24h"): Promise<string[]> {
  try {
    const query = `max by (repo, workspace_name) (max_over_time(copilot_real_session_input_tokens_ratio{usage_scope="workspace_real",workspace_kind="git",workspace_name!="unknown",repo!="",repo!="unknown"}[${range}]))`;
    const results = await queryPrometheus(query);
    const byWorkspace = new Map<string, string>();
    for (const result of results) {
      const workspaceName = result.metric.workspace_name || result.metric.repo;
      const repo = result.metric.repo;
      if (!workspaceName || !repo) {
        continue;
      }
      const current = byWorkspace.get(workspaceName);
      const repoLooksRemote = repo.startsWith("https://") || repo.startsWith("git@");
      const currentLooksRemote = current?.startsWith("https://") || current?.startsWith("git@");
      if (!current || (repoLooksRemote && !currentLooksRemote)) {
        byWorkspace.set(workspaceName, repo);
      }
    }
    return [...new Set(byWorkspace.values())].sort((left, right) => left.localeCompare(right));
  } catch (error) {
    console.warn("Repository list is unavailable.", error instanceof Error ? error.message : error);
    return [];
  }
}

function realWorkspaceSelector(repoLabelMatcher: string): string {
  return `usage_scope="workspace_real",workspace_kind="git",workspace_name!="unknown",repo!="",repo!="unknown"${repoLabelMatcher}`;
}

function realSessionSum(metric: string, range: string, repoLabelMatcher: string): string {
  return `sum(max by (trace_id) (max_over_time(copilot_real_session_${metric}_ratio{${realWorkspaceSelector(repoLabelMatcher)}}[${range}])))`;
}

interface WorkspaceUsage {
  repo: string;
  repoShort: string;
  branch: string;
  workspaceName: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  coldInputTokens: number;
  aiCredits: number;
  sessions: number;
  cacheEfficiency: number | null;
  coldRatio: number | null;
}

type NumericWorkspaceField =
  | "inputTokens"
  | "outputTokens"
  | "cacheReadTokens"
  | "cacheCreationTokens"
  | "coldInputTokens"
  | "aiCredits"
  | "sessions";

function shortRepoName(repo: string): string {
  if (!repo || repo === "unknown") {
    return "unattributed";
  }
  const cleaned = repo.replace(/\.git$/, "");
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts.at(-2)}/${parts.at(-1)}`;
  }
  return parts.at(-1) ?? repo;
}

async function workspaceBreakdown(
  range: string
): Promise<{ status: MetricStatus; items: WorkspaceUsage[]; message?: string }> {
  const selector = realWorkspaceSelector("");
  const groupBy = "sum by (workspace_path_hash, branch, workspace_name)";
  const base = (metric: string) =>
    `${groupBy} (max by (trace_id, workspace_path_hash, branch, workspace_name) (max_over_time(copilot_real_session_${metric}_ratio{${selector}}[${range}])))`;
  const sessionsQuery = `count by (workspace_path_hash, branch, workspace_name) (max by (trace_id, workspace_path_hash, branch, workspace_name) (max_over_time(copilot_real_session_input_tokens_ratio{${selector}}[${range}])))`;
  try {
    const [input, output, cacheRead, cacheCreation, cold, aiu, sessions] = await Promise.all([
      queryPrometheus(base("input_tokens")),
      queryPrometheus(base("output_tokens")),
      queryPrometheus(base("cache_read_tokens")),
      queryPrometheus(base("cache_creation_tokens")),
      queryPrometheus(base("cold_input_tokens")),
      queryPrometheus(base("nano_aiu")),
      queryPrometheus(sessionsQuery)
    ]);
    const map = new Map<string, WorkspaceUsage>();
    const keyOf = (metric: Record<string, string>) =>
      `${metric.workspace_path_hash ?? ""}|${metric.branch ?? ""}|${metric.workspace_name ?? ""}`;
    const ensure = (metric: Record<string, string>): WorkspaceUsage => {
      const key = keyOf(metric);
      let entry = map.get(key);
      if (!entry) {
        const repo = metric.workspace_name ?? "unknown";
        entry = {
          repo,
          repoShort: repo,
          branch: metric.branch ?? "",
          workspaceName: metric.workspace_name ?? "",
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          coldInputTokens: 0,
          aiCredits: 0,
          sessions: 0,
          cacheEfficiency: null,
          coldRatio: null
        };
        map.set(key, entry);
      }
      return entry;
    };
    const apply = (results: PrometheusVectorResult[], field: NumericWorkspaceField, scale = 1) => {
      for (const result of results) {
        const value = numericValue(result);
        if (value === null) {
          continue;
        }
        ensure(result.metric)[field] = value * scale;
      }
    };
    apply(input, "inputTokens");
    apply(output, "outputTokens");
    apply(cacheRead, "cacheReadTokens");
    apply(cacheCreation, "cacheCreationTokens");
    apply(cold, "coldInputTokens");
    apply(aiu, "aiCredits", 1 / 1e9);
    apply(sessions, "sessions");
    const items = [...map.values()]
      .map((entry) => {
        const promptTotal = entry.cacheReadTokens + entry.cacheCreationTokens + entry.coldInputTokens;
        entry.cacheEfficiency = promptTotal > 0 ? entry.cacheReadTokens / promptTotal : null;
        entry.coldRatio = promptTotal > 0 ? entry.coldInputTokens / promptTotal : null;
        return entry;
      })
      .sort((a, b) => b.aiCredits - a.aiCredits || b.inputTokens - a.inputTokens);
    return {
      status: items.length ? "ok" : "unavailable",
      items,
      message: items.length
        ? undefined
        : "No workspace-attributed telemetry is available yet. Open a Git repository and run a Copilot session."
    };
  } catch (error) {
    return {
      status: "unavailable",
      items: [],
      message: error instanceof Error ? error.message : "Workspace breakdown failed"
    };
  }
}

interface HistoryPoint {
  t: string;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  coldInputTokens: number | null;
  aiCredits: number | null;
}

type NumericHistoryField = "inputTokens" | "outputTokens" | "cacheReadTokens" | "coldInputTokens" | "aiCredits";

async function usageHistory(
  range: string,
  repoLabelMatcher: string
): Promise<{ status: MetricStatus; stepSeconds: number; points: HistoryPoint[]; message?: string }> {
  const shape = historyShapeByRange[range] ?? historyShapeByRange["1h"];
  const end = Math.floor(Date.now() / 1000);
  const start = end - (rangeToSeconds[range] ?? 3600);
  const window = shape.windowLiteral;
  const selector = realWorkspaceSelector(repoLabelMatcher);
  const buildQuery = (metric: string, toCredits = false) =>
    `sum(max by (trace_id) (max_over_time(copilot_real_session_${metric}_ratio{${selector}}[${window}])))${toCredits ? " / 1e9" : ""}`;
  try {
    const [input, output, cacheRead, cold, aiu] = await Promise.all([
      queryPrometheusRange(buildQuery("input_tokens"), start, end, shape.stepSeconds),
      queryPrometheusRange(buildQuery("output_tokens"), start, end, shape.stepSeconds),
      queryPrometheusRange(buildQuery("cache_read_tokens"), start, end, shape.stepSeconds),
      queryPrometheusRange(buildQuery("cold_input_tokens"), start, end, shape.stepSeconds),
      queryPrometheusRange(buildQuery("nano_aiu", true), start, end, shape.stepSeconds)
    ]);
    const byTimestamp = new Map<number, HistoryPoint>();
    const ensure = (timestamp: number): HistoryPoint => {
      let point = byTimestamp.get(timestamp);
      if (!point) {
        point = {
          t: new Date(timestamp * 1000).toISOString(),
          inputTokens: null,
          outputTokens: null,
          cacheReadTokens: null,
          coldInputTokens: null,
          aiCredits: null
        };
        byTimestamp.set(timestamp, point);
      }
      return point;
    };
    const apply = (results: PrometheusMatrixResult[], field: NumericHistoryField) => {
      const first = results[0];
      if (!first) {
        return;
      }
      for (const [timestamp, raw] of first.values) {
        const value = Number.parseFloat(raw);
        if (!Number.isFinite(value)) {
          continue;
        }
        ensure(timestamp)[field] = value;
      }
    };
    apply(input, "inputTokens");
    apply(output, "outputTokens");
    apply(cacheRead, "cacheReadTokens");
    apply(cold, "coldInputTokens");
    apply(aiu, "aiCredits");
    const points = [...byTimestamp.values()].sort((a, b) => a.t.localeCompare(b.t));
    const hasData = points.some((point) => (point.inputTokens ?? 0) > 0 || (point.aiCredits ?? 0) > 0);
    return {
      status: hasData ? "ok" : "unavailable",
      stepSeconds: shape.stepSeconds,
      points,
      message: hasData
        ? undefined
        : "Local history is still sparse for this range. Run more Copilot sessions or widen the range."
    };
  } catch (error) {
    return {
      status: "unavailable",
      stepSeconds: shape.stepSeconds,
      points: [],
      message: error instanceof Error ? error.message : "Usage history failed"
    };
  }
}

type AlertSeverity = "info" | "warning" | "critical";

interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  value: number | null;
  threshold: number | null;
}

function tieredAlert(
  id: string,
  value: number | null,
  warn: number,
  crit: number,
  copy: (severity: "warning" | "critical", threshold: number) => { title: string; detail: string }
): Alert | null {
  if (value === null) {
    return null;
  }
  if (value >= crit) {
    return { id, severity: "critical", value, threshold: crit, ...copy("critical", crit) };
  }
  if (value >= warn) {
    return { id, severity: "warning", value, threshold: warn, ...copy("warning", warn) };
  }
  return null;
}

function aiCreditsAlert(value: number | null): Alert | null {
  return tieredAlert("ai-credits", value, thresholds.aiCreditsWarn, thresholds.aiCreditsCrit, (severity, threshold) => ({
    title: severity === "critical" ? "AI credits consumption is very high" : "AI credits consumption is rising",
    detail: `Local AI credits in range reached ${(value ?? 0).toFixed(1)}, above the ${severity} guardrail of ${threshold}.`
  }));
}

function inputTokensAlert(value: number | null): Alert | null {
  return tieredAlert("input-tokens", value, thresholds.inputTokensWarn, thresholds.inputTokensCrit, (severity, threshold) => ({
    title: severity === "critical" ? "Input token volume is very high" : "Input token volume is rising",
    detail: `Input tokens in range reached ${Math.round(value ?? 0).toLocaleString()}, above the ${severity} guardrail of ${threshold.toLocaleString()}.`
  }));
}

function contextAlert(value: number | null): Alert | null {
  return tieredAlert("context", value, thresholds.contextWarnPct, thresholds.contextCritPct, (severity, threshold) => ({
    title: severity === "critical" ? "Context window is nearly full" : "Context window is filling up",
    detail: `Peak context utilization reached ${(value ?? 0).toFixed(0)}%, above the ${severity} guardrail of ${threshold}%.`
  }));
}

function cacheEfficiencyAlert(value: number | null): Alert | null {
  if (value === null || value >= thresholds.cacheEfficiencyWarn) {
    return null;
  }
  return {
    id: "cache-efficiency",
    severity: "warning",
    title: "Cache reuse is low",
    detail: `Only ${(value * 100).toFixed(0)}% of prompt tokens came from cache reads, below the ${(thresholds.cacheEfficiencyWarn * 100).toFixed(0)}% guardrail. Low reuse increases AI credit cost.`,
    value,
    threshold: thresholds.cacheEfficiencyWarn
  };
}

function coldRatioAlert(value: number | null): Alert | null {
  if (value === null || value <= thresholds.coldRatioWarn) {
    return null;
  }
  return {
    id: "cold-context",
    severity: "warning",
    title: "Cold context is high",
    detail: `${(value * 100).toFixed(0)}% of prompt tokens were uncached cold input, above the ${(thresholds.coldRatioWarn * 100).toFixed(0)}% guardrail. Reusing context lowers cost.`,
    value,
    threshold: thresholds.coldRatioWarn
  };
}

function attributionAlert(value: number | null): Alert | null {
  if ((value ?? 0) <= 0) {
    return null;
  }
  return {
    id: "attribution-gap",
    severity: "info",
    title: "Some sessions lack workspace attribution",
    detail: `${Math.round(value ?? 0)} real sessions were not attributed to a Git workspace. Open a Git repository so usage is correctly grouped by project.`,
    value,
    threshold: 0
  };
}

function errorsAlert(value: number | null): Alert | null {
  if ((value ?? 0) <= 0) {
    return null;
  }
  return {
    id: "errors",
    severity: "warning",
    title: "Sessions reported errors",
    detail: `${Math.round(value ?? 0)} error signals were recorded in range. Review failing tool calls or requests in Aspire or Tempo.`,
    value,
    threshold: 0
  };
}

function computeAlerts(input: {
  aiCredits: number | null;
  inputTokens: number | null;
  contextPeak: number | null;
  cacheEfficiency: number | null;
  coldRatio: number | null;
  nonWorkspaceReal: number | null;
  errors: number | null;
}): Alert[] {
  return [
    aiCreditsAlert(input.aiCredits),
    inputTokensAlert(input.inputTokens),
    contextAlert(input.contextPeak),
    cacheEfficiencyAlert(input.cacheEfficiency),
    coldRatioAlert(input.coldRatio),
    attributionAlert(input.nonWorkspaceReal),
    errorsAlert(input.errors)
  ].filter((alert): alert is Alert => alert !== null);
}

interface SavingsOpportunity {
  id: string;
  label: string;
  estimateCredits: number;
  detail: string;
}

interface EconomySummary {
  efficiencyScore: number | null;
  aiCredits: number;
  potentialSavingsCredits: number;
  coldCostShare: number | null;
  cacheEfficiency: number | null;
  savingsOpportunities: SavingsOpportunity[];
}

// Local token-economy heuristics. All values are local AIU estimates for
// coaching, not official GitHub billing. The efficiency score rewards cache
// reuse and penalizes cold context, context pressure, and error loops.
function computeEconomy(input: {
  aiCredits: number;
  sessions: number;
  errors: number;
  promptTotal: number;
  cacheEfficiency: number | null;
  coldRatio: number | null;
  contextPeak: number | null;
}): EconomySummary {
  const { aiCredits, sessions, errors, promptTotal, cacheEfficiency, coldRatio, contextPeak } = input;

  let efficiencyScore: number | null = null;
  if (promptTotal > 0 || sessions > 0) {
    const cacheComponent = (cacheEfficiency ?? 0) * 45;
    const coldPenalty = (coldRatio ?? 0) * 30;
    const contextPenalty = contextPeak == null ? 0 : Math.min(contextPeak / 100, 1) * 15;
    const errorRate = sessions > 0 ? errors / sessions : 0;
    const errorPenalty = Math.min(errorRate, 1) * 10;
    const score = 55 + cacheComponent - coldPenalty - contextPenalty - errorPenalty;
    efficiencyScore = Math.max(0, Math.min(100, Math.round(score)));
  }

  const coldSavings = aiCredits * (coldRatio ?? 0) * 0.5;
  const errorRate = sessions > 0 ? errors / sessions : 0;
  const errorSavings = aiCredits * Math.min(errorRate, 1) * 0.15;
  const potentialSavingsCredits = coldSavings + errorSavings;

  const savingsOpportunities: SavingsOpportunity[] = [
    {
      id: "cold-context",
      label: "Reduce cold context",
      estimateCredits: coldSavings,
      detail: `${Math.round((coldRatio ?? 0) * 100)}% of prompt tokens were cold input. Reusing warm context lowers cost.`
    },
    {
      id: "error-loops",
      label: "Avoid tool-error loops",
      estimateCredits: errorSavings,
      detail: `${Math.round(errors)} error signal(s) in range. Fixing the root cause avoids wasted retries.`
    }
  ].filter((item) => item.estimateCredits > 0);

  return {
    efficiencyScore,
    aiCredits,
    potentialSavingsCredits,
    coldCostShare: coldRatio,
    cacheEfficiency,
    savingsOpportunities
  };
}

function appLinks() {
  const tempoExploreQuery = encodeURIComponent(JSON.stringify({
    datasource: "tempo-local",
    queries: [{ query: '{service.name="copilot-chat"}' }],
    range: { from: "now-1h", to: "now" }
  }));
  const lokiExploreQuery = encodeURIComponent(JSON.stringify({
    datasource: "loki-local",
    queries: [{ expr: '{service_name="copilot-chat"}' }],
    range: { from: "now-1h", to: "now" }
  }));
  return [
    { label: "Grafana dashboards", url: publicGrafanaUrl },
    { label: "Aspire Dashboard live traces", url: publicAspireUrl },
    { label: "Prometheus", url: publicPrometheusUrl },
    { label: "Tempo API", url: publicTempoUrl },
    { label: "Loki API", url: publicLokiUrl },
    { label: "Grafana Tempo Explore", url: `${publicGrafanaUrl}/explore?left=${tempoExploreQuery}` },
    { label: "Grafana Loki Explore", url: `${publicGrafanaUrl}/explore?left=${lokiExploreQuery}` }
  ];
}

interface AiCreditsBudgetInsight {
  plan: string;
  seats: number;
  monthlyAllowanceCredits: number;
  observedCredits: number | null;
  utilizationPct: number | null;
  remainingCredits: number | null;
  daysElapsed: number;
  daysInCycle: number;
  daysLeft: number;
  projectedMonthEndCredits: number | null;
  projectedUtilizationPct: number | null;
  dailyRateCredits: number | null;
  status: MetricStatus;
  alertLevel: "ok" | "warning" | "critical" | "over";
  message?: string;
}

interface ModelMixEntry {
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
  estimatedAiCredits: number | null;
  share: number | null;
}

interface ModelMix {
  status: MetricStatus;
  entries: ModelMixEntry[];
  totalCalls: number;
  totalEstimatedAiCredits: number | null;
  message?: string;
}

interface ExperienceMetrics {
  avgTimeToFirstTokenSeconds: ScalarMetric;
  avgResponseSeconds: ScalarMetric;
  userTurns: ScalarMetric;
}

interface OutcomeMetrics {
  editAcceptances: ScalarMetric;
  linesAccepted: ScalarMetric;
  editSurvivalNoRevert: ScalarMetric;
  contextCompactions: ScalarMetric;
}

// AI Credits budgets are tracked per billing cycle. The local cockpit uses a
// month-to-date approximation and clearly separates it from official GitHub
// billing exports and Copilot usage APIs.
function billingCycle(now = new Date()): { daysInCycle: number; daysElapsed: number; daysLeft: number } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const daysInCycle = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const daysElapsed = now.getUTCDate();
  const daysLeft = Math.max(0, daysInCycle - daysElapsed);
  return { daysInCycle, daysElapsed, daysLeft };
}

function budgetAlertLevel(utilizationPct: number | null): AiCreditsBudgetInsight["alertLevel"] {
  if (utilizationPct === null) {
    return "ok";
  }
  if (utilizationPct >= 100) {
    return "over";
  }
  if (utilizationPct >= thresholds.budgetCritPct) {
    return "critical";
  }
  if (utilizationPct >= thresholds.budgetWarnPct) {
    return "warning";
  }
  return "ok";
}

async function aiCreditsBudgetInsight(): Promise<AiCreditsBudgetInsight> {
  const cycle = billingCycle();
  const monthWindow = `${Math.max(1, cycle.daysElapsed)}d`;
  const observed = await scalarMetric(`${realSessionSum("nano_aiu", monthWindow, "")} / 1e9`);
  const observedCredits = observed.value;
  const status: MetricStatus = observedCredits === null ? "unavailable" : "ok";
  const utilizationPct =
    observedCredits !== null && aiCreditsMonthlyAllowance > 0
      ? (observedCredits / aiCreditsMonthlyAllowance) * 100
      : null;
  const remainingCredits =
    observedCredits === null ? null : Math.max(0, aiCreditsMonthlyAllowance - observedCredits);
  const dailyRate =
    observedCredits !== null && cycle.daysElapsed > 0 ? observedCredits / cycle.daysElapsed : null;
  // Only project month-end consumption once a few days of the cycle have
  // elapsed, so the projection is not dominated by noise at the start of a cycle.
  const canProject = cycle.daysElapsed >= 3;
  const projectedMonthEnd = canProject && dailyRate !== null ? dailyRate * cycle.daysInCycle : null;
  const projectedUtilizationPct =
    projectedMonthEnd !== null && aiCreditsMonthlyAllowance > 0
      ? (projectedMonthEnd / aiCreditsMonthlyAllowance) * 100
      : null;
  return {
    plan: copilotPlan,
    seats: copilotSeats,
    monthlyAllowanceCredits: aiCreditsMonthlyAllowance,
    observedCredits,
    utilizationPct,
    remainingCredits,
    daysElapsed: cycle.daysElapsed,
    daysInCycle: cycle.daysInCycle,
    daysLeft: cycle.daysLeft,
    projectedMonthEndCredits: projectedMonthEnd,
    projectedUtilizationPct,
    dailyRateCredits: dailyRate,
    status,
    alertLevel: budgetAlertLevel(utilizationPct),
    message: observed.message
  };
}

function budgetToAlert(budget: AiCreditsBudgetInsight): Alert | null {
  if (budget.utilizationPct === null || budget.alertLevel === "ok") {
    return null;
  }
  const severity: AlertSeverity = budget.alertLevel === "warning" ? "warning" : "critical";
  return {
    id: "ai-credits-budget",
    severity,
    title:
      budget.alertLevel === "over"
        ? "AI Credits budget is exhausted"
        : "AI Credits budget is filling up",
    detail:
      `Local AI Credits observed this cycle reached ${(budget.observedCredits ?? 0).toFixed(0)} ` +
      `of the configured ${budget.monthlyAllowanceCredits.toLocaleString()} AI Credits pool ` +
      `(${(budget.utilizationPct ?? 0).toFixed(0)}%). This is a local estimate, not official billing.`,
    value: budget.utilizationPct,
    threshold: budget.alertLevel === "warning" ? thresholds.budgetWarnPct : thresholds.budgetCritPct
  };
}

function createModelMixEntry(model: string): ModelMixEntry {
  return { model, calls: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0, totalTokens: 0, estimatedAiCredits: null, share: null };
}

function applyModelToken(entry: ModelMixEntry, tokenType: string, value: number): void {
  entry.totalTokens += value;
  const normalized = tokenType.toLowerCase();
  if (normalized.includes("output")) {
    entry.outputTokens += value;
    return;
  }
  if (normalized.includes("cache")) {
    entry.cachedTokens += value;
    return;
  }
  entry.inputTokens += value;
}

async function modelMix(range: string): Promise<ModelMix> {
  const callsQuery =
    `sum by (gen_ai_request_model) (increase(gen_ai_client_operation_duration_count{service_name="copilot-chat"}[${range}]))`;
  const tokenQuery = `sum by (gen_ai_request_model, gen_ai_token_type) (increase(gen_ai_client_token_usage_sum{service_name="copilot-chat"}[${range}]))`;
  const aiCreditsQuery = `sum by (gen_ai_request_model) (((increase(gen_ai_client_token_usage_sum{service_name="copilot-chat"}[${range}]) / 1e6) * on (gen_ai_request_model, gen_ai_token_type) group_left() max by (gen_ai_request_model, gen_ai_token_type) (copilot_model_price_usd_per_million_ratio)) / 0.01)`;
  const [calls, tokens, costs] = await Promise.all([
    seriesMetric(callsQuery),
    seriesMetric(tokenQuery),
    seriesMetric(aiCreditsQuery)
  ]);
  const byModel = new Map<string, ModelMixEntry>();
  const ensure = (model: string): ModelMixEntry => {
    let entry = byModel.get(model);
    if (!entry) {
      entry = createModelMixEntry(model);
      byModel.set(model, entry);
    }
    return entry;
  };
  for (const point of calls.points) {
    const model = point.labels.gen_ai_request_model;
    if (model) {
      ensure(model).calls = point.value;
    }
  }
  for (const point of tokens.points) {
    const model = point.labels.gen_ai_request_model;
    if (!model) {
      continue;
    }
    const entry = ensure(model);
    applyModelToken(entry, point.labels.gen_ai_token_type ?? "", point.value);
  }
  for (const point of costs.points) {
    const model = point.labels.gen_ai_request_model;
    if (model) {
      ensure(model).estimatedAiCredits = point.value;
    }
  }
  const totalCalls = [...byModel.values()].reduce((sum, entry) => sum + entry.calls, 0);
  const totalEstimatedAiCredits = [...byModel.values()].reduce((sum, entry) => sum + (entry.estimatedAiCredits ?? 0), 0);
  const entries = [...byModel.values()]
    .map((entry) => ({
      ...entry,
      share: totalEstimatedAiCredits > 0 && entry.estimatedAiCredits !== null ? entry.estimatedAiCredits / totalEstimatedAiCredits : null
    }))
    .filter((entry) => entry.calls > 0 || entry.totalTokens > 0 || (entry.estimatedAiCredits ?? 0) > 0)
    .sort((left, right) => (right.estimatedAiCredits ?? 0) - (left.estimatedAiCredits ?? 0) || right.calls - left.calls);
  return {
    status: entries.length > 0 ? "ok" : "unavailable",
    entries,
    totalCalls,
    totalEstimatedAiCredits: entries.some((entry) => entry.estimatedAiCredits !== null) ? totalEstimatedAiCredits : null,
    message: entries.length > 0 ? undefined : "No model-call telemetry is available for the selected range."
  };
}

// Developer-experience latency signals. GenAI latency metrics are recorded in
// seconds per the OpenTelemetry GenAI semantic conventions.
async function experienceMetrics(range: string): Promise<ExperienceMetrics> {
  const filter = `service_name="copilot-chat"`;
  const [ttft, response, turns] = await Promise.all([
    scalarMetric(
      `sum(increase(copilot_chat_time_to_first_token_sum{${filter}}[${range}])) / ` +
      `clamp_min(sum(increase(copilot_chat_time_to_first_token_count{${filter}}[${range}])), 1)`
    ),
    scalarMetric(
      `sum(increase(gen_ai_client_operation_duration_sum{${filter}}[${range}])) / ` +
      `clamp_min(sum(increase(gen_ai_client_operation_duration_count{${filter}}[${range}])), 1)`
    ),
    scalarMetric(`sum(increase(copilot_chat_agent_turn_count_count{${filter}}[${range}]))`)
  ]);
  return {
    avgTimeToFirstTokenSeconds: ttft,
    avgResponseSeconds: response,
    userTurns: turns
  };
}

// Outcome and value signals. These counters are emitted at the editor level and
// are not attributable to a specific Git workspace, so they describe local
// GitHub Copilot value broadly rather than per repository.
async function outcomeMetrics(range: string): Promise<OutcomeMetrics> {
  const filter = `service_name="copilot-chat"`;
  const [acceptances, lines, survival, compactions] = await Promise.all([
    scalarMetric(`sum(increase(copilot_chat_edit_acceptance_count_total{${filter}}[${range}]))`),
    scalarMetric(`sum(increase(copilot_chat_lines_of_code_count_total{${filter}}[${range}]))`),
    scalarMetric(`sum(increase(copilot_chat_edit_survival_no_revert_count{${filter}}[${range}]))`),
    scalarMetric(`sum(increase(copilot_chat_agent_summarization_count_total{${filter}}[${range}]))`)
  ]);
  return {
    editAcceptances: acceptances,
    linesAccepted: lines,
    editSurvivalNoRevert: survival,
    contextCompactions: compactions
  };
}

async function summary(url: URL) {
  const range = rangeFromUrl(url);
  const repo = repoFromUrl(url);
  const repoLabelMatcher = repoMatcher(repo);
  const aiCreditsQuery = `${realSessionSum("nano_aiu", range, repoLabelMatcher)} / 1e9`;
  const selector = realWorkspaceSelector(repoLabelMatcher);
  const contextTypicalQuery = `avg(max by (trace_id) (max_over_time(copilot_real_session_context_utilization_pct_ratio{${selector}}[${range}])))`;
  const contextPeakQuery = `max(max by (trace_id) (max_over_time(copilot_real_session_context_utilization_pct_ratio{${selector}}[${range}])))`;
  const tokensQuery = `sum by (gen_ai_request_model, gen_ai_token_type) (increase(gen_ai_client_token_usage_sum{service_name="copilot-chat"}[${range}]))`;
  const usdQuery = `sum by (gen_ai_request_model) ((increase(gen_ai_client_token_usage_sum{service_name="copilot-chat"}[${range}]) / 1e6) * on (gen_ai_request_model, gen_ai_token_type) group_left() max by (gen_ai_request_model, gen_ai_token_type) (copilot_model_price_usd_per_million_ratio))`;
  const workspaceRealQuery = `count(max by (trace_id) (max_over_time(copilot_real_session_input_tokens_ratio{${selector}}[${range}])))`;
  const nonWorkspaceRealQuery = `count(max_over_time(copilot_real_session_input_tokens_ratio{usage_scope="non_workspace_real"}[${range}]))`;
  const observedCoverageQuery = `sum(max_over_time(copilot_otel_coverage_status_ratio{status="observed"}[${range}]))`;
  const notObservedCoverageQuery = `count(max_over_time(copilot_otel_coverage_status_ratio{status!="observed"}[${range}]))`;

  const [
    health,
    repoValues,
    aiCredits,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    coldInputTokens,
    reasoningTokens,
    toolCalls,
    errors,
    contextTypical,
    contextPeak,
    tokens,
    usdWhatIf,
    workspaceReal,
    nonWorkspaceReal,
    observedCoverage,
    notObservedYet,
    workspaces,
    history,
    budget,
    mix,
    experience,
    outcomes
  ] = await Promise.all([
    stackHealth(),
    repositories(range),
    scalarMetric(aiCreditsQuery),
    scalarMetric(realSessionSum("input_tokens", range, repoLabelMatcher)),
    scalarMetric(realSessionSum("output_tokens", range, repoLabelMatcher)),
    scalarMetric(realSessionSum("cache_read_tokens", range, repoLabelMatcher)),
    scalarMetric(realSessionSum("cache_creation_tokens", range, repoLabelMatcher)),
    scalarMetric(realSessionSum("cold_input_tokens", range, repoLabelMatcher)),
    scalarMetric(realSessionSum("reasoning_tokens", range, repoLabelMatcher)),
    scalarMetric(realSessionSum("tool_calls", range, repoLabelMatcher)),
    scalarMetric(realSessionSum("error_count", range, repoLabelMatcher)),
    scalarMetric(contextTypicalQuery),
    scalarMetric(contextPeakQuery),
    seriesMetric(tokensQuery),
    seriesMetric(usdQuery),
    scalarMetric(workspaceRealQuery),
    scalarMetric(nonWorkspaceRealQuery),
    scalarMetric(observedCoverageQuery),
    scalarMetric(notObservedCoverageQuery),
    workspaceBreakdown(range),
    usageHistory(range, repoLabelMatcher),
    aiCreditsBudgetInsight(),
    modelMix(range),
    experienceMetrics(range),
    outcomeMetrics(range)
  ]);

  const cacheRead = cacheReadTokens.value ?? 0;
  const cacheCreation = cacheCreationTokens.value ?? 0;
  const cold = coldInputTokens.value ?? 0;
  const promptTotal = cacheRead + cacheCreation + cold;
  const cacheEfficiency = promptTotal > 0 ? cacheRead / promptTotal : null;
  const warmRatio = promptTotal > 0 ? cacheCreation / promptTotal : null;
  const coldRatio = promptTotal > 0 ? cold / promptTotal : null;

  const alerts = computeAlerts({
    aiCredits: aiCredits.value,
    inputTokens: inputTokens.value,
    contextPeak: contextPeak.value,
    cacheEfficiency,
    coldRatio,
    nonWorkspaceReal: nonWorkspaceReal.value,
    errors: errors.value
  });

  const budgetAlert = budgetToAlert(budget);
  if (budgetAlert) {
    alerts.unshift(budgetAlert);
  }

  const economy = computeEconomy({
    aiCredits: aiCredits.value ?? 0,
    sessions: workspaceReal.value ?? 0,
    errors: errors.value ?? 0,
    promptTotal,
    cacheEfficiency,
    coldRatio,
    contextPeak: contextPeak.value
  });

  return {
    range,
    repo: repo ?? "all",
    refreshedAt: new Date().toISOString(),
    participant: participantIdentity(),
    health,
    repositories: repoValues,
    links: appLinks(),
    thresholds,
    alerts,
    economy,
    budget,
    modelMix: mix,
    experience,
    outcomes,
    metrics: {
      aiCredits,
      sessions: workspaceReal,
      tokens: {
        input: inputTokens,
        output: outputTokens,
        cacheRead: cacheReadTokens,
        cacheCreation: cacheCreationTokens,
        coldInput: coldInputTokens,
        reasoning: reasoningTokens,
        cacheEfficiency,
        warmRatio,
        coldRatio,
        promptTotal
      },
      context: {
        typical: contextTypical,
        peak: contextPeak
      },
      activity: {
        toolCalls,
        errors
      },
      modelTokens: tokens,
      usdWhatIf,
      dataQuality: {
        workspaceReal,
        nonWorkspaceReal,
        observedCoverage,
        notObservedYet
      }
    },
    workspaces,
    history,
    officialBilling: {
      status: "unavailable",
      reason: "Official AI Credits, spend, and adoption require GitHub billing exports or the GitHub Copilot usage metrics API. Local OpenTelemetry is operational telemetry only."
    },
    dataBoundary: {
      localOnly: [
        "Raw prompts",
        "Raw responses",
        "File contents",
        "Tool arguments",
        "Tool results",
        "DuckDB files",
        "Grafana PostgreSQL metadata"
      ],
      safeForwarding: [
        "Sanitized metrics",
        "Sanitized traces",
        "Sanitized logs",
        "Aggregated rollups",
        "Official GitHub API and billing exports when connected"
      ]
    }
  };
}

interface SessionRecord {
  traceId: string;
  conversationId: string;
  repo: string;
  repoShort: string;
  branch: string;
  workspaceName: string;
  model: string;
  agent: string;
  modeBucket: string;
  operation: string;
  rootSpanName: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  coldInputTokens: number;
  aiCredits: number;
  toolCalls: number;
  contextPct: number | null;
  cacheEfficiency: number | null;
  spans: number;
}

async function sessionsBreakdown(
  range: string,
  repo: string | null
): Promise<{ status: MetricStatus; items: SessionRecord[]; message?: string }> {
  const matcher = repoMatcher(repo);
  const selector = realWorkspaceSelector(matcher);
  const raw = (metric: string) =>
    `max_over_time(copilot_real_session_${metric}_ratio{${selector}}[${range}])`;
  try {
    const [input, output, cacheRead, cacheCreation, cold, aiu, tools, context] = await Promise.all([
      seriesMetric(raw("input_tokens")),
      seriesMetric(raw("output_tokens")),
      seriesMetric(raw("cache_read_tokens")),
      seriesMetric(raw("cache_creation_tokens")),
      seriesMetric(raw("cold_input_tokens")),
      seriesMetric(raw("nano_aiu")),
      seriesMetric(raw("tool_calls")),
      seriesMetric(raw("context_utilization_pct"))
    ]);

    const byTrace = new Map<string, SessionRecord>();
    const ensure = (labels: Record<string, string>): SessionRecord => {
      const traceId = labels.trace_id ?? "unknown";
      let record = byTrace.get(traceId);
      if (!record) {
        const repoLabel = labels.repo ?? "unknown";
        record = {
          traceId,
          conversationId: labels.conversation_id ?? "",
          repo: repoLabel,
          repoShort: shortRepoName(repoLabel),
          branch: labels.branch ?? "",
          workspaceName: labels.workspace_name ?? "",
          model: labels.request_model ?? labels.response_model ?? "unknown",
          agent: labels.agent_name ?? "",
          modeBucket: labels.mode_bucket ?? "",
          operation: labels.operation_name ?? "",
          rootSpanName: labels.root_span_name ?? "",
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          coldInputTokens: 0,
          aiCredits: 0,
          toolCalls: 0,
          contextPct: null,
          cacheEfficiency: null,
          spans: 0
        };
        byTrace.set(traceId, record);
      }
      return record;
    };

    for (const point of input.points) {
      const record = ensure(point.labels);
      record.spans += 1;
      if (point.value > record.inputTokens) {
        record.inputTokens = point.value;
        // Adopt the representative labels from the heaviest span of the trace.
        record.model = point.labels.request_model ?? record.model;
        record.agent = point.labels.agent_name ?? record.agent;
        record.modeBucket = point.labels.mode_bucket ?? record.modeBucket;
        record.rootSpanName = point.labels.root_span_name ?? record.rootSpanName;
        record.operation = point.labels.operation_name ?? record.operation;
      }
    }
    const applyMax = (metric: SeriesMetric, field: "outputTokens" | "cacheReadTokens" | "cacheCreationTokens" | "coldInputTokens" | "toolCalls", scale = 1) => {
      for (const point of metric.points) {
        const record = ensure(point.labels);
        const value = point.value * scale;
        if (value > record[field]) {
          record[field] = value;
        }
      }
    };
    applyMax(output, "outputTokens");
    applyMax(cacheRead, "cacheReadTokens");
    applyMax(cacheCreation, "cacheCreationTokens");
    applyMax(cold, "coldInputTokens");
    applyMax(tools, "toolCalls");
    for (const point of aiu.points) {
      const record = ensure(point.labels);
      const credits = point.value / 1e9;
      if (credits > record.aiCredits) {
        record.aiCredits = credits;
      }
    }
    for (const point of context.points) {
      const record = ensure(point.labels);
      if (record.contextPct === null || point.value > record.contextPct) {
        record.contextPct = point.value;
      }
    }

    const items = [...byTrace.values()]
      .map((record) => {
        const promptTotal = record.cacheReadTokens + record.cacheCreationTokens + record.coldInputTokens;
        record.cacheEfficiency = promptTotal > 0 ? record.cacheReadTokens / promptTotal : null;
        return record;
      })
      .sort((a, b) => b.aiCredits - a.aiCredits || b.inputTokens - a.inputTokens)
      .slice(0, 100);

    return {
      status: items.length ? "ok" : "unavailable",
      items,
      message: items.length
        ? undefined
        : "No workspace-attributed sessions are available yet. Run a Copilot session inside a Git repository."
    };
  } catch (error) {
    return {
      status: "unavailable",
      items: [],
      message: error instanceof Error ? error.message : "Sessions breakdown failed"
    };
  }
}

type CoachSeverity = "good" | "info" | "warning" | "critical";

interface CoachCard {
  id: string;
  severity: CoachSeverity;
  title: string;
  insight: string;
  action: string;
}

type SummaryResult = Awaited<ReturnType<typeof summary>>;

interface CoachContext {
  tokens: SummaryResult["metrics"]["tokens"];
  aiCredits: number | null;
  contextPeak: number | null;
  errors: number;
  nonWorkspace: number;
  budget: AiCreditsBudgetInsight;
  mix: ModelMix;
  sessions: SessionRecord[];
}

type CoachRule = (ctx: CoachContext) => CoachCard | null;

// Each coaching rule is a small, independent function that returns a card when
// its condition applies. Keeping rules declarative keeps the builder simple and
// makes it easy to add, remove, or reorder guidance.
const coachRules: CoachRule[] = [
  ({ tokens }) =>
    tokens.cacheEfficiency !== null && tokens.cacheEfficiency < thresholds.cacheEfficiencyWarn
      ? {
        id: "cache-reuse",
        severity: "warning",
        title: "Improve cache reuse",
        insight: `Only ${(tokens.cacheEfficiency * 100).toFixed(0)}% of your prompt tokens came from cache reads. Low reuse spends more AI credits on the same context.`,
        action: "Keep the conversation focused, avoid reopening or re-pasting large files, and let the agent build on prior turns instead of restating context."
      }
      : null,
  ({ tokens }) =>
    tokens.coldRatio !== null && tokens.coldRatio > thresholds.coldRatioWarn
      ? {
        id: "cold-context",
        severity: "warning",
        title: "Reduce cold context",
        insight: `${(tokens.coldRatio * 100).toFixed(0)}% of prompt tokens were uncached cold input. Cold context is the most expensive token class.`,
        action: "Work in shorter, related steps within one session so context stays warm, and attach only the files the task needs."
      }
      : null,
  ({ contextPeak }) =>
    contextPeak !== null && contextPeak >= thresholds.contextWarnPct
      ? {
        id: "context-pressure",
        severity: contextPeak >= thresholds.contextCritPct ? "critical" : "warning",
        title: "Manage context window pressure",
        insight: `Peak context utilization reached ${contextPeak.toFixed(0)}%. Near-full context raises cost and can degrade answer quality.`,
        action: "Split large tasks into smaller prompts, start a fresh session for unrelated work, and remove stale attachments."
      }
      : null,
  ({ errors }) =>
    errors > 0
      ? {
        id: "errors",
        severity: "warning",
        title: "Investigate failing operations",
        insight: `${Math.round(errors)} error signals were recorded in this range. Failed tool calls waste credits and slow you down.`,
        action: "Open the failing traces in Aspire or Tempo, fix the root cause, then retry the task."
      }
      : null,
  ({ nonWorkspace }) =>
    nonWorkspace > 0
      ? {
        id: "attribution",
        severity: "info",
        title: "Attribute sessions to a workspace",
        insight: `${Math.round(nonWorkspace)} real sessions had no Git workspace attribution, so they are missing from per-project analysis.`,
        action: "Open your project as a Git repository in VS Code so usage is grouped by repo and branch."
      }
      : null,
  ({ budget }) =>
    budget.projectedUtilizationPct !== null && budget.projectedUtilizationPct >= thresholds.budgetWarnPct
      ? {
        id: "budget-pacing",
        severity: budget.projectedUtilizationPct >= 100 ? "critical" : "warning",
        title: "Pace your AI Credits pool",
        insight: `At the current daily rate, local AI Credits would reach about ${budget.projectedMonthEndCredits === null ? "?" : budget.projectedMonthEndCredits.toFixed(0)} by the end of the cycle, roughly ${budget.projectedUtilizationPct.toFixed(0)}% of the configured ${budget.monthlyAllowanceCredits} credit pool for the ${budget.plan} plan. This is a local estimate, not official billing.`,
        action: "Reduce cold context, choose the lowest-cost model that can do the job, and avoid retrying large prompts before fixing the root cause."
      }
      : null,
  ({ mix }) =>
    mix.entries.length > 0 && (mix.entries[0].share ?? 0) > 0.6
      ? {
        id: "model-cost-concentration",
        severity: "info",
        title: "Watch model cost concentration",
        insight: `${mix.entries[0].model} accounts for ${((mix.entries[0].share ?? 0) * 100).toFixed(0)}% of estimated model AI Credits in this range. All billed model interactions consume AI Credits based on model and tokens.`,
        action: "Use a less expensive capable model for routine work and reserve higher-cost models for tasks that genuinely need stronger reasoning."
      }
      : null,
  ({ tokens }) => {
    const input = tokens.input.value;
    const output = tokens.output.value;
    if (input === null || output === null || output <= 0 || input / output <= 20) {
      return null;
    }
    return {
      id: "prompt-io",
      severity: "info",
      title: "Trim oversized prompts",
      insight: `You sent about ${(input / output).toFixed(0)}x more input tokens than output tokens. A very high input-to-output ratio usually means too much context is attached for the size of the answer.`,
      action: "Attach only the files and instructions the task needs, ask focused questions, and remove stale attachments so input stays lean relative to the output."
    };
  },
  ({ aiCredits }) =>
    aiCredits !== null && aiCredits >= thresholds.aiCreditsCrit
      ? {
        id: "credit-budget",
        severity: "critical",
        title: "AI credit consumption is high",
        insight: `Local AI credits reached ${aiCredits.toFixed(1)} in this range, above the critical guardrail of ${thresholds.aiCreditsCrit}.`,
        action: "Batch related questions, reuse context, and reserve frontier models for complex work to control credit burn."
      }
      : null,
  ({ sessions }) => {
    const lead = sessions.find((session) => session.aiCredits > 0);
    if (!lead) {
      return null;
    }
    return {
      id: "top-sessions",
      severity: "info",
      title: "Watch your most expensive sessions",
      insight: `Your highest-cost session used ${lead.aiCredits.toFixed(2)} AI credits with model ${lead.model} in ${lead.repoShort}.`,
      action: "Review whether these sessions needed a frontier model. Lighter tasks can use a smaller model to save credits."
    };
  }
];

function buildCoachCards(data: SummaryResult, sessions: SessionRecord[]): CoachCard[] {
  const context: CoachContext = {
    tokens: data.metrics.tokens,
    aiCredits: data.metrics.aiCredits.value,
    contextPeak: data.metrics.context.peak.value,
    errors: data.metrics.activity.errors.value ?? 0,
    nonWorkspace: data.metrics.dataQuality.nonWorkspaceReal.value ?? 0,
    budget: data.budget,
    mix: data.modelMix,
    sessions
  };

  const cards = coachRules
    .map((rule) => rule(context))
    .filter((card): card is CoachCard => card !== null);

  if (cards.length === 0) {
    cards.push({
      id: "healthy",
      severity: "good",
      title: "Usage looks healthy",
      insight: "Cache reuse, cold context, context pressure, and AI credits are all within the local guardrails for this range.",
      action: "Keep working as you are. Revisit this view after larger agent sessions to stay efficient."
    });
  }

  return cards;
}

async function coach(url: URL) {
  const data = await summary(url);
  const sessions = await sessionsBreakdown(data.range, repoFromUrl(url));
  return {
    generatedAt: new Date().toISOString(),
    range: data.range,
    repo: data.repo,
    cards: buildCoachCards(data, sessions.items),
    topSessions: sessions.items.slice(0, 5)
  };
}

type RouteHandler = (url: URL, response: http.ServerResponse) => void | Promise<void>;

const getRoutes: Record<string, RouteHandler> = {
  "/health": (_url, response) => textResponse(response, 200, "ok\n"),
  "/api/health": (_url, response) =>
    jsonResponse(response, 200, { status: "ok", checkedAt: new Date().toISOString() }),
  "/api/links": (_url, response) => jsonResponse(response, 200, { links: appLinks() }),
  "/api/repositories": async (url, response) =>
    jsonResponse(response, 200, { repositories: await repositories(rangeFromUrl(url)) }),
  "/api/identity": (_url, response) => jsonResponse(response, 200, participantIdentity()),
  "/api/summary": async (url, response) => jsonResponse(response, 200, await summary(url)),
  "/api/sessions": async (url, response) =>
    jsonResponse(response, 200, await sessionsBreakdown(rangeFromUrl(url), repoFromUrl(url))),
  "/api/coach": async (url, response) => jsonResponse(response, 200, await coach(url))
};

const server = http.createServer((request, response) => {
  void (async () => {
    if (!request.url) {
      errorResponse(response, 400, "Missing request URL");
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
    const handler = request.method === "GET" ? getRoutes[url.pathname] : undefined;

    if (!handler) {
      errorResponse(response, 404, "Not found");
      return;
    }

    await handler(url, response);
  })().catch((error) => {
    errorResponse(response, 500, error instanceof Error ? error.message : "Unexpected API error");
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Frontier Dashboard API listening on port ${port}`);
});
