import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  Alert,
  AlertSeverity,
  CoachResponse,
  HistoryPoint,
  RangeOption,
  SessionRecord,
  ServiceStatus,
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
  sumSeries,
  type HistoryField
} from "./ui";
import { LangProvider, defaultLang, languages, useT, type Lang, type TranslateFn } from "./i18n";

const rangeOptions: RangeOption[] = ["1h", "6h", "24h", "7d"];

type ViewId = "overview" | "credits" | "sessions" | "workspaces" | "coach" | "history" | "health" | "settings";

interface ViewDef {
  id: ViewId;
  label: string;
  icon: string;
  blurb: string;
}

const viewMeta: { id: ViewId; icon: string }[] = [
  { id: "overview", icon: "◎" },
  { id: "credits", icon: "◈" },
  { id: "sessions", icon: "≣" },
  { id: "workspaces", icon: "▤" },
  { id: "coach", icon: "✦" },
  { id: "history", icon: "📈" },
  { id: "health", icon: "♥" },
  { id: "settings", icon: "⚙" }
];

function buildViews(t: TranslateFn): ViewDef[] {
  return viewMeta.map((view) => ({
    id: view.id,
    icon: view.icon,
    label: t(`nav.${view.id}.label`),
    blurb: t(`nav.${view.id}.blurb`)
  }));
}

function buildHistoryFields(t: TranslateFn): { field: HistoryField; label: string; tone: string }[] {
  return [
    { field: "aiCredits", label: t("history.field.aiCredits"), tone: "credits" },
    { field: "inputTokens", label: t("history.field.input"), tone: "input" },
    { field: "cacheReadTokens", label: t("history.field.cached"), tone: "hot" },
    { field: "coldInputTokens", label: t("history.field.cold"), tone: "cold" },
    { field: "outputTokens", label: t("history.field.output"), tone: "output" }
  ];
}

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

function formatPctText(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return `${formatNumber(value, 0)}%`;
}

function secondsText(value: number | null | undefined, t: TranslateFn): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return t("experience.seconds", { value: formatNumber(value, 1) });
}

function formatNumberText(value: number | null | undefined, digits: number, t: TranslateFn): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return t("common.unavailable");
  }
  return formatNumber(value, digits);
}

function formatCurrencyText(value: number | null | undefined, t: TranslateFn): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return t("common.unavailable");
  }
  return formatCurrency(value);
}

function totalSub(value: number | null | undefined, t: TranslateFn): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return t("common.unavailable");
  }
  return t("kpi.totalSuffix", { value: formatNumber(value, 0) });
}

function statusText(status: ServiceStatus, t: TranslateFn): string {
  return t(`status.${status}`);
}

function severityText(severity: AlertSeverity, t: TranslateFn): string {
  return t(`severity.${severity}`);
}

function localizeAlerts(alerts: Alert[], t: TranslateFn): Alert[] {
  return alerts.map((alert) => {
    const severity = severityText(alert.severity, t);
    switch (alert.id) {
      case "ai-credits":
        return {
          ...alert,
          title: t(`alert.ai-credits.${alert.severity}.title`),
          detail: t("alert.ai-credits.detail", {
            value: formatNumber(alert.value, 2),
            severity,
            threshold: formatNumber(alert.threshold, 2)
          })
        };
      case "input-tokens":
        return {
          ...alert,
          title: t(`alert.input-tokens.${alert.severity}.title`),
          detail: t("alert.input-tokens.detail", {
            value: formatNumber(alert.value, 0),
            severity,
            threshold: formatNumber(alert.threshold, 0)
          })
        };
      case "context":
        return {
          ...alert,
          title: t(`alert.context.${alert.severity}.title`),
          detail: t("alert.context.detail", {
            value: formatNumber(alert.value, 0),
            severity,
            threshold: formatNumber(alert.threshold, 0)
          })
        };
      case "cache-efficiency":
        return {
          ...alert,
          title: t("alert.cache-efficiency.title"),
          detail: t("alert.cache-efficiency.detail", {
            value: formatNumber((alert.value ?? 0) * 100, 0),
            threshold: formatNumber((alert.threshold ?? 0) * 100, 0)
          })
        };
      case "cold-context":
        return {
          ...alert,
          title: t("alert.cold-context.title"),
          detail: t("alert.cold-context.detail", {
            value: formatNumber((alert.value ?? 0) * 100, 0),
            threshold: formatNumber((alert.threshold ?? 0) * 100, 0)
          })
        };
      case "attribution-gap":
        return {
          ...alert,
          title: t("alert.attribution-gap.title"),
          detail: t("alert.attribution-gap.detail", { value: formatNumber(alert.value, 0) })
        };
      case "errors":
        return {
          ...alert,
          title: t("alert.errors.title"),
          detail: t("alert.errors.detail", { value: formatNumber(alert.value, 0) })
        };
      case "premium-budget":
        return {
          ...alert,
          title: t(`alert.premium-budget.${alert.severity}.title`),
          detail: t("alert.premium-budget.detail", { value: formatNumber(alert.value, 0) })
        };
      default:
        return alert;
    }
  });
}

