import { lazy, Suspense } from "react";
import { useRoutes } from "react-router-dom";

// 路由级懒加载：登录/回调/聊天/主布局按需加载，减小首屏 bundle 体积
const Login = lazy(() => import('../pages/Login'))
const Callback = lazy(() => import('../pages/Callback'))
const ChatPage = lazy(() => import('../pages/ChatPage'))
const AppLayout = lazy(() => import('../components/AppLayout'))
import AuthGuard from "../components/AuthGuard";

export default function Router() {
    const routes = useRoutes([
        {
            path: "/login",
            element: <Login />
        },
        {
            path: "/callback",
            element: <Callback />
        },
        {
            element: <AuthGuard />,
            children: [
                {
                    path: '/',
                    element: <AppLayout />  ,
                    children:[
                        {
                            index: true,
                            element: <ChatPage />
                        },
                        // 以后可加：{ path: 'settings', element: <Settings /> },
                    ]
                }
            ]
        },

        // 404
        // { path: '*', element: <NotFound /> }
    ])

    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">加载中...</div>}>
            {routes}
        </Suspense>
    )
}
