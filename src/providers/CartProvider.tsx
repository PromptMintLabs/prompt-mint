import { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react';

export interface CartItem {
  promptId: string;
  title: string;
  priceStroops: bigint;
  imageUrl: string;
  category: string;
  creator: string;
}

export interface CartState {
  items: CartItem[];
  isCheckingOut: boolean;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_ITEM_PRICE'; payload: { promptId: string; priceStroops: bigint } }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_CHECKING_OUT'; payload: boolean };

interface CartContextValue {
  state: CartState;
  addItem: (item: CartItem) => boolean;
  removeItem: (promptId: string) => void;
  updateItemPrice: (promptId: string, priceStroops: bigint) => void;
  clearCart: () => void;
  setCheckingOut: (checkingOut: boolean) => void;
  totalStroops: bigint;
  itemCount: number;
  hasItem: (promptId: string) => boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

const MAX_CART_ITEMS = 20;

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      if (state.items.length >= MAX_CART_ITEMS) {
        return state;
      }
      if (state.items.some((item) => item.promptId === action.payload.promptId)) {
        return state;
      }
      return { ...state, items: [...state.items, action.payload] };
    }
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((item) => item.promptId !== action.payload),
      };
    case 'UPDATE_ITEM_PRICE':
      return {
        ...state,
        items: state.items.map((item) =>
          item.promptId === action.payload.promptId
            ? { ...item, priceStroops: action.payload.priceStroops }
            : item
        ),
      };
    case 'CLEAR_CART':
      return { ...state, items: [] };
    case 'SET_CHECKING_OUT':
      return { ...state, isCheckingOut: action.payload };
    default:
      return state;
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    isCheckingOut: false,
  });

  const addItem = useCallback((item: CartItem): boolean => {
    if (state.items.length >= MAX_CART_ITEMS) {
      return false;
    }
    if (state.items.some((i) => i.promptId === item.promptId)) {
      return false;
    }
    dispatch({ type: 'ADD_ITEM', payload: item });
    return true;
  }, [state.items.length]);

  const removeItem = useCallback((promptId: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: promptId });
  }, []);

  const updateItemPrice = useCallback((promptId: string, priceStroops: bigint) => {
    dispatch({ type: 'UPDATE_ITEM_PRICE', payload: { promptId, priceStroops } });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' });
  }, []);

  const setCheckingOut = useCallback((checkingOut: boolean) => {
    dispatch({ type: 'SET_CHECKING_OUT', payload: checkingOut });
  }, []);

  const totalStroops = state.items.reduce((sum, item) => sum + item.priceStroops, 0n);
  const itemCount = state.items.length;
  const hasItem = useCallback((promptId: string) => state.items.some((i) => i.promptId === promptId), [state.items]);

  return (
    <CartContext.Provider
      value={{
        state,
        addItem,
        removeItem,
        updateItemPrice,
        clearCart,
        setCheckingOut,
        totalStroops,
        itemCount,
        hasItem,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

export { MAX_CART_ITEMS };
