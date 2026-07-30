import api from './api'
import type { ReviewDto, CreateReviewDto } from '../types'

export const reviewService = {
  // Restoranın yorumlarını getir (auth gerekmez)
  getByRestaurant(restaurantId: string): Promise<ReviewDto[]> {
    return api.get<ReviewDto[]>(`/reviews/restaurant/${restaurantId}`).then(r => r.data)
  },

  // Yorum ekle (auth gerekir)
  add(dto: CreateReviewDto): Promise<void> {
    return api.post('/reviews', dto).then(() => undefined)
  },

  // Yorum güncelle (auth gerekir, sadece kendi yorumunu)
  update(reviewId: string, dto: CreateReviewDto): Promise<void> {
    return api.put(`/reviews/${reviewId}`, dto).then(() => undefined)
  },

  // Yorum sil (auth gerekir, sadece kendi yorumunu)
  remove(reviewId: string): Promise<void> {
    return api.delete(`/reviews/${reviewId}`).then(() => undefined)
  },
}
