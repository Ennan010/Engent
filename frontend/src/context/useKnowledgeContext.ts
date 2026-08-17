import { useContext } from 'react'
import { KnowledgeContext } from './knowledgeContext'

export function useKnowledgeContext() {
  const ctx = useContext(KnowledgeContext)
  if (!ctx) {
    throw new Error('useKnowledgeContext 必须在 KnowledgeProvider 内使用')
  }
  return ctx
}
