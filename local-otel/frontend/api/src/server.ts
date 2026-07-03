import http from "node:http";
import { readFile } from "node:fs/promises";
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
export const thresholds = {
  aiCreditsWarn: numberFromEnv("THRESHOLD_AI_CREDITS_WARN", 250),
  aiCreditsCrit: numberFromEnv("THRESHOLD_AI_CREDITS_CRIT", 500),
  inputTokensWarn: numberFromEnv("THRESHOLD_INPUT_TOKENS_WARN", 3_000_000),
  inputTokensCrit: numberFromEnv("THRESHOLD_INPUT_TOKENS_CRIT", 6_000_000),
  contextWarnPct: numberFromEnv("THRESHOLD_CONTEXT_WARN_PCT", 70),
  contextCritPct: numberFromEnv("THRESHOLD_CONTEXT_CRIT_PCT", 90),
  cacheEfficiencyWarn: numberFromEnv("THRESHOLD_CACHE_EFFICIENCY_WARN", 0.35),
  coldRatioWarn: numberFromEnv("THRESHOLD_COLD_RATIO_WARN", 0.45),
  budgetWarnPct: numberFromEnv("THRESHOLD_AI_CREDITS_BUDGET_WARN_PCT", 75),
  budgetCritPct: numberFromEnv("THRESHOLD_AI_CREDITS_BUDGET_CRIT_PCT", 90),
  modelConcentrationInfo: numberFromEnv("THRESHOLD_MODEL_CONCENTRATION", 0.6),
  promptIoRatioInfo: numberFromEnv("THRESHOLD_PROMPT_IO_RATIO", 20),
  // A request pair counts as cache-healthy when the follow-up request served
  // at least this share of its prompt-cache tokens from cache reads.
  inspectorHealthyHitRate: numberFromEnv("THRESHOLD_INSPECTOR_HEALTHY_HIT_RATE", 0.5),
  contextCompactionsInfo: numberFromEnv("THRESHOLD_CONTEXT_COMPACTIONS_INFO", 3)
};

// Coaching and planning tuning. These control how the efficiency score,
// savings estimates, and the workspace planner classify and weigh local
// telemetry. They are heuristics for local coaching, not official billing
// math, and every one of them is overridable with an environment variable.
export const coachTuning = {
  scoreBase: numberFromEnv("COACH_SCORE_BASE", 55),
  scoreCacheWeight: numberFromEnv("COACH_SCORE_CACHE_WEIGHT", 45),
  scoreColdPenalty: numberFromEnv("COACH_SCORE_COLD_PENALTY", 30),
  scoreContextPenalty: numberFromEnv("COACH_SCORE_CONTEXT_PENALTY", 15),
  scoreErrorPenalty: numberFromEnv("COACH_SCORE_ERROR_PENALTY", 10),
  coldSavingsFactor: numberFromEnv("COACH_COLD_SAVINGS_FACTOR", 0.5),
  errorSavingsFactor: numberFromEnv("COACH_ERROR_SAVINGS_FACTOR", 0.15),
  frontierOutputPriceMinUsdPerMillion: numberFromEnv("PLANNER_FRONTIER_OUTPUT_PRICE_MIN", 20),
  complexSessionMinToolCalls: numberFromEnv("PLANNER_COMPLEX_SESSION_MIN_TOOL_CALLS", 5)
};

function lowerFromEnv(name: string, fallback: string): string {
  return stringFromEnv(name, fallback).toLowerCase();
}

// GitHub Copilot usage-based billing (effective June 1, 2026) is measured in
// GitHub AI Credits, where 1 AI Credit equals US$0.01. Usage is metered from
// tokens (input, output, cached) at each model's listed API rate; code
// completions and next edit suggestions never consume credits, and Auto model
// selection applies a discount to model costs on paid plans. Allowances reset
// on the first day of each calendar month (UTC) and do not roll over.
// Individual paid plans include base credits (matching the plan price) plus a
// flex allotment; Business and Enterprise seats include exactly the per-seat
// base. Existing Business and Enterprise customers keep a temporary
// promotional allowance during the transition window. These defaults follow
// the GitHub Docs pages "Usage-based billing for individuals" and
// "Usage-based billing for organizations and enterprises" and remain
// configurable because allowances and promotions change over time.
const aiCreditUsd = numberFromEnv("AI_CREDIT_USD", 0.01);
const autoModelDiscount = numberFromEnv("AUTO_MODEL_SELECTION_DISCOUNT", 0.1);
const promoWindowStart = stringFromEnv("FRONTIER_AI_CREDITS_PROMO_START", "2026-06-01");
const promoWindowEnd = stringFromEnv("FRONTIER_AI_CREDITS_PROMO_END", "2026-09-01");

type PlanAudience = "individual" | "organization";
type PlanModelAccess = "auto-only" | "full";

interface CopilotPlanFacts {
  id: string;
  audience: PlanAudience;
  priceUsdMonth: number;
  perSeat: boolean;
  baseCredits: number | null;
  flexCredits: number;
  includedCredits: number | null;
  promoCredits: number | null;
  modelAccess: PlanModelAccess;
}

export const copilotPlanCatalog: CopilotPlanFacts[] = [
  { id: "free", audience: "individual", priceUsdMonth: 0, perSeat: false, baseCredits: null, flexCredits: 0, includedCredits: null, promoCredits: null, modelAccess: "auto-only" },
  { id: "pro", audience: "individual", priceUsdMonth: 10, perSeat: false, baseCredits: 1000, flexCredits: 500, includedCredits: 1500, promoCredits: null, modelAccess: "full" },
  { id: "pro+", audience: "individual", priceUsdMonth: 39, perSeat: false, baseCredits: 3900, flexCredits: 3100, includedCredits: 7000, promoCredits: null, modelAccess: "full" },
  { id: "max", audience: "individual", priceUsdMonth: 100, perSeat: false, baseCredits: 10000, flexCredits: 10000, includedCredits: 20000, promoCredits: null, modelAccess: "full" },
  { id: "business", audience: "organization", priceUsdMonth: 19, perSeat: true, baseCredits: 1900, flexCredits: 0, includedCredits: 1900, promoCredits: 3000, modelAccess: "full" },
  { id: "enterprise", audience: "organization", priceUsdMonth: 39, perSeat: true, baseCredits: 3900, flexCredits: 0, includedCredits: 3900, promoCredits: 7000, modelAccess: "full" }
];

const copilotPlan = lowerFromEnv("FRONTIER_COPILOT_PLAN", "business");
const copilotSeats = numberFromEnv("FRONTIER_COPILOT_SEATS", 1);
const usePromotionalAllowance = lowerFromEnv("FRONTIER_AI_CREDITS_USE_PROMO", "false") === "true";
const allowanceOverride = numberFromEnv("FRONTIER_AI_CREDITS_MONTHLY_ALLOWANCE", Number.NaN);

export function planFactsFor(planId: string): CopilotPlanFacts {
  return copilotPlanCatalog.find((plan) => plan.id === planId) ?? copilotPlanCatalog.find((plan) => plan.id === "business")!;
}

export function promoWindowActive(now: Date): boolean {
  const iso = now.toISOString().slice(0, 10);
  return iso >= promoWindowStart && iso < promoWindowEnd;
}

type AllowanceSource = "standard" | "promotional" | "override" | "unpublished";

interface AllowanceResolution {
  credits: number;
  perSeatCredits: number;
  source: AllowanceSource;
  promoActive: boolean;
}

// The promotional allowance only applies to qualifying existing customers,
// only when explicitly enabled, and only while the promotional window is
// open — after it closes the cockpit falls back to the standard allowance
// automatically so the dashboard never overstates included credits.
export interface PlanOverride {
  plan?: string;
  seats?: number;
  usePromo?: boolean;
}

// The setup wizard in the web app sends the selected license as query
// parameters, so the allowance can follow the wizard without restarting the
// stack. The environment remains the default when no override is present.
export function planOverridesFromUrl(url: URL): PlanOverride {
  const override: PlanOverride = {};
  const plan = (url.searchParams.get("plan") ?? "").toLowerCase();
  if (copilotPlanCatalog.some((entry) => entry.id === plan)) {
    override.plan = plan;
  }
  const seats = Number.parseInt(url.searchParams.get("seats") ?? "", 10);
  if (Number.isFinite(seats) && seats > 0) {
    override.seats = Math.min(100000, seats);
  }
  const promo = url.searchParams.get("promo");
  if (promo === "true" || promo === "false") {
    override.usePromo = promo === "true";
  }
  return override;
}

export function resolveAllowance(now = new Date(), override: PlanOverride = {}): AllowanceResolution {
  const effectivePlan = override.plan ?? copilotPlan;
  const effectiveSeats = override.seats ?? copilotSeats;
  const effectivePromo = override.usePromo ?? usePromotionalAllowance;
  const plan = planFactsFor(effectivePlan);
  const promoActive = effectivePromo && plan.promoCredits !== null && promoWindowActive(now);
  if (Number.isFinite(allowanceOverride) && override.plan === undefined) {
    return { credits: allowanceOverride, perSeatCredits: allowanceOverride / Math.max(1, effectiveSeats), source: "override", promoActive };
  }
  if (plan.includedCredits === null) {
    return { credits: 0, perSeatCredits: 0, source: "unpublished", promoActive: false };
  }
  const perSeat = promoActive ? plan.promoCredits ?? plan.includedCredits : plan.includedCredits;
  const seats = plan.perSeat ? Math.max(1, effectiveSeats) : 1;
  return {
    credits: perSeat * seats,
    perSeatCredits: perSeat,
    source: promoActive ? "promotional" : "standard",
    promoActive
  };
}

