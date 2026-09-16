import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import { AppShell } from './components/layout/AppShell'
import { Skeleton } from './components/ui'
import './index.css'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const PicksPage = lazy(() => import('./pages/PicksPage').then((m) => ({ default: m.PicksPage })))
const PerformancePage = lazy(() => import('./pages/PerformancePage').then((m) => ({ default: m.PerformancePage })))
const BacktestPage = lazy(() => import('./pages/BacktestPage').then((m) => ({ default: m.BacktestPage })))
const DataPage = lazy(() => import('./pages/DataPage').then((m) => ({ default: m.DataPage })))
const StockPage = lazy(() => import('./pages/StockPage').then((m) => ({ default: m.StockPage })))
const AnalystPage = lazy(() => import('./pages/AnalystPage').then((m) => ({ default: m.AnalystPage })))
const IposPage = lazy(() => import('./pages/IposPage').then((m) => ({ default: m.IposPage })))
const ElitePage = lazy(() => import('./pages/ElitePage').then((m) => ({ default: m.ElitePage })))
const CircuitPage = lazy(() => import('./pages/CircuitPage').then((m) => ({ default: m.CircuitPage })))

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } },
})

const fallback = (
  <div className="grid gap-4 md:grid-cols-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <Skeleton key={i} className="h-28" />
    ))}
    <Skeleton className="h-96 md:col-span-4" />
  </div>
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={fallback}>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="circuit" element={<CircuitPage />} />
              <Route path="elite" element={<ElitePage />} />
              <Route path="picks" element={<PicksPage />} />
              <Route path="performance" element={<PerformancePage />} />
              <Route path="backtest" element={<BacktestPage />} />
              <Route path="backtest/:id" element={<BacktestPage />} />
              <Route path="data" element={<DataPage />} />
              <Route path="stocks/:symbol" element={<StockPage />} />
              <Route path="analyst" element={<AnalystPage />} />
              <Route path="analyst/:symbol" element={<AnalystPage />} />
              <Route path="ipos" element={<IposPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
