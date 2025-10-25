'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Sparkles, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getSignalingHttpBase } from '@/lib/signaling'

interface Template {
  id?: string
  name: string
  criteria: string[]
  coding_questions: string[]
}

export default function EditTemplatePage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const isNew = id === 'new'

  const [template, setTemplate] = useState<Template>({ name: '', criteria: [], coding_questions: [] })
  const [loading, setLoading] = useState(!isNew)
  const [aiContext, setAiContext] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (!isNew) {
      fetch(`/api/templates/${id}`)
        .then((res) => res.json())
        .then((data) => setTemplate(data || { name: '', criteria: [], coding_questions: [] }))
        .finally(() => setLoading(false))
    }
  }, [id, isNew])

  const updateField = (section: 'criteria' | 'coding_questions', index: number, value: string) => {
    setTemplate((prev) => {
      const next = { ...prev }
      next[section] = [...prev[section]]
      next[section][index] = value
      return next
    })
  }

  const addField = (section: 'criteria' | 'coding_questions') => {
    setTemplate((prev) => ({ ...prev, [section]: [...prev[section], ''] }))
  }

  const removeField = (section: 'criteria' | 'coding_questions', index: number) => {
    setTemplate((prev) => {
      const list = [...prev[section]]
      list.splice(index, 1)
      return { ...prev, [section]: list }
    })
  }

  const saveTemplate = async () => {
    const method = isNew ? 'POST' : 'PUT'
    const url = isNew ? '/api/templates' : `/api/templates/${id}`
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template),
    })
    if (res.ok) {
      router.push('/interview-template')
    }
  }

  const generateWithAI = async () => {
    const base = getSignalingHttpBase()
    const text = aiContext.trim() || `Create interview prep for: ${template.name}\n\nExisting criteria:\n- ${template.criteria.join('\n- ')}\n\nExisting questions:\n- ${template.coding_questions.join('\n- ')}`
    setAiBusy(true)
    try {
      const res = await fetch(`${base}/interview-prep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(err || 'AI generation failed')
      }
      const data = await res.json()
      // Map backend schema -> simple editor model
      const areas: string[] = Array.isArray(data?.criteria?.areas)
        ? data.criteria.areas.map((a: any) => a?.name || '').filter(Boolean)
        : []
      const overview: string = (data?.criteria?.overview || '').trim()
      const critList = overview ? [overview, ...areas] : areas
      const questions: string[] = Array.isArray(data?.coding_questions)
        ? data.coding_questions.map((q: any) => (q?.title && q?.prompt ? `${q.title} — ${q.prompt}` : (q?.prompt || q?.title || 'Untitled')))
        : []
      setTemplate((prev) => ({
        ...prev,
        criteria: critList.length ? critList : prev.criteria,
        coding_questions: questions.length ? questions : prev.coding_questions,
      }))
      toast({ title: 'AI Generated', description: 'Template fields updated from AI suggestions.' })
    } catch (e: any) {
      toast({ title: 'AI Error', description: e?.message || 'Failed to generate from AI', variant: 'destructive' })
    } finally {
      setAiBusy(false)
    }
  }

  if (loading) return <div className="p-8">Loading…</div>

  return (
    <div className="p-8 space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => router.push('/interview-template')}>Back</Button>
        <h1 className="text-2xl font-bold">{isNew ? 'New Template' : 'Edit Template'}</h1>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> AI Assistance
            </h2>
            <p className="text-sm text-muted-foreground">Provide context and let AI suggest criteria and questions.</p>
          </div>
          <Button onClick={generateWithAI} disabled={aiBusy} className="bg-primary text-primary-foreground">
            {aiBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Generate with AI
          </Button>
        </div>
        <Textarea
          placeholder="Role, seniority, focus areas, technologies, interview goals…"
          value={aiContext}
          onChange={(e) => setAiContext(e.target.value)}
          rows={4}
        />
      </Card>

      <Input
        placeholder="Template name"
        value={template.name}
        onChange={(e) => setTemplate({ ...template, name: e.target.value })}
      />

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold text-lg">Criteria</h2>
        {template.criteria.map((c, i) => (
          <div key={i} className="flex gap-2">
            <Textarea value={c} onChange={(e) => updateField('criteria', i, e.target.value)} />
            <Button variant="destructive" onClick={() => removeField('criteria', i)}>Remove</Button>
          </div>
        ))}
        <Button onClick={() => addField('criteria')}>+ Add Criterion</Button>
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold text-lg">Coding Questions</h2>
        {template.coding_questions.map((q, i) => (
          <div key={i} className="flex gap-2">
            <Textarea value={q} onChange={(e) => updateField('coding_questions', i, e.target.value)} />
            <Button variant="destructive" onClick={() => removeField('coding_questions', i)}>Remove</Button>
          </div>
        ))}
        <Button onClick={() => addField('coding_questions')}>+ Add Question</Button>
      </Card>

      <Button onClick={saveTemplate} className="bg-blue-600 text-white">Save Template</Button>
    </div>
  )
}
