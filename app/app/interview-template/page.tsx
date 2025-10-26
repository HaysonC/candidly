'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft, RefreshCcw, Trash } from 'lucide-react'
import { getSignalingHttpBase } from '@/lib/signaling'
import { fetchTemplatesForAccount, deleteTemplate } from '@/lib/templates'
import { Spinner } from '@/components/ui/spinner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'

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
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { toast } = useToast()

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
            <Card
              key={t.id}
              className="p-4 cursor-pointer hover:bg-accent/30"
              onClick={() => router.push(`/interview-template/${t.id}`)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="mb-1 break-words">{t.name || 'Untitled template'}</CardTitle>
                  <CardDescription>
                    {t.criteria.length} criteria • {t.coding_questions.length} coding questions
                  </CardDescription>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="shrink-0"
                      onClick={(e) => e.stopPropagation()}
                      disabled={deletingId === t.id}
                      aria-label="Delete template"
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this template?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete “{t.name || 'Untitled template'}”.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (!username) return
                          try {
                            setDeletingId(t.id)
                            await deleteTemplate(username, t.id)
                            setTemplates((prev) => prev.filter((x) => x.id !== t.id))
                            toast({ title: 'Template deleted' })
                          } catch (err: any) {
                            toast({ title: 'Delete failed', description: err?.message || 'Could not delete template', variant: 'destructive' })
                          } finally {
                            setDeletingId(null)
                          }
                        }}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
