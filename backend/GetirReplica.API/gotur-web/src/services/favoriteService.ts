import api from './api'
import type { FavoriteDto } from '../types'

export const favoriteService = {
  // Kullanıcının favori restoranlarını getir
  getAll(): Promise<FavoriteDto[]> {
    return api.get<FavoriteDto[]>('/favorites').then(r => r.data)
  },

  // Restoran favorilere ekle
  add(restaurantId: string): Promise<void> {
    return api.post('/favorites', { restaurantId }).then(() => undefined)
  },

  // Restoran favorilerden çıkar
  remove(restaurantId: string): Promise<void> {
    return api.delete(`/favorites/${restaurantId}`).then(() => undefined)
  },

  // Belirli bir restoranın favori olup olmadığını kontrol et
  isFavorite(restaurantId: string): Promise<boolean> {
    return api
      .get<{ restaurantId: string; isFavorite: boolean }>(`/favorites/${restaurantId}/status`)
      .then(r => r.data.isFavorite)
  },
}
