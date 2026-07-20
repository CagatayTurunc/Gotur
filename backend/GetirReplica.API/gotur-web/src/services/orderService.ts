import api from './api'
import type { CreateOrderRequest, Order, LocationDto, PagedResult } from '../types'

export const orderService = {
  async createOrder(data: CreateOrderRequest): Promise<Order> {
    const res = await api.post<Order>('/orders', data)
    return res.data
  },

  async getOrder(id: string): Promise<Order> {
    const res = await api.get<Order>(`/orders/${id}`)
    return res.data
  },

  async getOrders(params?: Record<string, string | number>): Promise<PagedResult<Order>> {
    const res = await api.get<PagedResult<Order>>('/orders', { params })
    return res.data
  },

  async getMyOrders(params?: Record<string, string | number>): Promise<PagedResult<Order>> {
    const res = await api.get<PagedResult<Order>>('/orders/my', { params })
    return res.data
  },

  async updateStatus(id: string, status: string): Promise<Order> {
    const res = await api.patch<Order>(`/orders/${id}/status`, { status })
    return res.data
  },

  async getTracking(id: string): Promise<LocationDto | null> {
    const res = await api.get<LocationDto>(`/orders/${id}/tracking`)
    return res.data
  },

  async getAdminOrders(params?: Record<string, string | number>): Promise<PagedResult<Order>> {
    const res = await api.get<PagedResult<Order>>('/admin/orders', { params })
    return res.data
  },

  async cancelOrder(id: string): Promise<Order> {
    const res = await api.post<Order>(`/orders/${id}/cancel`)
    return res.data
  },

  async getActiveOrder(): Promise<Order | null> {
    try {
      const res = await api.get<Order>('/orders/active')
      return res.data
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 204 || status === 404) return null
      throw err
    }
  },
}
