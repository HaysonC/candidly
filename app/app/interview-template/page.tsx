'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft, RefreshCcw } from 'lucide-react'
import { getSignalingHttpBase } from '@/lib/signaling'
import { fetchTemplatesForAccount } from '@/lib/templates'
import { Spinner } from '@/components/ui/spinner'

interface Template {
  id: string
  name: string
  criteria: string[]
  coding_questions: string[]
}

export default function InterviewTemplatePage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [username, setUsername] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const name = sessionStorage.getItem('interviewer_name') || ''
    setUsername(name)
    if (!name) return
    const load = async () => {
      setLoading(true)
      try {
        const data = await fetchTemplatesForAccount(name)
        setTemplates(Array.isArray(data) ? data : [])
      } catch {
        setTemplates([])
      } finally {
        setLoading(false)
      }
    }
    load()
    const onVis = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold">Interview Templates</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.location.reload()} disabled={loading}>
            <RefreshCcw className="w-4 h-4 mr-2" /> {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button onClick={() => router.push('/interview-template/new')}>+ New Template</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner className="w-8 h-8 text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <Card className="p-6">
          <CardHeader className="p-0 mb-2">
            <CardTitle>No templates yet</CardTitle>
            <CardDescription>Create your first template to get started.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Button onClick={() => router.push('/interview-template/new')}>Create Template</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((t) => (
            <Card key={t.id} className="p-4 cursor-pointer" onClick={() => router.push(`/interview-template/${t.id}`)}>
              <CardTitle className="mb-1">{t.name}</CardTitle>
              <CardDescription>
                {t.criteria.length} criteria • {t.coding_questions.length} coding questions
              </CardDescription>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
