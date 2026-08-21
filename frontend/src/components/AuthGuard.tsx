import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { getToken } from '../api/token'
import { http } from '../api/http'

/**
 * 路由守卫：通过后端代理验证登录态（GET /api/auth/me）。
 * 不再使用 guard.checkLoginStatus() —— 该方法依赖 Authing 域名的会话 Cookie，
 * 本站为 IP + http 访问，跨站请求不携带 SameSite Cookie，会永远判定未登录。
 */
export default function AuthGuard() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const check = async () => {
      try {
        if (!getToken()) throw new Error('未登录')
        await http.get('/auth/me')
        setReady(true)
      } catch {
        navigate('/login', { replace: true })
      }
    }
    check()
  }, [navigate])

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">加载中...</div>
  }

  return <Outlet />
}
