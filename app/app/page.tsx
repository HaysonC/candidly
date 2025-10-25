"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Video, UserCircle, Users } from "lucide-react"

export default function HomePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
              <Video className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-balance">Candidly</h1>
          <p className="text-muted-foreground text-pretty">
            Anti-Cluely, Pro-Interview
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Interviewer Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <UserCircle className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Start Interview</CardTitle>
              <CardDescription>Create a new interview session and invite candidates</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push("/start")} className="w-full" size="lg">
                Start as Interviewer
              </Button>
            </CardContent>
          </Card>

          {/* Interviewee Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Join Interview</CardTitle>
              <CardDescription>Enter your meeting code to join an ongoing interview</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push("/join")} variant="secondary" className="w-full" size="lg">
                Join as Candidate
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">All interviews are peer-to-peer encrypted and secure</p>
          <p className="text-xs text-muted-foreground">
            Powered by WebRTC technology for real-time video communication
          </p>
        </div>
      </div>
    </div>
  )
}
