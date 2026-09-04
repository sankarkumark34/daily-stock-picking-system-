import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AiNoteResponseDto,
  AnalystAnswerDto,
  LiveMarketDto,
  LiveQuoteDto,
  StockAnalysisDto,
  BacktestParams,
  BacktestRunDto,
  BacktestRunSummaryDto,
  DailyRunResultDto,
  DataStatusDto,
  MarketOverviewDto,
  PerformanceSummaryDto,
  PickDto,
  StockDetailDto,
} from '@nse/shared'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    let msg = res.statusText
    try {
      const body = await res.json()
      msg = Array.isArray(body.message) ? body.message.join(', ') : body.message ?? msg
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, msg)
  }
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

const qs = (params: Record<string, string | number | undefined | null>) => {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v))
  const str = s.toString()
  return str ? `?${str}` : ''
}

export const useMarketOverview = (date?: string) =>
  useQuery({ queryKey: ['market', 'overview', date ?? 'latest'], queryFn: () => api.get<MarketOverviewDto>(`/market/overview${qs({ date })}`) })

export const usePicks = (date?: string, runId?: number | null) =>
  useQuery({
    queryKey: ['picks', date ?? 'latest', runId ?? 'live'],
    queryFn: () => api.get<{ date: string | null; picks: PickDto[] }>(`/picks${qs({ date, runId })}`),
  })

export const usePickDates = (runId?: number | null) =>
  useQuery({ queryKey: ['picks', 'dates', runId ?? 'live'], queryFn: () => api.get<string[]>(`/picks/dates${qs({ runId })}`) })

export const useRecentPicks = (limit = 200) =>
  useQuery({ queryKey: ['picks', 'recent', limit], queryFn: () => api.get<PickDto[]>(`/picks/recent${qs({ limit })}`) })

export const usePerformance = (runId?: number | null) =>
  useQuery({ queryKey: ['performance', runId ?? 'live'], queryFn: () => api.get<PerformanceSummaryDto>(`/performance/summary${qs({ runId })}`) })

export const useBacktestRuns = () =>
  useQuery({
    queryKey: ['backtest', 'runs'],
    queryFn: () => api.get<BacktestRunSummaryDto[]>('/backtest/runs'),
    refetchInterval: (q) => (q.state.data?.some((r) => r.status === 'RUNNING' || r.status === 'QUEUED') ? 2000 : false),
  })

export const useBacktestRun = (id: number | null) =>
  useQuery({
    queryKey: ['backtest', 'run', id],
    enabled: id !== null,
    queryFn: () => api.get<BacktestRunDto>(`/backtest/runs/${id}`),
    refetchInterval: (q) => (q.state.data && (q.state.data.status === 'RUNNING' || q.state.data.status === 'QUEUED') ? 2000 : false),
  })

export const useBacktestDefaults = () => useQuery({ queryKey: ['backtest', 'defaults'], queryFn: () => api.get<BacktestParams>('/backtest/defaults') })

export const useDataStatus = (poll = false) =>
  useQuery({
    queryKey: ['data', 'status'],
    queryFn: () => api.get<DataStatusDto>('/data/status'),
    refetchInterval: (q) => (poll || q.state.data?.job?.status === 'RUNNING' ? 1500 : false),
  })

export const useStock = (symbol: string | undefined, bars = 250) =>
  useQuery({ queryKey: ['stock', symbol, bars], enabled: !!symbol, queryFn: () => api.get<StockDetailDto>(`/stocks/${symbol}${qs({ bars })}`) })

export const useStockSearch = (q: string) =>
  useQuery({
    queryKey: ['stock-search', q],
    enabled: q.trim().length >= 1,
    staleTime: 5 * 60_000,
    queryFn: () => api.get<{ symbol: string; name: string | null; sector: string; nifty500: boolean }[]>(`/stocks/search${qs({ q })}`),
  })

export const useStockAnalysis = (symbol: string | undefined) =>
  useQuery({ queryKey: ['analyst', symbol], enabled: !!symbol, staleTime: 5 * 60_000, queryFn: () => api.get<StockAnalysisDto>(`/analyst/${symbol}`) })

export const useAiNote = (symbol: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['analyst', symbol, 'ai'],
    enabled: !!symbol && enabled,
    staleTime: 60 * 60_000,
    retry: false,
    queryFn: () => api.get<AiNoteResponseDto>(`/analyst/${symbol}/ai`),
  })

export const useAskAnalyst = (symbol: string | undefined) =>
  useMutation({ mutationFn: (question: string) => api.post<AnalystAnswerDto>(`/analyst/${symbol}/ask`, { question }) })

export const useLiveQuotes = (symbols: string[]) => {
  const key = [...new Set(symbols)].sort().join(',')
  return useQuery({
    queryKey: ['live', 'quotes', key],
    enabled: key.length > 0,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
    queryFn: () => api.get<LiveQuoteDto[]>(`/live/quotes${qs({ symbols: key })}`),
  })
}

export const useLiveMarket = () =>
  useQuery({ queryKey: ['live', 'market'], refetchInterval: 60_000, staleTime: 30_000, retry: 1, queryFn: () => api.get<LiveMarketDto>('/live/market') })

export function useInvalidate() {
  const qc = useQueryClient()
  return (...keys: string[]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] })))
}

export const useRunDaily = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (body: { date?: string; ingest?: boolean }) => api.post<DailyRunResultDto>('/run/daily', body),
    onSuccess: () => invalidate('picks', 'market', 'performance', 'data'),
  })
}

export const useEvaluate = () => {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: () => api.post<{ updated: number }>('/run/evaluate'), onSuccess: () => invalidate('picks', 'performance') })
}

export const useIngest = () => {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (body: { date: string; force?: boolean }) => api.post<{ date: string; rows: number }>('/data/ingest', body), onSuccess: () => invalidate('data') })
}

export const useBackfill = () => {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (body: { fromDate: string; toDate: string; force?: boolean }) => api.post<{ jobId: string }>('/data/backfill', body),
    onSuccess: () => invalidate('data'),
  })
}

export const useSyncUniverse = () => {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: () => api.post<{ mapped: number }>('/data/universe/sync'), onSuccess: () => invalidate('data') })
}

export const useStartBacktest = () => {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (body: Partial<BacktestParams>) => api.post<{ id: number }>('/backtest/runs', body), onSuccess: () => invalidate('backtest') })
}

export const useDeleteBacktest = () => {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: (id: number) => api.del<{ deleted: number }>(`/backtest/runs/${id}`), onSuccess: () => invalidate('backtest') })
}
