import { strict as assert } from "node:assert";
import test from "node:test";

// The server module reads its configuration from the environment at import
// time, so each scenario loads a fresh instance through a cache-busting query
// string after setting the environment it needs. The listen guard keeps the
// imports from binding ports.
process.env.FRONTIER_API_DISABLE_LISTEN = "true";

type ServerModule = typeof import("./server.js");

const baseEnv: Record<string, string> = {
  FRONTIER_COPILOT_PLAN: "business",
  FRONTIER_COPILOT_SEATS: "1",
  FRONTIER_AI_CREDITS_USE_PROMO: "false",
  FRONTIER_AI_CREDITS_MONTHLY_ALLOWANCE: "",
  FRONTIER_AI_CREDITS_PROMO_START: "2026-06-01",
  FRONTIER_AI_CREDITS_PROMO_END: "2026-09-01"
};

async function loadServer(tag: string, env: Record<string, string> = {}): Promise<ServerModule> {
  for (const [key, value] of Object.entries({ ...baseEnv, ...env })) {
    process.env[key] = value;
  }
  return (await import(`./server.js?scenario=${tag}`)) as ServerModule;
}

const inWindow = new Date("2026-07-03T12:00:00Z");
const afterWindow = new Date("2026-10-01T12:00:00Z");

test("billingCycle reports elapsed, total, and remaining days", async () => {
  const mod = await loadServer("cycle");
  const cycle = mod.billingCycle(inWindow);
  assert.equal(cycle.daysInCycle, 31);
  assert.equal(cycle.daysElapsed, 3);
  assert.equal(cycle.daysLeft, 28);
});

test("promotional allowance applies only when enabled and inside the window", async () => {
  const promo = await loadServer("biz-promo", { FRONTIER_AI_CREDITS_USE_PROMO: "true" });
  const active = promo.resolveAllowance(inWindow);
  assert.equal(active.credits, 3000);
  assert.equal(active.source, "promotional");
  const expired = promo.resolveAllowance(afterWindow);
  assert.equal(expired.credits, 1900);
  assert.equal(expired.source, "standard");

  const noOptIn = await loadServer("biz-standard");
  const standard = noOptIn.resolveAllowance(inWindow);
  assert.equal(standard.credits, 1900);
  assert.equal(standard.source, "standard");
});

test("per-plan allowances follow the published catalog", async () => {
  const pro = await loadServer("pro", { FRONTIER_COPILOT_PLAN: "pro" });
  assert.equal(pro.resolveAllowance(inWindow).credits, 1500);

  const free = await loadServer("free", { FRONTIER_COPILOT_PLAN: "free" });
  const freeAllowance = free.resolveAllowance(inWindow);
  assert.equal(freeAllowance.credits, 0);
  assert.equal(freeAllowance.source, "unpublished");

  const seats = await loadServer("biz-seats", { FRONTIER_COPILOT_SEATS: "3" });
  assert.equal(seats.resolveAllowance(inWindow).credits, 5700);

  const override = await loadServer("override", { FRONTIER_AI_CREDITS_MONTHLY_ALLOWANCE: "4200" });
  const overridden = override.resolveAllowance(inWindow);
  assert.equal(overridden.credits, 4200);
  assert.equal(overridden.source, "override");
});

test("plan catalog carries base plus flex for individual paid plans", async () => {
  const mod = await loadServer("catalog");
  const byId = new Map(mod.copilotPlanCatalog.map((plan) => [plan.id, plan]));
  assert.equal(byId.get("pro")?.includedCredits, 1500);
  assert.equal((byId.get("pro")?.baseCredits ?? 0) + (byId.get("pro")?.flexCredits ?? 0), 1500);
  assert.equal(byId.get("pro+")?.includedCredits, 7000);
  assert.equal(byId.get("max")?.includedCredits, 20000);
  assert.equal(byId.get("enterprise")?.promoCredits, 7000);
});

test("budget alert levels follow the configured thresholds", async () => {
  const mod = await loadServer("alerts");
  assert.equal(mod.budgetAlertLevel(50), "ok");
  assert.equal(mod.budgetAlertLevel(80), "warning");
  assert.equal(mod.budgetAlertLevel(95), "critical");
  assert.equal(mod.budgetAlertLevel(120), "over");
  assert.equal(mod.budgetAlertLevel(null), "ok");
});

