"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Video, Loader2, Copy, Check, ArrowLeft } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getSignalingHttpBase } from "@/lib/signaling"
import { fetchTemplatesForAccount } from "@/lib/templates"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"

export default function StartInterviewPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [username, setUsername] = useState("")
  const [step, setStep] = useState<"form" | "waiting">("form")
  const [candidateName, setCandidateName] = useState("")
  const [candidateEmail, setCandidateEmail] = useState("")
  const [notes, setNotes] = useState("")
  const [templates, setTemplates] = useState<{id:string;name:string}[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>(undefined)
  const [isCreating, setIsCreating] = useState(false)
  const [meetingCode, setMeetingCode] = useState("")
  const [joinLink, setJoinLink] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const name = sessionStorage.getItem("interviewer_name")
    if (!name) {
      router.push("/start")
      return
    }
    setUsername(name)
    // load templates for selection (backend)
    fetchTemplatesForAccount(name)
      .then((arr)=>{
        const opts = Array.isArray(arr) ? arr.map((t:any)=>({id:String(t.id), name: t.name||'Untitled'})) : []
        setTemplates(opts)
      }).catch(()=>setTemplates([]))
  }, [router])

  const handleCreateSession = async () => {
    if (!candidateName.trim() || !candidateEmail.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in candidate name and email",
        variant: "destructive",
      })
      return
    }

    setIsCreating(true)

    try {
      const signalingServer = process.env.NEXT_PUBLIC_SIGNALING_SERVER || "http://localhost:8000"
      const baseUrl = signalingServer.replace("ws://", "http://").replace("wss://", "https://")

      const trimmedName = candidateName.trim()
      const trimmedEmail = candidateEmail.trim()

      const response = await fetch(`${baseUrl}/api/create-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          candidate_name: trimmedName,
          candidate_email: trimmedEmail,
          notes: notes,
          interviewer_name: username,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create session")
      }

      const data = await response.json()
      setMeetingCode(data.meeting_code)

  const tmplParam = selectedTemplate ? `&template=${encodeURIComponent(selectedTemplate)}` : ""
  const fullJoinLink = `${window.location.origin}/join?code=${data.meeting_code}${tmplParam}`
      setJoinLink(fullJoinLink)

      toast({
        title: "Session Created!",
        description: "Share the meeting code or link with your candidate",
      })

      setStep("waiting")
    } catch (error) {
      console.error("[debug] Error creating session:", error)
      toast({
        title: "Error",
        description: "Failed to create interview session. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinCall = () => {
    const tmplParam = selectedTemplate ? `&template=${encodeURIComponent(selectedTemplate)}` : ""
    router.push(`/interview/${meetingCode}?role=interviewer${tmplParam}`)
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    })
    setTimeout(() => setCopied(false), 2000)
  }

  if (!username) {
    return null
  }

  if (step === "form") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Button variant="ghost" size="sm" className="w-fit -ml-2 mb-2" onClick={() => router.push("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <CardTitle>Interview Details</CardTitle>
            <CardDescription>Enter candidate information to create the session</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="candidateName">Candidate Name *</Label>
              <Input
                id="candidateName"
                placeholder="Jane Smith"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="candidateEmail">Candidate Email *</Label>
              <Input
                id="candidateEmail"
                type="email"
                placeholder="jane@example.com"
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Position, interview focus areas, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Template (Optional)</Label>
              <Select
                value={selectedTemplate}
                onValueChange={(val) => setSelectedTemplate(val === 'none' ? undefined : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No Template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Template</SelectItem>
                  {templates.map((t)=> (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleCreateSession} disabled={isCreating} className="w-full" size="lg">
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Video className="w-4 h-4 mr-2" />
                  Create Session
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === "waiting") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Session Created!</CardTitle>
            <CardDescription>Share these details with {candidateName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Meeting Code</Label>
              <div className="flex gap-2">
                <Input
                  value={meetingCode}
                  readOnly
                  className="text-center text-2xl font-mono tracking-wider font-bold"
                />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(meetingCode, "Meeting code")}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Join Link</Label>
              <div className="flex gap-2">
                <Input value={joinLink} readOnly className="text-sm" />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(joinLink, "Join link")}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <p className="text-sm text-muted-foreground text-center">Waiting for {candidateName} to join...</p>
              <Button onClick={handleJoinCall} className="w-full" size="lg">
                Join Interview Room
              </Button>
              <Button variant="outline" onClick={() => router.push("/dashboard")} className="w-full">
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}
