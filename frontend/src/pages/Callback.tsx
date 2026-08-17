// Callback.tsx
// React 18
// 代码示例：https://github.com/Authing/Guard/blob/v5/examples/guard-react18/normal/src/pages/Callback.tsx
import type { JwtTokenStatus, User } from '@authing/guard-react18';
import { useGuard } from '@authing/guard-react18';

import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';


export default function Callback() {
    const navigate = useNavigate()
    const guard = useGuard()

    const handleCallback = useCallback(async () => {
        try {
            // 1. 触发 guard.handleRedirectCallback() 方法完成登录认证
            // 用户认证成功之后，我们会将用户的身份凭证存到浏览器的本地缓存中
            await guard.handleRedirectCallback()

            // 2. 处理完 handleRedirectCallback 之后，你需要先检查用户登录态是否正常
            const loginStatus: JwtTokenStatus | undefined = await guard.checkLoginStatus()

            if (!loginStatus) {
                return console.error('Guard is not get login status')
            }

            // 3. 获取到登录用户的用户信息
            const userInfo: User | null = await guard.trackSession()

            console.log(userInfo)

            // 你也可以重定向到你的任意业务页面，比如重定向到用户的个人中心
            // 如果你希望实现登录后跳转到同一页面的效果，可以通过在调用 startWithRedirect 时传入的自定义 state 实现
            // 之后你在这些页面可以通过 trackSession 方法获取用户登录态和用户信息

            // 示例一：跳转到固定页面
            navigate('/')

            // 示例二：获取自定义 state，进行特定操作
            // const search = window.location.search
            // 从 URL search 中解析 state
        } catch (e) {
            // 登录失败，推荐再次跳转到登录页面
            console.error('Guard handleAuthingLoginCallback error: ', e)
            navigate('/login', { replace: true })
        }
    }, [navigate, guard])

    const handledRef = useRef(false)

    useEffect(() => {
        const run = async () => {
            if (handledRef.current) return
            handledRef.current = true
            await handleCallback()
        }
        run()
    }, [handleCallback])

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <p className="mt-2 text-sm text-gray-500">正在为您跳转，请稍候</p>
          </div>
        </div>
      )
}
