import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  Alert,
  AlertSeverity,
  CoachCard,
  CoachResponse,
  CopilotPlanFacts,
  HistoryPoint,
  InspectorEvent,
  InspectorResponse,
  LongTermHistoryResponse,
  PlannerInsight,
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
  contextTone,
  formatCompact,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatShare,
  setNumberLocale,
  TrendAxis,
  statusClass,
  sumSeries,
  type HistoryField
} from "./ui";
import { LangProvider, defaultLang, languages, useT, type Lang, type TranslateFn } from "./i18n";
import { CheckIcon, DashIcon, NavIcon } from "./icons";

const rangeOptions: RangeOption[] = ["1h", "6h", "24h", "7d"];

// First-run setup collected by the wizard. The license part is sent to the
// API as query overrides so credits follow the selected plan immediately; the
// environment configuration stays as the default when the wizard is skipped.
export interface SetupPrefs {
  name: string;
  role: string;
  plan: string;
  seats: number;
  promo: boolean;
  repoHost: "github" | "gitlab" | "azuredevops";
}

const setupStorageKey = "frontier.setup.v1";

function readSetupPrefs(): SetupPrefs | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(setupStorageKey);
    return raw ? (JSON.parse(raw) as SetupPrefs) : null;
  } catch {
    return null;
  }
}

function planQueryParams(prefs: SetupPrefs | null): Record<string, string> {
  if (!prefs) {
    return {};
  }
  return { plan: prefs.plan, seats: String(prefs.seats), promo: String(prefs.promo) };
}

type ViewId = "overview" | "credits" | "planner" | "inspector" | "sessions" | "workspaces" | "coach" | "history" | "health" | "settings";

interface ViewDef {
  id: ViewId;
  label: string;
  blurb: string;
}

const viewOrder: ViewId[] = [
  "overview",
  "credits",
  "planner",
  "inspector",
  "sessions",
  "workspaces",
  "coach",
  "history",
  "health",
  "settings"
];