test("exhaustion forecast projects the run-out date inside the cycle", async () => {
  const mod = await loadServer("exhaustion");
  const soon = mod.exhaustionForecast(1500, 3000, 100, inWindow);
  assert.equal(soon.daysToExhaustion, 15);
  assert.equal(soon.projectedExhaustionDate, "2026-07-18");

  const outlives = mod.exhaustionForecast(1500, 3000, 10, inWindow);
  assert.equal(outlives.daysToExhaustion, null);
  assert.equal(outlives.projectedExhaustionDate, null);

  const alreadyOver = mod.exhaustionForecast(3200, 3000, 100, inWindow);
  assert.equal(alreadyOver.daysToExhaustion, 0);
  assert.equal(alreadyOver.projectedExhaustionDate, "2026-07-03");

  const noRate = mod.exhaustionForecast(1500, 3000, null, inWindow);
  assert.equal(noRate.daysToExhaustion, null);
});

test("efficiency score rewards cache reuse and penalizes waste", async () => {
  const mod = await loadServer("economy");
  const healthy = mod.computeEconomy({
    aiCredits: 100,
    sessions: 10,
    errors: 0,
    promptTotal: 1_000_000,
    cacheEfficiency: 1,
    coldRatio: 0,
    contextPeak: 0
  });
  assert.equal(healthy.efficiencyScore, 100);
  assert.equal(healthy.potentialSavingsCredits, 0);

  const wasteful = mod.computeEconomy({
    aiCredits: 100,
    sessions: 10,
    errors: 10,
    promptTotal: 1_000_000,
    cacheEfficiency: 0,
    coldRatio: 1,
    contextPeak: 100
  });
  assert.equal(wasteful.efficiencyScore, 0);
  // cold savings 100 * 1 * 0.5 plus error savings 100 * 1 * 0.15
  assert.ok(Math.abs((wasteful.potentialSavingsCredits ?? 0) - 65) < 1e-9);
});

test("inspector event classification maps GenAI operations", async () => {
  const mod = await loadServer("classify");
  assert.equal(mod.classifyInspectorEvent("execute_tool", "execute_tool read_file"), "tool_call");
  assert.equal(mod.classifyInspectorEvent("execute_hook", "hook"), "hook");
  assert.equal(mod.classifyInspectorEvent("invoke_agent", "invoke_agent copilot"), "agent_turn");
  assert.equal(mod.classifyInspectorEvent("chat", "chat gpt-5.5"), "llm_request");
  assert.equal(mod.classifyInspectorEvent("", "span"), "other");
});

test("model tier classification follows the registered output price", async () => {
  const mod = await loadServer("tiers");
  const prices = new Map<string, import("./server.js").ModelPrice>([
    ["claude-opus-4.8", { inputUsdPerMillion: 15, outputUsdPerMillion: 75, tier: "frontier" }],
    ["claude-sonnet-4.6", { inputUsdPerMillion: 3, outputUsdPerMillion: 15, tier: "standard" }]
  ]);
  assert.equal(mod.modelTierOf("claude-opus-4.8", prices), "frontier");
  assert.equal(mod.modelTierOf("claude-sonnet-4.6", prices), "standard");
  assert.equal(mod.modelTierOf("mystery-model", prices), "unknown");
});

test("planner URL parameters are validated and clamped", async () => {
  const mod = await loadServer("planner-url");
  assert.equal(mod.plannerWeeksFromUrl(new URL("http://x/api/planner")), 4);
  assert.equal(mod.plannerWeeksFromUrl(new URL("http://x/api/planner?weeks=30")), 26);
  assert.equal(mod.plannerWeeksFromUrl(new URL("http://x/api/planner?weeks=0")), 1);
  assert.deepEqual(mod.plannerLookbackFromUrl(new URL("http://x/?lookback=30d")), { literal: "30d", days: 30 });
  assert.deepEqual(mod.plannerLookbackFromUrl(new URL("http://x/?lookback=bogus")), { literal: "7d", days: 7 });
});

test("content signature is stable, short, and empty for empty input", async () => {
  const mod = await loadServer("signature");
  assert.equal(mod.contentSignature(""), "");
  assert.equal(mod.contentSignature("system prompt A"), mod.contentSignature("system prompt A"));
  assert.notEqual(mod.contentSignature("system prompt A"), mod.contentSignature("system prompt B"));
  assert.match(mod.contentSignature("anything"), /^[0-9a-f]{8}$/);
});

