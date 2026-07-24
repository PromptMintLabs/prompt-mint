import { Link } from 'react-router-dom';
import { useCart, MAX_CART_ITEMS } from '@/providers/CartProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, X, Trash2 } from 'lucide-react';

const promptImageFallback = '/images/codeguru.png';

function formatPrice(stroops: bigint): string {
  const xlm = Number(stroops) / 10_000_000;
  return `${xlm.toLocaleString('en-US', { maximumFractionDigits: 7 })} XLM`;
}

interface CartItemCardProps {
  item: {
    promptId: string;
    title: string;
    priceStroops: bigint;
    imageUrl: string;
    category: string;
    creator: string;
  };
  onRemove: (promptId: string) => void;
}

function CartItemCard({ item, onRemove }: CartItemCardProps) {
  return (
    <article className="flex gap-3 rounded-xl border border-white/10 bg-[#0f1419] p-3 transition-colors hover:border-white/[0.18]">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
        <img
          src={item.imageUrl || promptImageFallback}
          alt={item.title}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium text-white truncate">{item.title}</h4>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-slate-500 hover:text-red-400 hover:bg-red-400/10 shrink-0"
            onClick={() => onRemove(item.promptId)}
            aria-label={`Remove ${item.title} from cart`}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Badge className="border-white/10 bg-white/[0.04] text-slate-300 text-[10px]">
            {item.category}
          </Badge>
          <span className="text-xs font-semibold text-white">{formatPrice(item.priceStroops)}</span>
        </div>
      </div>
    </article>
  );
}

interface CartProps {
  onCheckout?: () => void;
}

export function Cart({ onCheckout }: CartProps) {
  const { state, removeItem, clearCart, totalStroops, itemCount } = useCart();

  if (itemCount === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
        <ShoppingBag className="mx-auto h-8 w-8 text-slate-500" />
        <p className="mt-2 text-sm text-slate-400">Your cart is empty</p>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="mt-3 border-white/15 bg-white/[0.03] text-white hover:bg-white/10"
        >
          <Link to="/browse">Browse listings</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">
          Cart ({itemCount}/{MAX_CART_ITEMS})
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-slate-400 hover:text-red-400"
          onClick={clearCart}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Clear
        </Button>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {state.items.map((item) => (
          <CartItemCard
            key={item.promptId}
            item={item}
            onRemove={removeItem}
          />
        ))}
      </div>

      <div className="border-t border-white/10 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Total</span>
          <span className="text-lg font-bold text-white">{formatPrice(totalStroops)}</span>
        </div>
      </div>

      {onCheckout && (
        <Button
          className="w-full h-11 bg-cyan-200 text-slate-950 hover:bg-cyan-100"
          onClick={onCheckout}
        >
          <ShoppingBag className="h-4 w-4 mr-2" />
          Checkout {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </Button>
      )}
    </div>
  );
}

export function CartIcon() {
  const { itemCount } = useCart();

  return (
    <div className="relative">
      <ShoppingBag className="h-5 w-5" />
      {itemCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-200 text-[10px] font-bold text-slate-950">
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </div>
  );
}
