import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customInstance } from "./custom-instance";

export interface AIStatusResponse {
  enabled: boolean;
  provider: string;
  model: string;
  isAdmin: boolean;
  departmentName: string;
}

export interface AIChatMessage {
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
}

export interface AIChatResponse {
  reply: string;
  toolsUsed: string[];
  model: string;
  sessionId?: string;
}

export interface AIChatSession {
  id: string;
  userId: string;
  title: string;
  scope: string;
  departmentId?: string;
  departmentName?: string;
  messageCount: number;
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIChatSessionMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  toolsUsed: string[];
  model: string;
  createdAt: string;
}

export interface AIChatSessionDetailResponse {
  session: AIChatSession;
  messages: AIChatSessionMessage[];
}

export interface MonthlySummaryMetrics {
  totalBills: number;
  paidBills: number;
  paidAmount: number;
  pendingBills: number;
  pendingAmount: number;
  combinedTotal: number;
  prevMonthTotal: number;
  moMChangePct: number;
  totalAnomalies: number;
  unrecordedServices: number;
  recordedServices: number;
}

export interface AISummaryResponse {
  enabled: boolean;
  hasSummary: boolean;
  scope: "all" | "department";
  departmentId?: string;
  departmentName: string;
  billingMonth: number;
  billingYearCE: number;
  billingYearBE: number;
  periodLabel: string;
  headline: string;
  keyPoints: string[];
  recommendations: string[];
  metrics: MonthlySummaryMetrics;
  model: string;
  source: string;
  cached: boolean;
  generatedAt?: string;
}

export interface StatisticalAnomalyStats {
  isAnomaly: boolean;
  method: string;
  sampleCount: number;
  currentAmount: number;
  mean: number;
  stdDev: number;
  median: number;
  q1: number;
  q3: number;
  iqr: number;
  lowerFence: number;
  upperFence: number;
  zScore: number;
  pctDiffFromBaseline: number;
}

export interface BillHistoricalSample {
  billId: string;
  billCode?: string;
  billingMonth: number;
  billingYear: number;
  serviceNumber?: string;
  amount: number;
}

export interface AIAnomalyExplanationResponse {
  billId: string;
  billCode: string;
  departmentName: string;
  utilityType: string;
  billingMonth: number;
  billingYearBE: number;
  serviceNumber: string;
  invoiceAmount: number;
  severity: "HIGH" | "MEDIUM" | "LOW";
  flags: string[];
  summary: string;
  reasons: string[];
  actionItems: string[];
  stats?: StatisticalAnomalyStats;
  history?: BillHistoricalSample[];
  model: string;
  cached: boolean;
  generatedAt: string;
}

export interface AISearchRequest {
  query: string;
  entityType?: "all" | "bills" | "departments";
  limit?: number;
}

export interface AISearchBillHit {
  id: string;
  billCode?: string;
  departmentId: string;
  departmentName: string;
  province?: string;
  region?: string;
  utilityType: string;
  billingMonth: number;
  billingYearCE: number;
  billingYearBE: number;
  serviceNumber?: string;
  invoiceNumber?: string;
  invoiceAmount: number;
  paymentStatus: string;
  invoiceStatus: string;
  hasAnomaly: boolean;
  score: number;
  semanticScore: number;
  keywordScore: number;
  matchReasons: string[];
}

export interface AISearchDepartmentHit {
  id: string;
  fullName: string;
  shortName?: string;
  province?: string;
  region?: string;
  type?: string;
  costCenterCode?: string;
  score: number;
  semanticScore: number;
  keywordScore: number;
  matchReasons: string[];
}

export interface AISearchResponse {
  query: string;
  mode: "hybrid" | "keyword_fallback" | string;
  warning?: string;
  model: string;
  bills: AISearchBillHit[];
  departments: AISearchDepartmentHit[];
  indexedCount: number;
  totalScanned: number;
  tookMs: number;
}

export interface AISyncEmbeddingsResponse {
  indexedBills: number;
  indexedDepartments: number;
  skippedUnchanged: number;
  failed: number;
  model: string;
  durationMs: number;
}

