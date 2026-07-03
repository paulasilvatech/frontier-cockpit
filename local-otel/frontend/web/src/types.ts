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
    contextPeakPct: number | null;
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
export type AllowanceSource = "standard" | "promotional" | "override" | "unpublished";
export type PlanAudience = "individual" | "organization";
export type PlanModelAccess = "auto-only" | "full";
export type ModelTier = "frontier" | "standard" | "unknown";

export interface CopilotPlanFacts {
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

export interface BillingFacts {
    creditUsd: number;
    autoModelDiscount: number;
    noRollover: boolean;
    resetRule: string;
    meteringRule: string;
    overageRule: string;
    promoWindow: { start: string; end: string; active: boolean };
    configuredPlan: string;
    seats: number;
    allowance: {
        credits: number;
        perSeatCredits: number;
        source: AllowanceSource;
        promoActive: boolean;
    };
    planCatalog: CopilotPlanFacts[];
    source: string;
}

export interface PlannerModelSplit {
    tier: ModelTier;
    credits: number;
    sessions: number;
    avgToolCalls: number | null;
    models: string[];
}

export interface PlannerReviewSession {
    traceId: string;
    repoShort: string;
    model: string;
    aiCredits: number;
    toolCalls: number;
    outputTokens: number;
}

export type PlannerVerdict = "justified" | "review" | "no-frontier" | "no-data";

export interface PlannerInsight {
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
        verdict: PlannerVerdict;
    };
    justificationMarkdown: string;
}

export type InspectorEventType = "llm_request" | "agent_turn" | "tool_call" | "hook" | "other";

export interface InspectorEvent {
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
}

export type CacheBreakCause = "model-switch" | "system-prompt-change" | "tool-catalog-change" | "prefix-drift";

export interface InspectorCacheTurn {
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

export interface InspectorSummary {
    traceId: string;
    spanCount: number;
    llmRequests: number;
    agentTurns: number;
    toolCalls: number;
    hooks: number;
    errors: number;
    totalDurationMs: number | null;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
    cacheEfficiency: number | null;
    cacheBreaks: number;
    modelSwitches: number;
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

export interface InspectorResponse {
    status: MetricStatus;
    message?: string;
    summary: InspectorSummary | null;
    events: InspectorEvent[];
    cacheTimeline: InspectorCacheTurn[];
}

export interface BudgetInsight {
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
    alertLevel: BudgetAlertLevel;
    message?: string;
}

export interface LongTermEntry {
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

export interface LongTermDay {
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

export interface LongTermHistoryResponse {
    status: MetricStatus;
    message?: string;
    generatedAt: string | null;
    source: string | null;
    repo: string;
    entries: LongTermEntry[];
    days: LongTermDay[];
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
    coachTuning: Record<string, number>;
    billing: BillingFacts;
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
    params?: Record<string, string | number>;
}

export interface CoachResponse {
    generatedAt: string;
    range: RangeOption;
    repo: string;
    cards: CoachCard[];
    topSessions: SessionRecord[];
}
