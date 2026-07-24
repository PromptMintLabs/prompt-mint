import { usePromotionalPrice } from '@/hooks/usePromotionalPrice';
import { Badge } from '@/components/ui/badge';
import { Clock, Zap } from 'lucide-react';
import { formatPriceLabel } from '@/lib/stellar/format';

interface PromotionalPriceDisplayProps {
  promptId: string;
  basePrice: bigint;
  showOriginal?: boolean;
  showTimer?: boolean;
  className?: string;
}

function formatTimeRemaining(endTime: number): string {
  const now = Date.now();
  const end = endTime * 1000;
  const diff = end - now;

  if (diff <= 0) return 'Expired';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatDiscountPercent(original: bigint, promotional: bigint): number {
  if (original <= 0n) return 0;
  const discount = original - promotional;
  return Number((discount * 100n) / original);
}

export function PromotionalPriceDisplay({
  promptId,
  basePrice,
  showOriginal = true,
  showTimer = true,
  className = '',
}: PromotionalPriceDisplayProps) {
  const {
    effectivePrice,
    isPromotional,
    promotion,
    originalPrice,
    isLoading,
    refresh,
  } = usePromotionalPrice(promptId, basePrice);

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-6 w-24 bg-white/10 rounded"></div>
      </div>
    );
  }

  if (!isPromotional || !promotion) {
    return (
      <span className={className}>
        {formatPriceLabel(basePrice)}
      </span>
    );
  }

  const discountPercent = formatDiscountPercent(originalPrice, effectivePrice);
  const timeRemaining = formatTimeRemaining(promotion.endTime);

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-emerald-400">
          {formatPriceLabel(effectivePrice)}
        </span>
        {showOriginal && (
          <span className="text-sm text-slate-500 line-through">
            {formatPriceLabel(originalPrice)}
          </span>
        )}
        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
          <Zap className="h-3 w-3 mr-1" />
          {discountPercent}% OFF
        </Badge>
      </div>
      {showTimer && (
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Clock className="h-3 w-3" />
          <span>Promo ends in {timeRemaining}</span>
        </div>
      )}
    </div>
  );
}

interface PromotionBadgeProps {
  promptId: string;
  basePrice: bigint;
}

export function PromotionBadge({ promptId, basePrice }: PromotionBadgeProps) {
  const { isPromotional, promotion } = usePromotionalPrice(promptId, basePrice);

  if (!isPromotional || !promotion) {
    return null;
  }

  const now = Date.now();
  const startTime = promotion.startTime * 1000;
  const endTime = promotion.endTime * 1000;

  let status: 'upcoming' | 'active' | 'ended' = 'ended';
  if (now < startTime) status = 'upcoming';
  else if (now < endTime) status = 'active';

  const statusColors = {
    upcoming: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    ended: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };

  return (
    <Badge className={statusColors[status]}>
      <Zap className="h-3 w-3 mr-1" />
      {status === 'upcoming' ? 'Promo Soon' : status === 'active' ? 'On Sale' : 'Promo Ended'}
    </Badge>
  );
}
