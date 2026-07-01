import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CoachResponse,
  HistoryPoint,
  RangeOption,
  SessionRecord,
  SessionsResponse,
  SummaryResponse
} from "./types";
import {
  AlertsBanner,
  CompositionBar,
  Kpi,
  Panel,
  TrendChart,
  cacheTone,
  formatCompact,
  formatCurrency,
  formatNumber,
  formatPercent,
  statusClass,
  statusLabel,
  sumSeries,
  type HistoryField
} from "./ui";

const rangeOptions: RangeOption[] = ["1h", "6h", "24h", "7d"];

type ViewId = "overview" | "sessions" | "workspaces" | "coach" | "history" | "health" | "settings";

interface ViewDef {
  id: ViewId;
  label: string;
  icon: string;
  blurb: string;
}

const views: ViewDef[] = [
  { id: "overview", label: "Overview", icon: "◎", blurb: "AI credits, tokens, alerts" },
  { id: "sessions", label: "Sessions", icon: "≣", blurb: "Per-session cost and models" },
  { id: "workspaces", label: "Workspaces", icon: "▤", blurb: "Compare all projects" },
  { id: "coach", label: "Coach", icon: "✦", blurb: "Recommendations to save credits" },
  { id: "history", label: "History", icon: "📈", blurb: "Usage over time" },
  { id: "health", label: "Health", icon: "♥", blurb: "Stack and data quality" },
  { id: "settings", label: "Settings", icon: "⚙", blurb: "Thresholds and boundary" }
];

const historyFields: { field: HistoryField; label: string; tone: string }[] = [
  { field: "aiCredits", label: "AI credits", tone: "credits" },
  { field: "inputTokens", label: "Input tokens", tone: "input" },
  { field: "cacheReadTokens", label: "Cached (hot)", tone: "hot" },
  { field: "coldInputTokens", label: "Cold input", tone: "cold" },
  { field: "outputTokens", label: "Output tokens", tone: "output" }
];

interface DashboardData {
  summary: SummaryResponse | null;
  sessions: SessionsResponse | null;
  coach: CoachResponse | null;
}

function useDashboardData(range: RangeOption, repo: string) {
  const [data, setData] = useState<DashboardData>({ summary: null, sessions: null, coach: null });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ range, repo });
      const query = params.toString();
      const [summaryRes, sessionsRes, coachRes] = await Promise.all([
        fetch(`/api/summary?${query}`, { cache: "no-store" }),
        fetch(`/api/sessions?${query}`, { cache: "no-store" }),
        fetch(`/api/coach?${query}`, { cache: "no-store" })
      ]);
      if (!summaryRes.ok) {
        throw new Error(`Dashboard API returned HTTP ${summaryRes.status}`);
      }
      const summary = (await summaryRes.json()) as SummaryResponse;
      const sessions = sessionsRes.ok ? ((await sessionsRes.json()) as SessionsResponse) : null;
      const coach = coachRes.ok ? ((await coachRes.json()) as CoachResponse) : null;
      setData({ summary, sessions, coach });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load dashboard data.");
    } finally {
      setIsLoading(false);
    }
  }, [range, repo]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, isLoading, reload: load };
}

function KpiStrip({ summary }: { summary: SummaryResponse | null }) {
  const tokens = summary?.metrics.tokens;
  return (
    <section className="kpi-strip">
      <Kpi
        label="AI credits used"
        tone="credits"
        available={summary?.metrics.aiCredits.value != null}
        value={formatNumber(summary?.metrics.aiCredits.value ?? null, 2)}
        sub="Local AIU equivalent"
      />
      <Kpi
        label="Sessions"
        tone="neutral"
        available={summary?.metrics.sessions.value != null}
        value={formatNumber(summary?.metrics.sessions.value ?? null, 0)}
        sub="Workspace-attributed"
      />
      <Kpi
        label="Input tokens"
        tone="input"
        available={tokens?.input.value != null}
        value={formatCompact(tokens?.input.value ?? null)}
        sub={`${formatNumber(tokens?.input.value ?? null, 0)} total`}
      />
      <Kpi
        label="Output tokens"
        tone="output"
        available={tokens?.output.value != null}
        value={formatCompact(tokens?.output.value ?? null)}
        sub={`${formatNumber(tokens?.output.value ?? null, 0)} total`}
      />
      <Kpi
        label="Cached (hot)"
        tone="hot"
        available={tokens?.cacheRead.value != null}
        value={formatCompact(tokens?.cacheRead.value ?? null)}
        sub="Cache-read tokens"
      />
      <Kpi
        label="Cold input"
        tone="cold"
        available={tokens?.coldInput.value != null}
        value={formatCompact(tokens?.coldInput.value ?? null)}
        sub="Uncached tokens"
      />
      <Kpi
        label="Cache efficiency"
        tone="hot"
        available={tokens?.cacheEfficiency != null}
        value={formatPercent(tokens?.cacheEfficiency ?? null)}
        sub="Higher reuse lowers cost"
      />
      <Kpi
        label="Context peak"
        tone="context"
        available={summary?.metrics.context.peak.value != null}
        value={summary?.metrics.context.peak.value != null ? `${formatNumber(summary.metrics.context.peak.value, 0)}%` : "—"}
        sub={`Typical ${summary?.metrics.context.typical.value != null ? `${formatNumber(summary.metrics.context.typical.value, 0)}%` : "—"}`}
      />
    </section>
  );
}

