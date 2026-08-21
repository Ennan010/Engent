import { useGuard, GuardProvider } from '@authing/guard-react18';
import { useEffect } from 'react';
import "@authing/guard-react18/dist/esm/guard.min.css";

// Guard 只在登录页需要：此模块被 Login.tsx 懒加载，
// 避免 guard.js(2.5MB) 与 guard.min.css(497KB) 在首页/回调页被加载
function LoginInner() {
    const guard = useGuard();
    useEffect(() => {
        guard.startWithRedirect();
    }, [guard])
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <h1 className="text-gray-500">正在跳转至登录...</h1>
        </div>
    )
}

export default function GuardLogin() {
    return (
        <GuardProvider
            appId={import.meta.env.VITE_AUTHING_APP_ID}
            redirectUri={import.meta.env.VITE_AUTHING_REDIRECT_URI}
            // 显式指定 Authing 应用域名（国内版），避免 Guard 默认走慢/不通的国际端点
            host="https://engent.authing.cn"
        >
            <LoginInner />
        </GuardProvider>
    )
}
