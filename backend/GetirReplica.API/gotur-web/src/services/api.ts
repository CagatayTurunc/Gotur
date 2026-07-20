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

// 401 gelirse ve kullanıcı oturum açmışsa login'e yönlendir
// (token yokken public sayfalarda 401 dönen istekler için yönlendirme yapma)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
