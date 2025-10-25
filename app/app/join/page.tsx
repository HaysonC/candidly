"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Video, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function JoinPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const codeFromUrl = searchParams.get("code") || ""

  const [meetingCode, setMeetingCode] = useState(codeFromUrl)
  const [email, setEmail] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)

  const handleJoin = async () => {
    if (!meetingCode.trim()) {
      toast({
        title: "Missing Code",
        description: "Please enter a meeting code",
        variant: "destructive",
      })
      return
    }

    if (!email.trim()) {
      toast({
        title: "Missing Email",
        description: "Please enter your email address",
        variant: "destructive",
      })
      return
    }

    setIsVerifying(true)

    try {
      console.log("[debug] Verifying email:", email)
      console.log("[debug] Meeting code:", meetingCode)

      const signalingServer = process.env.NEXT_PUBLIC_SIGNALING_SERVER || "http://localhost:8000"
      const baseUrl = signalingServer.replace("ws://", "http://").replace("wss://", "https://")

      const trimmedEmail = email.trim()
      const url = `${baseUrl}/api/verify-email/${meetingCode}/${encodeURIComponent(trimmedEmail)}`
      console.log("[debug] Verification URL:", url)

      const response = await fetch(url, {
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
      })

      if (!response.ok) {
        throw new Error("Session not found")
      }

      const data = await response.json()
      console.log("[debug] Verification response:", data)

      if (data.valid) {
        toast({
          title: "Verified!",
          description: `Welcome, ${data.candidate_name}`,
        })
        router.push(`/interview/${meetingCode}?role=interviewee`)
      } else {
        toast({
          title: "Verification Failed",
          description: "Your email doesn't match this interview session",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[debug] Error verifying:", error)
      toast({
        title: "Error",
        description: "Failed to verify. Please check the meeting code and try again.",
        variant: "destructive",
      })
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Video className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Join Interview</CardTitle>
          <CardDescription>Enter your meeting code and email to join the interview</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Meeting Code</Label>
            <Input
              id="code"
              placeholder="Enter 6-character code"
              value={meetingCode}
              onChange={(e) => setMeetingCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="text-center text-lg tracking-wider font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Your Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="candidate@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Use the email address provided by your interviewer</p>
          </div>

          <Button onClick={handleJoin} className="w-full" size="lg" disabled={isVerifying}>
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              "Join Interview"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
