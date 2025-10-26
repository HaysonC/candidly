"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Video, Users, Calendar, CreditCard, Settings, BarChart3, Clock, CheckCircle2, FileText, ChevronRight, Download } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getCandidateList, getCandidateTracking, getCandidateFile, type CandidateTrackingData } from "@/lib/candidateQuery"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function DashboardPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [candidates, setCandidates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null)
  const [candidateFiles, setCandidateFiles] = useState<CandidateTrackingData | null>(null)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [selectedFile, setSelectedFile] = useState<{ name: string; content: string } | null>(null)
  const [loadingFileContent, setLoadingFileContent] = useState(false)

  useEffect(() => {
    const name = sessionStorage.getItem("interviewer_name")
    if (!name) {
      router.push("/start")
      return
    }
    setUsername(name)
    loadCandidates(name)
  }, [router])

  const loadCandidates = async (interviewer: string) => {
    try {
      setLoading(true)
      const candidateList = await getCandidateList(interviewer)
      setCandidates(candidateList)
    } catch (error) {
      console.error("Failed to load candidates:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCandidateClick = async (candidateName: string) => {
    setSelectedCandidate(candidateName)
    setLoadingFiles(true)
    setCandidateFiles(null)
    setSelectedFile(null)
    try {
      const tracking = await getCandidateTracking(username, candidateName)
      setCandidateFiles(tracking)
    } catch (error) {
      console.error("Failed to load candidate files:", error)
    } finally {
      setLoadingFiles(false)
    }
  }

  const handleFileClick = async (filename: string) => {
    if (!selectedCandidate) return
    setLoadingFileContent(true)
    try {
      const fileData = await getCandidateFile(username, selectedCandidate, filename)
      setSelectedFile({ name: filename, content: fileData.content })
    } catch (error) {
      console.error("Failed to load file content:", error)
    } finally {
      setLoadingFileContent(false)
    }
  }

  if (!username) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Video className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Interview Platform</h1>
              <p className="text-xs text-muted-foreground">Welcome back, {username}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon">
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-6">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-left">
                <h2 className="text-2xl font-bold text-balance mb-2">Ready to conduct an interview?</h2>
                <p className="text-muted-foreground text-pretty">
                  Create a new interview session and invite your candidate
                </p>
              </div>
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
                onClick={() => router.push("/dashboard/start-interview")}
              >
                <Video className="w-5 h-5 mr-2" />
                Start Interview
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Interview Templates entry */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-left">
                <h2 className="text-xl font-semibold mb-2">Want to prepare ahead?</h2>
                <p className="text-muted-foreground text-pretty">
                  Create a reusable interview template with custom questions and evaluation criteria.
                </p>
              </div>
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
                onClick={() => router.push("/interview-template")}
              >
                Create Interview Template
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Interviews</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">24</div>
              <p className="text-xs text-muted-foreground">+3 from last month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Duration</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">42 min</div>
              <p className="text-xs text-muted-foreground">Across all interviews</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">22</div>
              <p className="text-xs text-muted-foreground">2 scheduled</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Interviews */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Recent Interviews
              </CardTitle>
              <CardDescription>Your latest interview sessions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading candidates...</div>
              ) : candidates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No interviews yet. Start your first interview!
                </div>
              ) : (
                candidates.slice(0, 5).map((candidateName, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => handleCandidateClick(candidateName)}
                  >
                    <div className="flex-1">
                      <p className="font-medium">{candidateName}</p>
                      <p className="text-sm text-muted-foreground">Click to view files</p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <Badge variant="secondary">
                        completed
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Account & Subscription */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Account & Subscription
              </CardTitle>
              <CardDescription>Manage your plan and billing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold">Pro Plan</p>
                    <p className="text-sm text-muted-foreground">Unlimited interviews</p>
                  </div>
                  <Badge className="bg-primary text-primary-foreground">Active</Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Billing cycle</span>
                    <span className="font-medium">Monthly</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Next billing date</span>
                    <span className="font-medium">Jan 15, 2025</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-medium">$49/month</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 bg-transparent">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Billing
                </Button>
                <Button variant="outline" className="flex-1 bg-transparent">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Usage
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Placeholder for future features */}
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">More Features Coming Soon</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Analytics, team collaboration, interview templates, and more exciting features are on the way!
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Candidate Files Dialog */}
      <Dialog open={!!selectedCandidate} onOpenChange={(open) => {
        if (!open) {
          setSelectedCandidate(null)
          setSelectedFile(null)
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Interview Files - {selectedCandidate}</DialogTitle>
            <DialogDescription>
              Click on a file to view its content
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden">
            {/* File List */}
            <div className="space-y-2 overflow-y-auto pr-2">
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">Files</h3>
              {loadingFiles ? (
                <div className="text-center py-8 text-muted-foreground">Loading files...</div>
              ) : candidateFiles && Object.keys(candidateFiles.files).length > 0 ? (
                Object.entries(candidateFiles.files).map(([filename, fileInfo]) => (
                  <Card 
                    key={filename}
                    className={`cursor-pointer transition-colors hover:bg-accent ${
                      selectedFile?.name === filename ? 'border-primary bg-accent' : ''
                    }`}
                    onClick={() => handleFileClick(filename)}
                  >
                    <CardHeader className="p-4">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {filename}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {fileInfo.size} bytes • {new Date(fileInfo.updated_at).toLocaleString()}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No files found for this candidate
                </div>
              )}
            </div>

            {/* File Content */}
            <div className="border rounded-lg p-4 overflow-hidden flex flex-col">
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">
                {selectedFile ? selectedFile.name : 'Select a file'}
              </h3>
              <ScrollArea className="flex-1">
                {loadingFileContent ? (
                  <div className="text-center py-8 text-muted-foreground">Loading content...</div>
                ) : selectedFile ? (
                  <pre className="text-xs whitespace-pre-wrap break-words font-mono">
                    {selectedFile.content}
                  </pre>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Click a file to view its content
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
