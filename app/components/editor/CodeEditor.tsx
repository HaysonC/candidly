"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
// @ts-expect-error types resolved at runtime after install
import Editor from '@monaco-editor/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ChevronDown, Maximize2, Minimize2, Save } from 'lucide-react'
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
  onNewQuestion?: () => void // Callback to reset submission state when new question assigned
  questionAssigned?: boolean // Whether a question has been assigned
  role?: 'interviewer' | 'interviewee'
  timerActive?: boolean
  timerSeconds?: number
  onTimerToggle?: (active: boolean) => void
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
    onNewQuestion,
    questionAssigned = false,
    role,
    timerActive = false,
    timerSeconds = 0,
    onTimerToggle,
  } = props

  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  // Reset submission state when new question is assigned
  useEffect(() => {
    if (onNewQuestion) {
      setIsSubmitted(false)
      setSubmitSuccess(false)
      setSaveSuccess(false)
    }
  }, [originalQuestion, onNewQuestion])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSave = async () => {
    try {
      // Show save success message (code is automatically synced)
      setSaveSuccess(true);
      // Hide save success message after 2 seconds
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Error saving code:', error);
    }
  };

  const handleSubmit = async () => {
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
        setIsSubmitted(true);
        setSubmitSuccess(true);
      } else {
        console.error('Failed to submit code');
      }
    } catch (error) {
      console.error('Error submitting code:', error);
    }
  };

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

  // If no question assigned, show waiting message
  if (!questionAssigned) {
    return (
      <Card className="relative overflow-hidden">
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-blue-800">
              {role === 'interviewer' ? 'Ready to Assign Question' : 'Waiting for Question'}
            </h3>
            <p className="text-gray-600">
              {role === 'interviewer' 
                ? 'Click "Assign Question" to start the coding session' 
                : 'The interviewer will assign a coding question shortly'}
            </p>
          </div>
        </div>
      </Card>
    )
  }

  // If code has been submitted, show success message instead of editor
  if (isSubmitted) {
    return (
      <Card className="relative overflow-hidden">
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-green-800">Code Successfully Submitted!</h3>
            <p className="text-gray-600">Your solution has been saved and is ready for review.</p>
          </div>
        </div>
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
          
          {role === 'interviewer' && (
            <div className="flex items-center gap-2">
              <div className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                {formatTime(timerSeconds)}
              </div>
              <Button 
                size="sm" 
                variant={timerActive ? "destructive" : "default"}
                onClick={() => onTimerToggle && onTimerToggle(!timerActive)}
              >
                {timerActive ? "Stop" : "Start"} Timer
              </Button>
            </div>
          )}
          
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
          <div className="flex gap-2">
            <Button 
              onClick={handleSave}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save
            </Button>
            
            <Button 
              onClick={() => setShowConfirmDialog(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1"
            >
              Submit Code
            </Button>
          </div>
        )}

        {/* Save success message */}
        {saveSuccess && (
          <div className="flex items-center justify-center gap-2 text-blue-600 py-1 mt-2">
            <Save className="w-4 h-4" />
            <span className="text-sm">Code saved successfully</span>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Submission</DialogTitle>
            <DialogDescription>
              Are you sure you want to submit your code? You won't be able to edit it after submission.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                setShowConfirmDialog(false);
                handleSubmit();
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Yes, Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
