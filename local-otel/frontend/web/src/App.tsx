import { useCallback, useEffect, useMemo, useState } from "react";

type RangeOption = "1h" | "6h" | "24h" | "7d";
type ServiceStatus = "ok" | "degraded" | "unavailable";
type MetricStatus = "ok" | "unavailable";

interface ServiceHealth {
  id: string;
  name: string;
  status: ServiceStatus;
  detail: string;
  checkedAt: string;
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

interface AppLink {
  label: string;
  url: string;
}

interface SummaryResponse {
  range: RangeOption;
  repo: string;
  refreshedAt: string;
  health: ServiceHealth[];
  repositories: string[];
  links: AppLink[];
  metrics: {
    aiu: ScalarMetric;
    tokens: SeriesMetric;
    usdWhatIf: SeriesMetric;
    premiumRequestEquivalent: SeriesMetric;
    dataQuality: {
      workspaceReal: ScalarMetric;
      nonWorkspaceReal: ScalarMetric;
      observedCoverage: ScalarMetric;
      notObservedYet: ScalarMetric;
    };
  };
  officialBilling: {
    status: "unavailable";
    reason: string;
  };
  dataBoundary: {
    localOnly: string[];
    safeForwarding: string[];
  };
}

const rangeOptions: RangeOption[] = ["1h", "6h", "24h", "7d"];

function formatNumber(value: number | null, digits = 2): string {
  if (value === null || Number.isNaN(value)) {
    return "Unavailable";
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits
  }).format(value);
}

function formatCurrency(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "Unavailable";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4
  }).format(value);
}

function sumSeries(metric: SeriesMetric): number | null {
  if (metric.points.length === 0) {
    return null;
  }
  return metric.points.reduce((total, point) => total + point.value, 0);
}

function statusLabel(status: ServiceStatus | MetricStatus): string {
  return status.replace("-", " ");
}

function statusClass(status: ServiceStatus | MetricStatus): string {
  return `status status-${status}`;
}

function Card({
  title,
  value,
  caption,
  status
}: {
  title: string;
  value: string;
  caption: string;
  status: MetricStatus;
}) {
  return (
    <section className="metric-card">
      <div className="metric-card-header">
        <h3>{title}</h3>
        <span className={statusClass(status)}>{statusLabel(status)}</span>
      </div>
      <div className="metric-value">{value}</div>
      <p>{caption}</p>
    </section>
  );
}

function SeriesTable({
  title,
  metric,
  columns
}: {
  title: string;
  metric: SeriesMetric;
  columns: { label: string; field: string }[];
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
        <span className={statusClass(metric.status)}>{statusLabel(metric.status)}</span>
      </div>
      {metric.points.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.field}>{column.label}</th>
                ))}
                <th className="numeric">Value</th>
              </tr>
            </thead>
            <tbody>
              {metric.points
                .slice()
                .sort((a, b) => b.value - a.value)
                .map((point, index) => (
                  <tr key={`${title}-${index}`}>
                    {columns.map((column) => (
                      <td key={column.field}>{point.labels[column.field] ?? "unlabeled"}</td>
                    ))}
                    <td className="numeric">{formatNumber(point.value, 4)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">{metric.message ?? "No data is available for the selected range."}</p>
      )}
    </section>
  );
}

