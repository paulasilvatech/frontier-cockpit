export type RangeOption = "1h" | "6h" | "24h" | "7d";
export type ServiceStatus = "ok" | "degraded" | "unavailable";
export type MetricStatus = "ok" | "unavailable";
export type AlertSeverity = "info" | "warning" | "critical";
export type CoachSeverity = "good" | "info" | "warning" | "critical";

export interface ServiceHealth {
    id: string;
    name: string;
    status: ServiceStatus;
    detail: string;
    checkedAt: string;
}

export interface ScalarMetric {
    status: MetricStatus;
    value: number | null;
    query: string;
    message?: string;
}

export interface SeriesPoint {
    labels: Record<string, string>;
    value: number;
}

export interface SeriesMetric {
    status: MetricStatus;
    points: SeriesPoint[];
    query: string;
    message?: string;
}

export interface AppLink {
    label: string;
    url: string;
}

export interface TokenMetrics {
    input: ScalarMetric;
    output: ScalarMetric;
    cacheRead: ScalarMetric;
    cacheCreation: ScalarMetric;
    coldInput: ScalarMetric;
    reasoning: ScalarMetric;
    cacheEfficiency: number | null;
    warmRatio: number | null;
    coldRatio: number | null;
    promptTotal: number;
}

export interface WorkspaceUsage {
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

export interface HistoryPoint {
    t: string;
    inputTokens: number | null;
    outputTokens: number | null;
    cacheReadTokens: number | null;
    coldInputTokens: number | null;
    aiCredits: number | null;
}

export interface Alert {
    id: string;
    severity: AlertSeverity;
    title: string;
    detail: string;
    value: number | null;
    threshold: number | null;
}

export interface ParticipantIdentity {
    name: string;
    role: string;
    email: string;
    team: string;
    customerName: string;
    dashboardTitle: string;
}

export interface SavingsOpportunity {
    id: string;
    label: string;
    estimateCredits: number;
    detail: string;
}

export interface EconomySummary {
    efficiencyScore: number | null;
    aiCredits: number;
    potentialSavingsCredits: number;
    coldCostShare: number | null;
    cacheEfficiency: number | null;
    savingsOpportunities: SavingsOpportunity[];
}

export type BudgetAlertLevel = "ok" | "warning" | "critical" | "over";

export interface BudgetInsight {
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
    alertLevel: BudgetAlertLevel;
    message?: string;
}

export interface ModelMixEntry {
    model: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    totalTokens: number;
    estimatedAiCredits: number | null;
    share: number | null;
}

export interface ModelMix {
    status: MetricStatus;
    entries: ModelMixEntry[];
    totalCalls: number;
    totalEstimatedAiCredits: number | null;
    message?: string;
}

export interface ExperienceMetrics {
    avgTimeToFirstTokenSeconds: ScalarMetric;
    avgResponseSeconds: ScalarMetric;
    userTurns: ScalarMetric;
}

export interface OutcomeMetrics {
    editAcceptances: ScalarMetric;
    linesAccepted: ScalarMetric;
    editSurvivalNoRevert: ScalarMetric;
    contextCompactions: ScalarMetric;
}

export interface SummaryResponse {
    range: RangeOption;
    repo: string;
    refreshedAt: string;
    participant: ParticipantIdentity;
    health: ServiceHealth[];
    repositories: string[];
    links: AppLink[];
    thresholds: Record<string, number>;
    alerts: Alert[];
    economy: EconomySummary;
    budget: BudgetInsight;
    modelMix: ModelMix;
    experience: ExperienceMetrics;
    outcomes: OutcomeMetrics;
    metrics: {
        aiCredits: ScalarMetric;
        sessions: ScalarMetric;
        tokens: TokenMetrics;
        context: { typical: ScalarMetric; peak: ScalarMetric };
        activity: { toolCalls: ScalarMetric; errors: ScalarMetric };
        modelTokens: SeriesMetric;
        usdWhatIf: SeriesMetric;
        dataQuality: {
            workspaceReal: ScalarMetric;
            nonWorkspaceReal: ScalarMetric;
            observedCoverage: ScalarMetric;
            notObservedYet: ScalarMetric;
        };
    };
    workspaces: { status: MetricStatus; items: WorkspaceUsage[]; message?: string };
    history: { status: MetricStatus; stepSeconds: number; points: HistoryPoint[]; message?: string };
    officialBilling: { status: "unavailable"; reason: string };
    dataBoundary: { localOnly: string[]; safeForwarding: string[] };
}

export interface SessionRecord {
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

export interface SessionsResponse {
    status: MetricStatus;
    items: SessionRecord[];
    message?: string;
}

export interface CoachCard {
    id: string;
    severity: CoachSeverity;
    title: string;
    insight: string;
    action: string;
}

export interface CoachResponse {
    generatedAt: string;
    range: RangeOption;
    repo: string;
    cards: CoachCard[];
    topSessions: SessionRecord[];
}
