import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  size?: string;
}

interface CartStore {
  items: CartItem[];
  ownerKey: string;
  itemsByOwner: Record<string, CartItem[]>;
  setOwner: (ownerKey: string) => void;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, size?: string) => void;
  updateQuantity: (productId: string, quantity: number, size?: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      ownerKey: 'guest',
      itemsByOwner: { guest: [] },
      setOwner: (ownerKey) => {
        const normalizedOwner = ownerKey || 'guest';
        const state = get();
        const ownerItems = state.itemsByOwner[normalizedOwner] || [];
        if (state.ownerKey === normalizedOwner) return;
        set({
          ownerKey: normalizedOwner,
          items: ownerItems,
        });
      },
      addItem: (item) => {
        const state = get();
        const existingItem = state.items.find(
          i => i.productId === item.productId && i.size === item.size
        );
        if (existingItem) {
          set((state) => ({
            items: state.items.map(i =>
              i.productId === item.productId && i.size === item.size
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            ),
            itemsByOwner: {
              ...state.itemsByOwner,
              [state.ownerKey]: state.items.map(i =>
                i.productId === item.productId && i.size === item.size
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i
              ),
            },
          }));
        } else {
          set((state) => {
            const updatedItems = [...state.items, item];
            return {
              items: updatedItems,
              itemsByOwner: {
                ...state.itemsByOwner,
                [state.ownerKey]: updatedItems,
              },
            };
          });
        }
      },
      removeItem: (productId, size) => {
        set((state) => {
          const updatedItems = state.items.filter(
            i => !(i.productId === productId && i.size === size)
          );
          return {
            items: updatedItems,
            itemsByOwner: {
              ...state.itemsByOwner,
              [state.ownerKey]: updatedItems,
            },
          };
        });
      },
      updateQuantity: (productId, quantity, size) => {
        if (quantity <= 0) {
          get().removeItem(productId, size);
          return;
        }
        set((state) => {
          const updatedItems = state.items.map(i =>
            i.productId === productId && i.size === size ? { ...i, quantity } : i
          );
          return {
            items: updatedItems,
            itemsByOwner: {
              ...state.itemsByOwner,
              [state.ownerKey]: updatedItems,
            },
          };
        });
      },
      clearCart: () => {
        set((state) => ({
          items: [],
          itemsByOwner: {
            ...state.itemsByOwner,
            [state.ownerKey]: [],
          },
        }));
      },
      getTotal: () => {
        return get().items.reduce((total, item) => total + item.price * item.quantity, 0);
      },
      getItemCount: () => {
        return get().items.reduce((count, item) => count + item.quantity, 0);
      },
    }),
    {
      name: 'cart-storage',
      version: 2,
      migrate: (persistedState: any, version) => {
        if (!persistedState) return persistedState;
        if (version < 2) {
          const legacyItems = Array.isArray(persistedState.items) ? persistedState.items : [];
          return {
            ...persistedState,
            ownerKey: 'guest',
            items: legacyItems,
            itemsByOwner: { guest: legacyItems },
          };
        }
        return persistedState;
      },
      partialize: (state) => ({
        items: state.items,
        ownerKey: state.ownerKey,
        itemsByOwner: state.itemsByOwner,
      }),
    }
  )
);
