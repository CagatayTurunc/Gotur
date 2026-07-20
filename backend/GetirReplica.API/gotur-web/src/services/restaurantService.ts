import api from './api'

export interface PartnershipApplication {
  id: string
  restaurantName: string
  ownerName: string
  email: string
  phone: string
  address: string
  city: string
  category: string
  description?: string
  taxNumber?: string
  status: 'Pending' | 'Approved' | 'Rejected'
  adminNote?: string
  createdAt: string
  reviewedAt?: string
}

export interface SubmitApplicationRequest {
  restaurantName: string
  ownerName: string
  email: string
  phone: string
  address: string
  city: string
  category: string
  description?: string
  taxNumber?: string
  password?: string  // giriş yapmadan başvurulduğunda zorunlu
}

export interface MenuItem {
  id: string
  restaurantId: string
  name: string
  description?: string
  price: number
  category?: string
  imageUrl?: string
  isAvailable: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CreateMenuItemRequest {
  name: string
  description?: string
  price: number
  category?: string
  imageUrl?: string
  isAvailable?: boolean
  sortOrder?: number
}

export interface UpdateMenuItemRequest {
  name?: string
  description?: string
  price?: number
  category?: string
  imageUrl?: string
  isAvailable?: boolean
  sortOrder?: number
}

export const restaurantService = {
  // ── Başvuru işlemleri ──────────────────────────────────────
  async submitApplication(data: SubmitApplicationRequest): Promise<PartnershipApplication> {
    const res = await api.post<PartnershipApplication>('/restaurant-applications', data)
    return res.data
  },

  async getMyApplication(id: string): Promise<PartnershipApplication> {
    const res = await api.get<PartnershipApplication>(`/restaurant-applications/${id}`)
    return res.data
  },

  // ── Admin başvuru yönetimi ─────────────────────────────────
  async getApplications(status?: string): Promise<PartnershipApplication[]> {
    const params = status ? { status } : {}
    const res = await api.get<PartnershipApplication[]>('/admin/applications', { params })
    return res.data
  },

  async reviewApplication(id: string, decision: 'approve' | 'reject', note?: string) {
    const res = await api.patch(`/admin/applications/${id}`, { decision, note })
    return res.data
  },

  // ── Menü ürün yönetimi ────────────────────────────────────
  async getMenuItems(restaurantId: string): Promise<MenuItem[]> {
    const res = await api.get<MenuItem[]>(`/restaurants/${restaurantId}/menu`)
    return res.data
  },

  async createMenuItem(restaurantId: string, data: CreateMenuItemRequest): Promise<MenuItem> {
    const res = await api.post<MenuItem>(`/restaurants/${restaurantId}/menu`, data)
    return res.data
  },

  async updateMenuItem(restaurantId: string, itemId: string, data: UpdateMenuItemRequest): Promise<MenuItem> {
    const res = await api.patch<MenuItem>(`/restaurants/${restaurantId}/menu/${itemId}`, data)
    return res.data
  },

  async deleteMenuItem(restaurantId: string, itemId: string): Promise<void> {
    await api.delete(`/restaurants/${restaurantId}/menu/${itemId}`)
  },

  // ── Kendi restoranını bul (restaurant rolü için) ──────────
  async getMyRestaurant(): Promise<{ id: string; name: string; address: string } | null> {
    try {
      const res = await api.get<{ id: string; name: string; address: string }[]>('/restaurants')
      // Sunucu kendi userId'sine göre filtreler (eğer endpoint destekliyorsa)
      // Şimdilik ilk kaydı döndür
      return res.data?.[0] ?? null
    } catch {
      return null
    }
  },
}