test("cache analysis classifies break causes and counts healthy pairs", async () => {
  const mod = await loadServer("cache-analysis");
  const turn = (overrides: Partial<import("./server.js").CacheAnalysisRequest>) => ({
    startMs: 0,
    model: "claude-sonnet-4.6",
    inputTokens: 500,
    cacheReadTokens: 9000,
    cacheCreationTokens: 1000,
    systemSig: "aaaa0000",
    toolSig: "bbbb0000",
    ...overrides
  });
  const result = mod.buildCacheAnalysis(
    [
      turn({ startMs: 0, cacheReadTokens: 0, cacheCreationTokens: 10000 }),
      turn({ startMs: 1000 }),
      turn({ startMs: 2000, model: "gpt-5.5", cacheReadTokens: 0, cacheCreationTokens: 10000 }),
      turn({ startMs: 3000, model: "gpt-5.5" }),
      turn({ startMs: 4000, model: "gpt-5.5", systemSig: "cccc1111", cacheReadTokens: 0, cacheCreationTokens: 10000 }),
      turn({ startMs: 5000, model: "gpt-5.5", systemSig: "cccc1111", toolSig: "dddd2222", cacheReadTokens: 0, cacheCreationTokens: 10000 })
    ],
    0.5
  );
  assert.equal(result.requestPairs, 5);
  assert.equal(result.cacheBreaks, 3);
  assert.equal(result.modelSwitches, 1);
  assert.equal(result.healthyPairs, 2);
  assert.equal(result.contentCaptureSeen, true);
  assert.equal(result.timeline[0].cacheBreak, false);
  assert.equal(result.timeline[2].breakCause, "model-switch");
  assert.equal(result.timeline[4].breakCause, "system-prompt-change");
  assert.equal(result.timeline[5].breakCause, "tool-catalog-change");
  // Each break re-created 10k tokens that were cacheable before it.
  assert.equal(result.avoidableRecomputedTokens, 30000);
});

test("cache analysis falls back to prefix drift without content capture", async () => {
  const mod = await loadServer("cache-analysis-drift");
  const result = mod.buildCacheAnalysis(
    [
      { startMs: 0, model: "m", inputTokens: 1, cacheReadTokens: 9000, cacheCreationTokens: 1000, systemSig: "", toolSig: "" },
      { startMs: 1, model: "m", inputTokens: 1, cacheReadTokens: 1000, cacheCreationTokens: 9000, systemSig: "", toolSig: "" }
    ],
    0.5
  );
  assert.equal(result.contentCaptureSeen, false);
  assert.equal(result.cacheBreaks, 1);
  assert.equal(result.timeline[1].breakCause, "prefix-drift");
});

test("message preview extracts the last matching role from captured JSON", async () => {
  const mod = await loadServer("preview");
  const raw = JSON.stringify([
    { role: "system", content: "You are an assistant." },
    { role: "user", content: "First question" },
    { role: "assistant", content: [{ type: "text", text: "First answer" }] },
    { role: "user", content: [{ type: "text", text: "faça o sync das branches remotas com as locais" }] }
  ]);
  assert.equal(mod.extractMessagePreview(raw, "user"), "faça o sync das branches remotas com as locais");
  assert.equal(mod.extractMessagePreview(raw, "assistant"), "First answer");
  assert.equal(mod.extractMessagePreview("plain completion text", "assistant"), "plain completion text");
  assert.equal(mod.extractMessagePreview("", "user"), "");
  const long = mod.extractMessagePreview("x".repeat(500), "user");
  assert.equal(long.length, 200);
  assert.ok(long.endsWith("…"));
});

test("agent breakdown groups model turns, tools, and errors per agent", async () => {
  const mod = await loadServer("agent-breakdown");
  const ev = (type: string, agent: string, extra: Record<string, unknown> = {}) => ({
    type,
    agent,
    serviceName: "copilot-chat",
    durationMs: 100,
    inputTokens: 10,
    outputTokens: 5,
    error: null,
    ...extra
  });
  const breakdown = mod.buildAgentBreakdown([
    ev("llm_request", "GitHub Copilot Chat"),
    ev("llm_request", "GitHub Copilot Chat"),
    ev("tool_call", "GitHub Copilot Chat", { error: "ToolExecutionError" }),
    ev("llm_request", "code-reviewer"),
    ev("hook", "")
  ] as never);
  assert.equal(breakdown.length, 3);
  assert.equal(breakdown[0].agent, "GitHub Copilot Chat");
  assert.equal(breakdown[0].llmRequests, 2);
  assert.equal(breakdown[0].toolCalls, 1);
  assert.equal(breakdown[0].errors, 1);
  assert.equal(breakdown[1].agent, "code-reviewer");
  assert.equal(breakdown[2].agent, "copilot-chat");
  assert.equal(breakdown[2].hooks, 1);
});
