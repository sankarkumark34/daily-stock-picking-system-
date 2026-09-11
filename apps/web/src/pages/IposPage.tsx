import { useState } from 'react';
import { Rocket, TrendingUp, Users, AlertCircle, Sparkles } from 'lucide-react';
import { useUpcomingIpos } from '../lib/api';
import { Badge, Card, Spinner, Toggle } from '../components/ui';

export function IposPage() {
  const { data: ipos, isLoading, error } = useUpcomingIpos();
  const [showOnlyElite, setShowOnlyElite] = useState(false);

  const displayedIpos = ipos?.filter(ipo => showOnlyElite ? ipo.isElite : true);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-red-500 gap-2">
        <AlertCircle size={32} />
        <p>Failed to load upcoming IPOs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 flex items-center gap-2">
            <Rocket className="text-brand-600" />
            Upcoming IPOs
          </h1>
          <p className="text-sm text-ink-500 mt-1">
            Track current and upcoming Initial Public Offerings. Highly subscribed or high-GMP IPOs are marked as Elite Grade.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white/60 p-2 px-4 rounded-xl border border-white/80 shadow-sm backdrop-blur-md shrink-0">
          <Toggle checked={showOnlyElite} onChange={setShowOnlyElite} label="Show Elite Only 💎" />
        </div>
      </header>

      {displayedIpos?.length === 0 ? (
        <Card className="p-8 text-center text-ink-500">
          {showOnlyElite ? "No Elite Grade IPOs found at this time." : "No upcoming IPOs found at this time."}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayedIpos?.map((ipo) => (
            <Card key={ipo.symbol} className="overflow-hidden flex flex-col relative transition-all hover:shadow-md">
              {ipo.isElite && (
                <div className="absolute top-0 left-0 w-full bg-gradient-to-r from-brand-500 via-purple-500 to-brand-500 py-1.5 px-4 text-[10px] uppercase tracking-widest font-bold text-white shadow-[0_4px_15px_rgba(139,92,246,0.3)] flex items-center justify-center gap-1.5 z-10">
                  <Sparkles size={12} className="animate-pulse" /> ELITE GRADE <Sparkles size={12} className="animate-pulse" />
                </div>
              )}
              
              <div className={`p-5 flex-1 ${ipo.isElite ? 'pt-8' : ''}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-ink-900 text-lg leading-tight">{ipo.companyName}</h3>
                    <div className="text-xs font-medium text-ink-500 mt-0.5">{ipo.symbol}</div>
                  </div>
                  <Badge tone={ipo.isElite ? 'warning' : 'neutral'}>
                    {ipo.isElite ? 'High Demand' : 'Standard'}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-y-3 text-sm">
                  <div>
                    <div className="text-xs text-ink-500">Open Date</div>
                    <div className="font-medium text-ink-800">{new Date(ipo.openDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-500">Close Date</div>
                    <div className="font-medium text-ink-800">{new Date(ipo.closeDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-500">Price Band</div>
                    <div className="font-medium text-ink-800">{ipo.priceBand}</div>
                  </div>
                  {ipo.lotSize > 0 && (
                    <div>
                      <div className="text-xs text-ink-500">Lot Size</div>
                      <div className="font-medium text-ink-800">{ipo.lotSize} shares</div>
                    </div>
                  )}
                </div>

                <div className="mt-5 p-3 bg-white/40 rounded-lg border border-white/50 space-y-2 shadow-sm">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-ink-600">
                      <Users size={14} /> Total Sub
                    </span>
                    <span className="font-semibold text-ink-900">{ipo.qibSubscription}x</span>
                  </div>
                  {ipo.gmpPercent > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-ink-600">
                        <TrendingUp size={14} /> Est. GMP
                      </span>
                      <span className={`font-semibold ${ipo.gmpPercent > 20 ? 'text-up-600' : 'text-ink-900'}`}>
                        {ipo.gmpPercent}%
                      </span>
                    </div>
                  )}
                </div>

                {ipo.isElite && ipo.eliteReasons.length > 0 && (
                  <div className="mt-4 space-y-1.5">
                    {ipo.eliteReasons.map((reason, idx) => (
                      <div key={idx} className="text-xs flex items-start gap-2 text-brand-700 bg-brand-50/50 border border-brand-100 p-2 rounded-md">
                        <span className="mt-0.5 text-brand-500">•</span>
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