function buildViews(t: TranslateFn): ViewDef[] {
  return viewOrder.map((id) => ({
    id,
    label: t(`nav.${id}.label`),
    blurb: t(`nav.${id}.blurb`)
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

function useDashboardData(range: RangeOption, repo: string, prefs: SetupPrefs | null) {
  const [data, setData] = useState<DashboardData>({ summary: null, sessions: null, coach: null });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ range, repo, ...planQueryParams(prefs) });
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
  }, [range, repo, prefs]);

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
      case "ai-credits-budget":
        return {
          ...alert,
          title: t(`alert.ai-credits-budget.${alert.severity}.title`),
          detail: t("alert.ai-credits-budget.detail", { value: formatNumber(alert.value, 0) })
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
          <span className="stat-value">{formatCompact(summary?.metrics.activity.toolCalls.value ?? null)}</span>
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
        <>
          <TrendChart points={points} field={field} tone={tone} />
          <TrendAxis points={points} />
        </>
      ) : (
        <p className="muted" title={message}>{t("history.empty")}</p>
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
    return <p className="muted" title={summary?.workspaces.message}>{t("ws.empty")}</p>;
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
            <th className="numeric">{t("ws.col.contextPeak")}</th>
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
              <td className="numeric">
                <span className={`pill ${contextTone(workspace.contextPeakPct, summary?.thresholds)}`}>
                  {workspace.contextPeakPct === null ? "—" : `${formatNumber(workspace.contextPeakPct, 0)}%`}
                </span>
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
  // Percentages read as percentages only while they stay in human range; past
  // 10x the pool a multiplier is the honest, readable form (945% vs 97.6x).
  // One unit for the whole facts row: if either share crosses 10x, both
  // render as multipliers so the pair stays comparable.
  const forceMultiplier = Math.max(utilization ?? 0, projected ?? 0) >= 1000;
  const pctText = (pct: number | null): string => formatShare(pct, forceMultiplier && pct !== null);
  const overBy =
    budget && budget.observedCredits !== null && budget.observedCredits > budget.monthlyAllowanceCredits
      ? budget.observedCredits - budget.monthlyAllowanceCredits
      : null;
  const exhaustionText = budget?.projectedExhaustionDate
    ? t("budget.exhaustionValue", {
      date: new Date(budget.projectedExhaustionDate).toLocaleDateString(),
      days: formatNumber(Math.max(0, budget.daysToExhaustion ?? 0), 0)
    })
    : t("budget.exhaustionNone");

  return (
    <Panel
      title={t("budget.title")}
      status={budget?.status === "unavailable" ? "unavailable" : undefined}
      aside={
        <div className="link-row">
          <span className="muted">{t("budget.aside", { plan: planLabel })}</span>
          {budget && budget.alertLevel !== "ok" ? (
            <span className={`pill ${budget.alertLevel === "warning" ? "pill-warn" : "pill-bad"}`}>
              {t(`budget.level.${budget.alertLevel}`)}
            </span>
          ) : null}
        </div>
      }
    >
      <div className="budget-head">
        <div className={`budget-figure budget-${tone}`}>
          <span className="budget-figure-value">
            {formatNumber(budget?.observedCredits ?? null, 0)}
          </span>
          <span className="budget-figure-unit">
            {t("budget.ofAllowance", { allowance: formatNumber(budget?.monthlyAllowanceCredits ?? null, 0) })}
          </span>
        </div>
        <div className="budget-facts">
          <div>
            <span className="stat-label">{t("budget.utilization")}</span>
            <span className="stat-value">
              {pctText(utilization)}
              {budget && budget.alertLevel !== "ok" ? (
                <span className={`pill budget-level-pill ${budget.alertLevel === "warning" ? "pill-warn" : "pill-bad"}`}>
                  {t(`budget.level.${budget.alertLevel}`)}
                </span>
              ) : null}
            </span>
          </div>
          <div>
            <span className="stat-label">{t("budget.remaining")}</span>
            <span className="stat-value">
              {formatNumber(budget?.remainingCredits ?? null, 0)}
              {overBy !== null ? (
                <span className="pill pill-bad budget-level-pill">{t("budget.overBy", { value: formatNumber(overBy, 0) })}</span>
              ) : null}
            </span>
          </div>
          <div>
            <span className="stat-label">{t("budget.daysLeft")}</span>
            <span className="stat-value">{budget ? formatNumber(budget.daysLeft, 0) : "—"}</span>
          </div>
          <div>
            <span className="stat-label">{t("budget.projected")}</span>
            <span className="stat-value">{pctText(projected)}</span>
          </div>
          <div>
            <span className="stat-label">{t("budget.exhaustion")}</span>
            <span className="stat-value">{exhaustionText}</span>
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
  return (
    <Panel
      title={t("mix.title")}
      status={mix?.status}
      aside={<span className="muted">{t("mix.aside")}</span>}
    >
      {mix && mix.totalEstimatedAiCredits !== null ? (
        <div className="mix-split">
          <svg className="mix-split-bar" viewBox="0 0 100 8" preserveAspectRatio="none" role="img" aria-label={t("mix.title")}>
            {entries.map((entry, index) => {
              const previous = entries.slice(0, index).reduce((sum, item) => sum + ((item.share ?? 0) * 100), 0);
              return <rect key={entry.model} className={`seg-cat-${index % 6}`} x={previous} y="0" width={(entry.share ?? 0) * 100} height="8" />;
            })}
          </svg>
          <div className="mix-split-legend">
            {entries.slice(0, 6).map((entry, index) => (
              <span key={entry.model}><i className={`dot-cat-${index % 6}`} />{entry.model} {formatPercent(entry.share)}</span>
            ))}
            <span className="muted">{t("mix.total", { value: formatNumber(mix.totalEstimatedAiCredits, 1) })}</span>
          </div>
        </div>
      ) : null}
      {entries.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("sessions.col.model")}</th>
                <th className="numeric">{t("mix.col.input")}</th>
                <th className="numeric">{t("mix.col.output")}</th>
                <th className="numeric">{t("mix.col.cached")}</th>
                <th className="numeric">{t("mix.col.calls")}</th>
                <th className="numeric">{t("mix.col.credits")}</th>
                <th className="numeric">{t("mix.col.share")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.model}>
                  <td><span className="model-tag">{entry.model}</span></td>
                  <td className="numeric">{formatCompact(entry.inputTokens)}</td>
                  <td className="numeric">{formatCompact(entry.outputTokens)}</td>
                  <td className="numeric">{formatCompact(entry.cachedTokens)}</td>
                  <td className="numeric">{formatNumber(entry.calls, 0)}</td>
                  <td className="numeric strong">{entry.estimatedAiCredits === null ? "—" : formatNumber(entry.estimatedAiCredits, 2)}</td>
                  <td className="numeric">{formatPercent(entry.share)}</td>
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
      <PlanComparisonPanel summary={summary} />
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

interface PlanRow {
  readonly id: string;
  readonly label: string;
  readonly biz: string;
  readonly ent: string;
  readonly kind: "text" | "icon";
}

function planFeatureRows(t: TranslateFn, business?: CopilotPlanFacts, enterprise?: CopilotPlanFacts, promoActive?: boolean): readonly PlanRow[] {
  const credits = (value: number | null | undefined) => (value === null || value === undefined ? "—" : formatNumber(value, 0));
  const rows: PlanRow[] = [
    { id: "price", label: t("plans.row.price"), biz: `US$${business?.priceUsdMonth ?? "—"}`, ent: `US$${enterprise?.priceUsdMonth ?? "—"}`, kind: "text" },
    { id: "standard", label: t("plans.row.standard"), biz: credits(business?.includedCredits), ent: credits(enterprise?.includedCredits), kind: "text" }
  ];
  if (promoActive) {
    rows.push({ id: "promo", label: t("plans.row.promo"), biz: credits(business?.promoCredits), ent: credits(enterprise?.promoCredits), kind: "text" });
  }
  rows.push(
    { id: "value", label: t("plans.row.value"), biz: t("plans.val.creditValue"), ent: t("plans.val.creditValue"), kind: "text" },
    { id: "pooling", label: t("plans.row.pooling"), biz: t("plans.val.pooledOrg"), ent: t("plans.val.pooledEnt"), kind: "text" },
    { id: "completions", label: t("plans.row.completions"), biz: t("plans.val.notBilled"), ent: t("plans.val.notBilled"), kind: "text" },
    { id: "controls", label: t("plans.row.controls"), biz: t("plans.val.controlsBiz"), ent: t("plans.val.controlsEnt"), kind: "text" },
    { id: "githubcom", label: t("plans.row.githubcom"), biz: "dash", ent: "check", kind: "icon" },
    { id: "knowledge", label: t("plans.row.knowledge"), biz: "dash", ent: "check", kind: "icon" },
    { id: "governance", label: t("plans.row.governance"), biz: t("plans.val.orgScope"), ent: t("plans.val.entScope"), kind: "text" }
  );
  return rows;
}

function PlanCell({ kind, value, t }: Readonly<{ kind: "text" | "icon"; value: string; t: TranslateFn }>) {
  if (kind !== "icon") {
    return <>{value}</>;
  }
  if (value === "check") {
    return (
      <span className="plan-yes">
        <CheckIcon /> {t("plans.val.included")}
      </span>
    );
  }
  return (
    <span className="plan-no">
      <DashIcon /> {t("plans.val.notIncluded")}
    </span>
  );
}

function planDisplayName(plan: CopilotPlanFacts, t: TranslateFn): string {
  const key = `plans.name.${plan.id}`;
  const translated = t(key);
  return translated === key ? plan.id : translated;
}

function PlanCard({
  plan,
  current,
  promoActive,
  maxCredits,
  t
}: Readonly<{ plan: CopilotPlanFacts; current: boolean; promoActive: boolean; maxCredits: number; t: TranslateFn }>) {
  const included = plan.includedCredits;
  const stdPct = included === null ? 0 : (included / maxCredits) * 100;
  const showPromo = promoActive && plan.promoCredits !== null;
  const promoPct = showPromo ? ((plan.promoCredits ?? 0) / maxCredits) * 100 : 0;
  return (
    <article className={current ? "plan-card plan-card-current" : "plan-card"}>
      <div className="plan-card-head">
        <h3>{planDisplayName(plan, t)}</h3>
        {current ? <span className="plan-current-badge">{t("plans.current")}</span> : null}
      </div>
      <div className="plan-price">
        <span className="plan-price-value">US${plan.priceUsdMonth}</span>
        <span className="plan-price-unit muted">{plan.perSeat ? t("plans.perUserMonth") : t("plans.perMonth")}</span>
      </div>
      <div className="plan-allowance-row">
        <span className="plan-allowance-label">{t("plans.standard")}</span>
        <span className="plan-allowance-value">{included === null ? t("plans.autoOnly") : formatNumber(included, 0)}</span>
      </div>
      <svg className="plan-bar" viewBox="0 0 100 6" preserveAspectRatio="none" role="img" aria-label={t("plans.standard")}>
        <rect className="plan-bar-track" x="0" y="0" width="100" height="6" rx="3" />
        <rect className="plan-bar-fill plan-bar-standard" x="0" y="0" width={stdPct} height="6" rx="3" />
      </svg>
      {plan.flexCredits > 0 ? (
        <span className="plan-allowance-unit muted">{t("plans.flexNote", { base: formatNumber(plan.baseCredits ?? 0, 0), flex: formatNumber(plan.flexCredits, 0) })}</span>
      ) : null}
      {showPromo ? (
        <>
          <div className="plan-allowance-row">
            <span className="plan-allowance-label">
              {t("plans.promo")} <span className="muted">({t("plans.promoWindow")})</span>
            </span>
            <span className="plan-allowance-value">{formatNumber(plan.promoCredits ?? 0, 0)}</span>
          </div>
          <svg className="plan-bar" viewBox="0 0 100 6" preserveAspectRatio="none" role="img" aria-label={t("plans.promo")}>
            <rect className="plan-bar-track" x="0" y="0" width="100" height="6" rx="3" />
            <rect className="plan-bar-fill plan-bar-promo" x="0" y="0" width={promoPct} height="6" rx="3" />
          </svg>
        </>
      ) : null}
      <span className="plan-allowance-unit muted">{plan.perSeat ? t("plans.creditsUnit") : t("plans.creditsUnitIndividual")}</span>
    </article>
  );
}

function PlanComparisonPanel({ summary }: Readonly<{ summary: SummaryResponse | null }>) {
  const t = useT();
  const [showAll, setShowAll] = useState(false);
  const billing = summary?.billing;
  const catalog = billing?.planCatalog ?? [];
  const currentPlan = billing?.configuredPlan ?? summary?.budget?.plan ?? null;
  const promoActive = billing?.promoWindow.active ?? false;
  const business = catalog.find((plan) => plan.id === "business");
  const enterprise = catalog.find((plan) => plan.id === "enterprise");
  const yourPlan = catalog.find((plan) => plan.id === currentPlan) ?? null;
  const maxCredits = Math.max(
    1,
    ...catalog.map((plan) => Math.max(plan.includedCredits ?? 0, promoActive ? plan.promoCredits ?? 0 : 0))
  );
  const rows = planFeatureRows(t, business, enterprise, promoActive);
  if (catalog.length === 0) {
    return null;
  }
  // Once a license is configured, the panel is about YOUR plan: one card and
  // one facts column. The full catalog stays one click away for upgrade or
  // overage discussions, but never competes with the configured license.
  const focused = yourPlan !== null && !showAll;
  return (
    <Panel
      title={focused ? t("plans.titleMine") : t("plans.title")}
      aside={
        <div className="link-row">
          <span className="muted">{t("plans.aside")}</span>
          {yourPlan ? (
            <button type="button" className="plan-toggle" onClick={() => setShowAll((value) => !value)}>
              {focused ? t("plans.showAll") : t("plans.showMine")}
            </button>
          ) : null}
        </div>
      }
    >
      {focused && yourPlan ? (
        <>
          <div className="plans-grid plans-grid-single">
            <PlanCard plan={yourPlan} current promoActive={promoActive} maxCredits={maxCredits} t={t} />
          </div>
          {yourPlan.id === "business" || yourPlan.id === "enterprise" ? (
            <div className="table-wrap">
              <table className="plan-table">
                <thead>
                  <tr>
                    <th>{t("plans.feature")}</th>
                    <th>{t(`plans.${yourPlan.id}`)}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.label}</td>
                      <td>
                        <PlanCell kind={row.kind} value={yourPlan.id === "business" ? row.biz : row.ent} t={t} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="plans-grid">
            {catalog.map((plan) => (
              <PlanCard key={plan.id} plan={plan} current={currentPlan === plan.id} promoActive={promoActive} maxCredits={maxCredits} t={t} />
            ))}
          </div>
          <div className="table-wrap">
            <table className="plan-table">
              <thead>
                <tr>
                  <th>{t("plans.feature")}</th>
                  <th>{t("plans.business")}</th>
                  <th>{t("plans.enterprise")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.label}</td>
                    <td>
                      <PlanCell kind={row.kind} value={row.biz} t={t} />
                    </td>
                    <td>
                      <PlanCell kind={row.kind} value={row.ent} t={t} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="plan-note muted">{t("plans.note")}</p>
      {!promoActive && billing ? <p className="plan-note muted">{t("plans.promoEnded", { end: billing.promoWindow.end })}</p> : null}
    </Panel>
  );
}

const plannerWeeksOptions = [2, 4, 8, 12] as const;
const plannerLookbackOptions = ["24h", "7d", "14d", "30d"] as const;

function usePlannerData(repo: string, weeks: number, lookback: string, prefs: SetupPrefs | null) {
  const [planner, setPlanner] = useState<PlannerInsight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams({ repo, weeks: String(weeks), lookback, ...planQueryParams(prefs) });
    fetch(`/api/planner?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Planner API returned HTTP ${response.status}`);
        }
        const payload = (await response.json()) as PlannerInsight;
        if (!cancelled) {
          setPlanner(payload);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load planner data.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [repo, weeks, lookback, prefs]);

  return { planner, error, isLoading };
}

function plannerVerdictTone(verdict: string): string {
  if (verdict === "no-data") {
    return "pill-neutral";
  }
  if (verdict === "justified") {
    return "pill-good";
  }
  if (verdict === "review") {
    return "pill-warn";
  }
  return "pill-good";
}

function PlannerView({ summary, repo, prefs }: Readonly<{ summary: SummaryResponse | null; repo: string; prefs: SetupPrefs | null }>) {
  const t = useT();
  const [weeks, setWeeks] = useState<number>(4);
  const [lookback, setLookback] = useState<string>("7d");
  const [copied, setCopied] = useState(false);
  const { planner, error, isLoading } = usePlannerData(repo, weeks, lookback, prefs);

  const copyJustification = useCallback(async () => {
    if (!planner) {
      return;
    }
    try {
      await navigator.clipboard.writeText(planner.justificationMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, [planner]);

  const forecast = planner?.forecast;
  const strategy = planner?.modelStrategy;
  const allowance = planner?.allowanceCredits ?? 0;
  const projectedPct = forecast?.monthUtilizationPct ?? null;
  const barWidth = projectedPct === null ? 0 : Math.min(100, projectedPct);
  const overageTone = forecast?.needsOverage ? "bad" : "good";

  return (
    <>
      <Panel
        title={t("planner.title")}
        status={planner?.status}
        aside={
          <div className="link-row">
            <div className="segmented small">
              {plannerLookbackOptions.map((option) => (
                <button key={option} type="button" className={lookback === option ? "active" : ""} onClick={() => setLookback(option)}>
                  {option}
                </button>
              ))}
            </div>
            <div className="segmented small">
              {plannerWeeksOptions.map((option) => (
                <button key={option} type="button" className={weeks === option ? "active" : ""} onClick={() => setWeeks(option)}>
                  {t("planner.weeks", { count: option })}
                </button>
              ))}
            </div>
          </div>
        }
      >
        {error ? <p className="muted">{error}</p> : null}
        {isLoading && !planner ? <p className="muted">{t("state.loading")}</p> : null}
        {planner ? (
          <>
            <p className="muted">
              {t("planner.scopeLine", {
                scope: planner.scope,
                lookback: planner.lookbackDays,
                plan: planner.plan,
                allowance: formatNumber(allowance, 0)
              })}
            </p>
            <div className="composition-stats">
              <div>
                <span className="stat-label">{t("planner.observedScope")}</span>
                <span className="stat-value">{formatNumber(planner.observed.workspaceCredits, 1)}</span>
              </div>
              <div>
                <span className="stat-label">{t("planner.dailyBurn")}</span>
                <span className="stat-value">{formatNumber(forecast?.workspaceDailyCredits ?? null, 1)}</span>
              </div>
              <div>
                <span className="stat-label">{t("planner.horizonForecast", { weeks })}</span>
                <span className="stat-value">{formatNumber(forecast?.workspaceHorizonCredits ?? null, 0)}</span>
              </div>
              <div>
                <span className="stat-label">{t("planner.monthAll")}</span>
                <span className="stat-value">{formatNumber(forecast?.allMonthlyCredits ?? null, 0)}</span>
              </div>
              <div>
                <span className="stat-label">{t("planner.monthUtilization")}</span>
                <span className="stat-value">{formatShare(projectedPct)}</span>
              </div>
            </div>
            <svg className="budget-bar" viewBox="0 0 100 8" preserveAspectRatio="none" role="img" aria-label={t("planner.monthUtilization")}>
              <rect className="budget-bar-track" x="0" y="0" width="100" height="8" />
              <rect className={`budget-bar-fill budget-${overageTone}`} x="0" y="0" width={barWidth} height="8" />
              {/* Allowance marker: past 100% it moves left so the overshoot
                  magnitude stays readable inside the bar. */}
              <line
                className="budget-bar-crit"
                x1={projectedPct !== null && projectedPct > 100 ? Math.max(1, 100 * (100 / projectedPct)) : 99.5}
                y1="0"
                x2={projectedPct !== null && projectedPct > 100 ? Math.max(1, 100 * (100 / projectedPct)) : 99.5}
                y2="8"
              />
            </svg>
            <p className={forecast?.needsOverage ? "planner-overage warn-text" : "planner-overage muted"}>
              {projectedPct === null
                ? t("planner.noForecastData")
                : forecast?.needsOverage
                  ? t("planner.overageNeeded", {
                    credits: formatNumber(forecast.projectedOverageCredits, 0),
                    usd: formatNumber(forecast.projectedOverageUsd, 2)
                  })
                  : t("planner.fitsAllowance")}
            </p>
            <p className="muted">{t("planner.note")}</p>
          </>
        ) : null}
      </Panel>
      {planner && strategy ? (
        <Panel
          title={t("planner.modelStrategy")}
          aside={<span className={`pill ${plannerVerdictTone(strategy.verdict)}`}>{t(`planner.verdict.${strategy.verdict}`)}</span>}
        >
          {strategy.splits.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("planner.col.tier")}</th>
                    <th className="numeric">{t("ws.col.aiCredits")}</th>
                    <th className="numeric">{t("ws.col.sessions")}</th>
                    <th className="numeric">{t("planner.col.avgTools")}</th>
                    <th>{t("planner.col.models")}</th>
                  </tr>
                </thead>
                <tbody>
                  {strategy.splits.map((split) => (
                    <tr key={split.tier}>
                      <td><span className="model-tag">{t(`planner.tier.${split.tier}`)}</span></td>
                      <td className="numeric strong">{formatNumber(split.credits, 2)}</td>
                      <td className="numeric">{formatNumber(split.sessions, 0)}</td>
                      <td className="numeric">{formatNumber(split.avgToolCalls, 1)}</td>
                      <td className="muted">{split.models.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">{t("planner.noModelData")}</p>
          )}
          <p>{t(`planner.verdictBody.${strategy.verdict}`, {
            share: formatNumber((strategy.frontierShare ?? 0) * 100, 0),
            movable: formatNumber(strategy.lowComplexityFrontierCredits, 1),
            minTools: formatNumber(summary?.coachTuning.complexSessionMinToolCalls ?? 5, 0)
          })}</p>
          {strategy.autoWhatIfSavingsCredits !== null ? (
            <p className="muted">
              {t("planner.autoWhatIf", {
                discount: formatNumber((planner.autoModelDiscount ?? 0.1) * 100, 0),
                credits: formatNumber(strategy.autoWhatIfSavingsCredits, 1)
              })}
            </p>
          ) : null}
          {strategy.reviewSessions.length > 0 ? (
            <>
              <h3 className="planner-review-title">{t("planner.reviewSessions")}</h3>
              <div className="table-wrap">
                <table className="sessions-table">
                  <thead>
                    <tr>
                      <th>{t("ws.col.workspace")}</th>
                      <th>{t("sessions.col.model")}</th>
                      <th className="numeric">{t("ws.col.aiCredits")}</th>
                      <th className="numeric">{t("sessions.col.tools")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {strategy.reviewSessions.map((session) => (
                      <tr key={session.traceId}>
                        <td><span className="ws-name">{session.repoShort}</span></td>
                        <td><span className="model-tag">{session.model}</span></td>
                        <td className="numeric strong">{formatNumber(session.aiCredits, 3)}</td>
                        <td className="numeric">{formatNumber(session.toolCalls, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </Panel>
      ) : null}
      {planner ? (
        <Panel
          title={t("planner.justification")}
          aside={
            <button type="button" className="refresh" onClick={() => void copyJustification()}>
              {copied ? t("planner.copied") : t("planner.copy")}
            </button>
          }
        >
          <p className="muted">{t("planner.justificationHelp")}</p>
          <textarea className="planner-justification" readOnly value={planner.justificationMarkdown} rows={18} />
        </Panel>
      ) : null}
    </>
  );
}

function useInspectorData(traceId: string) {
  const [inspector, setInspector] = useState<InspectorResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!traceId) {
      setInspector(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    fetch(`/api/inspector?traceId=${encodeURIComponent(traceId)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as InspectorResponse;
        if (!cancelled) {
          setInspector(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInspector(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [traceId]);

  return { inspector, isLoading };
}

function eventTypeTone(): string {
  // Event type is a category, not a status — status colors are reserved for
  // outcomes (the ERROR column carries failure).
  return "pill-neutral";
}

function formatMs(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  if (value >= 60000) {
    return `${formatNumber(value / 60000, 1)} min`;
  }
  if (value >= 1000) {
    return `${formatNumber(value / 1000, 1)} s`;
  }
  return `${formatNumber(value, 0)} ms`;
}

const grafanaBase = "http://localhost:3000";

// Trace-scoped deep links so the raw spans and logs behind a session are one
// click away, like the VS Code "Explore Trace Data" row.
function traceExploreLinks(traceId: string): { aspire: string; tempo: string; loki: string } {
  const range = { from: "now-7d", to: "now" };
  const tempoPane = {
    fdb: {
      datasource: "tempo-local",
      queries: [{ refId: "A", queryType: "traceql", query: traceId, datasource: { type: "tempo", uid: "tempo-local" } }],
      range
    }
  };
  const lokiPane = {
    fdb: {
      datasource: "loki-local",
      queries: [{ refId: "A", expr: `{service_name=~".+"} |= \`${traceId}\``, datasource: { type: "loki", uid: "loki-local" } }],
      range
    }
  };
  return {
    aspire: `${aspireBase}/traces/detail/${traceId}`,
    tempo: `${grafanaBase}/explore?schemaVersion=1&orgId=1&panes=${encodeURIComponent(JSON.stringify(tempoPane))}`,
    loki: `${grafanaBase}/explore?schemaVersion=1&orgId=1&panes=${encodeURIComponent(JSON.stringify(lokiPane))}`
  };
}

interface FlowNode {
  key: string;
  kind: "user" | "model" | "response" | "tool" | "hook" | "agent" | "other";
  title: string;
  sub: string;
  preview?: string;
  error?: boolean;
}

// Flattens the chronological span events into the node chain the VS Code
// Agent Flow Chart shows: user message → model request → agent response,
// interleaved with tool calls and hooks.
function buildFlowNodes(events: InspectorEvent[], t: TranslateFn): FlowNode[] {
  const nodes: FlowNode[] = [];
  for (const event of events) {
    const base = `${event.spanId}-${event.startMs}`;
    if (event.type === "llm_request") {
      if (event.inputPreview) {
        nodes.push({ key: `${base}-u`, kind: "user", title: t("inspector.flow.userMessage"), sub: "", preview: event.inputPreview });
      }
      const promptTokens = (event.inputTokens ?? 0) + (event.cacheReadTokens ?? 0) + (event.cacheCreationTokens ?? 0);
      nodes.push({
        key: base,
        kind: "model",
        title: event.model || event.name,
        sub: `${event.operation || event.name} · ${formatCompact(promptTokens)} tokens · ${formatMs(event.durationMs)}`,
        error: Boolean(event.error)
      });
      if (event.outputPreview) {
        nodes.push({ key: `${base}-r`, kind: "response", title: t("inspector.flow.agentResponse"), sub: "", preview: event.outputPreview });
      }
    } else if (event.type === "tool_call") {
      nodes.push({
        key: base,
        kind: "tool",
        title: event.tool || event.name,
        sub: event.error ?? `${t("inspector.flow.success")} · ${formatMs(event.durationMs)}`,
        error: Boolean(event.error)
      });
    } else if (event.type === "hook") {
      nodes.push({ key: base, kind: "hook", title: event.name, sub: formatMs(event.durationMs) });
    } else if (event.type === "agent_turn") {
      nodes.push({ key: base, kind: "agent", title: event.agent || event.name, sub: `${t("inspector.flow.agentTurn")} · ${formatMs(event.durationMs)}` });
    } else {
      nodes.push({ key: base, kind: "other", title: event.name, sub: formatMs(event.durationMs) });
    }
  }
  return nodes;
}

function InspectorView({ sessions }: Readonly<{ sessions: SessionsResponse | null }>) {
  const t = useT();
  const items = sessions?.items ?? [];
  const [traceId, setTraceId] = useState("");
  const [flowFilter, setFlowFilter] = useState("");
  const effectiveTraceId = traceId || (items.length > 0 ? items[0].traceId : "");
  const { inspector, isLoading } = useInspectorData(effectiveTraceId);
  const summary = inspector?.summary ?? null;
  const events = inspector?.events ?? [];
  const cacheTimeline = inspector?.cacheTimeline ?? [];
  const agents = inspector?.agents ?? [];
  const session = items.find((item) => item.traceId === effectiveTraceId) ?? null;
  const links = effectiveTraceId ? traceExploreLinks(effectiveTraceId) : null;
  const flowNodes = useMemo(() => buildFlowNodes(events, t), [events, t]);
  const filteredFlow = useMemo(() => {
    const needle = flowFilter.trim().toLowerCase();
    if (!needle) {
      return flowNodes;
    }
    return flowNodes.filter((node) =>
      `${node.title} ${node.sub} ${node.preview ?? ""}`.toLowerCase().includes(needle)
    );
  }, [flowNodes, flowFilter]);
  const shownFlow = filteredFlow.slice(0, 150);

  const practices = [
    { id: "lock", title: t("inspector.practice.lock.title"), body: t("inspector.practice.lock.body") },
    { id: "stable", title: t("inspector.practice.stable.title"), body: t("inspector.practice.stable.body") },
    { id: "late", title: t("inspector.practice.late.title"), body: t("inspector.practice.late.body") },
    { id: "fresh", title: t("inspector.practice.fresh.title"), body: t("inspector.practice.fresh.body") }
  ];

  return (
    <>
      <Panel
        title={t("inspector.title")}
        status={inspector?.status}
        aside={
          <select value={effectiveTraceId} onChange={(event) => setTraceId(event.target.value)}>
            {items.length === 0 ? <option value="">{t("inspector.noSessions")}</option> : null}
            {items.map((session) => (
              <option key={session.traceId} value={session.traceId}>
                {session.repoShort} · {session.model} · {formatNumber(session.aiCredits, 2)} cr · {session.traceId.slice(0, 8)}…
              </option>
            ))}
          </select>
        }
      >
        <p className="muted">{t("inspector.blurb")}</p>
        {isLoading && !inspector ? <p className="muted">{t("state.loading")}</p> : null}
        {inspector && inspector.status === "unavailable" ? <p className="muted">{inspector.message}</p> : null}
        {summary ? (
          <dl className="session-details">
            <div>
              <dt>{t("inspector.details.workspace")}</dt>
              <dd>{session ? session.repoShort : "—"}</dd>
            </div>
            <div>
              <dt>{t("inspector.details.branch")}</dt>
              <dd>{session?.branch || "—"}</dd>
            </div>
            <div>
              <dt>{t("inspector.details.location")}</dt>
              <dd>{session?.modeBucket || session?.operation || summary.services.join(", ") || "—"}</dd>
            </div>
            <div>
              <dt>{t("inspector.details.agent")}</dt>
              <dd>{agents.length > 0 ? agents.map((entry) => entry.agent).slice(0, 2).join(", ") : "—"}</dd>
            </div>
            <div>
              <dt>{t("inspector.details.created")}</dt>
              <dd>{summary.startedAt ? new Date(summary.startedAt).toLocaleString() : "—"}</dd>
            </div>
            <div>
              <dt>{t("inspector.details.lastActivity")}</dt>
              <dd>{summary.endedAt ? new Date(summary.endedAt).toLocaleString() : "—"}</dd>
            </div>
            <div>
              <dt>{t("inspector.details.status")}</dt>
              <dd>
                <span className={`pill ${summary.sessionStatus === "active" ? "pill-good" : "pill-warn"}`}>
                  {summary.sessionStatus === "active" ? t("inspector.details.statusActive") : t("inspector.details.statusIdle")}
                </span>
              </dd>
            </div>
            <div>
              <dt>{t("inspector.duration")}</dt>
              <dd>{formatMs(summary.totalDurationMs)}</dd>
            </div>
          </dl>
        ) : null}
        {summary ? (
          <div className="composition-stats">
            <div>
              <span className="stat-label">{t("inspector.tile.modelTurns")}</span>
              <span className="stat-value">{formatNumber(summary.llmRequests, 0)}</span>
            </div>
            <div>
              <span className="stat-label">{t("inspector.toolCalls")}</span>
              <span className="stat-value">{formatNumber(summary.toolCalls, 0)}</span>
            </div>
            <div>
              <span className="stat-label">{t("inspector.tile.input")}</span>
              <span className="stat-value">{formatCompact(summary.inputTokens)}</span>
            </div>
            <div>
              <span className="stat-label">{t("inspector.tile.output")}</span>
              <span className="stat-value">{formatCompact(summary.outputTokens)}</span>
            </div>
            <div>
              <span className="stat-label">{t("inspector.tile.cachedInput")}</span>
              <span className="stat-value">{formatCompact(summary.cacheReadTokens)}</span>
            </div>
            <div>
              <span className="stat-label">{t("inspector.tile.totalTokens")}</span>
              <span className="stat-value">{formatCompact(summary.totalTokens)}</span>
            </div>
            <div>
              <span className="stat-label">{t("inspector.tile.credits")}</span>
              <span className="stat-value">{session ? formatNumber(session.aiCredits, 2) : "—"}</span>
            </div>
            <div>
              <span className="stat-label">{t("inspector.errors")}</span>
              <span className="stat-value">{formatNumber(summary.errors, 0)}</span>
            </div>
            <div>
              <span className="stat-label">{t("inspector.cacheHit")}</span>
              <span className="stat-value">{formatPercent(summary.cacheEfficiency)}</span>
            </div>
            <div>
              <span className="stat-label">{t("inspector.cacheBreaks")}</span>
              <span className="stat-value">{formatNumber(summary.cacheBreaks, 0)}</span>
            </div>
            <div>
              <span className="stat-label">{t("inspector.healthyPairs")}</span>
              <span className="stat-value">
                {summary.requestPairs > 0
                  ? `${formatNumber(summary.healthyPairs, 0)}/${formatNumber(summary.requestPairs, 0)}`
                  : "—"}
              </span>
            </div>
            <div>
              <span className="stat-label">{t("inspector.avoidableTokens")}</span>
              <span className="stat-value">{formatCompact(summary.avoidableRecomputedTokens)}</span>
            </div>
          </div>
        ) : null}
        {summary && links ? (
          <div className="trace-links">
            <span className="stat-label">{t("inspector.explore")}</span>
            <a href={links.aspire} target="_blank" rel="noopener noreferrer">{t("inspector.links.aspire")}</a>
            <a href={links.tempo} target="_blank" rel="noopener noreferrer">{t("inspector.links.tempo")}</a>
            <a href={links.loki} target="_blank" rel="noopener noreferrer">{t("inspector.links.logs")}</a>
          </div>
        ) : null}
        {summary && summary.cachedTokenShare !== null ? (
          <p className="muted">
            {t("inspector.tokenWeighted", {
              cached: formatCompact(summary.cacheReadTokens),
              total: formatCompact(summary.promptCacheTokens),
              requests: summary.llmRequests,
              pct: formatPercent(summary.cachedTokenShare)
            })}
          </p>
        ) : null}
        {summary && summary.models.length > 0 ? (
          <p className="muted">{t("inspector.modelsUsed", { models: summary.models.join(", ") })}</p>
        ) : null}
      </Panel>
      {flowNodes.length > 0 ? (
        <Panel
          title={t("inspector.flow.title")}
          aside={
            <input
              className="flow-filter"
              type="search"
              placeholder={t("inspector.flow.filter")}
              value={flowFilter}
              onChange={(event) => setFlowFilter(event.target.value)}
            />
          }
        >
          <p className="muted">{t("inspector.flow.aside")}</p>
          {shownFlow.length > 0 ? (
            <ol className="flow-list">
              {shownFlow.map((node) => (
                <li key={node.key} className={`flow-node flow-${node.kind}${node.error ? " flow-error" : ""}`}>
                  <span className="flow-title">{node.title}</span>
                  {node.sub ? <span className="flow-sub">{node.sub}</span> : null}
                  {node.preview ? <p className="flow-preview">{node.preview}</p> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">{t("inspector.flow.empty")}</p>
          )}
          {filteredFlow.length > shownFlow.length ? (
            <p className="muted">{t("inspector.flow.truncated", { shown: shownFlow.length, total: filteredFlow.length })}</p>
          ) : null}
        </Panel>
      ) : null}
      {agents.length > 0 ? (
        <Panel title={t("inspector.agents.title")} aside={<span className="muted">{t("inspector.agents.aside")}</span>}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("inspector.agents.col.agent")}</th>
                  <th className="numeric">{t("inspector.agents.col.turns")}</th>
                  <th className="numeric">{t("inspector.agents.col.tools")}</th>
                  <th className="numeric">{t("inspector.agents.col.hooks")}</th>
                  <th className="numeric">{t("sessions.col.output")}</th>
                  <th className="numeric">{t("inspector.errors")}</th>
                  <th className="numeric">{t("inspector.agents.col.time")}</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((entry) => (
                  <tr key={entry.agent}>
                    <td><span className="ws-name">{entry.agent}</span></td>
                    <td className="numeric">{formatNumber(entry.llmRequests, 0)}</td>
                    <td className="numeric">{formatNumber(entry.toolCalls, 0)}</td>
                    <td className="numeric">{formatNumber(entry.hooks, 0)}</td>
                    <td className="numeric">{formatCompact(entry.outputTokens)}</td>
                    <td className="numeric">{entry.errors > 0 ? <span className="pill pill-bad">{entry.errors}</span> : "0"}</td>
                    <td className="numeric">{formatMs(entry.durationMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
      {cacheTimeline.length > 0 ? (
        <Panel title={t("inspector.cacheTimeline")} aside={<span className="muted">{t("inspector.cacheTimelineAside")}</span>}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="numeric">#</th>
                  <th className="numeric">{t("inspector.col.offset")}</th>
                  <th>{t("sessions.col.model")}</th>
                  <th className="numeric">{t("inspector.col.hitRate")}</th>
                  <th className="numeric">{t("ws.col.cached")}</th>
                  <th className="numeric">{t("inspector.col.cacheWrite")}</th>
                  <th>{t("inspector.col.signal")}</th>
                </tr>
              </thead>
              <tbody>
                {cacheTimeline.map((turn) => (
                  <tr key={turn.seq}>
                    <td className="numeric">{turn.seq}</td>
                    <td className="numeric">{formatMs(turn.startMs)}</td>
                    <td><span className="model-tag">{turn.model || "—"}</span></td>
                    <td className="numeric">
                      <span className={`pill ${turn.cacheBreak ? "pill-bad" : "pill-good"}`}>{formatPercent(turn.hitRate)}</span>
                    </td>
                    <td className="numeric">{formatCompact(turn.cacheReadTokens)}</td>
                    <td className="numeric">{formatCompact(turn.cacheCreationTokens)}</td>
                    <td className="muted">
                      {turn.cacheBreak && turn.breakCause ? t(`inspector.cause.${turn.breakCause}`) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">{t("inspector.cacheNote")}</p>
          {summary && !summary.contentCaptureSeen ? (
            <p className="muted">{t("inspector.captureHint")}</p>
          ) : null}
        </Panel>
      ) : null}
      {events.length > 0 ? (
        <Panel title={t("inspector.eventLog")} aside={<span className="muted">{t("inspector.eventCount", { count: events.length })}</span>}>
          <div className="table-wrap">
            <table className="sessions-table">
              <thead>
                <tr>
                  <th className="numeric">{t("inspector.col.offset")}</th>
                  <th>{t("inspector.col.type")}</th>
                  <th>{t("inspector.col.name")}</th>
                  <th>{t("inspector.col.detail")}</th>
                  <th className="numeric">{t("inspector.col.duration")}</th>
                  <th className="numeric">{t("ws.col.input")}</th>
                  <th className="numeric">{t("sessions.col.output")}</th>
                  <th className="numeric">{t("ws.col.cached")}</th>
                  <th>{t("inspector.col.error")}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={`${event.spanId}-${event.startMs}`}>
                    <td className="numeric">{formatMs(event.startMs)}</td>
                    <td><span className={`pill ${eventTypeTone()}`}>{t(`inspector.type.${event.type}`)}</span></td>
                    <td>{event.name}</td>
                    <td className="muted">{event.tool || event.model || event.agent || "—"}</td>
                    <td className="numeric">{formatMs(event.durationMs)}</td>
                    <td className="numeric">{formatCompact(event.inputTokens)}</td>
                    <td className="numeric">{formatCompact(event.outputTokens)}</td>
                    <td className="numeric">{formatCompact(event.cacheReadTokens)}</td>
                    <td>{event.error ? <span className="pill pill-bad">{event.error}</span> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">{t("inspector.eventNote")}</p>
        </Panel>
      ) : null}
      <Panel title={t("inspector.practices")} aside={<span className="muted">{t("coach.bestPractices")}</span>}>
        <ul className="playbook-grid">
          {practices.map((item) => (
            <li key={item.id} className="playbook-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ul>
        <p className="muted">{t("inspector.importNote")}</p>
      </Panel>
    </>
  );
}

function OverviewView({
  summary,
  sessions,
  coach
}: Readonly<{ summary: SummaryResponse | null; sessions: SessionsResponse | null; coach: CoachResponse | null }>) {
  const t = useT();
  const alerts = localizeAlerts(summary?.alerts ?? [], t);
  const topWorkspace = summary?.workspaces.items?.[0] ?? null;
  const topModel = summary?.modelMix.entries?.[0] ?? null;
  const topSession = sessions?.items?.find((item) => item.aiCredits > 0) ?? sessions?.items?.[0] ?? null;
  const budget = summary?.budget ?? null;
  const contextPeak = summary?.metrics.context.peak.value ?? null;
  const compactions = summary?.outcomes.contextCompactions.value ?? null;
  const topRecommendations = (coach?.cards ?? [])
    .map((card) => localizeCoachCard(card, t))
    .filter((card) => card.severity !== "good")
    .slice(0, 3);
  const practices = [
    { id: "warm", title: t("playbook.warm.title"), body: t("playbook.warm.body") },
    { id: "mentions", title: t("ctx.mentions.title"), body: t("ctx.mentions.body") },
    { id: "compact", title: t("ctx.compact.title"), body: t("ctx.compact.body") },
    { id: "model", title: t("playbook.model.title"), body: t("playbook.model.body") }
  ];

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
      <Panel title={t("overview.highlights")} aside={<span className="muted">{t("overview.highlightsAside")}</span>}>
        <div className="highlight-grid">
          <article className="highlight-card">
            <span className="stat-label">{t("overview.hl.topWorkspace")}</span>
            <span className="stat-value">{topWorkspace ? topWorkspace.repoShort : t("overview.hl.none")}</span>
            {topWorkspace ? (
              <span className="muted">
                {formatNumber(topWorkspace.aiCredits, 2)} AI Credits · {formatPercent(topWorkspace.cacheEfficiency)} cache
              </span>
            ) : null}
          </article>
          <article className="highlight-card">
            <span className="stat-label">{t("overview.hl.topModel")}</span>
            <span className="stat-value">{topModel ? topModel.model : t("overview.hl.none")}</span>
            {topModel ? (
              <span className="muted">
                {formatPercent(topModel.share)} · {topModel.estimatedAiCredits === null ? "—" : formatNumber(topModel.estimatedAiCredits, 2)} AI Credits
              </span>
            ) : null}
          </article>
          <article className="highlight-card">
            <span className="stat-label">{t("overview.hl.topSession")}</span>
            <span className="stat-value">{topSession ? topSession.repoShort : t("overview.hl.none")}</span>
            {topSession ? (
              <span className="muted">
                {topSession.model} · {formatNumber(topSession.aiCredits, 2)} AI Credits
              </span>
            ) : null}
          </article>
          <article className="highlight-card">
            <span className="stat-label">{t("overview.hl.contextPeak")}</span>
            <span className="stat-value">{contextPeak === null ? "—" : `${formatNumber(contextPeak, 0)}%`}</span>
            {contextPeak === null && compactions === null ? (
              <span className="muted">{t("overview.hl.none")}</span>
            ) : (
              <span className="muted">{t("ctx.aside", {
                peak: contextPeak === null ? "—" : `${formatNumber(contextPeak, 0)}%`,
                compactions: compactions === null ? "—" : formatNumber(compactions, 0)
              })}</span>
            )}
          </article>
          <article className="highlight-card">
            <span className="stat-label">{t("overview.hl.exhaustion")}</span>
            <span className="stat-value">
              {budget?.projectedExhaustionDate ? new Date(budget.projectedExhaustionDate).toLocaleDateString() : "—"}
            </span>
            <span className="muted">
              {budget?.remainingCredits === null || budget?.remainingCredits === undefined
                ? t("overview.hl.none")
                : t("overview.hl.remaining", { value: formatNumber(budget.remainingCredits, 0) })}
            </span>
          </article>
        </div>
      </Panel>
      <TokenComposition summary={summary} />
      <Panel title={t("overview.topWorkspaces")} aside={<span className="muted">{t("overview.rankedByCredits")}</span>}>
        <WorkspaceTable summary={summary} limit={5} />
      </Panel>
      {topRecommendations.length > 0 ? (
        <Panel title={t("overview.topRecs")} aside={<span className="muted">{t("overview.topRecsAside")}</span>}>
          <ul className="coach-list">
            {topRecommendations.map((card) => (
              <li key={card.id} className={`coach-card coach-${card.severity}`}>
                <div className="coach-head">
                  <span className={`pill severity-${card.severity}`}>{t(`severity.${card.severity}`)}</span>
                  <h3>{card.title}</h3>
                </div>
                <p className="coach-action"><strong>{t("coach.tryThis")}</strong> {card.action}</p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      <Panel title={t("overview.practices")} aside={<span className="muted">{t("overview.practicesAside")}</span>}>
        <ul className="playbook-grid">
          {practices.map((item) => (
            <li key={item.id} className="playbook-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ul>
      </Panel>
      <HistoryPanel points={summary?.history.points ?? []} message={summary?.history.message} />
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
                <th className="numeric">{t("inspector.col.cacheWrite")}</th>
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
                  <td className="numeric">{formatCompact(session.cacheCreationTokens)}</td>
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
        <p className="muted" title={sessions?.message}>{t("sessions.empty")}</p>
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

const localizedCoachIds = new Set([
  "cache-reuse",
  "cold-context",
  "context-pressure",
  "context-compact-now",
  "context-session-scope",
  "errors",
  "attribution",
  "budget-pacing",
  "model-cost-concentration",
  "auto-model-adoption",
  "prompt-io",
  "credit-budget",
  "top-sessions",
  "healthy"
]);

function localizeCoachCard(card: CoachCard, t: TranslateFn): CoachCard {
  if (!localizedCoachIds.has(card.id)) {
    return card;
  }
  // Numeric params go through the locale-aware formatter so card bodies never
  // show raw "400000" or "9762%" style values.
  const params: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(card.params ?? {})) {
    const numeric = typeof value === "number" ? value : Number(value);
    params[key] = Number.isFinite(numeric) && `${value}`.trim() !== ""
      ? formatNumber(numeric, Number.isInteger(numeric) ? 0 : 1)
      : value;
  }
  if (card.id === "budget-pacing") {
    const pct = Number(card.params?.pct);
    if (Number.isFinite(pct) && pct >= 300) {
      params.times = formatNumber(pct / 100, 1);
      const insightTimes = t("coachCard.budget-pacing.insightTimes", params);
      if (!insightTimes.startsWith("coachCard.")) {
        const title = t("coachCard.budget-pacing.title", params);
        const action = t("coachCard.budget-pacing.action", params);
        return { ...card, title, insight: insightTimes, action };
      }
    }
  }
  const title = t(`coachCard.${card.id}.title`, params);
  const insight = t(`coachCard.${card.id}.insight`, params);
  const action = t(`coachCard.${card.id}.action`, params);
  return {
    ...card,
    title: title.startsWith("coachCard.") ? card.title : title,
    insight: insight.startsWith("coachCard.") ? card.insight : insight,
    action: action.startsWith("coachCard.") ? card.action : action
  };
}

function CoachView({ coach, summary }: Readonly<{ coach: CoachResponse | null; summary: SummaryResponse | null }>) {
  const t = useT();
  const cards = (coach?.cards ?? []).map((card) => localizeCoachCard(card, t));
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
  const contextPlaybook: { id: string; title: string; body: string }[] = [
    { id: "mentions", title: t("ctx.mentions.title"), body: t("ctx.mentions.body") },
    { id: "codebase", title: t("ctx.codebase.title"), body: t("ctx.codebase.body") },
    { id: "monitor", title: t("ctx.monitor.title"), body: t("ctx.monitor.body") },
    { id: "compact", title: t("ctx.compact.title"), body: t("ctx.compact.body") },
    { id: "sessions", title: t("ctx.sessions.title"), body: t("ctx.sessions.body") },
    { id: "cache", title: t("ctx.cache.title"), body: t("ctx.cache.body") }
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
              <span className="stat-value">
                {economy?.potentialSavingsCredits === null || economy === undefined
                  ? "—"
                  : t("coach.creditsUnit", { value: formatNumber(economy.potentialSavingsCredits, 0) })}
              </span>
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
                  <h3>{(() => { const l = t(`savings.${item.id}.label`); return l.startsWith("savings.") ? item.label : l; })()}</h3>
                  <span className="savings-credits">{t("coach.creditsUnit", { value: formatNumber(item.estimateCredits, 0) })}</span>
                </div>
                <p>{(() => { const d = t(`savings.${item.id}.detail`, item.params ?? {}); return d.startsWith("savings.") ? item.detail : d; })()}</p>
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
      <Panel
        title={t("ctx.title")}
        aside={
          <span className="muted">
            {t("ctx.aside", {
              peak:
                summary?.metrics.context.peak.value == null
                  ? "—"
                  : `${formatNumber(summary.metrics.context.peak.value, 0)}%`,
              compactions:
                summary?.outcomes.contextCompactions.value == null
                  ? "—"
                  : formatNumber(summary.outcomes.contextCompactions.value, 0)
            })}
          </span>
        }
      >
        <p className="muted">{t("ctx.blurb")}</p>
        <ul className="playbook-grid">
          {contextPlaybook.map((item) => (
            <li key={item.id} className="playbook-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ul>
        <p className="muted">{t("ctx.note")}</p>
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

function useLongTermHistory(repo: string) {
  const [history, setHistory] = useState<LongTermHistoryResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/history/long-term?repo=${encodeURIComponent(repo)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as LongTermHistoryResponse;
        if (!cancelled) {
          setHistory(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHistory(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [repo]);

  return history;
}

function LongTermPanel({ repo }: Readonly<{ repo: string }>) {
  const t = useT();
  const history = useLongTermHistory(repo);
  const days = history?.days ?? [];
  return (
    <Panel
      title={t("longterm.title")}
      status={history?.status}
      aside={<span className="muted">{t("longterm.aside")}</span>}
    >
      <p className="muted">{t("longterm.blurb")}</p>
      {days.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("longterm.col.day")}</th>
                <th className="numeric">{t("ws.col.aiCredits")}</th>
                <th className="numeric">{t("ws.col.sessions")}</th>
                <th className="numeric">{t("ws.col.input")}</th>
                <th className="numeric">{t("ws.col.cached")}</th>
                <th className="numeric">{t("ws.col.cold")}</th>
                <th className="numeric">{t("longterm.col.errors")}</th>
                <th className="numeric">{t("longterm.col.repos")}</th>
              </tr>
            </thead>
            <tbody>
              {days.slice(-60).map((day) => (
                <tr key={day.day}>
                  <td>{day.day}</td>
                  <td className="numeric strong">{formatNumber(day.aiCredits, 1)}</td>
                  <td className="numeric">{formatNumber(day.sessions, 0)}</td>
                  <td className="numeric">{formatCompact(day.inputTokens)}</td>
                  <td className="numeric">{formatCompact(day.cacheReadTokens)}</td>
                  <td className="numeric">{formatCompact(day.coldInputTokens)}</td>
                  <td className="numeric">{formatNumber(day.errors, 0)}</td>
                  <td className="numeric">{formatNumber(day.repos, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted" title={history?.message}>{t("longterm.empty")}</p>
      )}
      <p className="muted">{t("longterm.note")}</p>
    </Panel>
  );
}

function HistoryView({ summary, repo }: Readonly<{ summary: SummaryResponse | null; repo: string }>) {
  const t = useT();
  const points = summary?.history.points ?? [];
  return (
    <>
      <HistoryPanel points={points} message={summary?.history.message} />
      <LongTermPanel repo={repo} />
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
          <p className="muted" title={summary?.history.message}>{t("history.emptyRows")}</p>
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
              <dd title={summary?.metrics.dataQuality.workspaceReal.message}>{formatNumberText(summary?.metrics.dataQuality.workspaceReal.value, 0, t)}</dd>
            </div>
            <div>
              <dt>{t("health.nonWorkspaceReal")}</dt>
              <dd title={summary?.metrics.dataQuality.nonWorkspaceReal.message}>{formatNumberText(summary?.metrics.dataQuality.nonWorkspaceReal.value, 0, t)}</dd>
            </div>
            <div>
              <dt>{t("health.observedCoverage")}</dt>
              <dd title={summary?.metrics.dataQuality.observedCoverage.message}>{formatNumberText(summary?.metrics.dataQuality.observedCoverage.value, 0, t)}</dd>
            </div>
            <div>
              <dt>{t("health.notObservedYet")}</dt>
              <dd title={summary?.metrics.dataQuality.notObservedYet.message}>{formatNumberText(summary?.metrics.dataQuality.notObservedYet.value, 0, t)}</dd>
            </div>
          </dl>
          <p className="muted">{t("health.dqNote")}</p>
        </div>
        <div>
          <div className="panel-header">
            <h2>{t("health.officialBilling")}</h2>
            <span className={statusClass(summary?.officialBilling.status ?? "unavailable")}>{statusText(summary?.officialBilling.status ?? "unavailable", t)}</span>
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
  "coldRatioWarn",
  "budgetWarnPct",
  "budgetCritPct",
  "modelConcentrationInfo",
  "promptIoRatioInfo",
  "inspectorHealthyHitRate",
  "contextCompactionsInfo"
];

// Unit hints so the mixed-scale Value column is self-describing.
const settingUnit: Record<string, string> = {
  aiCreditsWarn: "AI Credits",
  aiCreditsCrit: "AI Credits",
  inputTokensWarn: "tokens",
  inputTokensCrit: "tokens",
  contextWarnPct: "%",
  contextCritPct: "%",
  cacheEfficiencyWarn: "0\u20131",
  coldRatioWarn: "0\u20131",
  budgetWarnPct: "%",
  budgetCritPct: "%",
  modelConcentrationInfo: "0\u20131",
  promptIoRatioInfo: "\u00d7",
  inspectorHealthyHitRate: "0\u20131",
  contextCompactionsInfo: "count",
  scoreBase: "pts",
  scoreCacheWeight: "pts",
  scoreColdPenalty: "pts",
  scoreContextPenalty: "pts",
  scoreErrorPenalty: "pts",
  coldSavingsFactor: "0\u20131",
  errorSavingsFactor: "0\u20131",
  frontierOutputPriceMinUsdPerMillion: "US$/M",
  complexSessionMinToolCalls: "count"
};

const thresholdEnv: Record<string, string> = {
  aiCreditsWarn: "THRESHOLD_AI_CREDITS_WARN",
  aiCreditsCrit: "THRESHOLD_AI_CREDITS_CRIT",
  inputTokensWarn: "THRESHOLD_INPUT_TOKENS_WARN",
  inputTokensCrit: "THRESHOLD_INPUT_TOKENS_CRIT",
  contextWarnPct: "THRESHOLD_CONTEXT_WARN_PCT",
  contextCritPct: "THRESHOLD_CONTEXT_CRIT_PCT",
  cacheEfficiencyWarn: "THRESHOLD_CACHE_EFFICIENCY_WARN",
  coldRatioWarn: "THRESHOLD_COLD_RATIO_WARN",
  budgetWarnPct: "THRESHOLD_AI_CREDITS_BUDGET_WARN_PCT",
  budgetCritPct: "THRESHOLD_AI_CREDITS_BUDGET_CRIT_PCT",
  modelConcentrationInfo: "THRESHOLD_MODEL_CONCENTRATION",
  promptIoRatioInfo: "THRESHOLD_PROMPT_IO_RATIO",
  inspectorHealthyHitRate: "THRESHOLD_INSPECTOR_HEALTHY_HIT_RATE",
  contextCompactionsInfo: "THRESHOLD_CONTEXT_COMPACTIONS_INFO"
};

const coachTuningKeys = [
  "scoreBase",
  "scoreCacheWeight",
  "scoreColdPenalty",
  "scoreContextPenalty",
  "scoreErrorPenalty",
  "coldSavingsFactor",
  "errorSavingsFactor",
  "frontierOutputPriceMinUsdPerMillion",
  "complexSessionMinToolCalls"
];

const coachTuningEnv: Record<string, string> = {
  scoreBase: "COACH_SCORE_BASE",
  scoreCacheWeight: "COACH_SCORE_CACHE_WEIGHT",
  scoreColdPenalty: "COACH_SCORE_COLD_PENALTY",
  scoreContextPenalty: "COACH_SCORE_CONTEXT_PENALTY",
  scoreErrorPenalty: "COACH_SCORE_ERROR_PENALTY",
  coldSavingsFactor: "COACH_COLD_SAVINGS_FACTOR",
  errorSavingsFactor: "COACH_ERROR_SAVINGS_FACTOR",
  frontierOutputPriceMinUsdPerMillion: "PLANNER_FRONTIER_OUTPUT_PRICE_MIN",
  complexSessionMinToolCalls: "PLANNER_COMPLEX_SESSION_MIN_TOOL_CALLS"
};

function SettingsView({ summary }: Readonly<{ summary: SummaryResponse | null }>) {
  const t = useT();
  const thresholds = summary?.thresholds ?? {};
  const coachTuning = summary?.coachTuning ?? {};
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
                  <td className="numeric strong">
                    {formatNumberText(thresholds[key], 6, t)}
                    {settingUnit[key] ? <span className="muted"> {settingUnit[key]}</span> : null}
                  </td>
                  <td><code>{thresholdEnv[key]}</code></td>
                  <td className="muted">{t(`th.${key}.help`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">{t("settings.note")}</p>
      </Panel>
      <Panel title={t("settings.coachTuning")} aside={<span className="muted">{t("settings.coachTuningAside")}</span>}>
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
              {coachTuningKeys.map((key) => (
                <tr key={key}>
                  <td>{t(`ct.${key}.label`)}</td>
                  <td className="numeric strong">
                    {formatNumberText(coachTuning[key], 6, t)}
                    {settingUnit[key] ? <span className="muted"> {settingUnit[key]}</span> : null}
                  </td>
                  <td><code>{coachTuningEnv[key]}</code></td>
                  <td className="muted">{t(`ct.${key}.help`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">{t("settings.coachTuningNote")}</p>
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
  repo: string;
  prefs: SetupPrefs | null;
}

const viewRenderers: Record<ViewId, (props: ViewProps) => ReactNode> = {
  overview: ({ summary, sessions, coach }) => <OverviewView summary={summary} sessions={sessions} coach={coach} />,
  credits: ({ summary }) => <CreditsView summary={summary} />,
  planner: ({ summary, repo, prefs }) => <PlannerView summary={summary} repo={repo} prefs={prefs} />,
  inspector: ({ sessions }) => <InspectorView sessions={sessions} />,
  sessions: ({ sessions }) => <SessionsView sessions={sessions} />,
  workspaces: ({ summary }) => <WorkspacesView summary={summary} />,
  coach: ({ coach, summary }) => <CoachView coach={coach} summary={summary} />,
  history: ({ summary, repo }) => <HistoryView summary={summary} repo={repo} />,
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

const repoHosts: SetupPrefs["repoHost"][] = ["github", "gitlab", "azuredevops"];

function SetupWizard({
  billingPlans,
  initial,
  lang,
  setLang,
  onDone
}: Readonly<{
  billingPlans: CopilotPlanFacts[];
  initial: SetupPrefs | null;
  lang: Lang;
  setLang: (lang: Lang) => void;
  onDone: (prefs: SetupPrefs) => void;
}>) {
  const t = useT();
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState(initial?.role ?? "Developer");
  const [plan, setPlan] = useState(initial?.plan ?? "business");
  const [seats, setSeats] = useState(initial?.seats ?? 1);
  const [promo, setPromo] = useState(initial?.promo ?? false);
  const [repoHost, setRepoHost] = useState<SetupPrefs["repoHost"]>(initial?.repoHost ?? "github");
  const selected = billingPlans.find((entry) => entry.id === plan);
  const perSeat = selected ? (promo && selected.promoCredits !== null ? selected.promoCredits : selected.includedCredits) : null;
  const totalCredits = perSeat === null ? null : perSeat * (selected?.perSeat ? Math.max(1, seats) : 1);

  return (
    <div className="wizard-overlay" role="dialog" aria-modal="true">
      <div className="wizard-card">
        <div className="wizard-head">
          <span className="brand__squares" aria-hidden="true"><i className="sq-red" /><i className="sq-green" /><i className="sq-blue" /><i className="sq-yellow" /></span>
          <div>
            <h2>{t("wizard.title")}</h2>
            <p className="muted">{t("wizard.subtitle")}</p>
          </div>
          <div className="segmented small lang-switch">
            {languages.map((entry) => (
              <button key={entry.id} type="button" className={lang === entry.id ? "active" : ""} onClick={() => setLang(entry.id)}>{entry.short}</button>
            ))}
          </div>
        </div>
        <div className="wizard-grid">
          <label className="wizard-field">
            <span>{t("wizard.name")}</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("wizard.namePlaceholder")} />
          </label>
          <label className="wizard-field">
            <span>{t("wizard.role")}</span>
            <input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Developer" />
          </label>
          <label className="wizard-field">
            <span>{t("wizard.plan")}</span>
            <select value={plan} onChange={(event) => setPlan(event.target.value)}>
              {billingPlans.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {planDisplayName(entry, t)} · US${entry.priceUsdMonth}{entry.perSeat ? t("wizard.perSeatShort") : ""} · {entry.includedCredits === null ? t("plans.autoOnly") : t("wizard.creditsShort", { credits: formatNumber(entry.includedCredits, 0) })}
                </option>
              ))}
            </select>
          </label>
          {selected?.perSeat ? (
            <label className="wizard-field">
              <span>{t("wizard.seats")}</span>
              <input type="number" min={1} value={seats} onChange={(event) => setSeats(Math.max(1, Number.parseInt(event.target.value || "1", 10)))} />
            </label>
          ) : null}
          {selected?.promoCredits !== null && selected?.promoCredits !== undefined ? (
            <label className="wizard-check">
              <input type="checkbox" checked={promo} onChange={(event) => setPromo(event.target.checked)} />
              <span>{t("wizard.promo", { credits: formatNumber(selected.promoCredits, 0) })}</span>
            </label>
          ) : null}
          <div className="wizard-field">
            <span>{t("wizard.repoHost")}</span>
            <div className="segmented">
              {repoHosts.map((host) => (
                <button key={host} type="button" className={repoHost === host ? "active" : ""} onClick={() => setRepoHost(host)}>
                  {t(`wizard.host.${host}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="wizard-summary">
          {totalCredits === null
            ? t("wizard.summaryAuto")
            : t("wizard.summary", { credits: formatNumber(totalCredits, 0), plan: selected ? planDisplayName(selected, t) : plan })}
        </div>
        <div className="wizard-actions">
          <button
            type="button"
            className="wizard-primary"
            onClick={() => onDone({ name: name.trim() || "Developer", role: role.trim() || "Developer", plan, seats, promo, repoHost })}
          >
            {t("wizard.start")}
          </button>
        </div>
        <p className="muted wizard-note">{t("wizard.note")}</p>
      </div>
    </div>
  );
}

function AppShell({ lang, setLang }: Readonly<{ lang: Lang; setLang: (lang: Lang) => void }>) {
  const t = useT();
  const [range, setRange] = useState<RangeOption>("24h");
  const [repo, setRepo] = useState("all");
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [prefs, setPrefs] = useState<SetupPrefs | null>(() => readSetupPrefs());
  const [wizardOpen, setWizardOpen] = useState(() => readSetupPrefs() === null);
  const { data, error, isLoading, reload } = useDashboardData(range, repo, prefs);
  const { summary, sessions, coach } = data;

  const saveSetup = useCallback((next: SetupPrefs) => {
    setPrefs(next);
    setWizardOpen(false);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(setupStorageKey, JSON.stringify(next));
    }
  }, []);

  const views = buildViews(t);
  const alertCount = summary?.alerts.length ?? 0;
  const activeDef = views.find((view) => view.id === activeView) ?? views[0];

  const dashboardTitle = summary?.participant.dashboardTitle ?? "Frontier Cockpit Local";
  const participantName = prefs?.name ?? summary?.participant.name ?? "Workshop Participant";
  const participantRole = prefs?.role ?? summary?.participant.role ?? "Developer";
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
            <span>{participantName}</span>
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
              <span className="nav-icon" aria-hidden><NavIcon id={view.id} /></span>
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
          <button type="button" className="sidebar-setup" onClick={() => setWizardOpen(true)}>{t("wizard.reopen")}</button>
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
          {viewRenderers[activeView]({ summary, sessions, coach, repo, prefs })}
        </div>

        <footer className="content-foot">
          <span>{summary ? t("footer.updated", { time: new Date(summary.refreshedAt).toLocaleTimeString() }) : t("footer.waiting")}</span>
          <span>{t("footer.scope", { range, scope: scopeLabel })}</span>
        </footer>
      </main>
      {wizardOpen ? (
        <SetupWizard
          billingPlans={summary?.billing.planCatalog ?? []}
          initial={prefs}
          lang={lang}
          setLang={setLang}
          onDone={saveSetup}
        />
      ) : null}
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
    setNumberLocale(entry?.htmlLang ?? "en");
  }, [lang]);

  return (
    <LangProvider lang={lang}>
      <AppShell lang={lang} setLang={selectLang} />
    </LangProvider>
  );
}
