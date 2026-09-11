import { Database, Download, PlayCircle, RefreshCw } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Badge, Button, Callout, Card, Field, Input, PageHeader, ProgressBar, Skeleton, StatTile, staggerList } from '../components/ui'
import { useBackfill, useDataStatus, useEvaluate, useIngest, useRunDaily, useSyncUniverse } from '../lib/api'
import { FilterSelect, SortTh, TableToolbar, useSortFilter } from '../components/table'
import { dateLong, dateShort, timeAgo, todayIso } from '../lib/format'

export function DataPage() {
  const { data, isLoading } = useDataStatus()
  const ingest = useIngest()
  const backfill = useBackfill()
  const sync = useSyncUniverse()
  const runDaily = useRunDaily()
  const evaluate = useEvaluate()

  const [ingestDate, setIngestDate] = useState(todayIso())
  const [from, setFrom] = useState('2019-01-01')
  const [to, setTo] = useState(todayIso())
  const [runDate, setRunDate] = useState('')
  const busy = data?.job?.status === 'RUNNING'
  const lg = useSortFilter(data?.recentLogs, {
    defaultKey: 'id',
    defaultDir: 'desc',
    searchText: (l) => `${l.date} ${l.source} ${l.status} ${l.message ?? ''}`,
    filters: { status: (l, v) => l.status === v, source: (l, v) => l.source === v },
  })

  return (
    <>
      <PageHeader title="Data & Operations" description="NSE end-of-day files are pulled from the public archives, validated and stored. The daily pipeline runs automatically at 18:45 IST on weekdays; you can also trigger every step here." />

      {isLoading || !data ? (
        <Skeleton className="h-40" />
      ) : (
        <motion.div variants={staggerList} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Coverage" value={data.tradingDays.toLocaleString()} sub={`trading days · ${dateShort(data.firstDate)} → ${dateShort(data.lastDate)}`} icon={<Database size={16} />} />
          <StatTile label="Daily bars" value={data.bars.toLocaleString('en-IN')} sub={`${data.symbols.toLocaleString()} symbols · ${data.indexBars.toLocaleString()} index rows`} />
          <StatTile label="Sector mapping" value={data.sectorsMapped} sub="Nifty 500 constituents with industry" tone={data.sectorsMapped ? 'success' : 'warning'} />
          <StatTile label="Live predictions" value={data.predictions.toLocaleString()} sub="stored permanently with outcomes" />
        </motion.div>
      )}

      {data?.job && (
        <Card className="mt-5" title={`${data.job.type.replace('_', ' ').toLowerCase()} job`} subtitle={`${data.job.fromDate} → ${data.job.toDate} · started ${timeAgo(data.job.startedAt)}`} action={<Badge tone={data.job.status === 'RUNNING' ? 'info' : data.job.status === 'COMPLETED' ? 'success' : 'danger'}>{data.job.status.toLowerCase()}</Badge>}>
          <ProgressBar value={data.job.total ? (data.job.processed / data.job.total) * 100 : 0} tone={data.job.status === 'FAILED' ? 'danger' : 'info'} />
          <p className="mt-2 text-sm text-ink-700">
            {data.job.processed}/{data.job.total} {data.job.currentDate ? `· ${data.job.currentDate}` : ''} {data.job.message ? `· ${data.job.message}` : ''}
          </p>
        </Card>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card title="Run the model" subtitle="Analyse the latest close and store today's picks">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              runDaily.mutate({ date: runDate || undefined, ingest: true })
            }}
          >
            <Field label="Date (optional)" hint="Blank = latest date with data, after trying to ingest today's file">
              <Input type="date" value={runDate} onChange={(e) => setRunDate(e.target.value)} />
            </Field>
            <Button type="submit" loading={runDaily.isPending} disabled={busy} className="w-full">
              <PlayCircle size={15} /> Run daily pipeline
            </Button>
            <Button type="button" variant="secondary" loading={evaluate.isPending} onClick={() => evaluate.mutate()} className="w-full">
              <RefreshCw size={14} /> Re-evaluate open predictions
            </Button>
            {runDaily.data && (
              <Callout tone="success">
                {runDaily.data.date}: {runDaily.data.picks.length} picks · regime {runDaily.data.overview.regime.replace('_', ' ').toLowerCase()} · {runDaily.data.evaluated} outcomes updated ({(runDaily.data.durationMs / 1000).toFixed(1)}s)
              </Callout>
            )}
            {evaluate.data && <Callout tone="info">{evaluate.data.updated} predictions resolved.</Callout>}
            {(runDaily.error || evaluate.error) && <Callout tone="danger">{((runDaily.error ?? evaluate.error) as Error).message}</Callout>}
          </form>
        </Card>

        <Card title="Ingest one day" subtitle="Bhavcopy + index closes + delivery data">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              ingest.mutate({ date: ingestDate })
            }}
          >
            <Field label="Trading date">
              <Input type="date" value={ingestDate} onChange={(e) => setIngestDate(e.target.value)} required />
            </Field>
            <Button type="submit" variant="secondary" loading={ingest.isPending} disabled={busy} className="w-full">
              <Download size={14} /> Ingest
            </Button>
            <Button type="button" variant="ghost" loading={sync.isPending} onClick={() => sync.mutate()} className="w-full">
              Refresh Nifty 500 sector map
            </Button>
            {ingest.data && <Callout tone={ingest.data.rows ? 'success' : 'warning'}>{ingest.data.rows ? `${ingest.data.rows} equity rows stored for ${ingest.data.date}.` : `No file for ${ingest.data.date} — holiday or not published yet.`}</Callout>}
            {sync.data && <Callout tone="success">{sync.data.mapped} constituents mapped.</Callout>}
            {(ingest.error || sync.error) && <Callout tone="danger">{((ingest.error ?? sync.error) as Error).message}</Callout>}
          </form>
        </Card>

        <Card title="Backfill history" subtitle="Weekdays only · skips dates already stored · runs in background">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              backfill.mutate({ fromDate: from, toDate: to })
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="From">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
              </Field>
              <Field label="To">
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} required />
              </Field>
            </div>
            <Button type="submit" variant="secondary" loading={backfill.isPending} disabled={busy} className="w-full">
              <Download size={14} /> Start backfill
            </Button>
            <p className="text-[11px] text-ink-500">Roughly 1–2 seconds per trading day (three NSE files each, cached on disk). 5 years ≈ 30–45 minutes.</p>
            {backfill.error && <Callout tone="danger">{(backfill.error as Error).message}</Callout>}
          </form>
        </Card>
      </div>

      <Card className="mt-5" title="Recent ingest log" padded={false}>
        <TableToolbar query={lg.query} onQuery={lg.setQuery} count={lg.rows.length} total={lg.total} onClear={lg.clear} active={lg.active} placeholder="Filter log…">
          <FilterSelect label="All statuses" value={lg.filterValues.status ?? ''} onChange={(v) => lg.setFilter('status', v)} options={['OK', 'EMPTY', 'ERROR'].map((s) => ({ value: s, label: s }))} />
          <FilterSelect label="All sources" value={lg.filterValues.source ?? ''} onChange={(v) => lg.setFilter('source', v)} options={[...new Set((data?.recentLogs ?? []).map((l) => l.source))].map((s) => ({ value: s, label: s }))} />
        </TableToolbar>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <SortTh k="date" sort={lg.sort}>Date</SortTh>
                <SortTh k="source" sort={lg.sort}>Source</SortTh>
                <SortTh k="status" sort={lg.sort}>Status</SortTh>
                <SortTh k="rows" sort={lg.sort} align="right">Rows</SortTh>
                <th>Message</th>
                <SortTh k="createdAt" sort={lg.sort}>Logged</SortTh>
              </tr>
            </thead>
            <tbody>
              {lg.rows.map((l) => (
                <tr key={l.id}>
                  <td className="font-medium">{dateLong(l.date)}</td>
                  <td>{l.source}</td>
                  <td>
                    <Badge tone={l.status === 'OK' ? 'success' : l.status === 'EMPTY' ? 'warning' : 'danger'}>{l.status}</Badge>
                  </td>
                  <td className="num">{l.rows}</td>
                  <td className="max-w-[420px] truncate text-ink-500">{l.message ?? ''}</td>
                  <td className="text-ink-500">{timeAgo(l.createdAt)}</td>
                </tr>
              ))}
              {!data?.recentLogs.length && (
                <tr>
                  <td colSpan={6} className="text-center text-ink-500">
                    Nothing ingested yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
