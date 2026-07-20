import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

interface LocationState { returnTo?: string }

// /login rotasına gelindiğinde anasayfaya yönlendir.
// HomePage openLogin state'ini algılayıp modal açar.
export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null
  const redirected = useRef(false)

  useEffect(() => {
    if (redirected.current) return
    redirected.current = true
    navigate('/', { replace: true, state: { openLogin: true, returnTo: state?.returnTo } })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