function KpiStrip({ summary }: Readonly<{ summary: SummaryResponse | null }>) {
  const t = useT();
  const tokens = summary?.metrics.tokens;
  const contextPeak = summary?.metrics.context.peak.value;
  const contextTypical = summary?.metrics.context.typical.value;
  return (
    <section className="kpi-strip">
      <Kpi
        label={t("kpi.aiCredits")}
        tone="credits"
        available={summary?.metrics.aiCredits.value != null}
        value={formatNumberText(summary?.metrics.aiCredits.value, 2, t)}
        sub={t("kpi.aiCreditsSub")}
      />
      <Kpi
        label={t("kpi.sessions")}
        tone="neutral"
        available={summary?.metrics.sessions.value != null}
        value={formatNumberText(summary?.metrics.sessions.value, 0, t)}
        sub={t("kpi.sessionsSub")}
      />
      <Kpi
        label={t("kpi.input")}
        tone="input"
        available={tokens?.input.value != null}
        value={formatCompact(tokens?.input.value ?? null)}
        sub={totalSub(tokens?.input.value, t)}
      />
      <Kpi
        label={t("kpi.output")}
        tone="output"
        available={tokens?.output.value != null}
        value={formatCompact(tokens?.output.value ?? null)}
        sub={totalSub(tokens?.output.value, t)}
      />
      <Kpi
        label={t("kpi.cached")}
        tone="hot"
        available={tokens?.cacheRead.value != null}
        value={formatCompact(tokens?.cacheRead.value ?? null)}
        sub={t("kpi.cachedSub")}
      />
      <Kpi
        label={t("kpi.cold")}
        tone="cold"
        available={tokens?.coldInput.value != null}
        value={formatCompact(tokens?.coldInput.value ?? null)}
        sub={t("kpi.coldSub")}
      />
      <Kpi
        label={t("kpi.cacheEff")}
        tone="hot"
        available={tokens?.cacheEfficiency != null}
        value={formatPercent(tokens?.cacheEfficiency ?? null)}
        sub={t("kpi.cacheEffSub")}
      />
      <Kpi
        label={t("kpi.contextPeak")}
        tone="context"
        available={contextPeak !== null && contextPeak !== undefined}
        value={formatPctText(contextPeak)}
        sub={t("kpi.contextTypical", {
          value: formatPctText(contextTypical)
        })}
      />
    </section>
  );
}

function TokenComposition({ summary }: Readonly<{ summary: SummaryResponse | null }>) {
  const t = useT();
  const tokens = summary?.metrics.tokens;
  return (
    <Panel title={t("composition.title")} aside={<span className="muted">{t("composition.aside")}</span>}>
      {tokens && tokens.promptTotal > 0 ? (
        <CompositionBar
          segments={[
            { label: t("composition.hot"), value: tokens.cacheRead.value ?? 0, tone: "hot" },
            { label: t("composition.warm"), value: tokens.cacheCreation.value ?? 0, tone: "warm" },
            { label: t("composition.cold"), value: tokens.coldInput.value ?? 0, tone: "cold" }
          ]}
        />
      ) : (
        <p className="muted">{t("composition.empty")}</p>
      )}
      <div className="composition-stats">
        <div>
          <span className="stat-label">{t("composition.cacheEff")}</span>
          <span className="stat-value">{formatPercent(tokens?.cacheEfficiency ?? null)}</span>
        </div>
        <div>
          <span className="stat-label">{t("composition.warmRatio")}</span>
          <span className="stat-value">{formatPercent(tokens?.warmRatio ?? null)}</span>
        </div>
        <div>
          <span className="stat-label">{t("composition.coldRatio")}</span>
          <span className="stat-value">{formatPercent(tokens?.coldRatio ?? null)}</span>
        </div>
        <div>
          <span className="stat-label">{t("composition.reasoning")}</span>
          <span className="stat-value">{formatCompact(tokens?.reasoning.value ?? null)}</span>
        </div>
        <div>
          <span className="stat-label">{t("composition.toolCalls")}</span>
          <span className="stat-value">{formatNumberText(summary?.metrics.activity.toolCalls.value, 0, t)}</span>
        </div>
      </div>
    </Panel>
  );
}

function HistoryPanel({ points, message }: Readonly<{ points: HistoryPoint[]; message?: string }>) {
  const t = useT();
  const [field, setField] = useState<HistoryField>("aiCredits");
  const historyFields = buildHistoryFields(t);
  const tone = historyFields.find((entry) => entry.field === field)?.tone ?? "credits";
  return (
    <Panel
      title={t("history.title")}
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
        <p className="muted">{message ?? t("history.empty")}</p>
      )}
      <p className="muted">{t("history.note")}</p>
    </Panel>
  );
}