function billingFacts(now = new Date(), override: PlanOverride = {}) {
  const allowance = resolveAllowance(now, override);
  return {
    creditUsd: aiCreditUsd,
    autoModelDiscount,
    noRollover: true,
    resetRule: "Allowances reset at 00:00 UTC on the first day of each calendar month and unused credits do not carry over.",
    meteringRule: "Usage is metered from input, output, and cached tokens at each model's listed API rate. Code completions and next edit suggestions do not consume AI Credits.",
    overageRule: "When the included allowance is exhausted, paid plans can purchase additional usage billed at per-model API rates at the end of the cycle. Organization admins must enable overages and can set per-user budgets.",
    promoWindow: { start: promoWindowStart, end: promoWindowEnd, active: promoWindowActive(now) },
    configuredPlan: override.plan ?? copilotPlan,
    seats: override.seats ?? copilotSeats,
    allowance,
    planCatalog: copilotPlanCatalog,
    source: "GitHub Docs: Copilot plans and usage-based billing (individuals; organizations and enterprises). Values are reference defaults and stay configurable because they can change."
  };
}

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
    dashboardTitle: stringFromEnv("FRONTIER_DASHBOARD_TITLE", "Frontier Cockpit Local")
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

// Stable human-readable detail for upstream failures; raw exception strings
// like "fetch failed" or "This operation was aborted" never reach the UI.
export function humanErrorDetail(error: unknown, service: string): string {
  if (error instanceof Error && error.name === "AbortError") {
    return `${service} did not respond within the timeout.`;
  }
  if (error instanceof Error && /fetch failed/i.test(error.message)) {
    return `${service} is unreachable. Is the stack running?`;
  }
  return error instanceof Error ? error.message : `${service} request failed.`;
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
      message: humanErrorDetail(error, "Prometheus")
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
      message: humanErrorDetail(error, "Prometheus")
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
      detail: humanErrorDetail(error, name),
      checkedAt
    };
  }
}

