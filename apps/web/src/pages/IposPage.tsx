import { Rocket, TrendingUp, Users, AlertCircle } from 'lucide-react';
import { useUpcomingIpos } from '../lib/api';
import { Badge, Card, Spinner } from '../components/ui';

export function IposPage() {
  const { data: ipos, isLoading, error } = useUpcomingIpos();

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
      </header>

      {ipos?.length === 0 ? (
        <Card className="p-8 text-center text-ink-500">
          No upcoming IPOs found at this time.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ipos?.map((ipo) => (
            <Card key={ipo.symbol} className="overflow-hidden flex flex-col relative transition-all hover:shadow-md">
              {ipo.isElite && (
                <div className="absolute top-0 left-0 w-full bg-gradient-to-r from-amber-500 to-orange-400 py-1 px-4 text-xs font-bold text-white shadow-sm flex items-center justify-center gap-1">
                  💎 ELITE GRADE
                </div>
              )}
              
              <div className={`p-5 flex-1 ${ipo.isElite ? 'pt-8' : ''}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-ink-900 text-lg leading-tight">{ipo.companyName}</h3>
                    <div className="text-xs font-medium text-ink-500 mt-0.5">{ipo.symbol}</div>
                  </div>
                  <Badge tone={ipo.isElite ? 'success' : 'neutral'}>
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

                <div className="mt-5 p-3 bg-ink-50 rounded-lg space-y-2">
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
                  <div className="mt-4 space-y-1">
                    {ipo.eliteReasons.map((reason, idx) => (
                      <div key={idx} className="text-xs flex items-start gap-1.5 text-amber-700 bg-amber-50 p-1.5 rounded">
                        <span className="mt-0.5">•</span>
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