function WorkspaceTable({ summary, limit }: Readonly<{ summary: SummaryResponse | null; limit?: number }>) {
  const t = useT();
  const items = summary?.workspaces.items ?? [];
  const shown = limit ? items.slice(0, limit) : items;
  if (shown.length === 0) {
    return <p className="muted">{summary?.workspaces.message ?? t("ws.empty")}</p>;
  }
  return (
    <div className="table-wrap">
      <table className="workspace-table">
        <thead>
          <tr>
            <th>{t("ws.col.workspace")}</th>
            <th>{t("ws.col.branch")}</th>
            <th className="numeric">{t("ws.col.sessions")}</th>
            <th className="numeric">{t("ws.col.aiCredits")}</th>
            <th className="numeric">{t("ws.col.input")}</th>
            <th className="numeric">{t("ws.col.cached")}</th>
            <th className="numeric">{t("ws.col.cold")}</th>
            <th className="numeric">{t("ws.col.cacheEff")}</th>
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

function FirstRunPanel({ summary }: Readonly<{ summary: SummaryResponse | null }>) {
  const t = useT();
  const sessions = summary?.metrics.sessions.value ?? 0;
  if (sessions > 0) {
    return null;
  }

  return (
    <Panel title={t("firstRun.title")} aside={<span className="status status-degraded">{t("firstRun.badge")}</span>}>
      <div className="first-run-grid">
        <div>
          <span className="badge-step">01</span>
          <h3>{t("firstRun.step1.title")}</h3>
          <p>{t("firstRun.step1.body")}</p>
        </div>
        <div>
          <span className="badge-step">02</span>
          <h3>{t("firstRun.step2.title")}</h3>
          <p>{t("firstRun.step2.body")}</p>
        </div>
        <div>
          <span className="badge-step">03</span>
          <h3>{t("firstRun.step3.title")}</h3>
          <p>{t("firstRun.step3.body")}</p>
        </div>
      </div>
    </Panel>
  );
}

function budgetTone(level: string): string {
  if (level === "warning") {
    return "warn";
  }
  if (level === "critical" || level === "over") {
    return "bad";
  }
  return "good";
}

function BudgetPanel({ summary, compact }: Readonly<{ summary: SummaryResponse | null; compact?: boolean }>) {
  const t = useT();
  const budget = summary?.budget;
  const utilization = budget?.utilizationPct ?? null;
  const projected = budget?.projectedUtilizationPct ?? null;
  const tone = budgetTone(budget?.alertLevel ?? "ok");
  const barWidth = utilization === null ? 0 : Math.min(100, utilization);
  const projectedWidth = projected === null ? 0 : Math.min(100, projected);
  const planLabel = budget?.plan ? budget.plan.charAt(0).toUpperCase() + budget.plan.slice(1) : "—";

  return (
    <Panel
      title={t("budget.title")}
      status={budget?.status}
      aside={<span className="muted">{t("budget.aside", { plan: planLabel })}</span>}
    >
      <div className="budget-head">
        <div className={`budget-figure budget-${tone}`}>
          <span className="budget-figure-value">
            {formatNumber(budget?.premiumRequestsEstimate ?? null, 0)}
          </span>
          <span className="budget-figure-unit">
            {t("budget.ofAllowance", { allowance: formatNumber(budget?.premiumRequestAllowance ?? null, 0) })}
          </span>
        </div>
        <div className="budget-facts">
          <div>
            <span className="stat-label">{t("budget.utilization")}</span>
            <span className="stat-value">{utilization === null ? "—" : `${formatNumber(utilization, 0)}%`}</span>
          </div>
          <div>
            <span className="stat-label">{t("budget.remaining")}</span>
            <span className="stat-value">{formatNumber(budget?.remaining ?? null, 0)}</span>
          </div>
          <div>
            <span className="stat-label">{t("budget.daysLeft")}</span>
            <span className="stat-value">{budget ? formatNumber(budget.daysLeft, 0) : "—"}</span>
          </div>
          <div>
            <span className="stat-label">{t("budget.projected")}</span>
            <span className="stat-value">{projected === null ? "—" : `${formatNumber(projected, 0)}%`}</span>
          </div>
        </div>
      </div>
      <svg className="budget-bar" viewBox="0 0 100 8" preserveAspectRatio="none" role="img" aria-label={t("budget.title")}>
        <rect className="budget-bar-track" x="0" y="0" width="100" height="8" />
        <rect className={`budget-bar-fill budget-${tone}`} x="0" y="0" width={barWidth} height="8" />
        {projectedWidth > barWidth ? (
          <rect className="budget-bar-projected" x={barWidth} y="0" width={projectedWidth - barWidth} height="8" />
        ) : null}
        <line className="budget-bar-warn" x1={summary?.thresholds.budgetWarnPct ?? 75} y1="0" x2={summary?.thresholds.budgetWarnPct ?? 75} y2="8" />
        <line className="budget-bar-crit" x1={summary?.thresholds.budgetCritPct ?? 90} y1="0" x2={summary?.thresholds.budgetCritPct ?? 90} y2="8" />
      </svg>
      <p className="muted">{t("budget.note")}</p>
      {compact ? null : <p className="muted">{t("budget.methodology")}</p>}
    </Panel>
  );
}

function ModelMixPanel({ summary }: Readonly<{ summary: SummaryResponse | null }>) {
  const t = useT();
  const mix = summary?.modelMix;
  const entries = mix?.entries ?? [];
  const totalPremiumWeight = entries.reduce((sum, entry) => sum + (entry.premiumRequestsEstimate ?? 0), 0);
  return (
    <Panel
      title={t("mix.title")}
      status={mix?.status}
      aside={<span className="muted">{t("mix.aside")}</span>}
    >
      {mix && (mix.includedShare !== null || mix.premiumShare !== null) ? (
        <div className="mix-split">
          <svg className="mix-split-bar" viewBox="0 0 100 8" preserveAspectRatio="none" role="img" aria-label={t("mix.title")}>
            <rect className="seg-mix-included" x="0" y="0" width={(mix.includedShare ?? 0) * 100} height="8" />
            <rect className="seg-mix-premium" x={(mix.includedShare ?? 0) * 100} y="0" width={(mix.premiumShare ?? 0) * 100} height="8" />
          </svg>
          <div className="mix-split-legend">
            <span><i className="dot-mix-included" /> {t("mix.included", { value: formatPercent(mix.includedShare) })}</span>
            <span><i className="dot-mix-premium" /> {t("mix.premium", { value: formatPercent(mix.premiumShare) })}</span>
          </div>
        </div>
      ) : null}
      {entries.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("sessions.col.model")}</th>
                <th>{t("mix.col.class")}</th>
                <th className="numeric">{t("mix.col.multiplier")}</th>
                <th className="numeric">{t("mix.col.calls")}</th>
                <th className="numeric">{t("mix.col.estimate")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.model}>
                  <td><span className="model-tag">{entry.model}</span></td>
                  <td>
                    <span className={`pill ${entry.included ? "pill-good" : "pill-warn"}`}>
                      {entry.included ? t("mix.classIncluded") : t("mix.classPremium")}
                    </span>
                  </td>
                  <td className="numeric">{entry.multiplier === null ? "—" : `${formatNumber(entry.multiplier, 2)}x`}</td>
                  <td className="numeric">{formatNumber(entry.calls, 0)}</td>
                  <td className="numeric strong">{entry.premiumRequestsEstimate === null || totalPremiumWeight <= 0 ? "—" : formatPercent(entry.premiumRequestsEstimate / totalPremiumWeight)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">{mix?.message ?? t("mix.empty")}</p>
      )}
      <p className="muted">{t("mix.note")}</p>
    </Panel>
  );
}

function ExperiencePanel({ summary }: Readonly<{ summary: SummaryResponse | null }>) {
  const t = useT();
  const experience = summary?.experience;
  const outcomes = summary?.outcomes;
  return (
    <section className="panel two-column">
      <div>
        <div className="panel-header"><h2>{t("experience.title")}</h2></div>
        <dl className="quality-grid">
          <div>
            <dt>{t("experience.ttft")}</dt>
            <dd>{secondsText(experience?.avgTimeToFirstTokenSeconds.value, t)}</dd>
          </div>
          <div>
            <dt>{t("experience.response")}</dt>
            <dd>{secondsText(experience?.avgResponseSeconds.value, t)}</dd>
          </div>
          <div>
            <dt>{t("experience.turns")}</dt>
            <dd>{formatNumber(experience?.userTurns.value ?? null, 0)}</dd>
          </div>
        </dl>
        <p className="muted">{t("experience.note")}</p>
      </div>
      <div>
        <div className="panel-header"><h2>{t("outcomes.title")}</h2></div>
        <dl className="quality-grid">
          <div>
            <dt>{t("outcomes.acceptances")}</dt>
            <dd>{formatNumber(outcomes?.editAcceptances.value ?? null, 0)}</dd>
          </div>
          <div>
            <dt>{t("outcomes.lines")}</dt>
            <dd>{formatNumber(outcomes?.linesAccepted.value ?? null, 0)}</dd>
          </div>
          <div>
            <dt>{t("outcomes.survival")}</dt>
            <dd>{formatNumber(outcomes?.editSurvivalNoRevert.value ?? null, 0)}</dd>
          </div>
          <div>
            <dt>{t("outcomes.compactions")}</dt>
            <dd>{formatNumber(outcomes?.contextCompactions.value ?? null, 0)}</dd>
          </div>
        </dl>
        <p className="muted">{t("outcomes.note")}</p>
      </div>
    </section>
  );
}

function CreditsView({ summary }: Readonly<{ summary: SummaryResponse | null }>) {
  const t = useT();
  const playbook = [
    { id: "included", title: t("credits.play.included.title"), body: t("credits.play.included.body") },
    { id: "budget", title: t("credits.play.budget.title"), body: t("credits.play.budget.body") },
    { id: "batch", title: t("credits.play.batch.title"), body: t("credits.play.batch.body") },
    { id: "cache", title: t("credits.play.cache.title"), body: t("credits.play.cache.body") },
    { id: "retry", title: t("credits.play.retry.title"), body: t("credits.play.retry.body") },
    { id: "monitor", title: t("credits.play.monitor.title"), body: t("credits.play.monitor.body") }
  ];
  return (
    <>
      <BudgetPanel summary={summary} />
      <ModelMixPanel summary={summary} />
      <ExperiencePanel summary={summary} />
      <Panel title={t("credits.play.title")} aside={<span className="muted">{t("credits.play.aside")}</span>}>
        <ul className="playbook-grid">
          {playbook.map((item) => (
            <li key={item.id} className="playbook-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

function OverviewView({ summary }: Readonly<{ summary: SummaryResponse | null }>) {
  const t = useT();
  const alerts = localizeAlerts(summary?.alerts ?? [], t);
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
      <AlertsBanner
        alerts={alerts}
        labels={{
          clearTitle: t("alerts.clearTitle"),
          clearBody: t("alerts.clearBody"),
          activeTitle: t("alerts.activeTitle"),
          note: t("alerts.note"),
          severity: {
            info: t("severity.info"),
            warning: t("severity.warning"),
            critical: t("severity.critical")
          }
        }}
      />
      <KpiStrip summary={summary} />
      <BudgetPanel summary={summary} compact />
      <TokenComposition summary={summary} />
      <HistoryPanel points={summary?.history.points ?? []} message={summary?.history.message} />
      <Panel title={t("overview.topWorkspaces")} aside={<span className="muted">{t("overview.rankedByCredits")}</span>}>
        <WorkspaceTable summary={summary} limit={5} />
      </Panel>
      <Panel
        title={t("health.stack")}
        aside={
          <span className="health-summary">
            {t("health.summary", { ok: healthCounts.ok, degraded: healthCounts.degraded, unavailable: healthCounts.unavailable })}
          </span>
        }
      >
        <div className="health-grid">
          {(summary?.health ?? []).map((service) => (
            <article className="health-card" key={service.id}>
              <div>
                <h3>{service.name}</h3>
                <p>{service.detail}</p>
              </div>
              <span className={statusClass(service.status)}>{statusText(service.status, t)}</span>
            </article>
          ))}
        </div>
      </Panel>
    </>
  );
}

const aspireBase = "http://localhost:18888";
const grafanaSessions = "http://localhost:3000/d/copilot-sessions-models-local/github-copilot-sessions-and-model-labels-local";

function SessionsView({ sessions }: Readonly<{ sessions: SessionsResponse | null }>) {
  const t = useT();
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
      title={t("sessions.title")}
      status={sessions?.status}
      aside={
        <div className="link-row">
          <a href={`${aspireBase}/traces`} target="_blank" rel="noopener noreferrer">{t("sessions.aspire")}</a>
          <a href={grafanaSessions} target="_blank" rel="noopener noreferrer">{t("sessions.grafana")}</a>
        </div>
      }
    >
      {items.length > 0 ? (
        <div className="table-wrap">
          <table className="sessions-table">
            <thead>
              <tr>
                <th>{t("ws.col.workspace")}</th>
                <th>{t("sessions.col.model")}</th>
                <th>{t("sessions.col.mode")}</th>
                <th className="numeric">{t("ws.col.aiCredits")}</th>
                <th className="numeric">{t("ws.col.input")}</th>
                <th className="numeric">{t("sessions.col.output")}</th>
                <th className="numeric">{t("ws.col.cached")}</th>
                <th className="numeric">{t("ws.col.cold")}</th>
                <th className="numeric">{t("ws.col.cacheEff")}</th>
                <th className="numeric">{t("sessions.col.tools")}</th>
                <th className="numeric">{t("sessions.col.context")}</th>
                <th>{t("sessions.col.trace")}</th>
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
                  <td className="numeric">{formatPctText(session.contextPct)}</td>
                  <td>
                    <button type="button" className="trace-copy" onClick={() => void copyTrace(session.traceId)} title={session.traceId}>
                      {copied === session.traceId ? t("sessions.copied") : `${session.traceId.slice(0, 8)}…`}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">{sessions?.message ?? t("sessions.empty")}</p>
      )}
      <p className="muted">{t("sessions.note")}</p>
    </Panel>
  );
}

function WorkspacesView({ summary }: Readonly<{ summary: SummaryResponse | null }>) {
  const t = useT();
  return (
    <Panel title={t("workspaces.title")} status={summary?.workspaces.status} aside={undefined}>
      <WorkspaceTable summary={summary} />
      <p className="muted">{t("workspaces.note")}</p>
    </Panel>
  );
}

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

function CoachView({ coach, summary }: Readonly<{ coach: CoachResponse | null; summary: SummaryResponse | null }>) {
  const t = useT();
  const cards = coach?.cards ?? [];
  const topSessions = coach?.topSessions ?? [];
  const economy = summary?.economy;
  const score = economy?.efficiencyScore ?? null;
  const opportunities = economy?.savingsOpportunities ?? [];
  const playbook: { id: string; title: string; body: string }[] = [
    { id: "warm", title: t("playbook.warm.title"), body: t("playbook.warm.body") },
    { id: "cold", title: t("playbook.cold.title"), body: t("playbook.cold.body") },
    { id: "focus", title: t("playbook.focus.title"), body: t("playbook.focus.body") },
    { id: "errors", title: t("playbook.errors.title"), body: t("playbook.errors.body") },
    { id: "model", title: t("playbook.model.title"), body: t("playbook.model.body") },
    { id: "validate", title: t("playbook.validate.title"), body: t("playbook.validate.body") },
    { id: "workspace", title: t("playbook.workspace.title"), body: t("playbook.workspace.body") }
  ];
  return (
    <>
      <Panel title={t("coach.efficiency")} aside={<span className="muted">{t("coach.localEstimate")}</span>}>
        <div className="efficiency-row">
          <div className={`score-dial score-${efficiencyTone(score)}`}>
            <span className="score-value">{score ?? "—"}</span>
            <span className="score-max">/ 100</span>
          </div>
          <div className="efficiency-facts">
            <div>
              <span className="stat-label">{t("coach.creditsInRange")}</span>
              <span className="stat-value">{formatNumber(economy?.aiCredits ?? null, 2)}</span>
            </div>
            <div>
              <span className="stat-label">{t("coach.cacheEff")}</span>
              <span className="stat-value">{formatPercent(economy?.cacheEfficiency ?? null)}</span>
            </div>
            <div>
              <span className="stat-label">{t("coach.coldShare")}</span>
              <span className="stat-value">{formatPercent(economy?.coldCostShare ?? null)}</span>
            </div>
            <div>
              <span className="stat-label">{t("coach.potentialSavings")}</span>
              <span className="stat-value">{formatNumber(economy?.potentialSavingsCredits ?? null, 2)}</span>
            </div>
          </div>
        </div>
        <p className="muted">{t("coach.scoreNote")}</p>
      </Panel>
      {opportunities.length > 0 ? (
        <Panel title={t("coach.savings")} aside={<span className="muted">{t("coach.savingsAside")}</span>}>
          <ul className="savings-list">
            {opportunities.map((item) => (
              <li key={item.id} className="savings-card">
                <div className="savings-head">
                  <h3>{item.label}</h3>
                  <span className="savings-credits">{t("coach.creditsUnit", { value: formatNumber(item.estimateCredits, 2) })}</span>
                </div>
                <p>{item.detail}</p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      <Panel title={t("coach.recommendations")} aside={<span className="muted">{coach ? t("coach.generated", { time: new Date(coach.generatedAt).toLocaleTimeString() }) : ""}</span>}>
        {cards.length > 0 ? (
          <ul className="coach-list">
            {cards.map((card) => (
              <li key={card.id} className={`coach-card coach-${card.severity}`}>
                <div className="coach-head">
                  <span className="coach-tag">{t(`severity.${card.severity}`)}</span>
                  <h3>{card.title}</h3>
                </div>
                <p className="coach-insight">{card.insight}</p>
                <p className="coach-action"><strong>{t("coach.tryThis")}</strong> {card.action}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t("coach.noRecs")}</p>
        )}
      </Panel>
      <Panel title={t("coach.playbook")} aside={<span className="muted">{t("coach.bestPractices")}</span>}>
        <ul className="playbook-grid">
          {playbook.map((item) => (
            <li key={item.id} className="playbook-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ul>
      </Panel>
      {topSessions.length > 0 ? (
        <Panel title={t("coach.expensive")} aside={<span className="muted">{t("coach.byCredits")}</span>}>
          <div className="table-wrap">
            <table className="sessions-table">
              <thead>
                <tr>
                  <th>{t("ws.col.workspace")}</th>
                  <th>{t("sessions.col.model")}</th>
                  <th className="numeric">{t("ws.col.aiCredits")}</th>
                  <th className="numeric">{t("ws.col.input")}</th>
                  <th className="numeric">{t("ws.col.cacheEff")}</th>
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

function HistoryView({ summary }: Readonly<{ summary: SummaryResponse | null }>) {
  const t = useT();
  const points = summary?.history.points ?? [];
  return (
    <>
      <HistoryPanel points={points} message={summary?.history.message} />
      <Panel title={t("history.detail")} aside={<span className="muted">{t("history.buckets", { count: points.length })}</span>}>
        {points.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("history.col.time")}</th>
                  <th className="numeric">{t("ws.col.aiCredits")}</th>
                  <th className="numeric">{t("ws.col.input")}</th>
                  <th className="numeric">{t("sessions.col.output")}</th>
                  <th className="numeric">{t("ws.col.cached")}</th>
                  <th className="numeric">{t("ws.col.cold")}</th>
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
          <p className="muted">{summary?.history.message ?? t("history.emptyRows")}</p>
        )}
      </Panel>
    </>
  );
}

function HealthView({ summary }: Readonly<{ summary: SummaryResponse | null }>) {
  const t = useT();
  const usdTotal = sumSeries(summary?.metrics.usdWhatIf);
  return (
    <>
      <Panel title={t("health.stack")} status={undefined}>
        <div className="health-grid">
          {(summary?.health ?? []).map((service) => (
            <article className="health-card" key={service.id}>
              <div>
                <h3>{service.name}</h3>
                <p>{service.detail}</p>
              </div>
              <span className={statusClass(service.status)}>{statusText(service.status, t)}</span>
            </article>
          ))}
        </div>
      </Panel>
      <section className="panel two-column">
        <div>
          <div className="panel-header"><h2>{t("health.dataQuality")}</h2></div>
          <dl className="quality-grid">
            <div>
              <dt>{t("health.workspaceReal")}</dt>
              <dd>{formatNumberText(summary?.metrics.dataQuality.workspaceReal.value, 0, t)}</dd>
            </div>
            <div>
              <dt>{t("health.nonWorkspaceReal")}</dt>
              <dd>{formatNumberText(summary?.metrics.dataQuality.nonWorkspaceReal.value, 0, t)}</dd>
            </div>
            <div>
              <dt>{t("health.observedCoverage")}</dt>
              <dd>{formatNumberText(summary?.metrics.dataQuality.observedCoverage.value, 0, t)}</dd>
            </div>
            <div>
              <dt>{t("health.notObservedYet")}</dt>
              <dd>{formatNumberText(summary?.metrics.dataQuality.notObservedYet.value, 0, t)}</dd>
            </div>
          </dl>
          <p className="muted">{t("health.dqNote")}</p>
        </div>
        <div>
          <div className="panel-header">
            <h2>{t("health.officialBilling")}</h2>
            <span className="status status-unavailable">{summary?.officialBilling.status ?? "unavailable"}</span>
          </div>
          <p>{summary?.officialBilling.reason}</p>
          <p className="muted">{t("health.usdWhatIf", { value: formatCurrencyText(usdTotal, t) })}</p>
        </div>
      </section>
      <section className="panel two-column">
        <div>
          <h2>{t("health.boundary")}</h2>
          <p>{t("health.boundaryBody")}</p>
          <h3>{t("health.localOnly")}</h3>
          <ul>{(summary?.dataBoundary.localOnly ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
          <h3>{t("health.governed")}</h3>
          <ul>{(summary?.dataBoundary.safeForwarding ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div>
          <h2>{t("health.drilldown")}</h2>
          <div className="link-grid">
            {(summary?.links ?? []).map((link) => (
              <a href={link.url} key={link.label} target="_blank" rel="noopener noreferrer">{link.label}</a>
            ))}
          </div>
          <p className="muted">{t("health.drilldownNote")}</p>
        </div>
      </section>
    </>
  );
}

const thresholdKeys = [
  "aiCreditsWarn",
  "aiCreditsCrit",
  "inputTokensWarn",
  "inputTokensCrit",
  "contextWarnPct",
  "contextCritPct",
  "cacheEfficiencyWarn",
  "coldRatioWarn"
];

const thresholdEnv: Record<string, string> = {
  aiCreditsWarn: "THRESHOLD_AI_CREDITS_WARN",
  aiCreditsCrit: "THRESHOLD_AI_CREDITS_CRIT",
  inputTokensWarn: "THRESHOLD_INPUT_TOKENS_WARN",
  inputTokensCrit: "THRESHOLD_INPUT_TOKENS_CRIT",
  contextWarnPct: "THRESHOLD_CONTEXT_WARN_PCT",
  contextCritPct: "THRESHOLD_CONTEXT_CRIT_PCT",
  cacheEfficiencyWarn: "THRESHOLD_CACHE_EFFICIENCY_WARN",
  coldRatioWarn: "THRESHOLD_COLD_RATIO_WARN"
};

function SettingsView({ summary }: Readonly<{ summary: SummaryResponse | null }>) {
  const t = useT();
  const thresholds = summary?.thresholds ?? {};
  return (
    <>
      <Panel title={t("settings.thresholds")} aside={<span className="muted">{t("settings.guardrails")}</span>}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("settings.col.guardrail")}</th>
                <th className="numeric">{t("settings.col.value")}</th>
                <th>{t("settings.col.env")}</th>
                <th>{t("settings.col.does")}</th>
              </tr>
            </thead>
            <tbody>
              {thresholdKeys.map((key) => (
                <tr key={key}>
                  <td>{t(`th.${key}.label`)}</td>
                  <td className="numeric strong">{formatNumberText(thresholds[key], 2, t)}</td>
                  <td><code>{thresholdEnv[key]}</code></td>
                  <td className="muted">{t(`th.${key}.help`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">{t("settings.note")}</p>
      </Panel>
      <Panel title={t("settings.about")} aside={undefined}>
        <p>{t("settings.aboutBody")}</p>
        <ul>
          <li>{t("settings.about1")}</li>
          <li>{t("settings.about2")}</li>
          <li>{t("settings.about3")}</li>
        </ul>
      </Panel>
    </>
  );
}

const langStorageKey = "frontier.lang";

interface ViewProps {
  summary: SummaryResponse | null;
  sessions: SessionsResponse | null;
  coach: CoachResponse | null;
}

const viewRenderers: Record<ViewId, (props: ViewProps) => ReactNode> = {
  overview: ({ summary }) => <OverviewView summary={summary} />,
  credits: ({ summary }) => <CreditsView summary={summary} />,
  sessions: ({ sessions }) => <SessionsView sessions={sessions} />,
  workspaces: ({ summary }) => <WorkspacesView summary={summary} />,
  coach: ({ coach, summary }) => <CoachView coach={coach} summary={summary} />,
  history: ({ summary }) => <HistoryView summary={summary} />,
  health: ({ summary }) => <HealthView summary={summary} />,
  settings: ({ summary }) => <SettingsView summary={summary} />
};

function readInitialLang(): Lang {
  if (typeof localStorage === "undefined") {
    return defaultLang;
  }
  const stored = localStorage.getItem(langStorageKey);
  return languages.some((entry) => entry.id === stored) ? (stored as Lang) : defaultLang;
}

function AppShell({ lang, setLang }: Readonly<{ lang: Lang; setLang: (lang: Lang) => void }>) {
  const t = useT();
  const [range, setRange] = useState<RangeOption>("24h");
  const [repo, setRepo] = useState("all");
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const { data, error, isLoading, reload } = useDashboardData(range, repo);
  const { summary, sessions, coach } = data;

  const views = buildViews(t);
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

  const scopeLabel = repo === "all" ? t("footer.allScope") : repo.replace(/^https?:\/\//, "");

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
        <div className="sidebar-lang">
          <span className="sidebar-lang-label">{t("controls.language")}</span>
          <div className="segmented small lang-switch">
            {languages.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={lang === entry.id ? "active" : ""}
                onClick={() => setLang(entry.id)}
                title={entry.label}
              >
                {entry.short}
              </button>
            ))}
          </div>
        </div>
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
            <p className="topbar-blurb">{activeDef.blurb}. {t("topbar.blurbSuffix")}</p>
          </div>
          <div className="topbar-controls">
            <div className="control-group">
              <label>{t("controls.range")}</label>
              <div className="segmented">
                {rangeOptions.map((option) => (
                  <button key={option} type="button" className={range === option ? "active" : ""} onClick={() => setRange(option)}>
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-group">
              <label htmlFor="repo">{t("controls.workspace")}</label>
              <select id="repo" value={repo} onChange={(event) => setRepo(event.target.value)}>
                <option value="all">{t("controls.allWorkspaces")}</option>
                {(summary?.repositories ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option.replace(/^https?:\/\//, "").replace(/\.git$/, "")}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="refresh" onClick={() => void reload()} disabled={isLoading}>
              {isLoading ? t("controls.refreshing") : t("controls.refresh")}
            </button>
          </div>
        </header>

        {error ? <div className="error">{error}</div> : null}
        {!summary && !error ? <div className="loading">{t("state.loading")}</div> : null}

        <div className="view">
          {viewRenderers[activeView]({ summary, sessions, coach })}
        </div>

        <footer className="content-foot">
          <span>{summary ? t("footer.updated", { time: new Date(summary.refreshedAt).toLocaleTimeString() }) : t("footer.waiting")}</span>
          <span>{t("footer.scope", { range, scope: scopeLabel })}</span>
        </footer>
      </main>
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useState<Lang>(() => readInitialLang());

  const selectLang = useCallback((next: Lang) => {
    setLang(next);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(langStorageKey, next);
    }
  }, []);

  useEffect(() => {
    const entry = languages.find((item) => item.id === lang);
    document.documentElement.lang = entry?.htmlLang ?? "en";
  }, [lang]);

  return (
    <LangProvider lang={lang}>
      <AppShell lang={lang} setLang={selectLang} />
    </LangProvider>
  );
}
