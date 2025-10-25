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

// Utility function to create language-specific comments
export const getCommentPrefix = (language: EditorLanguage): string => {
  switch (language) {
    case 'python':
      return '#'
    case 'cpp':
    case 'java':
    default:
      return '//'
  }
}

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
  candidateName?: string
  originalQuestion?: string
  interviewerName?: string
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
    candidateName,
    originalQuestion,
    interviewerName,
  } = props

  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Function to convert comments between languages
  const convertComments = (text: string, fromLang: EditorLanguage, toLang: EditorLanguage): string => {
    const fromPrefix = getCommentPrefix(fromLang)
    const toPrefix = getCommentPrefix(toLang)
    
    if (fromPrefix === toPrefix) return text
    
    const lines = text.split('\n')
    const convertedLines = lines.map(line => {
      const trimmed = line.trimStart()
      const leadingSpaces = line.length - trimmed.length
      const indent = line.substring(0, leadingSpaces)
      
      if (fromLang === 'python' && (toLang === 'cpp' || toLang === 'java')) {
        // Convert # to //
        if (trimmed.startsWith('#')) {
          return indent + '//' + trimmed.substring(1)
        }
      } else if ((fromLang === 'cpp' || fromLang === 'java') && toLang === 'python') {
        // Convert // to #
        if (trimmed.startsWith('//')) {
          return indent + '#' + trimmed.substring(2)
        }
      }
      
      return line
    })
    
    return convertedLines.join('\n')
  }

  // Handler for language change with comment conversion
  const handleLanguageChange = (newLang: EditorLanguage) => {
    const convertedValue = convertComments(value, language, newLang)
    onChange(convertedValue)
    onLanguageChange(newLang)
  }

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
          <Select value={language} onValueChange={(v) => handleLanguageChange(v as EditorLanguage)}>
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
        {submitSuccess ? (
          <div className="flex items-center justify-center gap-2 text-green-600 py-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">Code successfully submitted</span>
          </div>
        ) : (
          <Button 
            onClick={async () => {
              try {
                if (!candidateName) {
                  console.error('No candidate name provided');
                  return;
                }
                
                if (!interviewerName) {
                  console.error('No interviewer name provided');
                  return;
                }
                
                // Separate question from candidate response
                const lines = value.split('\n');
                let questionEndIndex = 0;
                let question = '';
                let candidateResponse = '';
                
                // Find where the question ends (look for "Write your solution below:")
                for (let i = 0; i < lines.length; i++) {
                  const line = lines[i].trim();
                  if (line.includes('Write your solution below:')) {
                    questionEndIndex = i;
                    question = lines.slice(0, i + 1).join('\n');
                    candidateResponse = lines.slice(i + 1).join('\n').trim();
                    break;
                  }
                }
                
                // Fallback: use originalQuestion if available
                if (!question && originalQuestion) {
                  question = originalQuestion;
                  candidateResponse = value;
                } else if (!question) {
                  // If no clear separation, treat first part as question
                  const halfPoint = Math.floor(lines.length / 2);
                  question = lines.slice(0, halfPoint).join('\n');
                  candidateResponse = lines.slice(halfPoint).join('\n');
                }
                
                const codeData = {
                  filename: docName,
                  question: question,
                  candidate_response: candidateResponse,
                  language: language
                };
                
                const success = await uploadCandidateInterviewed(candidateName, codeData, interviewerName);
                
                if (success) {
                  setSubmitSuccess(true);
                  setTimeout(() => setSubmitSuccess(false), 3000); // Hide after 3 seconds
                } else {
                  console.error('Failed to submit code');
                }
              } catch (error) {
                console.error('Error submitting code:', error);
              }
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
          >
            Submit Code
          </Button>
        )}
      </div>
    </Card>
  )
}
