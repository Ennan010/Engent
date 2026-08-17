import axios, { type AxiosRequestConfig } from 'axios'
import { clearToken, getToken } from './token'

const instance = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// 请求拦截：注入 Bearer Token
instance.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截：解包业务数据，统一处理 401
instance.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      clearToken()
      // 整页跳转登录页，重置应用状态
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

/** 类型安全的请求方法：直接返回业务数据（已解包 AxiosResponse） */
export const http = {
  get: <T>(url: string, config?: AxiosRequestConfig) => instance.get<T, T>(url, config),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    instance.post<T, T>(url, data, config),
  delete: <T>(url: string, config?: AxiosRequestConfig) => instance.delete<T, T>(url, config),
}

export default instance
