// Callback.tsx
// 登录回调：授权码换 token 改为走后端代理（后端服务器直连 Authing，避免浏览器跨域 Cookie 问题）
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { http } from '../api/http';

interface TokenResponse {
  access_token: string
  id_token: string | null
}

export default function Callback() {
    const navigate = useNavigate()
    const handledRef = useRef(false)

    useEffect(() => {
        if (handledRef.current) return
        handledRef.current = true

        const run = async () => {
            try {
                // 1. 从 URL 取授权码 code
                const params = new URLSearchParams(window.location.search)
                const code = params.get('code')
                if (!code) throw new Error('URL 中缺少 code 参数')

                // 2. 取出 Guard startWithRedirect 时缓存的 PKCE code_verifier
                const codeVerifier = localStorage.getItem('codeChallenge') ?? ''

                // 3. 后端代理换 token（服务器直连 Authing，不受浏览器跨域/Cookie 影响）
                const res = await http.post<TokenResponse>('/auth/oidc/callback', {
                    code,
                    code_verifier: codeVerifier,
                })
                if (!res?.access_token) throw new Error('未获取到 access_token')

                // 4. 缓存身份凭证（与 Guard 的 key 保持一致，业务 API 读取 accessToken）
                localStorage.setItem('accessToken', res.access_token)
                if (res.id_token) localStorage.setItem('idToken', res.id_token)

                // 5. 跳转主页面
                navigate('/', { replace: true })
            } catch (e) {
                // 登录失败，推荐再次跳转到登录页面
                console.error('登录回调失败: ', e)
                navigate('/login', { replace: true })
            }
        }
        run()
    }, [navigate])

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <p className="mt-2 text-sm text-gray-500">正在为您跳转，请稍候</p>
          </div>
        </div>
      )
}
