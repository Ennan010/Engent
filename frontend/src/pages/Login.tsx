import { lazy, Suspense } from 'react';

// 登录页懒加载 Guard（含 guard.js 2.5MB / guard.min.css 497KB），
// 只在进入 /login 时下载，已登录用户访问首页/回调页不受影响
const GuardLogin = lazy(() => import('./GuardLogin'));

export default function Login() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">正在跳转至登录...</div>}>
            <GuardLogin />
        </Suspense>
    )
}
