import { getSignalingHttpBase } from './signaling'

export type BackendTemplate = {
  id: string
  account: string
  name: string
  criteria: string[]
  coding_questions: string[]
}

export async function fetchTemplatesForAccount(account: string): Promise<BackendTemplate[]> {
  if (!account) return []
  const base = getSignalingHttpBase()
  const res = await fetch(`${base}/templates?account=${encodeURIComponent(account)}`)
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function fetchTemplateById(account: string, id: string): Promise<BackendTemplate | null> {
  if (!account || !id) return null
  const base = getSignalingHttpBase()
  const res = await fetch(`${base}/templates/${id}?account=${encodeURIComponent(account)}`)
  if (!res.ok) return null
  const data = await res.json()
  return data as BackendTemplate
}
