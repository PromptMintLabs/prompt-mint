import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  Eye,
  EyeOff,
  Trash2,
  Settings,
  Loader2,
  ShoppingBag,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRecentlyViewed, type UseRecentlyViewedReturn } from '@/hooks/useRecentlyViewed';
import { PromptHashClient } from '@/lib/stellar/promptHashClient';
import { browserStellarConfig } from '@/lib/stellar/browserConfig';
import { formatPriceLabel } from '@/lib/stellar/format';

const promptImageFallback = '/images/codeguru.png';

function RecentlyViewedCard({
  entry,
  onRemove,
  isRemoving,
}: {
  entry: UseRecentlyViewedReturn['entries'][0];
  onRemove: (promptId: string) => void;
  isRemoving: boolean;
}) {
  // Fetch full prompt data for display
  const { data: prompt, isLoading } = useQuery({
    queryKey: ['prompt-detail', entry.promptId],
    queryFn: () => PromptHashClient.getPrompt(browserStellarConfig, BigInt(entry.promptId)),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const displayTitle = prompt?.title || entry.title || 'Untitled Prompt';
  const displayImage = prompt?.imageUrl || entry.imageUrl || promptImageFallback;
  const displayPrice = prompt?.priceStroops || entry.priceStroops;
  const displayCategory = prompt?.category || entry.category;

  const viewedDate = new Date(entry.viewedAt);
  const timeAgo = getTimeAgo(viewedDate);

  return (
    <article className="overflow-hidden rounded-xl border border-white/10 bg-[#0f1419] transition-colors hover:border-white/[0.18]">
      <div className="flex gap-4 p-4">
        {/* Image */}
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg">
          <img
            src={displayImage}
            alt={displayTitle}
            className="h-full w-full object-cover"
          />
          <div className="absolute bottom-1 left-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-950/80 px-2 py-0.5 text-[10px] font-medium text-slate-300 backdrop-blur-sm">
              <Eye className="h-2.5 w-2.5" />
              Viewed
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">{displayTitle}</h3>
              {displayCategory && (
                <Badge className="mt-1 border-white/10 bg-white/[0.04] text-slate-300 text-xs">
                  {displayCategory}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-slate-500 hover:text-red-400 hover:bg-red-400/10"
              onClick={() => onRemove(entry.promptId)}
              disabled={isRemoving}
              aria-label={`Remove ${displayTitle} from recently viewed`}
            >
              {isRemoving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="mt-2 flex items-center gap-3">
            {displayPrice && (
              <span className="text-sm font-semibold text-white">
                {formatPriceLabel(displayPrice)} XLM
              </span>
            )}
            <span className="text-xs text-slate-500">{timeAgo}</span>
          </div>

          <div className="mt-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 border-white/15 bg-white/[0.03] text-white hover:bg-white/10"
            >
              <Link to={`/prompt/${entry.promptId}`}>
                <ShoppingBag className="h-3.5 w-3.5 mr-1.5" />
                View Listing
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function PrivacyControls({
  config,
  isStorageOk,
  onEnable,
  onDisable,
  onUpdateConfig,
  onClearAll,
  entryCount,
}: {
  config: UseRecentlyViewedReturn['config'];
  isStorageOk: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onUpdateConfig: (config: Partial<UseRecentlyViewedReturn['config']>) => void;
  onClearAll: () => void;
  entryCount: number;
}) {
  const [showSettings, setShowSettings] = useState(false);

  if (!isStorageOk) {
    return (
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <p className="text-xs text-amber-300">
          Local storage is not available. Recently viewed history cannot be stored.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main toggle */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-3">
          {config.enabled ? (
            <Eye className="h-5 w-5 text-cyan-200" />
          ) : (
            <EyeOff className="h-5 w-5 text-slate-500" />
          )}
          <div>
            <p className="text-sm font-medium text-white">
              Recently Viewed History
            </p>
            <p className="text-xs text-slate-400">
              {config.enabled
                ? `Tracking ${entryCount} listing${entryCount !== 1 ? 's' : ''} viewed in the last ${config.retentionDays} days`
                : 'History is disabled. Enable to remember listings you view.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-white/15 bg-white/[0.03] text-white hover:bg-white/10"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant={config.enabled ? 'outline' : 'default'}
            size="sm"
            className={`h-8 ${
              config.enabled
                ? 'border-white/15 bg-white/[0.03] text-white hover:bg-white/10'
                : 'bg-cyan-200 text-slate-950 hover:bg-cyan-100'
            }`}
            onClick={config.enabled ? onDisable : onEnable}
          >
            {config.enabled ? 'Disable' : 'Enable'}
          </Button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && config.enabled && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
          <h4 className="text-sm font-medium text-white">Privacy Settings</h4>
          
          <div className="space-y-2">
            <label className="text-xs text-slate-400">Retention Period</label>
            <select
              value={config.retentionDays}
              onChange={(e) => onUpdateConfig({ retentionDays: Number(e.target.value) })}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-200/50"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400">Maximum Entries</label>
            <select
              value={config.maxEntries}
              onChange={(e) => onUpdateConfig({ maxEntries: Number(e.target.value) })}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-200/50"
            >
              <option value={25}>25 listings</option>
              <option value={50}>50 listings</option>
              <option value={100}>100 listings</option>
              <option value={200}>200 listings</option>
            </select>
          </div>

          <div className="pt-2 border-t border-white/10">
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300"
              onClick={onClearAll}
              disabled={entryCount === 0}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Clear All History
            </Button>
          </div>
        </div>
      )}

      {/* Privacy notice */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <h4 className="text-xs font-medium text-slate-400 mb-2">Privacy Information</h4>
        <ul className="space-y-1 text-xs text-slate-500">
          <li>• History is stored locally on your device only</li>
          <li>• Data is scoped to your connected wallet</li>
          <li>• Switching wallets shows only that wallet's history</li>
          <li>• No browsing data is sent to our servers</li>
          <li>• You can disable tracking or clear history at any time</li>
        </ul>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
      <div className="max-w-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-200/10 text-cyan-100">
          <Clock className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-white">No recently viewed listings</h3>
        <p className="mt-2 text-sm text-slate-400">
          Listings you view will appear here for quick access.
        </p>
        <Button
          asChild
          className="mt-4 h-9 px-5 bg-cyan-200 text-slate-950 hover:bg-cyan-100"
        >
          <Link to="/browse">
            <ShoppingBag className="h-4 w-4 mr-1.5" />
            Browse Marketplace
          </Link>
        </Button>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] p-8 text-sm text-slate-300">
      <Loader2 className="mr-2 h-4 w-4 animate-spin text-cyan-200" />
      Loading recently viewed...
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface RecentlyViewedProps {
  walletAddress: string | null;
}

export function RecentlyViewed({ walletAddress }: RecentlyViewedProps) {
  const {
    entries,
    config,
    isStorageOk,
    addEntry,
    removeEntry,
    clearAll,
    enable,
    disable,
    updateConfig,
  } = useRecentlyViewed(walletAddress);

  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = async (promptId: string) => {
    setRemovingId(promptId);
    try {
      removeEntry(promptId);
    } finally {
      setRemovingId(null);
    }
  };

  if (!walletAddress) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="h-5 w-5 text-cyan-200" />
          <h3 className="text-lg font-semibold text-white">Recently Viewed</h3>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <p className="text-sm text-slate-400">
            Connect your wallet to see recently viewed listings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Clock className="h-5 w-5 text-cyan-200" />
        <h3 className="text-lg font-semibold text-white">Recently Viewed</h3>
      </div>

      {/* Privacy Controls */}
      <PrivacyControls
        config={config}
        isStorageOk={isStorageOk}
        onEnable={enable}
        onDisable={disable}
        onUpdateConfig={updateConfig}
        onClearAll={clearAll}
        entryCount={entries.length}
      />

      {/* Entries list */}
      {config.enabled && (
        <div className="space-y-3">
          {entries.length === 0 ? (
            <EmptyState />
          ) : (
            entries.map((entry) => (
              <RecentlyViewedCard
                key={entry.promptId}
                entry={entry}
                onRemove={handleRemove}
                isRemoving={removingId === entry.promptId}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