export interface AICategorizeBillRequest {
  departmentId?: string;
  description?: string;
  provider?: string;
  serviceNumber?: string;
  invoiceNumber?: string;
  billingMonth?: number;
  billingYear?: number;
  amount?: number;
  currentUtilityType?: string;
  currentBudgetCode?: string;
}

export interface AICategorizeBillResponse {
  utilityType: string;
  accountCode: string;
  budgetCode: string;
  budgetCodeName?: string;
  budgetFiscalYear?: number;
  matchedServiceNumber?: string;
  provider?: string;
  confidence: number;
  reasoning: string;
  warnings: string[];
  model: string;
}

export interface AIExtractDocumentResponse {
  utilityType: string;
  accountCode: string;
  provider?: string;
  serviceNumber?: string;
  matchedServiceNumber?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  invoiceDateRaw?: string;
  billingMonth?: number;
  billingYearCE?: number;
  billingYearBE?: number;
  billingMonthStr?: string;
  usageAmount?: number;
  invoiceAmount?: number;
  budgetCode?: string;
  budgetCodeName?: string;
  budgetFiscalYear?: number;
  confidence: number;
  notes?: string;
  warnings: string[];
  model: string;
}

export interface ForecastSeriesPoint {
  month: number;
  yearCE: number;
  yearBE: number;
  label: string;
  fullLabel: string;
  actualAmount: number;
  predictedAmount: number;
  lowerBound: number;
  upperBound: number;
  billCount: number;
  isForecast: boolean;
  seasonalIndex: number;
}

export interface UtilityForecastItem {
  utilityType: string;
  latestActual: number;
  avgRecent3Months: number;
  nextMonthPredicted: number;
  moMChangePct: number;
  sharePct: number;
}

export type BudgetPlanStatus = "HEALTHY" | "WATCH" | "RISK" | "DEFICIT" | "NO_BUDGET";

export interface DepartmentBudgetPlanItem {
  departmentId: string;
  departmentName: string;
  departmentShortName?: string;
  allocatedAmount: number;
  transferredAmount: number;
  netBudget: number;
  ytdSpent: number;
  projectedTotalSpend: number;
  projectedBalance: number;
  projectedUtilizationPct: number;
  recommendedAdjustment: number;
  status: BudgetPlanStatus;
}

export interface BudgetPlanSummary {
  fiscalYearCE: number;
  fiscalYearBE: number;
  fiscalYearLabel: string;
  availableFiscalYearsBE: number[];
  netBudget: number;
  allocatedAmount: number;
  transferredAmount: number;
  ytdSpent: number;
  ytdPaid: number;
  ytdPending: number;
  projectedRemainingSpend: number;
  projectedTotalSpend: number;
  projectedBalance: number;
  utilizationPct: number;
  projectedUtilizationPct: number;
  monthsElapsed: number;
  monthsRemaining: number;
  recommendedAdditional: number;
  status: BudgetPlanStatus;
  departmentPlans: DepartmentBudgetPlanItem[];
}

export interface AlertPredictionItem {
  departmentId: string;
  departmentName: string;
  departmentShortName?: string;
  utilityType: string;
  riskScore: number;
  severity: "HIGH" | "MEDIUM" | "LOW";
  riskCategories: string[];
  title: string;
  reason: string;
  recommendedAction: string;
  predictedAmount?: number;
  baselineAmount?: number;
  budgetUtilizationPct?: number;
  recentIncidentCount?: number;
}

export interface ForecastAIInsights {
  hasInsights: boolean;
  executiveSummary: string;
  budgetRecommendations: string[];
  preventiveActions: string[];
  model: string;
  cached: boolean;
  generatedAt?: string;
}

export interface AIForecastResponse {
  enabled: boolean;
  scope: "all" | "department";
  departmentId?: string;
  departmentName: string;
  horizon: number;
  sampleMonths: number;
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
  confidenceLabel: string;
  method: string;
  nextMonthLabel: string;
  nextMonthPredicted: number;
  nextMonthLowerBound: number;
  nextMonthUpperBound: number;
  latestMonthLabel: string;
  latestMonthActual: number;
  moMForecastChangePct: number;
  historicalAvgMonthly: number;
  series: ForecastSeriesPoint[];
  utilityBreakdown: UtilityForecastItem[];
  budgetPlan: BudgetPlanSummary;
  alertPredictions: AlertPredictionItem[];
  insights: ForecastAIInsights;
}

