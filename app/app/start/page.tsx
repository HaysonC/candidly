"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Video, Loader2, Copy, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function StartPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [step, setStep] = useState<"login" | "dashboard" | "form" | "waiting">("login")
  const [username, setUsername] = useState("")
  const [candidateName, setCandidateName] = useState("")
  const [candidateEmail, setCandidateEmail] = useState("")
  const [notes, setNotes] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [meetingCode, setMeetingCode] = useState("")
  const [joinLink, setJoinLink] = useState("")
  const [copied, setCopied] = useState(false)

  const handleLogin = () => {
    if (!username.trim()) {
      toast({
        title: "Enter your name",
        description: "Please enter your name to continue",
        variant: "destructive",
      })
      return
    }
    sessionStorage.setItem("interviewer_name", username.trim())
    router.push("/dashboard")
  }

  const handleStartInterview = () => {
    setStep("form")
  }

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

      console.log("[debug] Creating session with:")
      console.log("[debug]   Candidate name:", trimmedName)
      console.log("[debug]   Candidate email:", trimmedEmail)
      console.log("[debug]   Interviewer:", username)

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
      console.log("[debug] Session created:", data)

      setMeetingCode(data.meeting_code)

      const fullJoinLink = `${window.location.origin}/join?code=${data.meeting_code}`
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
    router.push(`/interview/${meetingCode}?role=interviewer`)
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

  if (step === "login") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Video className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Interviewer Login</CardTitle>
            <CardDescription>Enter your name to get started</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Your Name</Label>
              <Input
                id="username"
                placeholder="John Doe"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
            <Button onClick={handleLogin} className="w-full" size="lg">
              Continue
            </Button>
            <p className="text-xs text-center text-muted-foreground">Mock login - any name works for demo</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === "dashboard") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-3">
            <CardTitle className="text-2xl">Hi, {username}!</CardTitle>
            <CardDescription>Ready to start an interview?</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleStartInterview} className="w-full" size="lg">
              <Video className="w-5 h-5 mr-2" />
              Start Interview
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === "form") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
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

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("dashboard")} className="flex-1">
                Back
              </Button>
              <Button onClick={handleCreateSession} disabled={isCreating} className="flex-1">
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Session"
                )}
              </Button>
            </div>
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
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}
