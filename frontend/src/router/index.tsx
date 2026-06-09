import { useRoutes } from "react-router-dom";
// import Home from '../pages/Home'
import Login from '../pages/Login'
import ChatPage from '../pages/ChatPage'
import Callback from '../pages/Callback'
import AuthGuard from "../components/AuthGuard";
import AppLayout from "../components/AppLayout";

export default function Router() {
    return useRoutes([
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

}