export interface AIForecastInsightsRequest {
  scope?: "all" | "department";
  departmentId?: string;
  horizon?: number;
  fiscalYear?: number;
  force?: boolean;
}

export const AI_TOOL_LABELS: Record<string, string> = {
  get_utility_summary: "สรุปยอดค่าสาธารณูปโภค",
  get_pending_bills: "ตรวจสอบยอดค้างชำระ",
  get_anomalies: "ตรวจสอบความคลาดเคลื่อน",
  get_monthly_trend: "วิเคราะห์แนวโน้มรายเดือน",
  get_unrecorded_services: "ตรวจสอบหมายเลขที่ยังไม่บันทึก",
  get_budget_overview: "ข้อมูลวงเงินงบประมาณ",
  get_utility_forecast: "พยากรณ์ค่าใช้จ่ายและงบประมาณ",
  search_bills_and_departments: "ค้นหาบิลและหน่วยงาน",
  lookup_regulation_and_policy: "ค้นหาข้อระเบียบและแนวปฏิบัติราชการ",
};

export function useAIStatus(enabled = true) {
  return useQuery({
    queryKey: ["/api/ai/status"],
    queryFn: async ({ signal }) => {
      const res = await customInstance<AIStatusResponse>({
        url: "/api/ai/status",
        method: "GET",
        signal,
      });
      return res.data;
    },
    enabled,
    staleTime: 60 * 1000,
    retry: false,
  });
}

export interface AIChatPayload {
  messages: Pick<AIChatMessage, "role" | "content">[];
  scope?: "all" | "department";
  departmentId?: string;
  sessionId?: string;
}

export function useAIChat(defaultScope: "all" | "department" = "department") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Pick<AIChatMessage, "role" | "content">[] | AIChatPayload) => {
      const isArray = Array.isArray(payload);
      const messages = isArray ? payload : payload.messages;
      const scope = isArray ? defaultScope : (payload.scope || defaultScope);
      const departmentId = isArray ? undefined : payload.departmentId;
      const sessionId = isArray ? undefined : payload.sessionId;

      const res = await customInstance<AIChatResponse>({
        url: "/api/ai/chat",
        method: "POST",
        data: {
          messages,
          scope,
          ...(departmentId ? { departmentId } : {}),
          ...(sessionId ? { sessionId } : {}),
        },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/sessions"] });
    },
  });
}

export function useAIChatSessions(scope?: "all" | "department", enabled = true) {
  return useQuery({
    queryKey: ["/api/ai/sessions", { scope }],
    queryFn: async ({ signal }) => {
      const res = await customInstance<{ sessions: AIChatSession[] }>({
        url: "/api/ai/sessions",
        method: "GET",
        params: scope ? { scope } : undefined,
        signal,
      });
      return res.data?.sessions || [];
    },
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useAIChatSession(sessionId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["/api/ai/sessions", sessionId],
    queryFn: async ({ signal }) => {
      if (!sessionId) return null;
      const res = await customInstance<AIChatSessionDetailResponse>({
        url: `/api/ai/sessions/${sessionId}`,
        method: "GET",
        signal,
      });
      return res.data;
    },
    enabled: enabled && !!sessionId,
    staleTime: 60 * 1000,
  });
}

export function useDeleteAIChatSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await customInstance<{ success: boolean }>({
        url: `/api/ai/sessions/${sessionId}`,
        method: "DELETE",
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/sessions"] });
    },
  });
}

