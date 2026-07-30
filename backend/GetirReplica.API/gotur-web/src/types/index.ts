export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  fullName: string
  role: string
}

export interface UserInfo {
  id: string
  email: string
  fullName: string
  role: string
}

export interface AuthResponse {
  token: string
  expiresAt: string
  user: UserInfo
}

export interface LocationDto {
  latitude: number
  longitude: number
}

export interface OrderItem {
  name: string
  quantity: number
  price: number
}

export interface CreateOrderRequest {
  restaurantId: string
  deliveryAddress: string
  deliveryLocation: LocationDto
  items: OrderItem[]
}

export interface Order {
  id: string
  status: string
  customerId: string
  restaurantId: string
  restaurantName: string
  courierId: string | null
  deliveryAddress: string
  deliveryLocation: LocationDto
  items: OrderItem[]
  createdAt: string
  assignedAt: string | null
  pickedAt: string | null
  deliveredAt: string | null
}

export interface CourierInfo {
  id: string
  userId: string
  fullName: string
  status: string
  currentLocation: LocationDto | null
  lastLocationAt: string | null
}

export interface Restaurant {
  id: string
  name: string
  address: string
  description?: string
  logoUrl?: string
  isOpen: boolean
  locationLat: number
  locationLng: number
}

export interface PagedResult<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
}

// SignalR event payload'ları
export interface LocationUpdatedEvent {
  courierId: string
  latitude: number
  longitude: number
  timestamp: string
}

export interface OrderStatusChangedEvent {
  orderId: string
  status: string
  timestamp: string
}

export interface CourierAssignedEvent {
  orderId: string
  courierId: string
  timestamp: string
}

// ── Favorites ──────────────────────────────────────────────────────────────────
export interface FavoriteDto {
  restaurantId: string
  restaurantName: string
  createdAt: string
}

// ── Reviews ────────────────────────────────────────────────────────────────────
export interface ReviewDto {
  id: string
  userId: string
  userName: string
  rating: number
  comment?: string
  createdAt: string
}

export interface CreateReviewDto {
  restaurantId: string
  rating: number
  comment?: string
}
