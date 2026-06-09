import { useGuard } from '@authing/guard-react18';
import { useEffect } from 'react';

export default function Login(){
    const guard = useGuard();
    useEffect(()=>{
        guard.startWithRedirect();
    },[guard])
    return (
        <div>
            <h1>Login</h1>
        </div>
    )
}