export function useAISummary(params: {
  scope?: "all" | "department";
  departmentId?: string;
  month?: number;
  year?: number;
  enabled?: boolean;
}) {
  const { scope = "department", departmentId, month, year, enabled = true } = params;
  return useQuery({
    queryKey: ["/api/ai/summary", scope, departmentId || "", month || 0, year || 0],
    queryFn: async ({ signal }) => {
      const res = await customInstance<AISummaryResponse>({
        url: "/api/ai/summary",
        method: "GET",
        params: {
          scope,
          ...(departmentId ? { departmentId } : {}),
          ...(month ? { month } : {}),
          ...(year ? { year } : {}),
        },
        signal,
      });
      return res.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useRefreshAISummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      scope?: "all" | "department";
      departmentId?: string;
      month?: number;
      year?: number;
    }) => {
      const res = await customInstance<AISummaryResponse>({
        url: "/api/ai/summary/refresh",
        method: "POST",
        data: payload,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/summary"] });
    },
  });
}

export function extractAIErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  if (err && typeof err === "object") {
    const record = err as Record<string, unknown>;
    for (const key of ["detail", "message", "error"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }
  }
  return fallback;
}

export function useExplainBillAnomaly() {
  return useMutation({
    mutationFn: async ({ billId, force = false }: { billId: string; force?: boolean }) => {
      const res = await customInstance<AIAnomalyExplanationResponse>({
        url: `/api/ai/bills/${billId}/explain`,
        method: "POST",
        data: { force },
      });
      return res.data;
    },
  });
}

export async function searchAI(
  payload: AISearchRequest,
  signal?: AbortSignal,
): Promise<AISearchResponse> {
  const res = await customInstance<AISearchResponse>({
    url: "/api/ai/search",
    method: "POST",
    data: payload,
    signal,
  });
  return res.data;
}

export async function syncAIEmbeddings(force = false): Promise<AISyncEmbeddingsResponse> {
  const res = await customInstance<AISyncEmbeddingsResponse>({
    url: "/api/ai/embeddings/sync",
    method: "POST",
    data: { force },
  });
  return res.data;
}

export async function categorizeBillWithAI(
  payload: AICategorizeBillRequest,
  signal?: AbortSignal,
): Promise<AICategorizeBillResponse> {
  const res = await customInstance<AICategorizeBillResponse>({
    url: "/api/ai/bills/categorize",
    method: "POST",
    data: payload,
    signal,
  });
  return res.data;
}

export async function extractBillDocumentWithAI(
  params: { file: File; departmentId?: string },
  signal?: AbortSignal,
): Promise<AIExtractDocumentResponse> {
  const formData = new FormData();
  formData.append("file", params.file);
  if (params.departmentId) {
    formData.append("departmentId", params.departmentId);
  }
  const res = await customInstance<AIExtractDocumentResponse>({
    url: "/api/ai/bills/extract-document",
    method: "POST",
    data: formData,
    signal,
  });
  return res.data;
}

export function useAISearch() {
  return useMutation({
    mutationFn: async (payload: AISearchRequest) => searchAI(payload),
  });
}

export function useSyncAIEmbeddings() {
  return useMutation<AISyncEmbeddingsResponse, Error, boolean | undefined>({
    mutationFn: async (force = false) => syncAIEmbeddings(force),
  });
}

export function useCategorizeBill() {
  return useMutation({
    mutationFn: async (payload: AICategorizeBillRequest) => categorizeBillWithAI(payload),
  });
}

export function useExtractBillDocument() {
  return useMutation({
    mutationFn: async (params: { file: File; departmentId?: string }) =>
      extractBillDocumentWithAI(params),
  });
}

export function useAIForecast(params: {
  scope?: "all" | "department";
  departmentId?: string;
  horizon?: number;
  fiscalYear?: number;
  enabled?: boolean;
}) {
  const {
    scope = "department",
    departmentId,
    horizon = 6,
    fiscalYear = 0,
    enabled = true,
  } = params;
  return useQuery({
    queryKey: ["/api/ai/forecast", scope, departmentId || "", horizon, fiscalYear],
    queryFn: async ({ signal }) => {
      const res = await customInstance<AIForecastResponse>({
        url: "/api/ai/forecast",
        method: "GET",
        params: {
          scope,
          horizon,
          ...(departmentId ? { departmentId } : {}),
          ...(fiscalYear > 0 ? { fiscalYear } : {}),
        },
        signal,
      });
      return res.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useGenerateAIForecastInsights() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AIForecastInsightsRequest) => {
      const res = await customInstance<AIForecastResponse>({
        url: "/api/ai/forecast/insights",
        method: "POST",
        data: payload,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/forecast"] });
    },
  });
}
