import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FavoriteProduct {
  _id: string;
  name: string;
  price: number;
  code?: string;
  image?: string;
  category?: string;
}

interface FavoritesStore {
  items: FavoriteProduct[];
  ownerKey: string;
  itemsByOwner: Record<string, FavoriteProduct[]>;
  setOwner: (ownerKey: string) => void;
  addFavorite: (product: FavoriteProduct) => void;
  removeFavorite: (productId: string) => void;
  toggleFavorite: (product: FavoriteProduct) => void;
  isFavorite: (productId: string) => boolean;
  getCount: () => number;
}

export const useFavoritesStore = create<FavoritesStore>()(
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
      addFavorite: (product) => {
        const exists = get().items.some(item => item._id === product._id);
        if (!exists) {
          set((state) => {
            const updatedItems = [...state.items, product];
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
      removeFavorite: (productId) => {
        set((state) => {
          const updatedItems = state.items.filter(item => item._id !== productId);
          return {
            items: updatedItems,
            itemsByOwner: {
              ...state.itemsByOwner,
              [state.ownerKey]: updatedItems,
            },
          };
        });
      },
      toggleFavorite: (product) => {
        const exists = get().items.some(item => item._id === product._id);
        if (exists) {
          get().removeFavorite(product._id);
        } else {
          get().addFavorite(product);
        }
      },
      isFavorite: (productId) => {
        return get().items.some(item => item._id === productId);
      },
      getCount: () => {
        return get().items.length;
      },
    }),
    {
      name: 'favorites-storage',
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