function TokenComposition({ summary }: { summary: SummaryResponse | null }) {
  const tokens = summary?.metrics.tokens;
  return (
    <Panel title="Token composition" aside={<span className="muted">Prompt tokens split into hot, warm, and cold</span>}>
      {tokens && tokens.promptTotal > 0 ? (
        <CompositionBar
          segments={[
            { label: "Cache read (hot)", value: tokens.cacheRead.value ?? 0, tone: "hot" },
            { label: "Cache creation (warm)", value: tokens.cacheCreation.value ?? 0, tone: "warm" },
            { label: "Cold input", value: tokens.coldInput.value ?? 0, tone: "cold" }
          ]}
        />
      ) : (
        <p className="muted">No prompt-token telemetry is available for the selected range.</p>
      )}
      <div className="composition-stats">
        <div>
          <span className="stat-label">Cache efficiency</span>
          <span className="stat-value">{formatPercent(tokens?.cacheEfficiency ?? null)}</span>
        </div>
        <div>
          <span className="stat-label">Warm ratio</span>
          <span className="stat-value">{formatPercent(tokens?.warmRatio ?? null)}</span>
        </div>
        <div>
          <span className="stat-label">Cold ratio</span>
          <span className="stat-value">{formatPercent(tokens?.coldRatio ?? null)}</span>
        </div>
        <div>
          <span className="stat-label">Reasoning tokens</span>
          <span className="stat-value">{formatCompact(tokens?.reasoning.value ?? null)}</span>
        </div>
        <div>
          <span className="stat-label">Tool calls</span>
          <span className="stat-value">{formatNumber(summary?.metrics.activity.toolCalls.value ?? null, 0)}</span>
        </div>
      </div>
    </Panel>
  );
}

function HistoryPanel({ points, message }: { points: HistoryPoint[]; message?: string }) {
  const [field, setField] = useState<HistoryField>("aiCredits");
  const tone = historyFields.find((entry) => entry.field === field)?.tone ?? "credits";
  return (
    <Panel
      title="Usage history"
      aside={
        <div className="segmented small">
          {historyFields.map((entry) => (
            <button key={entry.field} type="button" className={field === entry.field ? "active" : ""} onClick={() => setField(entry.field)}>
              {entry.label}
            </button>
          ))}
        </div>
      }
    >
      {points.length > 0 ? (
        <TrendChart points={points} field={field} tone={tone} />
      ) : (
        <p className="muted">{message ?? "Usage history is not available yet."}</p>
      )}
      <p className="muted">
        History is built from materialized local session telemetry. Trends reflect when sessions were observed locally and can be sparse for short ranges.
      </p>
    </Panel>
  );
}