export default function App() {
  const [selectedRange, setSelectedRange] = useState<RangeOption>("1h");
  const [selectedRepo, setSelectedRepo] = useState("all");
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ range: selectedRange, repo: selectedRepo });
      const response = await fetch(`/api/summary?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Dashboard API returned HTTP ${response.status}`);
      }
      const payload = (await response.json()) as SummaryResponse;
      setSummary(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load dashboard data.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedRange, selectedRepo]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const totals = useMemo(() => {
    return {
      tokens: summary ? sumSeries(summary.metrics.tokens) : null,
      usd: summary ? sumSeries(summary.metrics.usdWhatIf) : null,
      premium: summary ? sumSeries(summary.metrics.premiumRequestEquivalent) : null
    };
  }, [summary]);

  const healthCounts = useMemo(() => {
    const services = summary?.health ?? [];
    return {
      ok: services.filter((service) => service.status === "ok").length,
      degraded: services.filter((service) => service.status === "degraded").length,
      unavailable: services.filter((service) => service.status === "unavailable").length
    };
  }, [summary]);

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">Frontier Cockpit</p>
          <h1>Frontier Developer Cockpit</h1>
          <p>
            Local Docker Desktop view for GitHub Copilot operational telemetry. AIU is local telemetry,
            premium-request-equivalents are estimates, and USD values are planning assumptions unless
            official GitHub billing data is connected.
          </p>
        </div>
        <div className="hero-actions">
          <button type="button" onClick={() => void loadSummary()} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
          <span>{summary ? `Fresh as of ${new Date(summary.refreshedAt).toLocaleTimeString()}` : "Waiting for data"}</span>
        </div>
      </header>

      <section className="controls">
        <div>
          <label>Time range</label>
          <div className="segmented">
            {rangeOptions.map((range) => (
              <button
                key={range}
                type="button"
                className={selectedRange === range ? "active" : ""}
                onClick={() => setSelectedRange(range)}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="repo">Workspace or repository</label>
          <select id="repo" value={selectedRepo} onChange={(event) => setSelectedRepo(event.target.value)}>
            <option value="all">All observed repositories</option>
            {(summary?.repositories ?? []).map((repo) => (
              <option key={repo} value={repo}>
                {repo}
              </option>
            ))}
          </select>
        </div>
      </section>

      {error ? <div className="error">{error}</div> : null}

      <section className="cards-grid">
        <Card
          title="Real AIU consumed"
          value={formatNumber(summary?.metrics.aiu.value ?? null, 6)}
          status={summary?.metrics.aiu.status ?? "unavailable"}
          caption="From copilot_real_session_nano_aiu_ratio divided by 1e9. Local operational telemetry, not official billing."
        />
        <Card
          title="Token volume"
          value={formatNumber(totals.tokens, 0)}
          status={summary?.metrics.tokens.status ?? "unavailable"}
          caption="Grouped by gen_ai_request_model and gen_ai_token_type when local telemetry is present."
        />
        <Card
          title="USD what-if"
          value={formatCurrency(totals.usd)}
          status={summary?.metrics.usdWhatIf.status ?? "unavailable"}
          caption="Local planning assumption from token volume and registered model prices. Not official spend."
        />
        <Card
          title="Premium-request-equivalent"
          value={formatNumber(totals.premium, 2)}
          status={summary?.metrics.premiumRequestEquivalent.status ?? "unavailable"}
          caption="Planning estimate from local LLM calls and GitHub Copilot model multipliers. Agent mode can make multiple calls per prompt."
        />
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Stack health</h2>
          <span className="health-summary">
            {healthCounts.ok} ok, {healthCounts.degraded} degraded, {healthCounts.unavailable} unavailable
          </span>
        </div>
        <div className="health-grid">
          {(summary?.health ?? []).map((service) => (
            <article className="health-card" key={service.id}>
              <div>
                <h3>{service.name}</h3>
                <p>{service.detail}</p>
              </div>
              <span className={statusClass(service.status)}>{statusLabel(service.status)}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="panel two-column">
        <div>
          <div className="panel-header">
            <h2>Data quality</h2>
          </div>
          <dl className="quality-grid">
            <div>
              <dt>workspace_real sessions</dt>
              <dd>{formatNumber(summary?.metrics.dataQuality.workspaceReal.value ?? null, 0)}</dd>
            </div>
            <div>
              <dt>non_workspace_real sessions</dt>
              <dd>{formatNumber(summary?.metrics.dataQuality.nonWorkspaceReal.value ?? null, 0)}</dd>
            </div>
            <div>
              <dt>Observed coverage signals</dt>
              <dd>{formatNumber(summary?.metrics.dataQuality.observedCoverage.value ?? null, 0)}</dd>
            </div>
            <div>
              <dt>not_observed_yet signals</dt>
              <dd>{formatNumber(summary?.metrics.dataQuality.notObservedYet.value ?? null, 0)}</dd>
            </div>
          </dl>
          <p className="muted">Missing values are shown as unavailable. The app does not fabricate telemetry.</p>
        </div>
        <div>
          <div className="panel-header">
            <h2>Official billing status</h2>
            <span className="status status-unavailable">{summary?.officialBilling.status ?? "unavailable"}</span>
          </div>
          <p>{summary?.officialBilling.reason}</p>
        </div>
      </section>

      {summary ? (
        <>
          <SeriesTable
            title="Tokens by model and token type"
            metric={summary.metrics.tokens}
            columns={[
              { label: "Model label", field: "gen_ai_request_model" },
              { label: "Token type", field: "gen_ai_token_type" }
            ]}
          />
          <SeriesTable
            title="USD what-if by model"
            metric={summary.metrics.usdWhatIf}
            columns={[{ label: "Model label", field: "gen_ai_request_model" }]}
          />
          <SeriesTable
            title="Premium-request-equivalent estimate by model"
            metric={summary.metrics.premiumRequestEquivalent}
            columns={[{ label: "Model label", field: "gen_ai_request_model" }]}
          />
        </>
      ) : null}

      <section className="panel two-column">
        <div>
          <h2>Data boundary</h2>
          <p>
            The browser uses the dashboard API proxy. It does not query PostgreSQL, DuckDB files, Aspire
            Dashboard API keys, or raw Loki content directly.
          </p>
          <h3>Local only by default</h3>
          <ul>{(summary?.dataBoundary.localOnly ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
          <h3>Eligible for governed forwarding</h3>
          <ul>{(summary?.dataBoundary.safeForwarding ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div>
          <h2>Drill-down links</h2>
          <div className="link-grid">
            {(summary?.links ?? []).map((link) => (
              <a href={link.url} key={link.label} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
          </div>
          <p className="muted">Trace drill-down opens Aspire Dashboard or Grafana Explore instead of embedding raw trace content.</p>
        </div>
      </section>
    </main>
  );
}
