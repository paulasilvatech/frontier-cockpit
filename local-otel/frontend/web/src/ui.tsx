import type { ReactNode } from "react";
import type {
    Alert,
    AlertSeverity,
    HistoryPoint,
    MetricStatus,
    SeriesMetric,
    ServiceStatus
} from "./types";

export function formatNumber(value: number | null, digits = 2): string {
    if (value === null || Number.isNaN(value)) {
        return "Unavailable";
    }
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);
}

export function formatCompact(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
        return "—";
    }
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatPercent(value: number | null, digits = 0): string {
    if (value === null || Number.isNaN(value)) {
        return "—";
    }
    return `${(value * 100).toFixed(digits)}%`;
}

export function formatCurrency(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
        return "Unavailable";
    }
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 4
    }).format(value);
}

export function sumSeries(metric: SeriesMetric | undefined): number | null {
    if (!metric || metric.points.length === 0) {
        return null;
    }
    return metric.points.reduce((total, point) => total + point.value, 0);
}

export function statusLabel(status: ServiceStatus | MetricStatus): string {
    return status.replaceAll("-", " ");
}

export function statusClass(status: ServiceStatus | MetricStatus): string {
    return `status status-${status}`;
}

export function cacheTone(efficiency: number | null): string {
    if (efficiency === null) {
        return "pill-warn";
    }
    if (efficiency >= 0.5) {
        return "pill-good";
    }
    if (efficiency >= 0.35) {
        return "pill-warn";
    }
    return "pill-bad";
}

export function Panel({
    title,
    status,
    aside,
    children
}: Readonly<{
    title: string;
    status?: MetricStatus | ServiceStatus;
    aside?: ReactNode;
    children: ReactNode;
}>) {
    return (
        <section className="panel">
            <div className="panel-header">
                <h2>{title}</h2>
                {status ? <span className={statusClass(status)}>{statusLabel(status)}</span> : aside}
            </div>
            {children}
        </section>
    );
}

export function Kpi({
    label,
    value,
    sub,
    tone,
    available
}: Readonly<{
    label: string;
    value: string;
    sub: string;
    tone: string;
    available: boolean;
}>) {
    return (
        <article className={`kpi kpi-${tone}${available ? "" : " kpi-empty"}`}>
            <span className="kpi-label">{label}</span>
            <span className="kpi-value">{value}</span>
            <span className="kpi-sub">{sub}</span>
        </article>
    );
}

export function CompositionBar({
    segments
}: Readonly<{ segments: ReadonlyArray<Readonly<{ label: string; value: number; tone: string }>> }>) {
    const total = segments.reduce((acc, segment) => acc + segment.value, 0) || 1;
    let offset = 0;
    return (
        <div className="composition">
            <svg className="composition-bar" viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label="Token composition">
                {segments.map((segment) => {
                    const width = (segment.value / total) * 100;
                    const x = offset;
                    offset += width;
                    return (
                        <rect key={segment.label} className={`seg seg-${segment.tone}`} x={x} y="0" width={width} height="10">
                            <title>{`${segment.label}: ${formatNumber(segment.value, 0)} (${width.toFixed(1)}%)`}</title>
                        </rect>
                    );
                })}
            </svg>
            <ul className="composition-legend">
                {segments.map((segment) => (
                    <li key={segment.label}>
                        <span className={`dot dot-${segment.tone}`} />
                        <span className="legend-label">{segment.label}</span>
                        <span className="legend-value">
                            {formatCompact(segment.value)} <em>{((segment.value / total) * 100).toFixed(0)}%</em>
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export type HistoryField = "aiCredits" | "inputTokens" | "cacheReadTokens" | "coldInputTokens" | "outputTokens";

export function TrendChart({ points, field, tone }: Readonly<{ points: HistoryPoint[]; field: HistoryField; tone: string }>) {
    const values = points.map((point) => point[field] ?? 0);
    const max = Math.max(...values, 1);
    const width = 100;
    const height = 40;
    const barWidth = points.length > 0 ? width / points.length : width;
    return (
        <svg className="trend" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Usage trend">
            {points.map((point, index) => {
                const value = point[field] ?? 0;
                const barHeight = (value / max) * (height - 2);
                return (
                    <rect
                        key={point.t}
                        className={`trend-bar trend-${tone}`}
                        x={index * barWidth + barWidth * 0.1}
                        y={height - barHeight}
                        width={barWidth * 0.8}
                        height={barHeight}
                    >
                        <title>{`${new Date(point.t).toLocaleString()}: ${formatNumber(value, 2)}`}</title>
                    </rect>
                );
            })}
        </svg>
    );
}

interface AlertBannerLabels {
    clearTitle: string;
    clearBody: string;
    activeTitle: string;
    note: string;
    severity: Record<AlertSeverity, string>;
}

const defaultAlertLabels: AlertBannerLabels = {
    clearTitle: "No active alerts",
    clearBody: "Token, cache, context, and AI credit usage are within the local guardrails for this range.",
    activeTitle: "Active alerts",
    note: "Thresholds are local planning guardrails, not official GitHub limits. Tune them in the Settings view.",
    severity: {
        info: "info",
        warning: "warning",
        critical: "critical"
    }
};

export function AlertsBanner({ alerts, labels = defaultAlertLabels }: Readonly<{ alerts: Alert[]; labels?: AlertBannerLabels }>) {
    if (alerts.length === 0) {
        return (
            <section className="alerts alerts-clear">
                <span className="alerts-icon">✓</span>
                <div>
                    <h2>{labels.clearTitle}</h2>
                    <p>{labels.clearBody}</p>
                </div>
            </section>
        );
    }
    return (
        <section className="alerts">
            <div className="alerts-head">
                <h2>{labels.activeTitle}</h2>
                <span className="alerts-count">{alerts.length}</span>
            </div>
            <ul className="alerts-list">
                {alerts.map((alert) => (
                    <li key={alert.id} className={`alert alert-${alert.severity}`}>
                        <span className="alert-tag">{labels.severity[alert.severity]}</span>
                        <div>
                            <h3>{alert.title}</h3>
                            <p>{alert.detail}</p>
                        </div>
                    </li>
                ))}
            </ul>
            <p className="muted">{labels.note}</p>
        </section>
    );
}
