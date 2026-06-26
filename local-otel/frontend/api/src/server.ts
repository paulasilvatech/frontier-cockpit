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
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\n/g, "\\n");
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
    const [multipliers, prices] = await Promise.all([
      queryPrometheus("count(copilot_model_premium_request_multiplier_ratio)"),
      queryPrometheus("count(copilot_model_price_usd_per_million_ratio)")
    ]);
    const multiplierCount = multipliers.length > 0 ? numericValue(multipliers[0]) ?? 0 : 0;
    const priceCount = prices.length > 0 ? numericValue(prices[0]) ?? 0 : 0;
    if (multiplierCount > 0 && priceCount > 0) {
      return {
        id: "copilot-otel-registry",
        name: "Model and price registry sidecar",
        status: "ok",
        detail: `${multiplierCount} multiplier series and ${priceCount} price series are live.`,
        checkedAt
      };
    }
    return {
      id: "copilot-otel-registry",
      name: "Model and price registry sidecar",
      status: "degraded",
      detail: "Registry metrics are not live yet in Prometheus.",
      checkedAt
    };
  } catch (error) {
    return {
      id: "copilot-otel-registry",
      name: "Model and price registry sidecar",
      status: "unavailable",
      detail: error instanceof Error ? error.message : "Registry metrics could not be checked.",
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

async function repositories(): Promise<string[]> {
  try {
    const results = await queryPrometheus('max by (repo) (copilot_real_session_input_tokens_ratio{usage_scope="workspace_real",repo!=""})');
    return [...new Set(results.map((result) => result.metric.repo).filter(Boolean))].sort();
  } catch (error) {
    console.warn("Repository list is unavailable.", error instanceof Error ? error.message : error);
    return [];
  }
}

function appLinks() {
  const tempoExploreQuery = encodeURIComponent('{"datasource":"tempo-local","queries":[{"query":"{service.name=\\"copilot-chat\\"}"}],"range":{"from":"now-1h","to":"now"}}');
  const lokiExploreQuery = encodeURIComponent('{"datasource":"loki-local","queries":[{"expr":"{service_name=\\"copilot-chat\\"}"}],"range":{"from":"now-1h","to":"now"}}');
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

async function summary(url: URL) {
  const range = rangeFromUrl(url);
  const repo = repoFromUrl(url);
  const repoLabelMatcher = repoMatcher(repo);
  const aiuQuery = `sum(max_over_time(copilot_real_session_nano_aiu_ratio{usage_scope="workspace_real"${repoLabelMatcher}}[${range}])) / 1e9`;
  const tokensQuery = `sum by (gen_ai_request_model, gen_ai_token_type) (increase(gen_ai_client_token_usage_sum{service_name="copilot-chat"}[${range}]))`;
  const usdQuery = `sum by (gen_ai_request_model) ((increase(gen_ai_client_token_usage_sum{service_name="copilot-chat"}[${range}]) / 1e6) * on (gen_ai_request_model, gen_ai_token_type) group_left() max by (gen_ai_request_model, gen_ai_token_type) (copilot_model_price_usd_per_million_ratio))`;
  const premiumQuery = `sum by (gen_ai_request_model) (increase(gen_ai_client_operation_duration_count{service_name="copilot-chat"}[${range}])) * on (gen_ai_request_model) group_left() max by (gen_ai_request_model) (copilot_model_premium_request_multiplier_ratio{model_key_kind="telemetry_label"})`;
  const workspaceRealQuery = `count(max_over_time(copilot_real_session_input_tokens_ratio{usage_scope="workspace_real"${repoLabelMatcher}}[${range}]))`;
  const nonWorkspaceRealQuery = `count(max_over_time(copilot_real_session_input_tokens_ratio{usage_scope="non_workspace_real"}[${range}]))`;
  const observedCoverageQuery = `sum(max_over_time(copilot_otel_coverage_status_ratio{status="observed"}[${range}]))`;
  const notObservedCoverageQuery = `count(max_over_time(copilot_otel_coverage_status_ratio{status!="observed"}[${range}]))`;

  const [
    health,
    repoValues,
    aiu,
    tokens,
    usdWhatIf,
    premiumRequestEquivalent,
    workspaceReal,
    nonWorkspaceReal,
    observedCoverage,
    notObservedYet
  ] = await Promise.all([
    stackHealth(),
    repositories(),
    scalarMetric(aiuQuery),
    seriesMetric(tokensQuery),
    seriesMetric(usdQuery),
    seriesMetric(premiumQuery),
    scalarMetric(workspaceRealQuery),
    scalarMetric(nonWorkspaceRealQuery),
    scalarMetric(observedCoverageQuery),
    scalarMetric(notObservedCoverageQuery)
  ]);

  return {
    range,
    repo: repo ?? "all",
    refreshedAt: new Date().toISOString(),
    health,
    repositories: repoValues,
    links: appLinks(),
    metrics: {
      aiu,
      tokens,
      usdWhatIf,
      premiumRequestEquivalent,
      dataQuality: {
        workspaceReal,
        nonWorkspaceReal,
        observedCoverage,
        notObservedYet
      }
    },
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

const server = http.createServer((request, response) => {
  void (async () => {
    if (!request.url) {
      errorResponse(response, 400, "Missing request URL");
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && url.pathname === "/health") {
      textResponse(response, 200, "ok\n");
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      jsonResponse(response, 200, { status: "ok", checkedAt: new Date().toISOString() });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/links") {
      jsonResponse(response, 200, { links: appLinks() });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/repositories") {
      jsonResponse(response, 200, { repositories: await repositories() });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/summary") {
      jsonResponse(response, 200, await summary(url));
      return;
    }

    errorResponse(response, 404, "Not found");
  })().catch((error) => {
    errorResponse(response, 500, error instanceof Error ? error.message : "Unexpected API error");
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Frontier Dashboard API listening on port ${port}`);
});
