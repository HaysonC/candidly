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
  const res = await fetch(`${base}/templates?account=${encodeURIComponent(account)}`, {
    headers: {
      'ngrok-skip-browser-warning': 'true',
    },
  })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function fetchTemplateById(account: string, id: string): Promise<BackendTemplate | null> {
  if (!account || !id) return null
  const base = getSignalingHttpBase()
  const res = await fetch(`${base}/templates/${id}?account=${encodeURIComponent(account)}`, {
    headers: {
      'ngrok-skip-browser-warning': 'true',
    },
  })
  if (!res.ok) return null
  const data = await res.json()
  return data as BackendTemplate
}

export async function createTemplate(
  account: string,
  payload: { name: string; criteria: string[]; coding_questions: string[] }
): Promise<BackendTemplate> {
  if (!account) throw new Error('account is required')
  const base = getSignalingHttpBase()
  const res = await fetch(`${base}/templates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify({ account, ...payload }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(txt || 'Failed to create template')
  }
  return res.json()
}

export async function updateTemplate(
  account: string,
  id: string,
  payload: { name: string; criteria: string[]; coding_questions: string[] }
): Promise<BackendTemplate> {
  if (!account) throw new Error('account is required')
  if (!id) throw new Error('id is required')
  const base = getSignalingHttpBase()
  const res = await fetch(`${base}/templates/${id}?account=${encodeURIComponent(account)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(txt || 'Failed to update template')
  }
  return res.json()
}

export async function deleteTemplate(
  account: string,
  id: string,
): Promise<{ deleted: boolean; id: string; name?: string }> {
  if (!account) throw new Error('account is required')
  if (!id) throw new Error('id is required')
  const base = getSignalingHttpBase()
  const res = await fetch(`${base}/templates/${id}?account=${encodeURIComponent(account)}`, {
    method: 'DELETE',
    headers: {
      'ngrok-skip-browser-warning': 'true',
    },
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(txt || 'Failed to delete template')
  }
  return res.json()
}
