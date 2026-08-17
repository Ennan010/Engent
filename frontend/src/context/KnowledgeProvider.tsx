import type { ReactNode } from 'react'
import { KnowledgeContext } from './knowledgeContext'
import { useKnowledge } from '../hooks/useKnowledge'

export function KnowledgeProvider({ children }: { children: ReactNode }) {
  const value = useKnowledge()
  return <KnowledgeContext.Provider value={value}>{children}</KnowledgeContext.Provider>
}