async function jobsHealth(): Promise<ServiceHealth> {
  const checkedAt = new Date().toISOString();
  try {
    const fresh = await queryPrometheus('count(present_over_time(copilot_real_session_input_tokens_ratio[30m]))');
    const freshCount = fresh.length > 0 ? numericValue(fresh[0]) ?? 0 : 0;
    if (freshCount > 0) {
      return {
        id: "copilot-otel-jobs",
        name: "Session materializer jobs",
        status: "ok",
        detail: `${freshCount} materialized session series were refreshed in the last 30 minutes.`,
        checkedAt
      };
    }
    return {
      id: "copilot-otel-jobs",
      name: "Session materializer jobs",
      status: "degraded",
      detail: "No materialized session metrics in the last 30 minutes. Run a GitHub Copilot Chat or agent request, then wait one materializer interval.",
      checkedAt
    };
  } catch (error) {
    return {
      id: "copilot-otel-jobs",
      name: "Session materializer jobs",
      status: "unavailable",
      detail: humanErrorDetail(error, "Prometheus"),
      checkedAt
    };
  }
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
      detail: humanErrorDetail(error, "Prometheus"),
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
    httpHealth("aspire-dashboard", "Aspire Dashboard", aspireInternalUrl),
    jobsHealth(),
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
  contextPeakPct: number | null;
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
  const contextPeakQuery =
    `max by (workspace_path_hash, branch, workspace_name) ` +
    `(max by (trace_id, workspace_path_hash, branch, workspace_name) ` +
    `(max_over_time(copilot_real_session_context_utilization_pct_ratio{${selector}}[${range}])))`;
  try {
    const [input, output, cacheRead, cacheCreation, cold, aiu, sessions, contextPeak] = await Promise.all([
      queryPrometheus(base("input_tokens")),
      queryPrometheus(base("output_tokens")),
      queryPrometheus(base("cache_read_tokens")),
      queryPrometheus(base("cache_creation_tokens")),
      queryPrometheus(base("cold_input_tokens")),
      queryPrometheus(base("nano_aiu")),
      queryPrometheus(sessionsQuery),
      queryPrometheus(contextPeakQuery)
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
          coldRatio: null,
          contextPeakPct: null
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
    for (const result of contextPeak) {
      const value = numericValue(result);
      if (value !== null) {
        ensure(result.metric).contextPeakPct = value;
      }
    }
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
      message: humanErrorDetail(error, "Prometheus")
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
    // allSettled: one timed-out series must not discard the four that loaded.
    const settled = await Promise.allSettled([
      queryPrometheusRange(buildQuery("input_tokens"), start, end, shape.stepSeconds),
      queryPrometheusRange(buildQuery("output_tokens"), start, end, shape.stepSeconds),
      queryPrometheusRange(buildQuery("cache_read_tokens"), start, end, shape.stepSeconds),
      queryPrometheusRange(buildQuery("cold_input_tokens"), start, end, shape.stepSeconds),
      queryPrometheusRange(buildQuery("nano_aiu", true), start, end, shape.stepSeconds)
    ]);
    if (settled.every((result) => result.status === "rejected")) {
      throw (settled[0] as PromiseRejectedResult).reason;
    }
    const pick = (index: number): PrometheusMatrixResult[] =>
      settled[index].status === "fulfilled" ? (settled[index] as PromiseFulfilledResult<PrometheusMatrixResult[]>).value : [];
    const [input, output, cacheRead, cold, aiu] = [pick(0), pick(1), pick(2), pick(3), pick(4)];
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
      message: humanErrorDetail(error, "Prometheus")
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
  params?: Record<string, string | number>;
  detail: string;
}

interface EconomySummary {
  efficiencyScore: number | null;
  aiCredits: number | null;
  potentialSavingsCredits: number | null;
  coldCostShare: number | null;
  cacheEfficiency: number | null;
  savingsOpportunities: SavingsOpportunity[];
}

// Local token-economy heuristics. All values are local AIU estimates for
// coaching, not official GitHub billing. The efficiency score rewards cache
// reuse and penalizes cold context, context pressure, and error loops. The
// weights and savings factors live in coachTuning and are env-overridable.
export function computeEconomy(input: {
  aiCredits: number | null;
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
    const cacheComponent = (cacheEfficiency ?? 0) * coachTuning.scoreCacheWeight;
    const coldPenalty = (coldRatio ?? 0) * coachTuning.scoreColdPenalty;
    const contextPenalty = contextPeak == null ? 0 : Math.min(contextPeak / 100, 1) * coachTuning.scoreContextPenalty;
    const errorRate = sessions > 0 ? errors / sessions : 0;
    const errorPenalty = Math.min(errorRate, 1) * coachTuning.scoreErrorPenalty;
    const score = coachTuning.scoreBase + cacheComponent - coldPenalty - contextPenalty - errorPenalty;
    efficiencyScore = Math.max(0, Math.min(100, Math.round(score)));
  }

  const observedCredits = aiCredits ?? 0;
  const coldSavings = observedCredits * (coldRatio ?? 0) * coachTuning.coldSavingsFactor;
  const errorRate = sessions > 0 ? errors / sessions : 0;
  const errorSavings = observedCredits * Math.min(errorRate, 1) * coachTuning.errorSavingsFactor;
  // With no telemetry at all, savings are unknown, not zero.
  const potentialSavingsCredits = aiCredits === null ? null : coldSavings + errorSavings;

  const savingsOpportunities: SavingsOpportunity[] = [
    {
      id: "cold-context",
      label: "Reduce cold context",
      estimateCredits: coldSavings,
      params: { value: Math.round((coldRatio ?? 0) * 100) },
      detail: `${Math.round((coldRatio ?? 0) * 100)}% of prompt tokens were cold input. Reusing warm context lowers cost.`
    },
    {
      id: "error-loops",
      label: "Avoid tool-error loops",
      estimateCredits: errorSavings,
      params: { value: Math.round(errors) },
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
  allowanceSource: AllowanceSource;
  promoActive: boolean;
  observedCredits: number | null;
  utilizationPct: number | null;
  remainingCredits: number | null;
  daysElapsed: number;
  daysInCycle: number;
  daysLeft: number;
  projectedMonthEndCredits: number | null;
  projectedUtilizationPct: number | null;
  dailyRateCredits: number | null;
  daysToExhaustion: number | null;
  projectedExhaustionDate: string | null;
  status: MetricStatus;
  alertLevel: "ok" | "warning" | "critical" | "over";
  message?: string;
}

// At the observed daily rate, when does the included pool run out? Returns
// null when there is no meaningful rate or the pool would outlive the cycle.
export function exhaustionForecast(
  observedCredits: number | null,
  allowanceCredits: number,
  dailyRate: number | null,
  now = new Date()
): { daysToExhaustion: number | null; projectedExhaustionDate: string | null } {
  if (observedCredits === null || allowanceCredits <= 0 || dailyRate === null || dailyRate <= 0) {
    return { daysToExhaustion: null, projectedExhaustionDate: null };
  }
  if (observedCredits >= allowanceCredits) {
    return { daysToExhaustion: 0, projectedExhaustionDate: now.toISOString().slice(0, 10) };
  }
  const days = (allowanceCredits - observedCredits) / dailyRate;
  const date = new Date(now.getTime());
  date.setUTCDate(date.getUTCDate() + Math.floor(days));
  const cycleEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  if (date >= cycleEnd) {
    // The allowance resets before it runs out at the current rate.
    return { daysToExhaustion: null, projectedExhaustionDate: null };
  }
  return {
    daysToExhaustion: Math.round(days * 10) / 10,
    projectedExhaustionDate: date.toISOString().slice(0, 10)
  };
}

interface ModelMixEntry {
  model: string;
  calls: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens: number | null;
  totalTokens: number | null;
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
export function billingCycle(now = new Date()): { daysInCycle: number; daysElapsed: number; daysLeft: number } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const daysInCycle = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const daysElapsed = now.getUTCDate();
  const daysLeft = Math.max(0, daysInCycle - daysElapsed);
  return { daysInCycle, daysElapsed, daysLeft };
}

export function budgetAlertLevel(utilizationPct: number | null): AiCreditsBudgetInsight["alertLevel"] {
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

async function aiCreditsBudgetInsight(override: PlanOverride = {}): Promise<AiCreditsBudgetInsight> {
  const cycle = billingCycle();
  const allowance = resolveAllowance(new Date(), override);
  const allowanceCredits = allowance.credits;
  const monthWindow = `${Math.max(1, cycle.daysElapsed)}d`;
  const observed = await scalarMetric(`${realSessionSum("nano_aiu", monthWindow, "")} / 1e9`);
  const observedCredits = observed.value;
  const status: MetricStatus = observedCredits === null ? "unavailable" : "ok";
  const utilizationPct =
    observedCredits !== null && allowanceCredits > 0
      ? (observedCredits / allowanceCredits) * 100
      : null;
  const remainingCredits =
    observedCredits === null ? null : Math.max(0, allowanceCredits - observedCredits);
  const dailyRate =
    observedCredits !== null && cycle.daysElapsed > 0 ? observedCredits / cycle.daysElapsed : null;
  // Only project month-end consumption once a few days of the cycle have
  // elapsed, so the projection is not dominated by noise at the start of a cycle.
  const canProject = cycle.daysElapsed >= 3;
  const projectedMonthEnd = canProject && dailyRate !== null ? dailyRate * cycle.daysInCycle : null;
  const projectedUtilizationPct =
    projectedMonthEnd !== null && allowanceCredits > 0
      ? (projectedMonthEnd / allowanceCredits) * 100
      : null;
  const exhaustion = canProject
    ? exhaustionForecast(observedCredits, allowanceCredits, dailyRate)
    : { daysToExhaustion: null, projectedExhaustionDate: null };
  return {
    plan: override.plan ?? copilotPlan,
    seats: override.seats ?? copilotSeats,
    monthlyAllowanceCredits: allowanceCredits,
    allowanceSource: allowance.source,
    promoActive: allowance.promoActive,
    observedCredits,
    utilizationPct,
    remainingCredits,
    daysElapsed: cycle.daysElapsed,
    daysInCycle: cycle.daysInCycle,
    daysLeft: cycle.daysLeft,
    projectedMonthEndCredits: projectedMonthEnd,
    projectedUtilizationPct,
    dailyRateCredits: dailyRate,
    daysToExhaustion: exhaustion.daysToExhaustion,
    projectedExhaustionDate: exhaustion.projectedExhaustionDate,
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
  // Token/call fields start null: a model that only appears in the price join
  // must show "no data" for calls/tokens, not a fabricated zero.
  return { model, calls: null, inputTokens: null, outputTokens: null, cachedTokens: null, totalTokens: null, estimatedAiCredits: null, share: null };
}

function applyModelToken(entry: ModelMixEntry, tokenType: string, value: number): void {
  entry.totalTokens = (entry.totalTokens ?? 0) + value;
  const normalized = tokenType.toLowerCase();
  if (normalized.includes("output")) {
    entry.outputTokens = (entry.outputTokens ?? 0) + value;
    return;
  }
  if (normalized.includes("cache")) {
    entry.cachedTokens = (entry.cachedTokens ?? 0) + value;
    return;
  }
  entry.inputTokens = (entry.inputTokens ?? 0) + value;
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
  const totalCalls = [...byModel.values()].reduce((sum, entry) => sum + (entry.calls ?? 0), 0);
  const totalEstimatedAiCredits = [...byModel.values()].reduce((sum, entry) => sum + (entry.estimatedAiCredits ?? 0), 0);
  const entries = [...byModel.values()]
    .map((entry) => ({
      ...entry,
      share: totalEstimatedAiCredits > 0 && entry.estimatedAiCredits !== null ? entry.estimatedAiCredits / totalEstimatedAiCredits : null
    }))
    .filter((entry) => (entry.calls ?? 0) > 0 || (entry.totalTokens ?? 0) > 0 || (entry.estimatedAiCredits ?? 0) > 0)
    .sort((left, right) => (right.estimatedAiCredits ?? 0) - (left.estimatedAiCredits ?? 0) || (right.calls ?? 0) - (left.calls ?? 0));
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
    aiCreditsBudgetInsight(planOverridesFromUrl(url)),
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
    aiCredits: aiCredits.value,
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
    coachTuning,
    billing: billingFacts(new Date(), planOverridesFromUrl(url)),
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
      message: humanErrorDetail(error, "Prometheus")
    };
  }
}

// Inspector: a per-session event log built from the raw Tempo trace, mirroring
// what the VS Code Agent Debug Log panel shows (LLM requests, tool calls,
// hooks, errors, token usage) but grouped by workspace in the local cockpit.
// Sessions exported from VS Code as OTLP JSON and imported with
// import-agent-debug-session.sh/.ps1 land in the same trace store and are
// inspectable the same way.

type InspectorEventType = "llm_request" | "agent_turn" | "tool_call" | "hook" | "other";

interface InspectorEvent {
  spanId: string;
  parentSpanId: string;
  type: InspectorEventType;
  name: string;
  operation: string;
  model: string;
  tool: string;
  agent: string;
  serviceName: string;
  startMs: number;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  error: string | null;
  // Short plain-text previews of the user message and the model response,
  // present only when content capture is enabled in VS Code. The full text
  // never leaves local Tempo; these are truncated for the flow view.
  inputPreview?: string;
  outputPreview?: string;
}

interface InspectorSummary {
  traceId: string;
  spanCount: number;
  llmRequests: number;
  agentTurns: number;
  toolCalls: number;
  hooks: number;
  errors: number;
  totalDurationMs: number | null;
  // Absolute session window, mirroring the VS Code Agent Debug Logs header
  // (Created / Last Activity / Status).
  startedAt: string | null;
  endedAt: string | null;
  sessionStatus: "active" | "idle";
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  cacheEfficiency: number | null;
  cacheBreaks: number;
  modelSwitches: number;
  // Token-weighted view, matching the VS Code Cache Explorer headline:
  // "cacheReadTokens of promptCacheTokens input tokens served from cache
  // across llmRequests requests".
  promptCacheTokens: number;
  cachedTokenShare: number | null;
  requestPairs: number;
  healthyPairs: number;
  avoidableRecomputedTokens: number;
  contentCaptureSeen: boolean;
  models: string[];
  tools: string[];
  services: string[];
}

// Why a prompt-cache prefix broke between two consecutive requests. The
// documented invalidators are a model switch, a system-prompt change, and a
// tool-catalog change; anything else shows up as prefix drift. Cause
// classification beyond the model switch needs prompt/tool content on the
// spans (VS Code setting "Chat > Agent Host > Otel: Capture Content").
export type CacheBreakCause =
  | "model-switch"
  | "system-prompt-change"
  | "tool-catalog-change"
  | "prefix-drift";

// Cache timeline: one entry per LLM request, mirroring the VS Code Cache
// Explorer idea. The hit rate is cache_read / (cache_read + cache_creation)
// for that request; a sharp drop against the previous request or a model
// switch marks where the prompt-cache prefix broke.
interface InspectorCacheTurn {
  seq: number;
  startMs: number;
  model: string;
  inputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  hitRate: number | null;
  modelSwitched: boolean;
  cacheBreak: boolean;
  breakCause: CacheBreakCause | null;
  promptSig: string;
}

// Per-agent action rollup for one session: which agents ran, how many model
// turns and tool calls each made, and what it cost in tokens and errors.
export interface InspectorAgentBreakdown {
  agent: string;
  llmRequests: number;
  toolCalls: number;
  hooks: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

interface InspectorResponse {
  status: MetricStatus;
  message?: string;
  summary: InspectorSummary | null;
  events: InspectorEvent[];
  cacheTimeline: InspectorCacheTurn[];
  agents: InspectorAgentBreakdown[];
}

interface TempoAttribute {
  key: string;
  value?: { stringValue?: string; intValue?: string | number; doubleValue?: number; boolValue?: boolean };
}

function attributeText(value: TempoAttribute["value"]): string {
  if (!value) {
    return "";
  }
  if (value.stringValue !== undefined) {
    return value.stringValue;
  }
  if (value.intValue !== undefined) {
    return String(value.intValue);
  }
  if (value.doubleValue !== undefined) {
    return String(value.doubleValue);
  }
  if (value.boolValue !== undefined) {
    return String(value.boolValue);
  }
  return "";
}

function attributeNumber(value: TempoAttribute["value"]): number | null {
  const text = attributeText(value);
  if (!text) {
    return null;
  }
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : null;
}

// Short stable signature (djb2 as hex) of free-form span content. Only the
// signature ever leaves the API, never the captured text itself, so prompt
// content stays inside the local trace store.
export function contentSignature(text: string): string {
  if (!text) {
    return "";
  }
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash * 33) ^ text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

// Attribute names that can carry the system prompt / tool catalog when
// content capture is enabled. Copilot emits GenAI semantic-convention
// attributes; the older names are kept as fallbacks.
const systemPromptAttributeKeys = [
  "gen_ai.system_instructions",
  "gen_ai.request.system_instructions",
  "gen_ai.input.messages",
  "gen_ai.prompt"
];
const toolCatalogAttributeKeys = [
  "gen_ai.request.tools",
  "gen_ai.tool.definitions",
  "llm.request.functions"
];

function firstAttributeText(attrs: Map<string, TempoAttribute["value"]>, keys: string[]): string {
  for (const key of keys) {
    const text = attributeText(attrs.get(key));
    if (text) {
      return text;
    }
  }
  return "";
}

// Content-capture attribute names that can carry the conversation messages.
const inputMessageAttributeKeys = ["gen_ai.input.messages", "gen_ai.prompt"];
const outputMessageAttributeKeys = ["gen_ai.output.messages", "gen_ai.completion"];

function textFromMessageContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object") {
          const record = part as Record<string, unknown>;
          if (typeof record.text === "string") {
            return record.text;
          }
          if (typeof record.content === "string") {
            return record.content;
          }
        }
        return "";
      })
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

// Pulls a short plain-text preview out of a captured message payload. The
// payload is usually a JSON array of {role, content|parts} records (GenAI
// semantic conventions); for the input side the last message with the wanted
// role wins (that is the current user turn), otherwise the raw text is used.
export function extractMessagePreview(raw: string, role: "user" | "assistant", maxChars = 200): string {
  if (!raw) {
    return "";
  }
  let text = "";
  try {
    const parsed: unknown = JSON.parse(raw);
    const messages = Array.isArray(parsed) ? parsed : [parsed];
    for (const message of messages) {
      if (!message || typeof message !== "object") {
        continue;
      }
      const record = message as Record<string, unknown>;
      const messageRole = typeof record.role === "string" ? record.role.toLowerCase() : "";
      if (messageRole && messageRole !== role) {
        continue;
      }
      const candidate = textFromMessageContent(record.content ?? record.parts ?? record.text);
      if (candidate) {
        text = candidate; // keep iterating: the LAST matching message wins
      }
    }
  } catch {
    text = raw;
  }
  if (!text) {
    return "";
  }
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > maxChars ? `${collapsed.slice(0, maxChars - 1)}…` : collapsed;
}

// Groups a session's events by agent, mirroring the "what did each agent do"
// question: model turns, tool calls, hooks, errors, tokens, and active time.
export function buildAgentBreakdown(
  events: Pick<InspectorEvent, "type" | "agent" | "serviceName" | "durationMs" | "inputTokens" | "outputTokens" | "error">[]
): InspectorAgentBreakdown[] {
  const byAgent = new Map<string, InspectorAgentBreakdown>();
  for (const event of events) {
    const key = event.agent || event.serviceName || "unattributed";
    let entry = byAgent.get(key);
    if (!entry) {
      entry = { agent: key, llmRequests: 0, toolCalls: 0, hooks: 0, errors: 0, inputTokens: 0, outputTokens: 0, durationMs: 0 };
      byAgent.set(key, entry);
    }
    if (event.type === "llm_request") {
      entry.llmRequests += 1;
    } else if (event.type === "tool_call") {
      entry.toolCalls += 1;
    } else if (event.type === "hook") {
      entry.hooks += 1;
    }
    if (event.error) {
      entry.errors += 1;
    }
    entry.inputTokens += event.inputTokens ?? 0;
    entry.outputTokens += event.outputTokens ?? 0;
    entry.durationMs += event.durationMs;
  }
  return [...byAgent.values()].sort((a, b) => b.llmRequests - a.llmRequests || b.toolCalls - a.toolCalls);
}

export function classifyInspectorEvent(operation: string, name: string): InspectorEventType {
  const key = `${operation} ${name}`.toLowerCase();
  if (key.includes("execute_tool") || key.includes("tool")) {
    return "tool_call";
  }
  if (key.includes("execute_hook") || key.includes("hook")) {
    return "hook";
  }
  if (key.includes("invoke_agent")) {
    return "agent_turn";
  }
  if (key.includes("chat") || key.includes("generate") || key.includes("completion")) {
    return "llm_request";
  }
  return "other";
}

export interface CacheAnalysisRequest {
  startMs: number;
  model: string;
  inputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  systemSig: string;
  toolSig: string;
}

export interface CacheAnalysisResult {
  timeline: InspectorCacheTurn[];
  cacheBreaks: number;
  modelSwitches: number;
  requestPairs: number;
  healthyPairs: number;
  avoidableRecomputedTokens: number;
  contentCaptureSeen: boolean;
}

// One pass over the session's LLM requests in chronological order. For every
// consecutive request pair it decides whether the prompt-cache prefix
// survived (healthy pair) or broke, and when it broke, why: model switch and
// (with content capture) system-prompt or tool-catalog changes are the
// documented invalidators; everything else is prefix drift. Avoidable
// recomputed tokens estimate how much cache-write work a break forced that a
// stable prefix would have served from cache.
export function buildCacheAnalysis(requests: CacheAnalysisRequest[], healthyHitRate: number): CacheAnalysisResult {
  const timeline: InspectorCacheTurn[] = [];
  const result: CacheAnalysisResult = {
    timeline,
    cacheBreaks: 0,
    modelSwitches: 0,
    requestPairs: Math.max(0, requests.length - 1),
    healthyPairs: 0,
    avoidableRecomputedTokens: 0,
    contentCaptureSeen: requests.some((request) => request.systemSig !== "" || request.toolSig !== "")
  };
  let previousHit: number | null = null;
  let previousModel = "";
  let previousSystemSig = "";
  let previousToolSig = "";
  let previousCacheable = 0;
  for (const request of requests) {
    const read = request.cacheReadTokens ?? 0;
    const created = request.cacheCreationTokens ?? 0;
    const denominator = read + created;
    const hitRate = denominator > 0 ? read / denominator : null;
    const isFirst = timeline.length === 0;
    const modelSwitched = previousModel !== "" && request.model !== "" && request.model !== previousModel;
    const systemChanged =
      previousSystemSig !== "" && request.systemSig !== "" && request.systemSig !== previousSystemSig;
    const toolsChanged = previousToolSig !== "" && request.toolSig !== "" && request.toolSig !== previousToolSig;
    const hitDropped = hitRate !== null && previousHit !== null && previousHit - hitRate >= 0.3;
    const cacheBreak = !isFirst && (modelSwitched || systemChanged || toolsChanged || hitDropped);
    let breakCause: CacheBreakCause | null = null;
    if (cacheBreak) {
      if (modelSwitched) {
        breakCause = "model-switch";
      } else if (systemChanged) {
        breakCause = "system-prompt-change";
      } else if (toolsChanged) {
        breakCause = "tool-catalog-change";
      } else {
        breakCause = "prefix-drift";
      }
    }
    timeline.push({
      seq: timeline.length + 1,
      startMs: request.startMs,
      model: request.model,
      inputTokens: request.inputTokens,
      cacheReadTokens: request.cacheReadTokens,
      cacheCreationTokens: request.cacheCreationTokens,
      hitRate: hitRate === null ? null : Math.round(hitRate * 1000) / 1000,
      modelSwitched,
      cacheBreak,
      breakCause,
      promptSig: request.systemSig
    });
    if (cacheBreak) {
      result.cacheBreaks += 1;
      // The prefix that was cached before the break had to be re-written.
      // Cap by this request's actual cache writes so the estimate stays
      // grounded in observed tokens.
      result.avoidableRecomputedTokens += Math.round(Math.min(previousCacheable, created));
    }
    if (modelSwitched) {
      result.modelSwitches += 1;
    }
    if (!isFirst && !cacheBreak && hitRate !== null && hitRate >= healthyHitRate) {
      result.healthyPairs += 1;
    }
    if (hitRate !== null) {
      previousHit = hitRate;
    }
    if (request.model) {
      previousModel = request.model;
    }
    if (request.systemSig) {
      previousSystemSig = request.systemSig;
    }
    if (request.toolSig) {
      previousToolSig = request.toolSig;
    }
    previousCacheable = denominator;
  }
  return result;
}

function traceIdFromUrl(url: URL): string | null {
  const raw = (url.searchParams.get("traceId") ?? "").trim().toLowerCase();
  return /^[0-9a-f]{16,32}$/.test(raw) ? raw : null;
}

async function inspectorTrace(url: URL): Promise<InspectorResponse> {
  const traceId = traceIdFromUrl(url);
  if (!traceId) {
    return {
      status: "unavailable",
      message: "Provide a valid traceId query parameter (hex trace id from the Sessions view).",
      summary: null,
      events: [],
      cacheTimeline: [],
      agents: []
    };
  }
  let payload: unknown;
  try {
    const response = await fetchWithTimeout(`${tempoUrl}/api/traces/${traceId}`, {}, 8000);
    if (response.status === 404) {
      return {
        status: "unavailable",
        message: "Trace was not found in Tempo. It may have expired past local retention or not been ingested yet.",
        summary: null,
        events: [],
        cacheTimeline: [],
        agents: []
      };
    }
    if (!response.ok) {
      throw new Error(`Tempo returned HTTP ${response.status}`);
    }
    payload = await response.json();
  } catch (error) {
    return {
      status: "unavailable",
      message: humanErrorDetail(error, "Tempo"),
      summary: null,
      events: [],
      cacheTimeline: [],
      agents: []
    };
  }

  type ParsedEvent = InspectorEvent & { systemSig: string; toolSig: string };
  const events: ParsedEvent[] = [];
  const batches = (payload as { batches?: unknown[] }).batches ?? [];
  for (const batch of batches as {
    resource?: { attributes?: TempoAttribute[] };
    scopeSpans?: { spans?: Record<string, unknown>[] }[];
    instrumentationLibrarySpans?: { spans?: Record<string, unknown>[] }[];
  }[]) {
    const resourceAttrs = new Map<string, string>();
    for (const attr of batch.resource?.attributes ?? []) {
      resourceAttrs.set(attr.key, attributeText(attr.value));
    }
    const serviceName = resourceAttrs.get("service.name") ?? "unknown";
    const scopeGroups = batch.scopeSpans ?? batch.instrumentationLibrarySpans ?? [];
    for (const group of scopeGroups) {
      for (const span of group.spans ?? []) {
        const spanAttrs = new Map<string, TempoAttribute["value"]>();
        for (const attr of (span.attributes as TempoAttribute[] | undefined) ?? []) {
          spanAttrs.set(attr.key, attr.value);
        }
        const text = (key: string) => attributeText(spanAttrs.get(key));
        const num = (key: string) => attributeNumber(spanAttrs.get(key));
        const startNano = Number.parseFloat(String(span.startTimeUnixNano ?? "0"));
        const endNano = Number.parseFloat(String(span.endTimeUnixNano ?? "0"));
        const operation = text("gen_ai.operation.name");
        const name = String(span.name ?? "span");
        const status = span.status as { code?: string | number; message?: string } | undefined;
        const statusError = status && (status.code === 2 || status.code === "STATUS_CODE_ERROR");
        const errorType = text("error.type");
        events.push({
          spanId: String(span.spanId ?? ""),
          parentSpanId: String(span.parentSpanId ?? ""),
          type: classifyInspectorEvent(operation, name),
          name,
          operation,
          model: text("gen_ai.request.model") || text("gen_ai.response.model"),
          tool: text("gen_ai.tool.name"),
          agent: text("gen_ai.agent.name"),
          serviceName,
          startMs: Number.isFinite(startNano) ? startNano / 1e6 : 0,
          durationMs: Number.isFinite(endNano - startNano) ? Math.max(0, (endNano - startNano) / 1e6) : 0,
          inputTokens: num("gen_ai.usage.input_tokens"),
          outputTokens: num("gen_ai.usage.output_tokens"),
          cacheReadTokens: num("gen_ai.usage.cache_read.input_tokens"),
          cacheCreationTokens: num("gen_ai.usage.cache_creation.input_tokens"),
          error: errorType || (statusError ? status?.message || "error" : null),
          inputPreview: extractMessagePreview(firstAttributeText(spanAttrs, inputMessageAttributeKeys), "user") || undefined,
          outputPreview: extractMessagePreview(firstAttributeText(spanAttrs, outputMessageAttributeKeys), "assistant") || undefined,
          systemSig: contentSignature(firstAttributeText(spanAttrs, systemPromptAttributeKeys)),
          toolSig: contentSignature(firstAttributeText(spanAttrs, toolCatalogAttributeKeys))
        });
      }
    }
  }

  if (events.length === 0) {
    return {
      status: "unavailable",
      message: "The trace contains no spans.",
      summary: null,
      events: [],
      cacheTimeline: [],
      agents: []
    };
  }

  events.sort((a, b) => a.startMs - b.startMs);
  const firstStart = events[0].startMs;
  let lastEnd = firstStart;
  const models = new Set<string>();
  const tools = new Set<string>();
  const services = new Set<string>();
  const summary: InspectorSummary = {
    traceId,
    spanCount: events.length,
    llmRequests: 0,
    agentTurns: 0,
    toolCalls: 0,
    hooks: 0,
    errors: 0,
    totalDurationMs: null,
    startedAt: null,
    endedAt: null,
    sessionStatus: "idle",
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    cacheEfficiency: null,
    cacheBreaks: 0,
    modelSwitches: 0,
    promptCacheTokens: 0,
    cachedTokenShare: null,
    requestPairs: 0,
    healthyPairs: 0,
    avoidableRecomputedTokens: 0,
    contentCaptureSeen: false,
    models: [],
    tools: [],
    services: []
  };
  for (const event of events) {
    lastEnd = Math.max(lastEnd, event.startMs + event.durationMs);
    if (event.type === "llm_request") {
      summary.llmRequests += 1;
    } else if (event.type === "agent_turn") {
      summary.agentTurns += 1;
    } else if (event.type === "tool_call") {
      summary.toolCalls += 1;
    } else if (event.type === "hook") {
      summary.hooks += 1;
    }
    if (event.error) {
      summary.errors += 1;
    }
    summary.inputTokens += event.inputTokens ?? 0;
    summary.outputTokens += event.outputTokens ?? 0;
    summary.cacheReadTokens += event.cacheReadTokens ?? 0;
    summary.cacheCreationTokens += event.cacheCreationTokens ?? 0;
    if (event.model) {
      models.add(event.model);
    }
    if (event.tool) {
      tools.add(event.tool);
    }
    services.add(event.serviceName);
    // Relative timeline: the UI shows offsets from the session start.
    event.startMs = Math.round((event.startMs - firstStart) * 10) / 10;
    event.durationMs = Math.round(event.durationMs * 10) / 10;
  }
  summary.totalDurationMs = Math.round((lastEnd - firstStart) * 10) / 10;
  summary.startedAt = Number.isFinite(firstStart) && firstStart > 0 ? new Date(firstStart).toISOString() : null;
  summary.endedAt = Number.isFinite(lastEnd) && lastEnd > 0 ? new Date(lastEnd).toISOString() : null;
  // Mirrors the VS Code session header: a session with no activity in the
  // last two minutes reads as Idle.
  summary.sessionStatus = Date.now() - lastEnd < 120_000 ? "active" : "idle";
  summary.totalTokens =
    summary.inputTokens + summary.outputTokens + summary.cacheReadTokens + summary.cacheCreationTokens;
  const promptTotal = summary.cacheReadTokens + summary.cacheCreationTokens;
  summary.cacheEfficiency = promptTotal > 0 ? summary.cacheReadTokens / promptTotal : null;
  summary.models = [...models].sort((a, b) => a.localeCompare(b));
  summary.tools = [...tools].sort((a, b) => a.localeCompare(b));
  summary.services = [...services].sort((a, b) => a.localeCompare(b));

  // Cache timeline over the LLM requests, in chronological order, with
  // per-pair break/cause classification and the token-weighted totals the
  // VS Code Cache Explorer reports.
  const analysis = buildCacheAnalysis(
    events
      .filter((event) => event.type === "llm_request")
      .map((event) => ({
        startMs: event.startMs,
        model: event.model,
        inputTokens: event.inputTokens,
        cacheReadTokens: event.cacheReadTokens,
        cacheCreationTokens: event.cacheCreationTokens,
        systemSig: event.systemSig,
        toolSig: event.toolSig
      })),
    thresholds.inspectorHealthyHitRate
  );
  summary.cacheBreaks = analysis.cacheBreaks;
  summary.modelSwitches = analysis.modelSwitches;
  summary.requestPairs = analysis.requestPairs;
  summary.healthyPairs = analysis.healthyPairs;
  summary.avoidableRecomputedTokens = analysis.avoidableRecomputedTokens;
  summary.contentCaptureSeen = analysis.contentCaptureSeen;
  summary.promptCacheTokens = promptTotal;
  summary.cachedTokenShare = promptTotal > 0 ? Math.round((summary.cacheReadTokens / promptTotal) * 1000) / 1000 : null;

  // The signatures are internal inputs to the analysis; only the events'
  // public shape leaves the API.
  const publicEvents = events.slice(0, 500).map(({ systemSig: _systemSig, toolSig: _toolSig, ...rest }) => rest);
  return { status: "ok", summary, events: publicEvents, cacheTimeline: analysis.timeline, agents: buildAgentBreakdown(events) };
}

// Long-term history: the jobs container's daily rollup persists per-day,
// per-repo aggregates to DuckDB (developer_daily_rollup) and rebuilds a JSON
// snapshot in the shared analytics volume. This endpoint serves that snapshot
// so the dashboard keeps history beyond the 30-day Prometheus retention.
const longTermHistoryFile = stringFromEnv("LONG_TERM_HISTORY_FILE", "");

interface LongTermEntry {
  day: string;
  repo: string;
  sessions: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  coldInputTokens: number;
  aiCredits: number;
  maxContextPct: number;
  toolCalls: number;
  errors: number;
}

interface LongTermDay {
  day: string;
  sessions: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  coldInputTokens: number;
  aiCredits: number;
  errors: number;
  repos: number;
}

async function longTermHistory(url: URL): Promise<{
  status: MetricStatus;
  message?: string;
  generatedAt: string | null;
  source: string | null;
  repo: string;
  entries: LongTermEntry[];
  days: LongTermDay[];
}> {
  const repo = repoFromUrl(url);
  const empty = { generatedAt: null, source: null, repo: repo ?? "all", entries: [], days: [] };
  if (!longTermHistoryFile) {
    return {
      status: "unavailable",
      message: "Long-term history is not configured (LONG_TERM_HISTORY_FILE is unset).",
      ...empty
    };
  }
  let raw: string;
  try {
    raw = await readFile(longTermHistoryFile, "utf-8");
  } catch {
    return {
      status: "unavailable",
      message: "The long-term snapshot does not exist yet. It is created by the first daily rollup in the jobs container.",
      ...empty
    };
  }
  let snapshot: { generatedAt?: string; source?: string; entries?: LongTermEntry[] };
  try {
    snapshot = JSON.parse(raw) as typeof snapshot;
  } catch {
    return { status: "unavailable", message: "The long-term snapshot could not be parsed.", ...empty };
  }
  const all = Array.isArray(snapshot.entries) ? snapshot.entries : [];
  const entries = (repo ? all.filter((entry) => entry.repo === repo) : all).slice(-2000);
  const byDay = new Map<string, LongTermDay>();
  for (const entry of entries) {
    let day = byDay.get(entry.day);
    if (!day) {
      day = {
        day: entry.day,
        sessions: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        coldInputTokens: 0,
        aiCredits: 0,
        errors: 0,
        repos: 0
      };
      byDay.set(entry.day, day);
    }
    day.sessions += entry.sessions;
    day.inputTokens += entry.inputTokens;
    day.outputTokens += entry.outputTokens;
    day.cacheReadTokens += entry.cacheReadTokens;
    day.coldInputTokens += entry.coldInputTokens;
    day.aiCredits += entry.aiCredits;
    day.errors += entry.errors;
    day.repos += 1;
  }
  const days = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  return {
    status: days.length > 0 ? "ok" : "unavailable",
    message:
      days.length > 0
        ? undefined
        : "No long-term rollups match this scope yet. History accumulates one entry per day per workspace.",
    generatedAt: snapshot.generatedAt ?? null,
    source: snapshot.source ?? null,
    repo: repo ?? "all",
    entries,
    days
  };
}

type ModelTier = "frontier" | "standard" | "unknown";

export interface ModelPrice {
  inputUsdPerMillion: number | null;
  outputUsdPerMillion: number | null;
  tier: ModelTier;
}

// Model prices come from the local registry sidecar
// (copilot_model_price_usd_per_million_ratio). A model counts as frontier tier
// when its output list price crosses the configurable planner threshold, so
// the classification follows whatever prices the user registered instead of a
// hardcoded model list.
async function modelPriceMap(): Promise<Map<string, ModelPrice>> {
  const prices = await seriesMetric(
    "max by (gen_ai_request_model, gen_ai_token_type) (copilot_model_price_usd_per_million_ratio)"
  );
  const byModel = new Map<string, ModelPrice>();
  for (const point of prices.points) {
    const model = point.labels.gen_ai_request_model;
    if (!model) {
      continue;
    }
    let entry = byModel.get(model);
    if (!entry) {
      entry = { inputUsdPerMillion: null, outputUsdPerMillion: null, tier: "unknown" };
      byModel.set(model, entry);
    }
    const tokenType = (point.labels.gen_ai_token_type ?? "").toLowerCase();
    if (tokenType.includes("output")) {
      entry.outputUsdPerMillion = point.value;
    } else if (tokenType.includes("input")) {
      entry.inputUsdPerMillion = point.value;
    }
  }
  for (const entry of byModel.values()) {
    if (entry.outputUsdPerMillion !== null) {
      entry.tier = entry.outputUsdPerMillion >= coachTuning.frontierOutputPriceMinUsdPerMillion ? "frontier" : "standard";
    }
  }
  return byModel;
}

export function modelTierOf(model: string, prices: Map<string, ModelPrice>): ModelTier {
  return prices.get(model)?.tier ?? "unknown";
}

interface PlannerModelSplit {
  tier: ModelTier;
  credits: number;
  sessions: number;
  avgToolCalls: number | null;
  models: string[];
}

interface PlannerReviewSession {
  traceId: string;
  repoShort: string;
  model: string;
  aiCredits: number;
  toolCalls: number;
  outputTokens: number;
}

interface PlannerInsight {
  generatedAt: string;
  scope: string;
  lookbackDays: number;
  horizonWeeks: number;
  plan: string;
  seats: number;
  allowanceCredits: number;
  allowanceSource: AllowanceSource;
  perSeatAllowanceCredits: number;
  creditUsd: number;
  autoModelDiscount: number;
  status: MetricStatus;
  message?: string;
  observed: {
    workspaceCredits: number | null;
    allCredits: number | null;
    workspaceShare: number | null;
    workspaceSessions: number;
    cacheEfficiency: number | null;
  };
  forecast: {
    workspaceDailyCredits: number | null;
    allDailyCredits: number | null;
    workspaceHorizonCredits: number | null;
    allMonthlyCredits: number | null;
    monthUtilizationPct: number | null;
    projectedOverageCredits: number | null;
    projectedOverageUsd: number | null;
    needsOverage: boolean;
  };
  modelStrategy: {
    splits: PlannerModelSplit[];
    frontierShare: number | null;
    frontierComplexAvgToolCalls: number | null;
    lowComplexityFrontierCredits: number;
    reviewSessions: PlannerReviewSession[];
    autoWhatIfSavingsCredits: number | null;
    verdict: "justified" | "review" | "no-frontier" | "no-data";
  };
  justificationMarkdown: string;
}

const plannerLookbackDays: Record<string, number> = { "24h": 1, "7d": 7, "14d": 14, "30d": 30 };

export function plannerLookbackFromUrl(url: URL): { literal: string; days: number } {
  const requested = url.searchParams.get("lookback") ?? "7d";
  const days = plannerLookbackDays[requested];
  return days ? { literal: requested, days } : { literal: "7d", days: 7 };
}

export function plannerWeeksFromUrl(url: URL): number {
  const parsed = Number.parseInt(url.searchParams.get("weeks") ?? "4", 10);
  if (!Number.isFinite(parsed)) {
    return 4;
  }
  return Math.min(26, Math.max(1, parsed));
}

function round2(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100;
}

function buildJustificationMarkdown(insight: PlannerInsight): string {
  const lines: string[] = [];
  const usd = (credits: number | null) =>
    credits === null ? "n/a" : `US$${(credits * insight.creditUsd).toFixed(2)}`;
  lines.push(`# AI Credits plan for ${insight.scope}`);
  lines.push("");
  lines.push(`Prepared from local Frontier Cockpit telemetry (last ${insight.lookbackDays} day(s), horizon ${insight.horizonWeeks} week(s)). Local estimates from OpenTelemetry, not official GitHub billing.`);
  lines.push("");
  lines.push("## Current usage");
  lines.push(`- Copilot plan: ${insight.plan} (${insight.seats} seat(s)), included allowance ${insight.allowanceCredits.toLocaleString()} AI Credits/month (${insight.allowanceSource}).`);
  lines.push(`- Observed in lookback: ${insight.observed.workspaceCredits?.toFixed(1) ?? "n/a"} AI Credits in this scope across ${insight.observed.workspaceSessions} session(s); ${insight.observed.allCredits?.toFixed(1) ?? "n/a"} AI Credits across all local work.`);
  if (insight.observed.cacheEfficiency !== null) {
    lines.push(`- Cache efficiency in scope: ${(insight.observed.cacheEfficiency * 100).toFixed(0)}% of prompt tokens served from cache.`);
  }
  lines.push("");
  lines.push("## Forecast");
  lines.push(`- Daily burn: ${insight.forecast.workspaceDailyCredits?.toFixed(1) ?? "n/a"} AI Credits/day in this scope; ${insight.forecast.allDailyCredits?.toFixed(1) ?? "n/a"} AI Credits/day overall.`);
  lines.push(`- Projected for ${insight.horizonWeeks} week(s) in this scope: ${insight.forecast.workspaceHorizonCredits?.toFixed(0) ?? "n/a"} AI Credits (${usd(insight.forecast.workspaceHorizonCredits)}).`);
  lines.push(`- Projected monthly total (all local work): ${insight.forecast.allMonthlyCredits?.toFixed(0) ?? "n/a"} AI Credits, about ${insight.forecast.monthUtilizationPct?.toFixed(0) ?? "n/a"}% of the included allowance.`);
  if (insight.forecast.needsOverage) {
    lines.push(`- Projected overage: ${insight.forecast.projectedOverageCredits?.toFixed(0)} AI Credits (~${usd(insight.forecast.projectedOverageCredits)}) beyond the included allowance this cycle.`);
    lines.push("");
    lines.push("## Overage request");
    lines.push(`Based on the sustained burn rate above, the included allowance will not cover this cycle. Requesting budget for approximately ${insight.forecast.projectedOverageCredits?.toFixed(0)} additional AI Credits (~${usd(insight.forecast.projectedOverageCredits)}). Overage is billed at per-model API rates at the end of the cycle and requires an admin to enable additional usage with a per-user budget.`);
  } else {
    lines.push("- Projected usage fits inside the included allowance; no overage request is needed at the current rate.");
  }
  lines.push("");
  lines.push("## Model strategy");
  const strategy = insight.modelStrategy;
  if (strategy.verdict === "no-data") {
    lines.push("No per-model telemetry is available yet for this scope.");
  } else if (strategy.verdict === "no-frontier") {
    lines.push("No frontier-tier model usage was observed in this scope. Auto model selection (discounted model costs) plus included models cover the current workload.");
  } else {
    lines.push(`- Frontier-tier models account for ${((strategy.frontierShare ?? 0) * 100).toFixed(0)}% of estimated AI Credits in this scope.`);
    if (strategy.verdict === "justified") {
      lines.push(`- Frontier sessions average ${strategy.frontierComplexAvgToolCalls?.toFixed(1) ?? "n/a"} tool calls, indicating multi-step agent work (complex refactoring, architecture, deep debugging) where stronger reasoning models are the documented recommendation.`);
      lines.push("- Justification: routine work already runs on lower-cost models; the frontier share maps to genuinely complex tasks, so switching it to Auto would likely trade quality and rework time for a small credit saving.");
    } else {
      lines.push(`- ${strategy.lowComplexityFrontierCredits.toFixed(1)} AI Credits went to frontier models in low-complexity sessions (fewer than ${coachTuning.complexSessionMinToolCalls} tool calls). These are candidates for Auto model selection or an included model.`);
    }
    if (strategy.autoWhatIfSavingsCredits !== null) {
      lines.push(`- What-if: running the same chat work through Auto model selection (${(insight.autoModelDiscount * 100).toFixed(0)}% discount on model costs on paid plans) would save roughly ${strategy.autoWhatIfSavingsCredits.toFixed(1)} AI Credits (~${usd(strategy.autoWhatIfSavingsCredits)}).`);
    }
  }
  lines.push("");
  lines.push("---");
  lines.push("Generated by Frontier Cockpit Local. Numbers are local operational estimates; confirm official spend in the GitHub usage dashboard or billing exports before approving budgets.");
  return lines.join("\n");
}

async function planner(url: URL): Promise<PlannerInsight> {
  const repo = repoFromUrl(url);
  const lookback = plannerLookbackFromUrl(url);
  const horizonWeeks = plannerWeeksFromUrl(url);
  const repoLabelMatcher = repoMatcher(repo);
  const cycle = billingCycle();
  const override = planOverridesFromUrl(url);
  const allowance = resolveAllowance(new Date(), override);

  const [scopeCredits, allCredits, sessions, prices, scopeCacheRead, scopeCacheCreation, scopeCold] = await Promise.all([
    scalarMetric(`${realSessionSum("nano_aiu", lookback.literal, repoLabelMatcher)} / 1e9`),
    scalarMetric(`${realSessionSum("nano_aiu", lookback.literal, "")} / 1e9`),
    sessionsBreakdown(lookback.literal, repo),
    modelPriceMap(),
    scalarMetric(realSessionSum("cache_read_tokens", lookback.literal, repoLabelMatcher)),
    scalarMetric(realSessionSum("cache_creation_tokens", lookback.literal, repoLabelMatcher)),
    scalarMetric(realSessionSum("cold_input_tokens", lookback.literal, repoLabelMatcher))
  ]);

  const workspaceCredits = scopeCredits.value;
  const allCreditsValue = allCredits.value;
  const promptTotal = (scopeCacheRead.value ?? 0) + (scopeCacheCreation.value ?? 0) + (scopeCold.value ?? 0);
  const cacheEfficiency = promptTotal > 0 ? (scopeCacheRead.value ?? 0) / promptTotal : null;

  const workspaceDaily = workspaceCredits === null ? null : workspaceCredits / lookback.days;
  const allDaily = allCreditsValue === null ? null : allCreditsValue / lookback.days;
  const workspaceHorizon = workspaceDaily === null ? null : workspaceDaily * 7 * horizonWeeks;
  const allMonthly = allDaily === null ? null : allDaily * cycle.daysInCycle;
  const monthUtilizationPct =
    allMonthly !== null && allowance.credits > 0 ? (allMonthly / allowance.credits) * 100 : null;
  const overageCredits =
    allMonthly !== null && allowance.credits > 0 ? Math.max(0, allMonthly - allowance.credits) : null;
  const needsOverage = (overageCredits ?? 0) > 0;

  // Model strategy is derived from materialized sessions because per-model
  // GenAI metrics are editor-wide and carry no workspace attribution.
  const tierAgg = new Map<ModelTier, { credits: number; sessions: number; toolCalls: number; models: Set<string> }>();
  const reviewSessions: PlannerReviewSession[] = [];
  let frontierToolCalls = 0;
  let frontierSessions = 0;
  let lowComplexityFrontierCredits = 0;
  let sessionCreditsTotal = 0;
  for (const session of sessions.items) {
    const tier = modelTierOf(session.model, prices);
    let agg = tierAgg.get(tier);
    if (!agg) {
      agg = { credits: 0, sessions: 0, toolCalls: 0, models: new Set() };
      tierAgg.set(tier, agg);
    }
    agg.credits += session.aiCredits;
    agg.sessions += 1;
    agg.toolCalls += session.toolCalls;
    agg.models.add(session.model);
    sessionCreditsTotal += session.aiCredits;
    if (tier === "frontier") {
      frontierSessions += 1;
      frontierToolCalls += session.toolCalls;
      if (session.toolCalls < coachTuning.complexSessionMinToolCalls) {
        lowComplexityFrontierCredits += session.aiCredits;
        if (session.aiCredits > 0 && reviewSessions.length < 10) {
          reviewSessions.push({
            traceId: session.traceId,
            repoShort: session.repoShort,
            model: session.model,
            aiCredits: session.aiCredits,
            toolCalls: session.toolCalls,
            outputTokens: session.outputTokens
          });
        }
      }
    }
  }
  const splits: PlannerModelSplit[] = [...tierAgg.entries()]
    .map(([tier, agg]) => ({
      tier,
      credits: agg.credits,
      sessions: agg.sessions,
      avgToolCalls: agg.sessions > 0 ? agg.toolCalls / agg.sessions : null,
      models: [...agg.models].sort((a, b) => a.localeCompare(b))
    }))
    .sort((a, b) => b.credits - a.credits);
  const frontierCredits = tierAgg.get("frontier")?.credits ?? 0;
  const frontierShare = sessionCreditsTotal > 0 ? frontierCredits / sessionCreditsTotal : null;
  const frontierComplexAvgToolCalls = frontierSessions > 0 ? frontierToolCalls / frontierSessions : null;
  const autoWhatIfSavingsCredits =
    sessionCreditsTotal > 0 ? sessionCreditsTotal * autoModelDiscount : null;

  let verdict: PlannerInsight["modelStrategy"]["verdict"];
  if (sessions.items.length === 0) {
    verdict = "no-data";
  } else if (frontierCredits <= 0) {
    verdict = "no-frontier";
  } else if (
    frontierComplexAvgToolCalls !== null &&
    frontierComplexAvgToolCalls >= coachTuning.complexSessionMinToolCalls &&
    lowComplexityFrontierCredits <= frontierCredits * 0.25
  ) {
    verdict = "justified";
  } else {
    verdict = "review";
  }

  const status: MetricStatus = workspaceCredits === null && sessions.items.length === 0 ? "unavailable" : "ok";

  const insight: PlannerInsight = {
    generatedAt: new Date().toISOString(),
    scope: repo ? shortRepoName(repo) : "all workspaces",
    lookbackDays: lookback.days,
    horizonWeeks,
    plan: override.plan ?? copilotPlan,
    seats: override.seats ?? copilotSeats,
    allowanceCredits: allowance.credits,
    allowanceSource: allowance.source,
    perSeatAllowanceCredits: allowance.perSeatCredits,
    creditUsd: aiCreditUsd,
    autoModelDiscount,
    status,
    message:
      status === "unavailable"
        ? "No workspace telemetry is available for this scope and lookback yet. Run Copilot sessions inside a Git repository first."
        : undefined,
    observed: {
      workspaceCredits: round2(workspaceCredits),
      allCredits: round2(allCreditsValue),
      workspaceShare:
        workspaceCredits !== null && allCreditsValue !== null && allCreditsValue > 0
          ? round2(workspaceCredits / allCreditsValue)
          : null,
      workspaceSessions: sessions.items.length,
      cacheEfficiency: round2(cacheEfficiency)
    },
    forecast: {
      workspaceDailyCredits: round2(workspaceDaily),
      allDailyCredits: round2(allDaily),
      workspaceHorizonCredits: round2(workspaceHorizon),
      allMonthlyCredits: round2(allMonthly),
      monthUtilizationPct: round2(monthUtilizationPct),
      projectedOverageCredits: round2(overageCredits),
      projectedOverageUsd: round2(overageCredits === null ? null : overageCredits * aiCreditUsd),
      needsOverage
    },
    modelStrategy: {
      splits,
      frontierShare: round2(frontierShare),
      frontierComplexAvgToolCalls: round2(frontierComplexAvgToolCalls),
      lowComplexityFrontierCredits: Math.round(lowComplexityFrontierCredits * 100) / 100,
      reviewSessions,
      autoWhatIfSavingsCredits: round2(autoWhatIfSavingsCredits),
      verdict
    },
    justificationMarkdown: ""
  };
  insight.justificationMarkdown = buildJustificationMarkdown(insight);
  return insight;
}

type CoachSeverity = "good" | "info" | "warning" | "critical";

interface CoachCard {
  id: string;
  severity: CoachSeverity;
  title: string;
  insight: string;
  action: string;
  params?: Record<string, string | number>;
}

type SummaryResult = Awaited<ReturnType<typeof summary>>;

interface CoachContext {
  tokens: SummaryResult["metrics"]["tokens"];
  aiCredits: number | null;
  contextPeak: number | null;
  compactions: number | null;
  errors: number;
  nonWorkspace: number;
  budget: AiCreditsBudgetInsight;
  mix: ModelMix;
  sessions: SessionRecord[];
  modelPrices: Map<string, ModelPrice>;
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
        params: { value: (tokens.cacheEfficiency * 100).toFixed(0) },
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
        params: { value: (tokens.coldRatio * 100).toFixed(0) },
        title: "Reduce cold context",
        insight: `${(tokens.coldRatio * 100).toFixed(0)}% of prompt tokens were uncached cold input. Cold context is the most expensive token class.`,
        action: "Attach only what the task needs: #-mention specific files, folders, or symbols instead of #codebase, work in shorter related steps within one session so context stays warm, and drop stale attachments."
      }
      : null,
  ({ contextPeak }) =>
    contextPeak !== null && contextPeak >= thresholds.contextWarnPct
      ? {
        id: "context-pressure",
        severity: contextPeak >= thresholds.contextCritPct ? "critical" : "warning",
        params: { value: contextPeak.toFixed(0) },
        title: "Manage context window pressure",
        insight: `Peak context utilization reached ${contextPeak.toFixed(0)}%. Near-full context raises cost and can degrade answer quality.`,
        action: "Run /compact (optionally with focus instructions, e.g. \"/compact focus on the schema decisions\") to summarize the conversation, split large tasks into smaller prompts, start a fresh session for unrelated work, and remove stale attachments."
      }
      : null,
  // Manual compaction guidance: when the window is under pressure but no
  // compaction has happened yet, the cheapest fix is a targeted /compact
  // before VS Code is forced into an automatic one.
  ({ contextPeak, compactions }) =>
    contextPeak !== null &&
    contextPeak >= thresholds.contextWarnPct &&
    compactions !== null &&
    Math.round(compactions) === 0
      ? {
        id: "context-compact-now",
        severity: "info",
        params: { value: contextPeak.toFixed(0) },
        title: "Compact before the window fills",
        insight: `Context reached ${contextPeak.toFixed(0)}% of the window but no compaction ran in this range. When the window fills, VS Code auto-compacts at a moment you do not control, and every request keeps paying for the accumulated history.`,
        action: "Watch the context window control in the chat input, and run /compact with focus instructions at a natural checkpoint so the summary keeps what matters. Every subsequent request then sends fewer tokens."
      }
      : null,
  // The opposite signal: many compactions in a short range means sessions run
  // far past their useful scope, which also degrades prompt-cache reuse.
  ({ compactions }) =>
    compactions !== null && Math.round(compactions) > thresholds.contextCompactionsInfo
      ? {
        id: "context-session-scope",
        severity: "info",
        params: { value: Math.round(compactions), threshold: thresholds.contextCompactionsInfo },
        title: "Scope sessions tighter",
        insight: `${Math.round(compactions)} context compactions ran in this range (guardrail: ${thresholds.contextCompactionsInfo}). Frequent summarization means conversations regularly outgrow the window; each compaction also rewrites the prompt prefix, which resets the prompt cache.`,
        action: "Start a new chat session per task instead of one long-running conversation, keep #-mentions targeted, and use /compact deliberately at task boundaries rather than letting auto-compaction fire mid-task."
      }
      : null,
  ({ errors }) =>
    errors > 0
      ? {
        id: "errors",
        severity: "warning",
        params: { value: Math.round(errors) },
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
        params: { value: Math.round(nonWorkspace) },
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
        params: {
          projected: budget.projectedMonthEndCredits === null ? "?" : budget.projectedMonthEndCredits.toFixed(0),
          pct: budget.projectedUtilizationPct.toFixed(0),
          allowance: budget.monthlyAllowanceCredits,
          plan: budget.plan
        },
        title: "Pace your AI Credits pool",
        insight: `At the current daily rate, local AI Credits would reach about ${budget.projectedMonthEndCredits === null ? "?" : budget.projectedMonthEndCredits.toFixed(0)} by the end of the cycle, roughly ${budget.projectedUtilizationPct.toFixed(0)}% of the configured ${budget.monthlyAllowanceCredits} credit pool for the ${budget.plan} plan. This is a local estimate, not official billing.`,
        action: "Reduce cold context, prefer Auto model selection or an included model for routine work, and avoid retrying large prompts before fixing the root cause. If the overshoot is sustained, open the Planner view to draft an overage request with real numbers."
      }
      : null,
  ({ mix }) =>
    mix.entries.length > 0 && (mix.entries[0].share ?? 0) > thresholds.modelConcentrationInfo
      ? {
        id: "model-cost-concentration",
        severity: "info",
        params: { model: mix.entries[0].model, share: ((mix.entries[0].share ?? 0) * 100).toFixed(0) },
        title: "Watch model cost concentration",
        insight: `${mix.entries[0].model} accounts for ${((mix.entries[0].share ?? 0) * 100).toFixed(0)}% of estimated model AI Credits in this range. All billed model interactions consume AI Credits based on model and tokens.`,
        action: "Use a less expensive capable model for routine work and reserve higher-cost models for tasks that genuinely need stronger reasoning."
      }
      : null,
  // Auto model selection routes each prompt to a capable model and is billed
  // with a discount on model costs on paid plans, so heavy frontier-tier spend
  // on simple work is the clearest documented savings opportunity.
  ({ mix, sessions, modelPrices }) => {
    const frontierCredits = mix.entries
      .filter((entry) => modelTierOf(entry.model, modelPrices) === "frontier")
      .reduce((sum, entry) => sum + (entry.estimatedAiCredits ?? 0), 0);
    const totalCredits = mix.totalEstimatedAiCredits ?? 0;
    if (totalCredits <= 0 || frontierCredits / totalCredits <= 0.5) {
      return null;
    }
    const simpleFrontier = sessions.filter(
      (session) =>
        modelTierOf(session.model, modelPrices) === "frontier" &&
        session.toolCalls < coachTuning.complexSessionMinToolCalls &&
        session.aiCredits > 0
    );
    if (simpleFrontier.length === 0) {
      return null;
    }
    const movableCredits = simpleFrontier.reduce((sum, session) => sum + session.aiCredits, 0);
    return {
      id: "auto-model-adoption",
      severity: "info",
      params: { count: simpleFrontier.length, credits: movableCredits.toFixed(1), discount: (autoModelDiscount * 100).toFixed(0) },
      title: "Try Auto model selection for routine work",
      insight: `${simpleFrontier.length} low-complexity session(s) used frontier-tier models and spent ${movableCredits.toFixed(1)} AI Credits. Auto model selection routes each prompt to a capable model and is billed with a ${(autoModelDiscount * 100).toFixed(0)}% discount on model costs on paid plans.`,
      action: "Set the model picker to Auto for everyday edits, boilerplate, and questions. Pick a specific frontier model only for complex refactoring, architecture, or multi-step debugging, and keep one model per session so the prompt cache stays valid."
    };
  },
  ({ tokens }) => {
    const input = tokens.input.value;
    const output = tokens.output.value;
    if (input === null || output === null || output <= 0 || input / output <= thresholds.promptIoRatioInfo) {
      return null;
    }
    return {
      id: "prompt-io",
      severity: "info",
      params: { ratio: (input / output).toFixed(0) },
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
        params: { value: aiCredits.toFixed(1), threshold: thresholds.aiCreditsCrit },
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
      params: { credits: lead.aiCredits.toFixed(2), model: lead.model, repo: lead.repoShort },
      title: "Watch your most expensive sessions",
      insight: `Your highest-cost session used ${lead.aiCredits.toFixed(2)} AI credits with model ${lead.model} in ${lead.repoShort}.`,
      action: "Review whether these sessions needed a frontier model. Lighter tasks can use a smaller model to save credits."
    };
  }
];

function buildCoachCards(data: SummaryResult, sessions: SessionRecord[], modelPrices: Map<string, ModelPrice>): CoachCard[] {
  const context: CoachContext = {
    tokens: data.metrics.tokens,
    aiCredits: data.metrics.aiCredits.value,
    contextPeak: data.metrics.context.peak.value,
    compactions: data.outcomes.contextCompactions.value,
    errors: data.metrics.activity.errors.value ?? 0,
    nonWorkspace: data.metrics.dataQuality.nonWorkspaceReal.value ?? 0,
    budget: data.budget,
    mix: data.modelMix,
    sessions,
    modelPrices
  };

  const cards = coachRules
    .map((rule) => rule(context))
    .filter((card): card is CoachCard => card !== null);

  if (cards.length === 0) {
    cards.push({
      id: "healthy",
      severity: "good",
      params: {},
      title: "Usage looks healthy",
      insight: "Cache reuse, cold context, context pressure, and AI credits are all within the local guardrails for this range.",
      action: "Keep working as you are. Revisit this view after larger agent sessions to stay efficient."
    });
  }

  return cards;
}

async function coach(url: URL) {
  const [data, sessions, modelPrices] = await Promise.all([
    summary(url),
    sessionsBreakdown(rangeFromUrl(url), repoFromUrl(url)),
    modelPriceMap()
  ]);
  return {
    generatedAt: new Date().toISOString(),
    range: data.range,
    repo: data.repo,
    cards: buildCoachCards(data, sessions.items, modelPrices),
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
  "/api/coach": async (url, response) => jsonResponse(response, 200, await coach(url)),
  "/api/plans": (url, response) => jsonResponse(response, 200, billingFacts(new Date(), planOverridesFromUrl(url))),
  "/api/planner": async (url, response) => jsonResponse(response, 200, await planner(url)),
  "/api/inspector": async (url, response) => jsonResponse(response, 200, await inspectorTrace(url)),
  "/api/history/long-term": async (url, response) => jsonResponse(response, 200, await longTermHistory(url))
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

// Tests import this module with FRONTIER_API_DISABLE_LISTEN=true to reach the
// exported pure functions without binding a port.
if (process.env.FRONTIER_API_DISABLE_LISTEN !== "true") {
  server.listen(port, "0.0.0.0", () => {
    console.log(`Frontier Dashboard API listening on port ${port}`);
  });
}
