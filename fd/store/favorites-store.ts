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
      addFavorite: (product) => {
        const exists = get().items.some(item => item._id === product._id);
        if (!exists) {
          set((state) => ({ items: [...state.items, product] }));
        }
      },
      removeFavorite: (productId) => {
        set((state) => ({
          items: state.items.filter(item => item._id !== productId),
        }));
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
    }
  )
);
