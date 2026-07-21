import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Her istekte localStorage'daki token'ı ekle
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 401 gelirse session'ı temizle ama background istekler için zorla yönlendirme yapma
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      // Sadece kullanıcı zaten bir sayfadaysa yönlendir,
      // arka plan istekler (active order vb.) için sessizce hata döndür
      const isBackgroundRequest = err.config?.url?.includes('/orders/active')
      if (!isBackgroundRequest) {
        window.location.href = '/?sessionExpired=1'
      }
    }
    return Promise.reject(err)
  }
)

export default api
