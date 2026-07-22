import api from './api'
import type { AuthResponse, LoginRequest, RegisterRequest, UserInfo } from '../types'

export const authService = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>('/auth/login', data)
    return res.data
  },

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>('/auth/register', data)
    return res.data
  },

  async googleLogin(idToken: string): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>('/auth/google', { idToken })
    return res.data
  },

  async me(): Promise<UserInfo> {
    const res = await api.get<UserInfo>('/auth/me')
    return res.data
  },

  saveSession(auth: AuthResponse) {
    localStorage.setItem('token', auth.token)
    localStorage.setItem('user', JSON.stringify(auth.user))
  },

  getUser(): UserInfo | null {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  },

  logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  },

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token')
  },
}
