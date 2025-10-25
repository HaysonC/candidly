"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
// @ts-expect-error types resolved at runtime after install
import Editor from '@monaco-editor/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronDown, Maximize2, Minimize2 } from 'lucide-react'
import { uploadCandidateInterviewed } from '@/lib/upload'

export type EditorLanguage = 'python' | 'cpp' | 'java'

export interface CodeEditorProps {
  open: boolean
  minimized: boolean
  onToggleOpen: () => void
  onToggleMinimize: () => void
  language: EditorLanguage
  onLanguageChange: (lang: EditorLanguage) => void
  docName: string
  value: string
  onChange: (val: string) => void
  showGazeOverlay?: boolean
  remoteGaze?: { x: number; y: number; pageW?: number; pageH?: number } | null
}

export function CodeEditorPanel(props: CodeEditorProps) {
  const {
    open,
    minimized,
    onToggleOpen,
    onToggleMinimize,
    language,
    onLanguageChange,
    docName,
    value,
    onChange,
    showGazeOverlay,
    remoteGaze,
  } = props

  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)

  // Map friendly names to Monaco
  const monacoLang = useMemo(() => {
    switch (language) {
      case 'python':
        return 'python'
      case 'cpp':
        return 'cpp'
      case 'java':
        return 'java'
      default:
        return 'plaintext'
    }
  }, [language])

  useEffect(() => {
    if (!showGazeOverlay) return
    const canvas = overlayRef.current
    const host = containerRef.current
    if (!canvas || !host) return

    const resize = () => {
      const rect = host.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    let raf = 0
    const draw = () => {
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (remoteGaze && remoteGaze.pageW && remoteGaze.pageH) {
        const scaleX = canvas.width / remoteGaze.pageW
        const scaleY = canvas.height / remoteGaze.pageH
        const x = Math.round(remoteGaze.x * scaleX)
        const y = Math.round(remoteGaze.y * scaleY)
        ctx.fillStyle = 'rgba(255,0,0,0.85)'
        ctx.beginPath()
        ctx.arc(x, y, 8, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [showGazeOverlay, remoteGaze])

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <Button onClick={onToggleOpen} className="bg-primary text-primary-foreground">
          Open Editor
        </Button>
      </div>
    )
  }

  if (minimized) {
    return (
      <Card className="p-2 flex items-center justify-between">
        <div className="text-sm">{docName} • {language.toUpperCase()}</div>
        <Button variant="outline" size="sm" onClick={onToggleMinimize}>
          <Maximize2 className="w-4 h-4 mr-1" /> Open
        </Button>
      </Card>
    )
  }

  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onToggleOpen}>Close</Button>
          <Button size="sm" variant="outline" onClick={onToggleMinimize}>
            <Minimize2 className="w-4 h-4 mr-1" /> Minimize
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium">{docName}</div>
          <Select value={language} onValueChange={(v) => onLanguageChange(v as EditorLanguage)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="python">Python</SelectItem>
              <SelectItem value="cpp">C++</SelectItem>
              <SelectItem value="java">Java</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div ref={containerRef} className="relative" style={{ height: 520 }}>
        <Editor
          height="100%"
          defaultLanguage={monacoLang}
          language={monacoLang}
          value={value}
          onChange={(val: string | undefined) => onChange(val || '')}
          options={{
            minimap: { enabled: false },
            wordWrap: 'on',
            fontSize: 14,
            automaticLayout: true,
          }}
        />
        {showGazeOverlay && (
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0" />
        )}
      </div>
      <div className="px-3 py-2 border-t">
        <Button 
          onClick={async () => {
            try {
              // TODO: Replace with actual candidate name logic
              const candidateName = 'candidate'; // This should come from props or context
              
              const codeData = {
                filename: docName,
                content: value,
                language: language
              };
              
              const success = await uploadCandidateInterviewed(candidateName, codeData);
              
              if (success) {
                console.log('Code submitted successfully');
                // TODO: Add success notification
              } else {
                console.error('Failed to submit code');
                // TODO: Add error notification
              }
            } catch (error) {
              console.error('Error submitting code:', error);
              // TODO: Add error notification
            }
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Submit Code
        </Button>
      </div>
    </Card>
  )
}
