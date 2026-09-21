import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import { AppShell } from './components/layout/AppShell'
import { Skeleton } from './components/ui'
import './index.css'

const StockPage = lazy(() => import('./pages/StockPage').then((m) => ({ default: m.StockPage })))
const SwingPage = lazy(() => import('./pages/SwingPage').then((m) => ({ default: m.SwingPage })))

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
              <Route index element={<SwingPage />} />
              <Route path="swing" element={<SwingPage />} />
              <Route path="stocks/:symbol" element={<StockPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
