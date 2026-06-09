import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useGuard } from '@authing/guard-react18'

export default function AuthGuard() {
  const guard = useGuard()
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const check = async () => {
      const status = await guard.checkLoginStatus()
      if (status?.status) {
        setReady(true)
      } else {
        navigate('/login', { replace: true })
      }
    }
    check()
  }, [guard, navigate])

  if (!ready) {
    return <div>加载中...</div>  // 可换成和 Callback 类似的 loading UI
  }

  return <Outlet />
}