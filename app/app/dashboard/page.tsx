"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Video, Users, Calendar, Settings, BarChart3, Clock, CheckCircle2, FileText, ChevronRight, Download } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getCandidateList, getCandidateTracking, getCandidateFile, type CandidateTrackingData } from "@/lib/candidateQuery"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function DashboardPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [candidates, setCandidates] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null)
  const [candidateFiles, setCandidateFiles] = useState<CandidateTrackingData | null>(null)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [selectedFile, setSelectedFile] = useState<{ name: string; content?: string; contentBase64?: string; contentType?: string } | null>(null)
  const [loadingFileContent, setLoadingFileContent] = useState(false)

  const displayedFiles = candidateFiles
    ? Object.entries(candidateFiles.files).filter(([filename]) => !/^heatmap-.*\.txt$/i.test(filename))
    : []

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
      console.log('Loading candidates for interviewer:', interviewer)
      const candidateList = await getCandidateList(interviewer)
      console.log('Received candidates:', candidateList)
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
    console.log('Fetching files for candidate:', candidateName)
    console.log('Using interviewer:', username)
    try {
      const tracking = await getCandidateTracking(username, candidateName)
      console.log('Received tracking data:', tracking)
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
      setSelectedFile({ name: filename, content: fileData.content, contentBase64: (fileData as any).contentBase64, contentType: (fileData as any).contentType })
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

          {/* Team & Role */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Team & Role
              </CardTitle>
              <CardDescription>Your current team and organization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Company</span>
                    <span className="font-medium">Salmon Solutions Inc</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Team</span>
                    <span className="font-medium">Vibe Coders Subteam</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role</span>
                    <span className="font-medium">Senior Prompt Engineer</span>
                  </div>
                </div>
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

            {/* Candidate Files Sheet */}
      <Sheet
        open={!!selectedCandidate}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCandidate(null)
            setSelectedFile(null)
          }
        }}
      >
        <SheetContent side="bottom" className="w-[100vw] h-[90vh] p-0">
          <div className="flex flex-col h-full bg-white/80 dark:bg-background/80 backdrop-blur-lg">
            <SheetHeader className="px-8 pt-8 pb-2 border-b border-border/30">
              <SheetTitle className="text-2xl font-bold">Interview Files - {selectedCandidate}</SheetTitle>
              <SheetDescription className="text-base text-muted-foreground">
                Click on a file to view its content
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-0 md:gap-4 px-4 pb-6 pt-4">
              {/* File List */}
              <div className="md:w-1/4 w-full border-r border-border/30 pr-4 flex flex-col">
                <h3 className="font-semibold text-sm text-muted-foreground mb-2 mt-2">Files</h3>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {loadingFiles ? (
                    <div className="text-center py-8 text-muted-foreground">Loading files...</div>
                  ) : candidateFiles && displayedFiles.length > 0 ? (
                    displayedFiles.map(([filename, fileInfo]) => (
                      <Card
                        key={filename}
                        className={`cursor-pointer transition-colors hover:bg-accent/60 ${
                          selectedFile?.name === filename ? 'border-primary bg-accent/40' : ''
                        } mb-2 shadow-sm`}
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
              </div>

              {/* File Content */}
              <div className="md:w-3/4 w-full flex flex-col pl-0 md:pl-4 mt-6 md:mt-0">
                <div className="border rounded-lg p-4 bg-background/80 shadow-inner flex-1 flex flex-col min-h-[300px]">
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">
                    {selectedFile ? selectedFile.name : 'Select a file'}
                  </h3>
                  <ScrollArea className="flex-1">
                    {loadingFileContent ? (
                      <div className="text-center py-8 text-muted-foreground">Loading content...</div>
                    ) : selectedFile ? (
                      selectedFile.contentBase64 && selectedFile.contentType && selectedFile.contentType.startsWith('image/') ? (
                        <div className="w-full h-full flex items-center justify-center p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt={selectedFile.name}
                            src={`data:${selectedFile.contentType};base64,${selectedFile.contentBase64}`}
                            className="max-w-full max-h-[60vh] rounded border"
                          />
                        </div>
                      ) : selectedFile.content ? (
                        <pre className="text-xs whitespace-pre-wrap break-words font-mono">
                          {selectedFile.content}
                        </pre>
                      ) : selectedFile.contentBase64 ? (
                        <div className="text-sm text-muted-foreground">Binary file ({selectedFile.contentType || 'application/octet-stream'})</div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No preview available.</div>
                      )
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        Click a file to view its content
                      </div>
                    )}
                  </ScrollArea>
                  {selectedFile && (
                    <div className="pt-3 flex justify-end">
                      {selectedFile.contentBase64 && selectedFile.contentType ? (
                        <a
                          className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded border"
                          download={selectedFile.name}
                          href={`data:${selectedFile.contentType};base64,${selectedFile.contentBase64}`}
                        >
                          <Download className="w-4 h-4" /> Download
                        </a>
                      ) : selectedFile.content ? (
                        <button
                          className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded border"
                          onClick={() => {
                            try {
                              const blob = new Blob([selectedFile.content as string], { type: 'text/plain;charset=utf-8' })
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = selectedFile.name
                              document.body.appendChild(a)
                              a.click()
                              document.body.removeChild(a)
                              setTimeout(() => URL.revokeObjectURL(url), 1000)
                            } catch {}
                          }}
                        >
                          <Download className="w-4 h-4" /> Download
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