function WorkspaceTable({ summary, limit }: { summary: SummaryResponse | null; limit?: number }) {
  const items = summary?.workspaces.items ?? [];
  const shown = limit ? items.slice(0, limit) : items;
  if (shown.length === 0) {
    return <p className="muted">{summary?.workspaces.message ?? "No workspace telemetry is available yet."}</p>;
  }
  return (
    <div className="table-wrap">
      <table className="workspace-table">
        <thead>
          <tr>
            <th>Workspace</th>
            <th>Branch</th>
            <th className="numeric">Sessions</th>
            <th className="numeric">AI credits</th>
            <th className="numeric">Input</th>
            <th className="numeric">Cached</th>
            <th className="numeric">Cold</th>
            <th className="numeric">Cache eff.</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((workspace) => (
            <tr key={`${workspace.repo}-${workspace.branch}-${workspace.workspaceName}`}>
              <td>
                <span className="ws-name">{workspace.repoShort}</span>
              </td>
              <td>{workspace.branch || "—"}</td>
              <td className="numeric">{formatNumber(workspace.sessions, 0)}</td>
              <td className="numeric strong">{formatNumber(workspace.aiCredits, 2)}</td>
              <td className="numeric">{formatCompact(workspace.inputTokens)}</td>
              <td className="numeric">{formatCompact(workspace.cacheReadTokens)}</td>
              <td className="numeric">{formatCompact(workspace.coldInputTokens)}</td>
              <td className="numeric">
                <span className={`pill ${cacheTone(workspace.cacheEfficiency)}`}>{formatPercent(workspace.cacheEfficiency)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FirstRunPanel({ summary }: { summary: SummaryResponse | null }) {
  const sessions = summary?.metrics.sessions.value ?? 0;
  if (sessions > 0) {
    return null;
  }

  return (
    <Panel title="Workshop first run" aside={<span className="status status-degraded">Needs one real session</span>}>
      <div className="first-run-grid">
        <div>
          <span className="badge-step">01</span>
          <h3>Open a Git repository</h3>
          <p>Workspace attribution depends on Git metadata. Open the participant repository as the VS Code workspace.</p>
        </div>
        <div>
          <span className="badge-step">02</span>
          <h3>Run GitHub Copilot Chat</h3>
          <p>Ask GitHub Copilot to explain, edit, or test a small file in the repository.</p>
        </div>
        <div>
          <span className="badge-step">03</span>
          <h3>Refresh local telemetry</h3>
          <p>Run <code>local-otel/workshop-ready.sh</code> again or wait for the local materializer, then click Refresh.</p>
        </div>
      </div>
    </Panel>
  );
}

function OverviewView({ summary }: { summary: SummaryResponse | null }) {
  const healthCounts = useMemo(() => {
    const services = summary?.health ?? [];
    return {
      ok: services.filter((service) => service.status === "ok").length,
      degraded: services.filter((service) => service.status === "degraded").length,
      unavailable: services.filter((service) => service.status === "unavailable").length
    };
  }, [summary]);

  return (
    <>
      <FirstRunPanel summary={summary} />
      <AlertsBanner alerts={summary?.alerts ?? []} />
      <KpiStrip summary={summary} />
      <TokenComposition summary={summary} />
      <HistoryPanel points={summary?.history.points ?? []} message={summary?.history.message} />
      <Panel title="Top workspaces" aside={<span className="muted">Ranked by AI credits</span>}>
        <WorkspaceTable summary={summary} limit={5} />
      </Panel>
      <Panel title="Stack health" aside={<span className="health-summary">{healthCounts.ok} ok, {healthCounts.degraded} degraded, {healthCounts.unavailable} unavailable</span>}>
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
      </Panel>
    </>
  );
}

const aspireBase = "http://localhost:18888";
const grafanaSessions = "http://localhost:3000/d/copilot-sessions-models-local/github-copilot-sessions-and-model-labels-local";

function SessionsView({ sessions }: { sessions: SessionsResponse | null }) {
  const [copied, setCopied] = useState<string | null>(null);
  const items = sessions?.items ?? [];

  const copyTrace = useCallback(async (traceId: string) => {
    try {
      await navigator.clipboard.writeText(traceId);
      setCopied(traceId);
      setTimeout(() => setCopied((current) => (current === traceId ? null : current)), 1500);
    } catch {
      setCopied(null);
    }
  }, []);

  return (
    <Panel
      title="Sessions"
      status={sessions?.status}
      aside={
        <div className="link-row">
          <a href={`${aspireBase}/traces`} target="_blank" rel="noopener noreferrer">Aspire traces</a>
          <a href={grafanaSessions} target="_blank" rel="noopener noreferrer">Grafana sessions</a>
        </div>
      }
    >
      {items.length > 0 ? (
        <div className="table-wrap">
          <table className="sessions-table">
            <thead>
              <tr>
                <th>Workspace</th>
                <th>Model</th>
                <th>Mode</th>
                <th className="numeric">AI credits</th>
                <th className="numeric">Input</th>
                <th className="numeric">Output</th>
                <th className="numeric">Cached</th>
                <th className="numeric">Cold</th>
                <th className="numeric">Cache eff.</th>
                <th className="numeric">Tools</th>
                <th className="numeric">Context</th>
                <th>Trace</th>
              </tr>
            </thead>
            <tbody>
              {items.map((session) => (
                <tr key={session.traceId}>
                  <td>
                    <span className="ws-name">{session.repoShort}</span>
                    {session.branch ? <span className="muted small-text"> · {session.branch}</span> : null}
                  </td>
                  <td><span className="model-tag">{session.model}</span></td>
                  <td>{session.modeBucket || "—"}</td>
                  <td className="numeric strong">{formatNumber(session.aiCredits, 3)}</td>
                  <td className="numeric">{formatCompact(session.inputTokens)}</td>
                  <td className="numeric">{formatCompact(session.outputTokens)}</td>
                  <td className="numeric">{formatCompact(session.cacheReadTokens)}</td>
                  <td className="numeric">{formatCompact(session.coldInputTokens)}</td>
                  <td className="numeric">
                    <span className={`pill ${cacheTone(session.cacheEfficiency)}`}>{formatPercent(session.cacheEfficiency)}</span>
                  </td>
                  <td className="numeric">{formatNumber(session.toolCalls, 0)}</td>
                  <td className="numeric">{session.contextPct != null ? `${formatNumber(session.contextPct, 0)}%` : "—"}</td>
                  <td>
                    <button type="button" className="trace-copy" onClick={() => void copyTrace(session.traceId)} title={session.traceId}>
                      {copied === session.traceId ? "copied" : `${session.traceId.slice(0, 8)}…`}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">{sessions?.message ?? "No sessions are available for the selected range."}</p>
      )}
      <p className="muted">
        Sessions are grouped by trace. Click a trace id to copy it, then search it in Aspire traces or Grafana Tempo to inspect spans, prompts, and tool calls. Raw content stays local.
      </p>
    </Panel>
  );
}

function WorkspacesView({ summary }: { summary: SummaryResponse | null }) {
  return (
    <Panel
      title="Workspaces compared"
      status={summary?.workspaces.status}
      aside={undefined}
    >
      <WorkspaceTable summary={summary} />
      <p className="muted">All observed workspaces are shown regardless of the selected workspace filter, so you can compare projects over time.</p>
    </Panel>
  );
}

const tokenPlaybook: { id: string; title: string; body: string }[] = [
  { id: "warm", title: "Reuse warm context", body: "Stay in the same conversation while the context is still relevant. Cache reads are far cheaper than cold input." },
  { id: "cold", title: "Reduce cold input", body: "Avoid reattaching or reopening large files you already shared. Cold tokens are the most expensive class." },
  { id: "focus", title: "Keep context focused", body: "Split large tasks into smaller prompts so the context window stays lean and answers stay sharp." },
  { id: "errors", title: "Avoid tool-error loops", body: "Fix the root cause of a failing tool call before retrying. Repeated failures burn credits with no result." },
  { id: "model", title: "Use the right model", body: "Reserve frontier models for complex work. Lighter tasks can use a smaller model to save credits." },
  { id: "validate", title: "Validate early", body: "Run tests or checks to catch issues before they turn into long, expensive agent loops." },
  { id: "workspace", title: "Open a Git workspace", body: "Work inside a Git repository so usage is attributed to the right project and stays measurable." }
];

function efficiencyTone(score: number | null): string {
  if (score === null) {
    return "neutral";
  }
  if (score >= 70) {
    return "good";
  }
  if (score >= 45) {
    return "warn";
  }
  return "bad";
}

function CoachView({ coach, summary }: { coach: CoachResponse | null; summary: SummaryResponse | null }) {
  const cards = coach?.cards ?? [];
  const topSessions = coach?.topSessions ?? [];
  const economy = summary?.economy;
  const score = economy?.efficiencyScore ?? null;
  const opportunities = economy?.savingsOpportunities ?? [];
  return (
    <>
      <Panel title="Token efficiency" aside={<span className="muted">Local AIU estimate, not official billing</span>}>
        <div className="efficiency-row">
          <div className={`score-dial score-${efficiencyTone(score)}`}>
            <span className="score-value">{score ?? "—"}</span>
            <span className="score-max">/ 100</span>
          </div>
          <div className="efficiency-facts">
            <div>
              <span className="stat-label">AI credits in range</span>
              <span className="stat-value">{formatNumber(economy?.aiCredits ?? null, 2)}</span>
            </div>
            <div>
              <span className="stat-label">Cache efficiency</span>
              <span className="stat-value">{formatPercent(economy?.cacheEfficiency ?? null)}</span>
            </div>
            <div>
              <span className="stat-label">Cold cost share</span>
              <span className="stat-value">{formatPercent(economy?.coldCostShare ?? null)}</span>
            </div>
            <div>
              <span className="stat-label">Potential savings</span>
              <span className="stat-value">{formatNumber(economy?.potentialSavingsCredits ?? null, 2)}</span>
            </div>
          </div>
        </div>
        <p className="muted">
          The efficiency score rewards cache reuse and penalizes cold context, context pressure, and tool errors. Savings are local AIU estimates to guide behavior, not GitHub billing.
        </p>
      </Panel>
      {opportunities.length > 0 ? (
        <Panel title="Savings opportunities" aside={<span className="muted">Quantified local estimates</span>}>
          <ul className="savings-list">
            {opportunities.map((item) => (
              <li key={item.id} className="savings-card">
                <div className="savings-head">
                  <h3>{item.label}</h3>
                  <span className="savings-credits">~{formatNumber(item.estimateCredits, 2)} credits</span>
                </div>
                <p>{item.detail}</p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      <Panel title="Coaching recommendations" aside={<span className="muted">{coach ? `Generated ${new Date(coach.generatedAt).toLocaleTimeString()}` : ""}</span>}>
        {cards.length > 0 ? (
          <ul className="coach-list">
            {cards.map((card) => (
              <li key={card.id} className={`coach-card coach-${card.severity}`}>
                <div className="coach-head">
                  <span className="coach-tag">{card.severity}</span>
                  <h3>{card.title}</h3>
                </div>
                <p className="coach-insight">{card.insight}</p>
                <p className="coach-action"><strong>Try this:</strong> {card.action}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No recommendations are available yet.</p>
        )}
      </Panel>
      <Panel title="Token efficiency playbook" aside={<span className="muted">Best practices</span>}>
        <ul className="playbook-grid">
          {tokenPlaybook.map((item) => (
            <li key={item.id} className="playbook-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ul>
      </Panel>
      {topSessions.length > 0 ? (
        <Panel title="Most expensive sessions" aside={<span className="muted">By AI credits</span>}>
          <div className="table-wrap">
            <table className="sessions-table">
              <thead>
                <tr>
                  <th>Workspace</th>
                  <th>Model</th>
                  <th className="numeric">AI credits</th>
                  <th className="numeric">Input</th>
                  <th className="numeric">Cache eff.</th>
                </tr>
              </thead>
              <tbody>
                {topSessions.map((session: SessionRecord) => (
                  <tr key={session.traceId}>
                    <td><span className="ws-name">{session.repoShort}</span></td>
                    <td><span className="model-tag">{session.model}</span></td>
                    <td className="numeric strong">{formatNumber(session.aiCredits, 3)}</td>
                    <td className="numeric">{formatCompact(session.inputTokens)}</td>
                    <td className="numeric">
                      <span className={`pill ${cacheTone(session.cacheEfficiency)}`}>{formatPercent(session.cacheEfficiency)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </>
  );
}

function HistoryView({ summary }: { summary: SummaryResponse | null }) {
  const points = summary?.history.points ?? [];
  return (
    <>
      <HistoryPanel points={points} message={summary?.history.message} />
      <Panel title="History detail" aside={<span className="muted">{points.length} buckets</span>}>
        {points.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th className="numeric">AI credits</th>
                  <th className="numeric">Input</th>
                  <th className="numeric">Output</th>
                  <th className="numeric">Cached</th>
                  <th className="numeric">Cold</th>
                </tr>
              </thead>
              <tbody>
                {points.map((point) => (
                  <tr key={point.t}>
                    <td>{new Date(point.t).toLocaleString()}</td>
                    <td className="numeric">{formatNumber(point.aiCredits, 2)}</td>
                    <td className="numeric">{formatCompact(point.inputTokens)}</td>
                    <td className="numeric">{formatCompact(point.outputTokens)}</td>
                    <td className="numeric">{formatCompact(point.cacheReadTokens)}</td>
                    <td className="numeric">{formatCompact(point.coldInputTokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">{summary?.history.message ?? "No history rows are available yet."}</p>
        )}
      </Panel>
    </>
  );
}

function HealthView({ summary }: { summary: SummaryResponse | null }) {
  const usdTotal = sumSeries(summary?.metrics.usdWhatIf);
  return (
    <>
      <Panel title="Stack health" status={undefined}>
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
      </Panel>
      <section className="panel two-column">
        <div>
          <div className="panel-header"><h2>Data quality</h2></div>
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
          <p className="muted">Missing values are shown as unavailable. The dashboard never fabricates telemetry.</p>
        </div>
        <div>
          <div className="panel-header">
            <h2>Official billing</h2>
            <span className="status status-unavailable">{summary?.officialBilling.status ?? "unavailable"}</span>
          </div>
          <p>{summary?.officialBilling.reason}</p>
          <p className="muted">USD what-if total in range: {formatCurrency(usdTotal)} (local planning assumption).</p>
        </div>
      </section>
      <section className="panel two-column">
        <div>
          <h2>Data boundary</h2>
          <p>The browser only uses the dashboard API proxy. It never queries PostgreSQL, DuckDB files, Aspire API keys, or raw Loki content directly.</p>
          <h3>Local only by default</h3>
          <ul>{(summary?.dataBoundary.localOnly ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
          <h3>Eligible for governed forwarding</h3>
          <ul>{(summary?.dataBoundary.safeForwarding ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div>
          <h2>Drill-down links</h2>
          <div className="link-grid">
            {(summary?.links ?? []).map((link) => (
              <a href={link.url} key={link.label} target="_blank" rel="noopener noreferrer">{link.label}</a>
            ))}
          </div>
          <p className="muted">Trace drill-down opens Aspire Dashboard or Grafana Explore instead of embedding raw trace content.</p>
        </div>
      </section>
    </>
  );
}

const thresholdCopy: Record<string, { label: string; env: string; help: string }> = {
  aiCreditsWarn: { label: "AI credits warning", env: "THRESHOLD_AI_CREDITS_WARN", help: "Warn when local AI credits in range exceed this value." },
  aiCreditsCrit: { label: "AI credits critical", env: "THRESHOLD_AI_CREDITS_CRIT", help: "Critical alert when local AI credits exceed this value." },
  inputTokensWarn: { label: "Input tokens warning", env: "THRESHOLD_INPUT_TOKENS_WARN", help: "Warn when input tokens in range exceed this value." },
  inputTokensCrit: { label: "Input tokens critical", env: "THRESHOLD_INPUT_TOKENS_CRIT", help: "Critical alert when input tokens exceed this value." },
  contextWarnPct: { label: "Context warning %", env: "THRESHOLD_CONTEXT_WARN_PCT", help: "Warn when peak context utilization exceeds this percent." },
  contextCritPct: { label: "Context critical %", env: "THRESHOLD_CONTEXT_CRIT_PCT", help: "Critical alert when peak context utilization exceeds this percent." },
  cacheEfficiencyWarn: { label: "Cache efficiency floor", env: "THRESHOLD_CACHE_EFFICIENCY_WARN", help: "Warn when cache reuse drops below this ratio (0 to 1)." },
  coldRatioWarn: { label: "Cold ratio ceiling", env: "THRESHOLD_COLD_RATIO_WARN", help: "Warn when cold input ratio rises above this ratio (0 to 1)." }
};

function SettingsView({ summary }: { summary: SummaryResponse | null }) {
  const thresholds = summary?.thresholds ?? {};
  return (
    <>
      <Panel title="Alert thresholds" aside={<span className="muted">Local guardrails</span>}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Guardrail</th>
                <th className="numeric">Value</th>
                <th>Environment variable</th>
                <th>What it does</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(thresholdCopy).map(([key, copy]) => (
                <tr key={key}>
                  <td>{copy.label}</td>
                  <td className="numeric strong">{formatNumber(thresholds[key] ?? null, 2)}</td>
                  <td><code>{copy.env}</code></td>
                  <td className="muted">{copy.help}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          Thresholds are read from the API container environment. To change them, set the matching variable on the
          <code> frontier-dashboard-api</code> service and restart it. They are local planning guardrails, not official GitHub limits or AI Credit allowances.
        </p>
      </Panel>
      <Panel title="About this cockpit" aside={undefined}>
        <p>
          This is the Frontier Developer Cockpit mini app. It reads local OpenTelemetry telemetry materialized into Prometheus and renders AI credits, token classes, cache behavior, per-session cost, workspace comparison, history, and coaching. It is local-first and never forwards data to Azure on its own.
        </p>
        <ul>
          <li>AI credits are local AIU telemetry, not official GitHub billing.</li>
          <li>Premium-request multipliers are legacy planning aids and are not the primary cost concept here.</li>
          <li>Official billing and AI Credit totals require GitHub billing exports or the Copilot usage metrics API.</li>
        </ul>
      </Panel>
    </>
  );
}

export default function App() {
  const [range, setRange] = useState<RangeOption>("24h");
  const [repo, setRepo] = useState("all");
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const { data, error, isLoading, reload } = useDashboardData(range, repo);
  const { summary, sessions, coach } = data;

  const alertCount = summary?.alerts.length ?? 0;
  const activeDef = views.find((view) => view.id === activeView) ?? views[0];

  const dashboardTitle = summary?.participant.dashboardTitle ?? "Frontier Developer Cockpit";
  const participantName = summary?.participant.name ?? "Workshop Participant";
  const participantRole = summary?.participant.role ?? "Developer";
  const participantLine = participantRole ? `${participantName} | ${participantRole}` : participantName;
  const customerName = summary?.participant.customerName ?? "";

  useEffect(() => {
    document.title = dashboardTitle;
  }, [dashboardTitle]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__squares" aria-hidden="true">
            <i className="sq-red" />
            <i className="sq-green" />
            <i className="sq-blue" />
            <i className="sq-yellow" />
          </span>
          <div className="brand__text">
            <strong>{dashboardTitle}</strong>
            <span>{participantLine}</span>
          </div>
        </div>
        <nav className="nav">
          {views.map((view) => (
            <button
              key={view.id}
              type="button"
              className={`nav-item${activeView === view.id ? " active" : ""}`}
              onClick={() => setActiveView(view.id)}
            >
              <span className="nav-icon" aria-hidden>{view.icon}</span>
              <span className="nav-text">
                <span className="nav-label">{view.label}</span>
                <span className="nav-blurb">{view.blurb}</span>
              </span>
              {view.id === "overview" && alertCount > 0 ? <span className="nav-badge">{alertCount}</span> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <a href="http://localhost:18888" target="_blank" rel="noopener noreferrer">Aspire</a>
          <a href="http://localhost:3000" target="_blank" rel="noopener noreferrer">Grafana</a>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">{customerName ? `${participantLine} · ${customerName}` : participantLine}</p>
            <h1>{activeDef.label}</h1>
            <p className="topbar-blurb">{activeDef.blurb}. AI credits are local AIU telemetry, not official GitHub billing.</p>
          </div>
          <div className="topbar-controls">
            <div className="control-group">
              <label>Range</label>
              <div className="segmented">
                {rangeOptions.map((option) => (
                  <button key={option} type="button" className={range === option ? "active" : ""} onClick={() => setRange(option)}>
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-group">
              <label htmlFor="repo">Workspace</label>
              <select id="repo" value={repo} onChange={(event) => setRepo(event.target.value)}>
                <option value="all">All workspaces</option>
                {(summary?.repositories ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option.replace(/^https?:\/\//, "").replace(/\.git$/, "")}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="refresh" onClick={() => void reload()} disabled={isLoading}>
              {isLoading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </header>

        {error ? <div className="error">{error}</div> : null}
        {!summary && !error ? <div className="loading">Loading local telemetry…</div> : null}

        <div className="view">
          {activeView === "overview" ? <OverviewView summary={summary} /> : null}
          {activeView === "sessions" ? <SessionsView sessions={sessions} /> : null}
          {activeView === "workspaces" ? <WorkspacesView summary={summary} /> : null}
          {activeView === "coach" ? <CoachView coach={coach} summary={summary} /> : null}
          {activeView === "history" ? <HistoryView summary={summary} /> : null}
          {activeView === "health" ? <HealthView summary={summary} /> : null}
          {activeView === "settings" ? <SettingsView summary={summary} /> : null}
        </div>

        <footer className="content-foot">
          <span>{summary ? `Updated ${new Date(summary.refreshedAt).toLocaleTimeString()}` : "Waiting for data"}</span>
          <span>Range {range} · {repo === "all" ? "all workspaces" : repo.replace(/^https?:\/\//, "")}</span>
        </footer>
      </main>
    </div>
  );
}
