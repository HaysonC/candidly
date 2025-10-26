"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { fetchTemplatesForAccount, fetchTemplateById } from "@/lib/templates"
import { Card } from "@/components/ui/card"
import { Copy, Mic, MicOff, Phone, Video, VideoOff, Monitor, Loader2, Eye, Code2 } from "lucide-react"
import { CodeEditorPanel, type EditorLanguage } from "@/components/editor/CodeEditor"
import { useToast } from "@/hooks/use-toast"
import { ConsentDialog } from "@/components/consent-dialog"
import { CalibrationFullscreen } from "@/components/calibration-fullscreen"
import { GazeTrackingCanvas } from "@/components/gaze-tracking-canvas"
import { buildHeatmapReportFromSamples } from "@/lib/heatmap"
import { uploadCandidateInterviewed, uploadCandidateFileBinary, uploadCandidateFileBlob } from "@/lib/upload"
import GazeHeatmap from "@/components/gaze-heatmap"
import { startInterviewRecording, stopInterviewRecording, isInterviewRecordingActive, getCurrentTranscript } from "@/lib/audio-manager"

interface GazeData {
  x: number
  y: number
  confidence: number
  timestamp: number
  pageW?: number
  pageH?: number
}

declare global {
  interface Window {
    webgazer: any
  }
}

export default function InterviewPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()

  const meetingCode = params.meetingCode as string
  const role = searchParams.get("role") as "interviewer" | "interviewee"
  const [accountName, setAccountName] = useState<string>("")

  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [sessionInfo, setSessionInfo] = useState<any>(null)
  const [localVideoReady, setLocalVideoReady] = useState(false)
  const [remoteVideoReady, setRemoteVideoReady] = useState(false)
  const [showConsentDialog, setShowConsentDialog] = useState(role === "interviewee")
  const [hasConsented, setHasConsented] = useState(role === "interviewer")

  const [showCalibrationDialog, setShowCalibrationDialog] = useState(false)
  const [showCalibrationRequest, setShowCalibrationRequest] = useState(false)
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [isEyeTrackingActive, setIsEyeTrackingActive] = useState(false)
  const [gazeData, setGazeData] = useState<GazeData | null>(null)
  const [remoteVideoBlurred, setRemoteVideoBlurred] = useState(false)
  const [waitingForCalibration, setWaitingForCalibration] = useState(false)
  const [candidateReady, setCandidateReady] = useState(false)
  const [templateData, setTemplateData] = useState<any | null>(null)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState<string>("")
  const [customQuestion, setCustomQuestion] = useState<string>("")
  const [assignedQuestion, setAssignedQuestion] = useState<string>("")
  const [templatesList, setTemplatesList] = useState<Array<{id:string; name:string}>>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  // Heatmap report UI state
  const [showHeatmapDialog, setShowHeatmapDialog] = useState(false)
  const [heatmapUrl, setHeatmapUrl] = useState<string | null>(null)
  const [heatmapStats, setHeatmapStats] = useState<{
    sampleCount: number
    totalTimeSec: number
    maxCell: number
    meanCell: number
    viewportChanges: number
    baseWidth: number
    baseHeight: number
  } | null>(null)
  const [heatmapLoading, setHeatmapLoading] = useState(false)
  const [heatmapSamples, setHeatmapSamples] = useState<any[]>([])
  const [heatmapPoints, setHeatmapPoints] = useState<Array<[number, number]>>([])
  const [showHeatmapOverlay, setShowHeatmapOverlay] = useState(false)

  const CLUELY_MESSAGE = "Cluely: Buy some binary seeds :)"
  const [showCluelyOverlay, setShowCluelyOverlay] = useState(false)
  const [cluelyTypedText, setCluelyTypedText] = useState("")
  const cluelyTypeIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const cluelyHideTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMinimized, setEditorMinimized] = useState(false)
  const [editorLang, setEditorLang] = useState<EditorLanguage>("python")
  const [taskCounter, setTaskCounter] = useState(1)
  const [docName, setDocName] = useState("coding-task-1")
  const [editorValue, setEditorValue] = useState("")
  const [showGazeOnEditor, setShowGazeOnEditor] = useState(true)
  const [questionAssigned, setQuestionAssigned] = useState(false)
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState<number | null>(null)
  const [timerActive, setTimerActive] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null)
  
  // Audio recording state
  const [isRecordingInterview, setIsRecordingInterview] = useState(false)
  
  // Timer functionality
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined
    if (timerActive) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev + 1)
      }, 1000)
    } else if (interval) {
      clearInterval(interval)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [timerActive])

  const handleTimerToggle = (active: boolean) => {
    setTimerActive(active)
    if (active) {
      setTimerStartTime(Date.now())
    } else {
      setTimerStartTime(null)
    }
    
    // Sync timer state with remote peer
    sendEditorUpdate({ kind: "timer-sync", active, reset: active && timerSeconds === 0 })
  }

  // Recording controls
  const handleStartRecording = async () => {
    if (isRecordingInterview || !sessionInfo) return;
    
    console.log("[debug] Starting interview recording manually...");
    try {
      const recordingStarted = await startInterviewRecording(
        sessionInfo.candidate_name,
        sessionInfo.interviewer_name,
        meetingCode
      );
      
      if (recordingStarted) {
        setIsRecordingInterview(true);
        
        // Notify the other participant about recording status
        wsRef.current?.send(JSON.stringify({
          type: "recording-started",
          message: "Interview recording has started"
        }));
        
        toast({
          title: "Recording Started",
          description: "Interview transcription is now active",
        });
      } else {
        throw new Error("Failed to start recording");
      }
    } catch (error) {
      console.error("[debug] Error starting recording:", error);
      toast({
        title: "Recording Error",
        description: "Failed to start interview recording",
        variant: "destructive",
      });
    }
  };

  const handleStopRecording = async () => {
    if (!isRecordingInterview) return;
    
    console.log("[debug] Stopping interview recording manually...");
    try {
      const result = await stopInterviewRecording();
      setIsRecordingInterview(false);
      
      // Notify the other participant about recording status
      wsRef.current?.send(JSON.stringify({
        type: "recording-stopped",
        message: "Interview recording has stopped"
      }));
      
      if (result.success) {
        toast({
          title: "Recording Stopped",
          description: "Interview transcript has been saved",
        });
      } else {
        toast({
          title: "Recording Stopped",
          description: "Recording stopped but there may have been issues saving the transcript",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("[debug] Error stopping recording:", error);
      setIsRecordingInterview(false);
      toast({
        title: "Recording Error",
        description: "Error stopping recording, but recording has been disabled",
        variant: "destructive",
      });
    }
  };

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const gazeDataBufferRef = useRef<GazeData[]>([])
  const isEyeTrackingActiveRef = useRef(false)

  // Helper: resolve backend HTTP base from signaling env (ws -> http)
  const getBackendHttpBase = () => {
    const base = process.env.NEXT_PUBLIC_SIGNALING_SERVER || "ws://localhost:8000"
    try {
      const url = new URL(base)
      if (url.protocol === "ws:") url.protocol = "http:"
      if (url.protocol === "wss:") url.protocol = "https:"
      return url.toString().replace(/\/$/, "")
    } catch {
      return "http://localhost:8000"
    }
  }

  useEffect(() => {
    const tid = searchParams.get("template")
    if (!tid || !accountName) return
    const load = async () => {
      try {
        // Use shared helper (adds ngrok bypass header and correct base)
        const data = await fetchTemplateById(accountName, tid)
        if (data) {
          setTemplateData(data)
          setSelectedTemplateId(tid)
          return
        }
        setTemplateData(null)
        toast({ title: "Template not found", description: `Could not load template ${tid}`, variant: "destructive" })
      } catch (e) {
        setTemplateData(null)
        toast({ title: "Template error", description: "Failed to fetch template data", variant: "destructive" })
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, accountName])

  // Load templates list for account (interviewer)
  useEffect(() => {
    if (!accountName || role !== 'interviewer') return
    fetchTemplatesForAccount(accountName)
      .then(list => setTemplatesList(list.map(t => ({ id: String(t.id), name: t.name || 'Untitled' }))))
      .catch(() => setTemplatesList([]))
  }, [accountName, role])

  useEffect(() => {
    if (hasConsented) {
      initializeCall()
    }

    return () => {
      cleanup()
    }
  }, [meetingCode, role, hasConsented])

  const triggerCluelyOverlay = () => {
    if (cluelyTypeIntervalRef.current) {
      clearInterval(cluelyTypeIntervalRef.current)
      cluelyTypeIntervalRef.current = null
    }
    if (cluelyHideTimeoutRef.current) {
      clearTimeout(cluelyHideTimeoutRef.current)
      cluelyHideTimeoutRef.current = null
    }

    setCluelyTypedText("")
    setShowCluelyOverlay(true)

    let index = 0
    cluelyTypeIntervalRef.current = setInterval(() => {
      index += 1
      setCluelyTypedText(CLUELY_MESSAGE.slice(0, index))
      if (index >= CLUELY_MESSAGE.length) {
        if (cluelyTypeIntervalRef.current) {
          clearInterval(cluelyTypeIntervalRef.current)
          cluelyTypeIntervalRef.current = null
        }
        cluelyHideTimeoutRef.current = setTimeout(() => {
          setShowCluelyOverlay(false)
          setCluelyTypedText("")
        }, 3200)
      }
    }, 40)
  }

  useEffect(() => {
    const handleCluelyHotkey = (event: KeyboardEvent) => {
      if (event.key !== "T" && event.key !== "t") return
      const target = event.target as HTMLElement | null
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return
      event.preventDefault()
      triggerCluelyOverlay()
    }

    window.addEventListener("keydown", handleCluelyHotkey)
    return () => {
      window.removeEventListener("keydown", handleCluelyHotkey)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (cluelyTypeIntervalRef.current) {
        clearInterval(cluelyTypeIntervalRef.current)
        cluelyTypeIntervalRef.current = null
      }
      if (cluelyHideTimeoutRef.current) {
        clearTimeout(cluelyHideTimeoutRef.current)
        cluelyHideTimeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const attachLocalStream = async () => {
      if (localStreamRef.current && localVideoRef.current && !localVideoRef.current.srcObject) {
        console.log("[debug] ===== ATTACHING LOCAL STREAM TO VIDEO ELEMENT =====")
        const localVideo = localVideoRef.current
        localVideo.srcObject = localStreamRef.current

        try {
          await localVideo.play()
          console.log("[debug] ===== LOCAL VIDEO PLAYING =====")
          setLocalVideoReady(true)
        } catch (error) {
          console.error("[debug] Error playing local video:", error)
          // Retry after a short delay
          setTimeout(async () => {
            try {
              await localVideo.play()
              setLocalVideoReady(true)
            } catch (e) {
              console.error("[debug] Retry failed:", e)
            }
          }, 500)
        }
      }
    }

    attachLocalStream()
  }, [localStreamRef.current, localVideoRef.current])

  useEffect(() => {
    if (role === "interviewee" && hasConsented && !isLoading) {
      console.log("[debug] Attempting to load WebGazer...")
      loadWebGazer()
    }

    return () => {
      if (window.webgazer) {
        console.log("[debug] Cleaning up WebGazer")
        window.webgazer.end()
      }
    }
  }, [role, hasConsented, isLoading])

  const loadWebGazer = () => {
    if (window.webgazer) {
      console.log("[debug] WebGazer already loaded")
      return
    }

    console.log("[debug] Creating script element for WebGazer")
    const script = document.createElement("script")
    script.src = "/webgazer.js"
    script.async = true
    script.onload = () => {
      console.log("[debug] WebGazer script loaded successfully")
      if (window.webgazer) {
        console.log("[debug] WebGazer object is available")
      } else {
        console.error("[debug] WebGazer script loaded but object not available")
      }
    }
    script.onerror = (error) => {
      console.error("[debug] Failed to load WebGazer script:", error)
      console.error("[debug] Script src was:", script.src)
      toast({
        title: "Eye Tracking Error",
        description: "Failed to load eye tracking library. Please refresh the page.",
        variant: "destructive",
      })
    }
    document.body.appendChild(script)
    console.log("[debug] WebGazer script element appended to body")
  }

  const handleCalibrationRequest = () => {
    if (role === "interviewer") {
      console.log("[debug] Sending calibration request")
      const message = {
        type: "calibration-request",
      }
      console.log("[debug] Message to send:", message)
      wsRef.current?.send(JSON.stringify(message))
      setWaitingForCalibration(true)
      toast({
        title: "Calibration Request Sent",
        description: "Waiting for candidate to accept",
      })
    }
  }

  const handleCalibrationAccept = async () => {
    console.log("[debug] Calibration accepted")
    setShowCalibrationRequest(false)
    setShowCalibrationDialog(true)
    setIsCalibrating(true)

    console.log("[debug] Sending calibration-started message")
    wsRef.current?.send(
      JSON.stringify({
        type: "calibration-started",
      }),
    )

    if (window.webgazer) {
      console.log("[debug] Initializing WebGazer for calibration")
      try {
        await window.webgazer.setRegression("ridge").setTracker("TFFacemesh").begin()
        window.webgazer.showVideoPreview(false).showPredictionPoints(false)
        console.log("[debug] WebGazer initialized successfully")
      } catch (error) {
        console.error("[debug] WebGazer initialization error:", error)
        toast({
          title: "Eye Tracking Error",
          description: "Failed to initialize eye tracking",
          variant: "destructive",
        })
      }
    } else {
      console.error("[debug] WebGazer not available when trying to initialize")
      toast({
        title: "Eye Tracking Error",
        description: "Eye tracking library not loaded. Please refresh the page.",
        variant: "destructive",
      })
    }
  }

  const handleCalibrationComplete = () => {
    setShowCalibrationDialog(false)
    setIsCalibrating(false)
    setIsEyeTrackingActive(true)
    isEyeTrackingActiveRef.current = true

    console.log("[debug] Calibration complete, sending message to interviewer")
    wsRef.current?.send(
      JSON.stringify({
        type: "calibration-complete",
      }),
    )

    toast({
      title: "Calibration Complete",
      description: "Eye tracking is now active",
    })

    console.log("[debug] Starting gaze tracking loop")
    startGazeTracking()
  }

  const handleCalibrationDecline = () => {
    console.log("[debug] Calibration declined, sending cancellation message")
    setShowCalibrationRequest(false)

    wsRef.current?.send(
      JSON.stringify({
        type: "calibration-cancelled",
      }),
    )

    toast({
      title: "Calibration Declined",
      description: "Eye tracking will not be enabled",
    })
  }

  const startGazeTracking = () => {
    if (!window.webgazer) {
      console.error("[debug] WebGazer not available for tracking")
      return
    }

    console.log("[debug] Starting gaze tracking loop")
    let frameCount = 0
    const BUFFER_SIZE = 5 // Moving average window

    const trackGaze = () => {
      if (!isEyeTrackingActiveRef.current) {
        console.log("[debug] Eye tracking stopped")
        return
      }

      window.webgazer
        .getCurrentPrediction()
        .then((prediction: any) => {
          if (prediction && Number.isFinite(prediction.x) && Number.isFinite(prediction.y)) {
            const gazePoint: GazeData = {
              x: Math.round(prediction.x),
              y: Math.round(prediction.y),
              confidence: prediction.confidence ?? 1,
              timestamp: Date.now(),
              pageW: window.innerWidth,
              pageH: window.innerHeight,
            }

            gazeDataBufferRef.current.push(gazePoint)
            if (gazeDataBufferRef.current.length > BUFFER_SIZE) {
              gazeDataBufferRef.current.shift()
            }

            const avgX = gazeDataBufferRef.current.reduce((sum, p) => sum + p.x, 0) / gazeDataBufferRef.current.length
            const avgY = gazeDataBufferRef.current.reduce((sum, p) => sum + p.y, 0) / gazeDataBufferRef.current.length
            const avgConfidence =
              gazeDataBufferRef.current.reduce((sum, p) => sum + (Number.isFinite(p.confidence) ? p.confidence : 1), 0) /
              gazeDataBufferRef.current.length

            const smoothedGaze: GazeData = {
              x: Math.round(avgX),
              y: Math.round(avgY),
              confidence: avgConfidence,
              timestamp: Date.now(),
              pageW: window.innerWidth,
              pageH: window.innerHeight,
            }

            if (frameCount % 30 === 0) {
              console.log(
                `[debug] Sending gaze data: (${smoothedGaze.x}, ${smoothedGaze.y}) conf: ${smoothedGaze.confidence.toFixed(2)} viewport: ${smoothedGaze.pageW}x${smoothedGaze.pageH}`,
              )
            }

            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({
                  type: "gaze-data",
                  gaze: smoothedGaze,
                }),
              )
            } else {
              console.warn("[debug] WebSocket not ready, skipping gaze data send")
            }

            frameCount++
            if (frameCount % 10 === 0) {
              fetch("/api/gaze-data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  meetingCode,
                  ...smoothedGaze,
                }),
              }).catch((error) => {
                console.error("[debug] Error sending gaze data to backend:", error)
              })
            }
          }

          requestAnimationFrame(trackGaze)
        })
        .catch((error: any) => {
          console.error("[debug] Error getting gaze prediction:", error)
          requestAnimationFrame(trackGaze)
        })
    }

    trackGaze()
  }

  const handleConsentAccept = () => {
    setHasConsented(true)
    setShowConsentDialog(false)
    toast({
      title: "Consent Accepted",
      description: "Setting up your interview...",
    })
  }

  const handleConsentDecline = () => {
    toast({
      title: "Consent Required",
      description: "You must accept the terms to join the interview",
      variant: "destructive",
    })
    setTimeout(() => {
      router.push("/")
    }, 2000)
  }

  const initializeCall = async () => {
    try {
      console.log("[debug] ===== STARTING INITIALIZE CALL =====")
      console.log("[debug] Initializing call as", role)

      console.log("[debug] Requesting user media...")
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: true,
      })

      console.log("[debug] ===== GOT USER MEDIA STREAM =====")
      localStreamRef.current = stream
      console.log("[debug] Got local stream with", stream.getTracks().length, "tracks")

      console.log("[debug] Setting isLoading to false")
      setIsLoading(false)

      const signalingServer = process.env.NEXT_PUBLIC_SIGNALING_SERVER || "ws://localhost:8000"
      const wsUrl = `${signalingServer}/ws/${meetingCode}/${role}`

      console.log("[debug] Connecting to:", wsUrl)
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log("[debug] WebSocket connected")
        toast({
          title: "Connected",
          description: "Connected to interview room",
        })
      }

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data)
        console.log("[debug] Received:", data.type)

        switch (data.type) {
          case "session-info":
            setSessionInfo(data)
            if (data?.interviewer_name) setAccountName(data.interviewer_name)
            console.log("[debug] Session info:", data)
            break

          case "room-joined":
            console.log("[debug] Joined room with", data.participants, "participants")
            break

          case "user-joined":
            console.log("[debug] User joined, creating offer")
            await createOffer()
            setIsConnected(true)
            
            toast({
              title: `${data.role === "interviewer" ? "Interviewer" : "Candidate"} joined`,
              description: "Starting video connection...",
            })
            break

          case "offer":
            console.log("[debug] Received offer")
            await handleOffer(data.offer)
            setIsConnected(true)
            break

          case "answer":
            console.log("[debug] Received answer")
            await handleAnswer(data.answer)
            break

          case "ice-candidate":
            console.log("[debug] Received ICE candidate")
            await handleIceCandidate(data.candidate)
            break

          case "user-left":
            console.log("[debug] User left")
            handleUserLeft()
            toast({
              title: "User left",
              description: "The other participant has left",
            })
            break

          case "calibration-request":
            console.log("[debug] Received calibration request, role:", role)
            if (role === "interviewee") {
              console.log("[debug] Showing calibration request dialog")
              setShowCalibrationRequest(true)
            }
            break

          case "calibration-started":
            console.log("[debug] Received calibration started, role:", role)
            if (role === "interviewer") {
              console.log("[debug] Blurring remote video")
              setRemoteVideoBlurred(true)
              setWaitingForCalibration(false)
              toast({
                title: "Calibration Started",
                description: "Candidate is calibrating eye tracking",
              })
            }
            break

          case "calibration-complete":
            console.log("[debug] Received calibration complete, role:", role)
            if (role === "interviewer") {
              console.log("[debug] Unblurring remote video and activating eye tracking display")
              setRemoteVideoBlurred(false)
              setWaitingForCalibration(false)
              setIsEyeTrackingActive(true)
              setCandidateReady(true)
              toast({
                title: "Calibration Complete",
                description: "Eye tracking is now active",
              })
            }
            break

          case "calibration-cancelled":
            console.log("[debug] Received calibration cancelled, role:", role)
            if (role === "interviewer") {
              setRemoteVideoBlurred(false)
              setWaitingForCalibration(false)
              setIsEyeTrackingActive(false)
              toast({
                title: "Calibration Cancelled",
                description: "The candidate declined eye tracking calibration",
                variant: "destructive",
              })
            }
            break

          case "gaze-data":
            if (role === "interviewer") {
              setGazeData(data.gaze)
              if (!candidateReady) {
                setCandidateReady(true)
                console.log("[debug] Gaze data received — unlocking assign button")
              }
            }
            break

          case "recording-started":
            console.log("[debug] Recording started by interviewer")
            setIsRecordingInterview(true)
            if (role === "interviewee") {
              toast({
                title: "Recording Started",
                description: data.message || "Interview recording has started",
              })
            }
            break

          case "recording-stopped":
            console.log("[debug] Recording stopped by interviewer")
            setIsRecordingInterview(false)
            if (role === "interviewee") {
              toast({
                title: "Recording Stopped",
                description: data.message || "Interview recording has stopped",
              })
            }
            break
          case "editor":
            // Receive remote editor events
            if (data.payload) {
              const p = data.payload
              if (p.kind === "update" && typeof p.value === "string") {
                setEditorValue(p.value)
              }
              if (p.kind === "meta" && p.lang) {
                setEditorLang(p.lang as EditorLanguage)
              }
              if (p.kind === "toggle") {
                if (typeof p.open === "boolean") setEditorOpen(p.open)
                if (typeof p.minimized === "boolean") setEditorMinimized(p.minimized)
              }
              if (p.kind === "question-assigned") {
                setQuestionAssigned(p.assigned)
                setCurrentQuestionNumber(p.questionNumber)
                // Trigger reset for candidate when new question is assigned
                if (role === "interviewee") {
                  console.log("[debug] New question assigned, resetting candidate editor state");
                }
              }
              if (p.kind === "timer-sync") {
                setTimerActive(p.active)
                if (p.reset) {
                  setTimerSeconds(0)
                }
              }
              if (p.kind === "submitted") {
                // Candidate submitted code – notify interviewer
                if (role === "interviewer") {
                  toast({
                    title: "Code submitted",
                    description: "The candidate has submitted their solution.",
                  })
                }
              }
            }
            break

          case "error":
            console.error("[debug] Server error:", data.message)
            toast({
              title: "Error",
              description: data.message,
              variant: "destructive",
            })
            break

          default:
            console.log("[debug] Unknown message type:", data.type)
        }
      }

      ws.onerror = (error) => {
        console.error("[debug] WebSocket error:", error)
        toast({
          title: "Connection Error",
          description: "Failed to connect to server",
          variant: "destructive",
        })
      }

      ws.onclose = () => {
        console.log("[debug] WebSocket closed")
      }
    } catch (error) {
      console.error("[debug] Error initializing:", error)
      setIsLoading(false)
      toast({
        title: "Media Error",
        description: "Failed to access camera/microphone. Please check permissions.",
        variant: "destructive",
      })
    }
  }

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
    })

    localStreamRef.current?.getTracks().forEach((track) => {
      console.log("[debug] Adding track to peer connection:", track.kind)
      pc.addTrack(track, localStreamRef.current!)
    })

    pc.ontrack = (event) => {
      console.log("[debug] Received remote track:", event.track.kind, "readyState:", event.track.readyState)
      if (remoteVideoRef.current && event.streams[0]) {
        const remoteVideo = remoteVideoRef.current
        const newStream = event.streams[0]

        console.log("[debug] Remote stream has", newStream.getTracks().length, "tracks")

        if (!document.body.contains(remoteVideo)) {
          console.error("[debug] Remote video element not in DOM yet!")
        }

        if (remoteVideo.srcObject !== newStream) {
          console.log("[debug] Setting remote video srcObject")
          remoteVideo.srcObject = newStream

          const attemptRemotePlay = async (attemptNumber: number, maxAttempts: number) => {
            console.log(`[debug] Remote play attempt ${attemptNumber}/${maxAttempts}`)
            console.log(`[debug] Remote video readyState: ${remoteVideo.readyState}, paused: ${remoteVideo.paused}`)

            try {
              await remoteVideo.play()
              console.log("[debug] Remote video playing successfully - SETTING STATE TO TRUE")
              setRemoteVideoReady(true)
              // Force a second state update
              setTimeout(() => {
                console.log("[debug] Double-checking remote video state")
                if (remoteVideo.readyState >= 2 && !remoteVideo.paused) {
                  setRemoteVideoReady(true)
                }
              }, 100)
              return true
            } catch (e) {
              console.error(`[debug] Remote play attempt ${attemptNumber} failed:`, e)

              if (attemptNumber < maxAttempts) {
                const delay = 300
                console.log(`[debug] Retrying remote play in ${delay}ms...`)
                await new Promise((resolve) => setTimeout(resolve, delay))
                return attemptRemotePlay(attemptNumber + 1, maxAttempts)
              }
              return false
            }
          }

          attemptRemotePlay(1, 5)

          remoteVideo.onloadedmetadata = () => {
            console.log("[debug] Remote video metadata loaded")
            console.log("[debug] Remote video dimensions:", remoteVideo.videoWidth, "x", remoteVideo.videoHeight)
            if (remoteVideo.paused) {
              attemptRemotePlay(1, 3)
            }
          }

          const checkInterval = setInterval(() => {
            if (remoteVideo.readyState >= 2 && !remoteVideo.paused) {
              console.log("[debug] Remote video is actually playing, forcing state update")
              setRemoteVideoReady(true)
              clearInterval(checkInterval)
            }
          }, 500)

          setTimeout(() => clearInterval(checkInterval), 5000)
        } else {
          console.log("[debug] Remote video srcObject already set, skipping")
        }
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(
          JSON.stringify({
            type: "ice-candidate",
            candidate: event.candidate,
          }),
        )
      }
    }

    pc.onconnectionstatechange = () => {
      console.log("[debug] Connection state:", pc.connectionState)
    }

    peerConnectionRef.current = pc
    return pc
  }

  const createOffer = async () => {
    const pc = createPeerConnection()
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    wsRef.current?.send(
      JSON.stringify({
        type: "offer",
        offer,
      }),
    )
  }

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    const pc = createPeerConnection()
    await pc.setRemoteDescription(new RTCSessionDescription(offer))

    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    wsRef.current?.send(
      JSON.stringify({
        type: "answer",
        answer,
      }),
    )
  }

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    await peerConnectionRef.current?.setRemoteDescription(new RTCSessionDescription(answer))
  }

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    await peerConnectionRef.current?.addIceCandidate(new RTCIceCandidate(candidate))
  }

  const handleUserLeft = () => {
    setIsConnected(false)
    setRemoteVideoReady(false)
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }
    peerConnectionRef.current?.close()
    peerConnectionRef.current = null
  }

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsAudioEnabled(audioTrack.enabled)
      }
    }
  }

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoEnabled(videoTrack.enabled)
      }
    }
  }

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach((track) => track.stop())
      screenStreamRef.current = null

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current
        await localVideoRef.current.play()
      }

      if (peerConnectionRef.current && localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0]
        const sender = peerConnectionRef.current.getSenders().find((s) => s.track?.kind === "video")
        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack)
        }
      }

      setIsScreenSharing(false)
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
        screenStreamRef.current = screenStream

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream
          await localVideoRef.current.play()
        }

        if (peerConnectionRef.current) {
          const screenTrack = screenStream.getVideoTracks()[0]
          const sender = peerConnectionRef.current.getSenders().find((s) => s.track?.kind === "video")
          if (sender && screenTrack) {
            await sender.replaceTrack(screenTrack)
          }

          screenTrack.onended = () => {
            toggleScreenShare()
          }
        }

        setIsScreenSharing(true)
      } catch (error) {
        console.error("[debug] Screen share error:", error)
        toast({
          title: "Screen Share Error",
          description: "Failed to start screen sharing",
          variant: "destructive",
        })
      }
    }
  }

  // Generate all three PDF reports
  const generateInterviewReports = async (
    candidateName: string, 
    interviewerName: string, 
    meetingCode: string,
    gazeAnalysis: string
  ) => {
    try {
      console.log("[debug] Generating interview PDF reports...")
      
      // Get the current transcript
      const currentTranscript = getCurrentTranscript()
      
      // For demo purposes, we'll use placeholder data for questions/answers
      // In production, you'd collect this during the interview
      const questionsAndAnswers = `
Technical Questions and Responses:

Q1: Explain the difference between a stack and a queue.
A1: ${currentTranscript.slice(0, 200)}...

Q2: Write a function to reverse a string.
A2: [Code solution would be captured here]

Q3: Describe your experience with React/JavaScript.
A3: ${currentTranscript.slice(200, 400)}...
      `.trim()

      const reportRequest = {
        interviewer: interviewerName,
        candidate_name: candidateName,
        transcript: currentTranscript || "No transcript available",
        questions_and_answers: questionsAndAnswers,
        gaze_analysis: gazeAnalysis,
        template_criteria: [
          "Problem Solving",
          "Communication Skills", 
          "Technical Knowledge",
          "Code Quality",
          "Analytical Thinking"
        ],
        model: "gemini-2.0-flash"
      }

      // Show loading toast
      toast({
        title: "Generating Reports",
        description: "Creating AI-powered assessment reports. This may take a moment...",
      })

      // Call the backend to generate all reports
      const response = await fetch('/generate-all-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportRequest),
      })

      if (response.ok) {
        const result = await response.json()
        console.log("[debug] PDF reports generated:", result)
        
        if (result.success) {
          toast({
            title: "Reports Generated",
            description: `Successfully created ${result.reports_generated} assessment reports`,
          })
        } else {
          toast({
            title: "Partial Success",
            description: `Generated ${result.reports_generated} of ${result.total_reports} reports`,
            variant: "destructive"
          })
        }
      } else {
        console.error("[debug] Failed to generate reports:", response.status)
        toast({
          title: "Report Generation Failed",
          description: "Failed to generate assessment reports. They can be created manually later.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("[debug] Error generating reports:", error)
      toast({
        title: "Report Error",
        description: "Error occurred while generating reports. They can be created manually later.",
        variant: "destructive"
      })
    }
  }

  const endCall = async () => {
    cleanup()
    // If interviewer, attempt to generate and upload final heatmap before redirect
    if (role === "interviewer") {
      try {
        const res = await fetch(`/api/gaze-data?meetingCode=${encodeURIComponent(meetingCode)}`)
        if (res.ok) {
          const json = await res.json()
          const samples = Array.isArray(json?.data) ? json.data : []
          if (samples.length > 0 && sessionInfo?.candidate_name && sessionInfo?.interviewer_name) {
            // Build a heatmap image using heatmap.js (same as overlay rendering)
            // 1) Determine render size
            const rect = remoteVideoRef.current?.getBoundingClientRect()
            const rW = Math.max(640, Math.round(rect?.width || 1280))
            const rH = Math.max(360, Math.round(rect?.height || Math.round((rW * 9) / 16)))

            // 2) Pick a base viewport from samples
            const counts = new Map<string, { w: number; h: number; c: number }>()
            for (const s of samples) {
              const w = s.pageW && s.pageW > 0 ? Math.round(s.pageW) : undefined
              const h = s.pageH && s.pageH > 0 ? Math.round(s.pageH) : undefined
              if (!w || !h) continue
              const key = `${w}x${h}`
              const e = counts.get(key)
              if (e) e.c += 1
              else counts.set(key, { w, h, c: 1 })
            }
            let baseW = rW, baseH = rH
            if (counts.size > 0) {
              let best: { w: number; h: number; c: number } | null = null
              for (const v of counts.values()) if (!best || v.c > best.c) best = v
              if (best) { baseW = best.w; baseH = best.h }
            }

            // 3) Reproject samples to render size as simple points
            const pts: Array<{ x: number; y: number }> = []
            for (const s of samples) {
              const sw = s.pageW && s.pageW > 0 ? s.pageW : baseW
              const sh = s.pageH && s.pageH > 0 ? s.pageH : baseH
              const sx = (s.x / sw) * rW
              const sy = (s.y / sh) * rH
              if (Number.isFinite(sx) && Number.isFinite(sy) && sx >= 0 && sy >= 0) {
                pts.push({ x: Math.round(sx), y: Math.round(sy) })
              }
            }

            if (pts.length) {
              try {
                const mod: any = await import("heatmap.js")
                const h337: any = mod?.default ?? mod
                // Create an offscreen container
                const container = document.createElement("div")
                container.style.position = "fixed"
                container.style.top = "-9999px"
                container.style.left = "-9999px"
                container.style.width = `${rW}px`
                container.style.height = `${rH}px`
                document.body.appendChild(container)

                const radius = Math.max(16, Math.round(40 * Math.min(rW / baseW, rH / baseH)))
                const instance = h337.create({ container, radius, maxOpacity: 0.6, blur: 0.85 })
                instance.setData({ max: 5, data: pts.map((p) => ({ x: p.x, y: p.y, value: 1 })) })

                // Extract PNG
                const canvas = container.querySelector("canvas") as HTMLCanvasElement | null
                let dataUrl = ""
                if (canvas) dataUrl = canvas.toDataURL("image/png")
                // Cleanup container
                container.remove()

                if (dataUrl) {
                  // Prefer Blob upload
                  const blob = await (await fetch(dataUrl)).blob()
                  const okBlob = await uploadCandidateFileBlob(
                    sessionInfo.candidate_name,
                    `heatmap-${meetingCode}.png`,
                    blob,
                    sessionInfo.interviewer_name,
                  )
                  if (!okBlob) {
                    const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : ""
                    if (base64) {
                      await uploadCandidateFileBinary(
                        sessionInfo.candidate_name,
                        `heatmap-${meetingCode}.png`,
                        base64,
                        sessionInfo.interviewer_name,
                      )
                    }
                  }
                }
              } catch (e) {
                console.warn("[debug] heatmap.js export failed, skipping image upload", e)
              }
            }

            // Also upload a small text summary for reference
            const summary = [
              `Meeting: ${meetingCode}`,
              `Candidate: ${sessionInfo.candidate_name}`,
              `Interviewer: ${sessionInfo.interviewer_name}`,
              `Samples: ${samples.length}`,
              // We don't compute exact total time/viewport changes here to keep logic simple
              `Render size: ${rW}x${rH}`,
            ].join("\n")
            await uploadCandidateInterviewed(
              sessionInfo.candidate_name,
              {
                filename: `heatmap-${meetingCode}.txt`,
                question: "Gaze Heatmap Summary",
                candidate_response: summary,
                language: "text",
              },
              sessionInfo.interviewer_name,
            )

            // Generate AI-powered PDF reports
            console.log("[debug] Starting PDF report generation...")
            await generateInterviewReports(
              sessionInfo.candidate_name,
              sessionInfo.interviewer_name,
              meetingCode,
              summary // Pass gaze analysis summary
            )
          }
        }
      } catch (e) {
        console.warn("[debug] Skipping heatmap upload due to error", e)
      }
      
      // Show loading state while generating reports
      toast({
        title: "Generating Reports",
        description: "Creating interview assessment reports...",
      })

      router.push("/dashboard")
      return
    }

    // Non-interviewer
    router.push("/")
  }

  // --- Shared editor helpers ---
  const sendEditorUpdate = (payload: any) => {
    try {
      wsRef.current?.send(JSON.stringify({ type: "editor", payload }))
    } catch {}
  }

  const handleEditorChange = (val: string) => {
    setEditorValue(val)
    sendEditorUpdate({ kind: "update", value: val })
  }

  const handleLanguageChange = (lang: EditorLanguage) => {
    setEditorLang(lang)
    sendEditorUpdate({ kind: "meta", lang })
  }

  const toggleEditorOpen = () => {
    const next = !editorOpen
    setEditorOpen(next)
    setEditorMinimized(false)
    sendEditorUpdate({ kind: "toggle", open: next, minimized: false })
  }

  const toggleEditorMin = () => {
    const next = !editorMinimized
    setEditorMinimized(next)
    setEditorOpen(true)
    sendEditorUpdate({ kind: "toggle", open: true, minimized: next })
  }

  // Generate end-of-interview heatmap report
  const generateHeatmap = async () => {
    try {
      setHeatmapLoading(true)
      setHeatmapUrl(null)
      setHeatmapStats(null)

      const res = await fetch(`/api/gaze-data?meetingCode=${encodeURIComponent(meetingCode)}`)
      if (!res.ok) throw new Error("Failed to fetch gaze data")
      const json = await res.json()
      const samples = Array.isArray(json?.data) ? json.data : []
      setHeatmapSamples(samples)

      if (samples.length === 0) {
        toast({ title: "No gaze data", description: "No samples recorded for this session.", variant: "destructive" })
        setHeatmapLoading(false)
        return
      }

      // Determine render size: prefer remote video display size if available
      const rect = remoteVideoRef.current?.getBoundingClientRect()
      const rW = Math.max(640, Math.round(rect?.width || 960))
      const rH = Math.max(360, Math.round(rect?.height || Math.round((rW * 9) / 16)))

      // Infer base viewport from most frequent dims, then reproject samples to that base
      const counts = new Map<string, { w: number; h: number; c: number }>()
      for (const s of samples) {
        const w = Number.isFinite(s.pageW) && s.pageW > 0 ? Math.round(s.pageW) : undefined
        const h = Number.isFinite(s.pageH) && s.pageH > 0 ? Math.round(s.pageH) : undefined
        if (!w || !h) continue
        const key = `${w}x${h}`
        const e = counts.get(key)
        if (e) e.c += 1
        else counts.set(key, { w, h, c: 1 })
      }
      let baseW = rW, baseH = rH
      if (counts.size > 0) {
        let best: { w: number; h: number; c: number } | null = null
        for (const e of counts.values()) if (!best || e.c > best.c) best = e
        if (best) { baseW = best.w; baseH = best.h }
      }
      const pts: Array<[number, number]> = []
      for (const s of samples) {
        const sw = Number.isFinite(s.pageW) && s.pageW > 0 ? s.pageW : baseW
        const sh = Number.isFinite(s.pageH) && s.pageH > 0 ? s.pageH : baseH
        const sx = (s.x / sw) * baseW
        const sy = (s.y / sh) * baseH
        if (Number.isFinite(sx) && Number.isFinite(sy)) pts.push([sx, sy])
      }
      setHeatmapPoints(pts)

      // Basic stats
      const sorted = [...samples].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
      const totalTimeSec = sorted.length > 1 ? Math.max(0, (sorted[sorted.length - 1].timestamp - sorted[0].timestamp) / 1000) : 0
      setHeatmapStats({
        sampleCount: samples.length,
        totalTimeSec,
        maxCell: 0,
        meanCell: 0,
        viewportChanges: 0,
        baseWidth: baseW,
        baseHeight: baseH,
      })
      // Show fullscreen overlay instead of dialog
      setShowHeatmapOverlay(true)
    } catch (e) {
      console.error("[debug] Heatmap generation failed:", e)
      toast({ title: "Heatmap error", description: "Failed to generate report.", variant: "destructive" })
    } finally {
      setHeatmapLoading(false)
    }
  }

  // Toggle handler: hide overlay if visible, otherwise fetch and show
  const toggleHeatmapOverlay = () => {
    if (showHeatmapOverlay) {
      setShowHeatmapOverlay(false)
      return
    }
    // Not visible: (re)generate and show
    void generateHeatmap()
  }

  // Prepare and send assignment payload to the peer
  const openAssignDialog = () => {
    setSelectedQuestion("")
    setCustomQuestion("")
    const tid = searchParams.get("template")
    const ensureFresh = async () => {
      if (!tid || !accountName) return
      try {
        const data = await fetchTemplateById(accountName, tid)
        if (data) setTemplateData(data)
      } catch {}
    }
    ensureFresh()
    setShowAssignDialog(true)
  }

  const handleSelectTemplate = async (newId: string) => {
    setSelectedTemplateId(newId)
    setSelectedQuestion("")
    setCustomQuestion("")
    if (!accountName) return
    const t = await fetchTemplateById(accountName, newId)
    if (t) setTemplateData(t)
  }

  const assignSelectedQuestion = () => {
    if (!templateData) return
    const questions: string[] = Array.isArray(templateData?.coding_questions) ? templateData.coding_questions : []
    const chosen = (customQuestion && customQuestion.trim().length > 0)
      ? customQuestion.trim()
      : (selectedQuestion ? selectedQuestion : "")

    if (!chosen) {
      toast({ title: "Select a question", description: "Pick from the template or paste a custom one.", variant: "destructive" })
      return
    }

    // Detect language from query parameter or use editor language
    const langParam = searchParams.get("lang") || editorLang
    const getCommentPrefix = (lang: string) => {
      switch (lang.toLowerCase()) {
        case 'python':
        case 'py':
          return '#'
        case 'cpp':
        case 'c++':
        case 'java':
        case 'javascript':
        case 'js':
        case 'typescript':
        case 'ts':
        default:
          return '//'
      }
    }
    
    const commentPrefix = getCommentPrefix(langParam)
    const line = (s: string) => `${commentPrefix} ${s}`
    const content = [
      line("=== Coding Question ==="),
      line(`Template: ${templateData?.name || "Untitled"}`),
      line(""),
      ...chosen.split("\n").map((l) => line(l)),
      "",
      line("Write your solution below:"),
      "",
    ].join("\n")

    try {
      // Store the assigned question for later use
      setAssignedQuestion(chosen)
      
      // Find the question number from the template questions array
      let questionNumber: number | null = null;
      if (templateData?.coding_questions && selectedQuestion) {
        const questionIndex = templateData.coding_questions.findIndex((q: string) => q === selectedQuestion);
        if (questionIndex !== -1) {
          questionNumber = questionIndex + 1;
        }
      }
      
      // Update task name based on question number or use sequential counter
      const newDocName = questionNumber ? `coding-task-${questionNumber}` : `coding-task-${taskCounter}`
      setDocName(newDocName)
      setCurrentQuestionNumber(questionNumber)
      setTaskCounter(prevCounter => prevCounter + 1)
      setQuestionAssigned(true)
      
      // Update the interviewer's own editor content immediately
      setEditorValue(content)
      setEditorOpen(true)
      setEditorMinimized(false)
      
      // Ensure editor is open for both peers
      sendEditorUpdate({ kind: "toggle", open: true, minimized: false })
      // Send content and question assignment status
      sendEditorUpdate({ kind: "update", value: content })
      sendEditorUpdate({ kind: "question-assigned", assigned: true, questionNumber })
      
      // Reset timer when new question is assigned
      setTimerActive(false)
      setTimerSeconds(0)
      setTimerStartTime(null)
      
      setShowAssignDialog(false)
      toast({ title: "Question assigned", description: `Sent to the shared editor as ${newDocName}.` })
    } catch (e) {
      toast({ title: "Assignment failed", description: "Could not send to the candidate.", variant: "destructive" })
    }
  }

  const randomizeQuestion = () => {
    if (!templateData) return
    const questions: string[] = Array.isArray(templateData?.coding_questions) ? templateData.coding_questions : []
    if (!questions.length) return
    const idx = Math.floor(Math.random() * questions.length)
    setSelectedQuestion(questions[idx])
  }

  const cleanup = async () => {
    isEyeTrackingActiveRef.current = false

    // Stop interview recording if active
    if (isRecordingInterview) {
      console.log("[debug] Stopping interview recording...")
      try {
        const result = await stopInterviewRecording();
        if (result.success) {
          toast({
            title: "Interview Recording Saved",
            description: "Complete transcript has been saved",
          });
        }
      } catch (error) {
        console.error("[debug] Error stopping interview recording:", error);
      }
      setIsRecordingInterview(false);
    }

    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    screenStreamRef.current?.getTracks().forEach((track) => track.stop())
    peerConnectionRef.current?.close()
    wsRef.current?.close()
    if (window.webgazer) {
      console.log("[debug] Stopping WebGazer")
      window.webgazer.end()
    }
    setIsEyeTrackingActive(false)
  }

  const copyCode = () => {
    navigator.clipboard.writeText(meetingCode)
    toast({
      title: "Copied!",
      description: "Meeting code copied to clipboard",
    })
  }

  if (showConsentDialog) {
    return (
      <>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md">
            <h2 className="text-2xl font-bold">Welcome to Your Interview</h2>
            <p className="text-muted-foreground">
              Before we begin, please review and accept our recording and consent terms.
            </p>
          </div>
        </div>
        <ConsentDialog open={showConsentDialog} onAccept={handleConsentAccept} onDecline={handleConsentDecline} />
      </>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Setting up interview...</h2>
            <p className="text-muted-foreground text-sm">Please allow camera and microphone access</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{role === "interviewer" ? "Interview Room" : "Interview"}</h1>
            {isConnected ? (
              <span className="flex items-center gap-1.5 px-3 py-1 text-xs bg-green-500/10 text-green-600 dark:text-green-400 rounded-full">
                <span className="w-1.5 h-1.5 bg-green-600 dark:bg-green-400 rounded-full animate-pulse" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-full">
                <span className="w-1.5 h-1.5 bg-yellow-600 dark:bg-yellow-400 rounded-full animate-pulse" />
                Waiting...
              </span>
            )}
            {isEyeTrackingActive && role === "interviewee" && (
              <span className="flex items-center gap-1.5 px-3 py-1 text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full">
                <Eye className="w-3 h-3" />
                Eye Tracking Active
              </span>
            )}
            {isRecordingInterview && (
              <span className="flex items-center gap-1.5 px-3 py-1 text-xs bg-red-500/10 text-red-600 dark:text-red-400 rounded-full">
                <div className="w-2 h-2 bg-red-600 dark:bg-red-400 rounded-full animate-pulse" />
                Recording Interview
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={toggleEditorOpen}>
              <Code2 className="w-4 h-4 mr-2" />
              {editorOpen ? 'Close Editor' : 'Open Editor'}
            </Button>
            {role === 'interviewer' && (
              <Button variant="outline" size="sm" onClick={() => setShowGazeOnEditor((v) => !v)}>
                {showGazeOnEditor ? 'Gaze Overlay: On' : 'Gaze Overlay: Off'}
              </Button>
            )}
            {role === "interviewer" && isConnected && !isEyeTrackingActive && (
              <Button variant="outline" size="sm" onClick={handleCalibrationRequest}>
                <Eye className="w-4 h-4 mr-2" />
                Start Calibration
              </Button>
            )}
            {role === "interviewer" && candidateReady && templateData && (
              <Button size="sm" onClick={openAssignDialog}>Assign Question</Button>
            )}
            {role === "interviewer" && isConnected && (
              <Button 
                size="sm" 
                variant={isRecordingInterview ? "destructive" : "default"}
                onClick={isRecordingInterview ? handleStopRecording : handleStartRecording}
              >
                <Mic className="w-4 h-4 mr-2" />
                {isRecordingInterview ? "Stop Recording" : "Start Recording"}
              </Button>
            )}
            {role === "interviewer" && (
              <Button size="sm" variant="outline" onClick={toggleHeatmapOverlay} disabled={heatmapLoading}>
                {heatmapLoading ? (
                  <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Generating…</span>
                ) : showHeatmapOverlay ? (
                  "Hide Heatmap"
                ) : (
                  "Generate Heatmap"
                )}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={copyCode}>
              <Copy className="w-4 h-4 mr-2" />
              {meetingCode}
            </Button>
          </div>
        </div>

        {sessionInfo && (
          <div className="text-sm text-muted-foreground">
            {role === "interviewer" ? (
              <p>
                Interviewing: {sessionInfo.candidate_name} ({sessionInfo.candidate_email})
              </p>
            ) : (
              <p>Interviewer: {sessionInfo.interviewer_name}</p>
            )}
          </div>
        )}

        {/* Video Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Remote Video */}
          <Card className="relative aspect-video bg-muted overflow-hidden">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover transition-all ${remoteVideoBlurred ? "blur-xl" : ""}`}
            />
            {showCluelyOverlay && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="max-w-sm w-full mx-6 bg-black/80 text-white rounded-xl shadow-lg border border-white/20 px-5 py-4 backdrop-blur-sm animate-in fade-in-0 zoom-in-95">
                  <p className="font-mono text-sm leading-relaxed whitespace-pre-wrap text-center">
                    {cluelyTypedText}
                    {cluelyTypedText.length < CLUELY_MESSAGE.length && <span className="inline-block w-2 bg-white/80 animate-pulse ml-1" />}
                  </p>
                </div>
              </div>
            )}
            {(!isConnected || (isConnected && !remoteVideoReady)) && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    {isConnected ? (
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    ) : (
                      <Video className="w-8 h-8 text-primary" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">
                      {isConnected
                        ? "Loading video..."
                        : `Waiting for ${role === "interviewer" ? "candidate" : "interviewer"}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isConnected
                        ? "Video stream connecting..."
                        : role === "interviewer"
                          ? "Share the meeting code"
                          : "They will join shortly"}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {isConnected && remoteVideoReady && (
              <div className="absolute top-4 left-4">
                <span className="px-2 py-1 text-xs bg-black/70 text-white rounded backdrop-blur-sm">
                  {role === "interviewer" ? "Candidate" : "Interviewer"}
                </span>
              </div>
            )}

            {remoteVideoBlurred && waitingForCalibration && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-2 bg-black/70 p-4 rounded-lg">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-white" />
                  <p className="text-white text-sm">Waiting for calibration response...</p>
                </div>
              </div>
            )}
            {remoteVideoBlurred && !waitingForCalibration && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-2 bg-black/70 p-4 rounded-lg">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-white" />
                  <p className="text-white text-sm">Calibrating eye tracking...</p>
                </div>
              </div>
            )}
          </Card>

          {/* Local Video */}
          <Card className="relative aspect-video bg-muted overflow-hidden">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
              style={{ display: "block" }}
            />
            <div className="absolute top-4 left-4">
              <span className="px-2 py-1 text-xs bg-black/70 text-white rounded backdrop-blur-sm">
                You {isScreenSharing && "(Sharing)"}
              </span>
            </div>
            <div className="absolute bottom-4 left-4 flex items-center gap-2">
              {!isAudioEnabled && (
                <span className="px-2 py-1 text-xs bg-red-500/90 text-white rounded backdrop-blur-sm flex items-center gap-1">
                  <MicOff className="w-3 h-3" />
                  Muted
                </span>
              )}
              {!isVideoEnabled && (
                <span className="px-2 py-1 text-xs bg-red-500/90 text-white rounded backdrop-blur-sm flex items-center gap-1">
                  <VideoOff className="w-3 h-3" />
                  Off
                </span>
              )}
            </div>
            {!localVideoReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <div className="text-center space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                  <p className="text-sm text-muted-foreground">Loading camera...</p>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-3">
          <Button
            variant={isAudioEnabled ? "secondary" : "destructive"}
            size="lg"
            onClick={toggleAudio}
            className="rounded-full w-14 h-14"
          >
            {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </Button>

          <Button
            variant={isVideoEnabled ? "secondary" : "destructive"}
            size="lg"
            onClick={toggleVideo}
            className="rounded-full w-14 h-14"
          >
            {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </Button>

          {(role === "interviewer" || role === "interviewee") && (
            <Button
              variant={isScreenSharing ? "default" : "secondary"}
              size="lg"
              onClick={toggleScreenShare}
              className="rounded-full w-14 h-14"
            >
              <Monitor className="w-5 h-5" />
            </Button>
          )}

          <Button variant="destructive" size="lg" onClick={endCall} className="rounded-full w-14 h-14">
            <Phone className="w-5 h-5 rotate-[135deg]" />
          </Button>
        </div>
        {/* Editor Panel */}
        <div className="mt-4">
          <CodeEditorPanel
            open={editorOpen}
            minimized={editorMinimized}
            onToggleOpen={toggleEditorOpen}
            onToggleMinimize={toggleEditorMin}
            language={editorLang}
            onLanguageChange={handleLanguageChange}
            docName={docName}
            value={editorValue}
            onChange={handleEditorChange}
            candidateName={sessionInfo?.candidate_name}
            originalQuestion={assignedQuestion}
            interviewerName={sessionInfo?.interviewer_name}
            showGazeOverlay={role === 'interviewer' && showGazeOnEditor}
            remoteGaze={role === 'interviewer' ? gazeData : null}
            questionAssigned={questionAssigned}
            role={role}
            timerActive={timerActive}
            timerSeconds={timerSeconds}
            onTimerToggle={handleTimerToggle}
            onNewQuestion={() => {
              // Reset submission state when new question is assigned
              console.log('New question assigned, resetting editor state');
            }}
            onSubmitted={() => {
              // Broadcast a submitted event to the peer
              sendEditorUpdate({ kind: 'submitted' })
              // Also give local feedback for interviewer if they triggered a manual submission (unlikely)
              if (role === 'interviewer') {
                toast({ title: 'Submitted', description: 'Submission event broadcast.' })
              }
            }}
          />
        </div>
      </div>

      {role === "interviewer" && isEyeTrackingActive && gazeData && remoteVideoRef.current && (
        <GazeTrackingCanvas gazeData={gazeData} showMetrics={true} remoteVideoElement={remoteVideoRef.current} />
      )}

      {showCalibrationRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md space-y-4">
            <h3 className="text-lg font-semibold">Eye Tracking Calibration Request</h3>
            <p className="text-sm text-muted-foreground">
              The interviewer has requested to enable eye tracking. This helps ensure interview integrity. Would you
              like to proceed with calibration?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCalibrationDecline}>
                Decline
              </Button>
              <Button onClick={handleCalibrationAccept}>Accept</Button>
            </div>
          </Card>
        </div>
      )}

      <CalibrationFullscreen
        open={showCalibrationDialog}
        onComplete={handleCalibrationComplete}
        onCancel={() => {
          setShowCalibrationDialog(false)
          setIsCalibrating(false)
          if (role === "interviewee") {
            wsRef.current?.send(
              JSON.stringify({
                type: "calibration-cancelled",
              }),
            )
          }
        }}
      />

      {/* Assign Question Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign a question</DialogTitle>
            <DialogDescription>
              Select a question from the template or paste a custom one. You can also pick a random question.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {role === 'interviewer' && templatesList.length > 0 && (
              <div className="space-y-1">
                <div className="text-sm font-medium">Template</div>
                <Select value={selectedTemplateId ?? undefined} onValueChange={handleSelectTemplate}>
                  <SelectTrigger className="w-full truncate">
                    <SelectValue placeholder="Choose a template" className="truncate" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64 max-w-[600px] whitespace-normal break-words">
                    {templatesList.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <Select value={selectedQuestion} onValueChange={setSelectedQuestion}>
                  <SelectTrigger className="w-full min-h-[60px] h-auto">
                    <SelectValue 
                      placeholder={templateData?.coding_questions?.length ? "Choose a question" : "No questions in template"} 
                      className="whitespace-normal break-words text-left overflow-hidden"
                    >
                      {selectedQuestion && (
                        <div className="whitespace-normal break-words text-sm leading-relaxed py-1">
                          {selectedQuestion.length > 120 ? selectedQuestion.slice(0, 120) + "..." : selectedQuestion}
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-64 w-[600px] max-w-[90vw]">
                    {Array.isArray(templateData?.coding_questions) && templateData.coding_questions.length > 0 ? (
                      templateData.coding_questions.map((q: string, i: number) => (
                        <SelectItem 
                          key={i} 
                          value={q}
                          className="whitespace-normal break-words py-3 px-3 min-h-fit h-auto"
                        >
                          <div className="w-full space-y-1">
                            <span className="font-medium text-xs text-muted-foreground">Question #{i + 1}</span>
                            <div className="text-sm leading-relaxed whitespace-normal break-words">
                              {q}
                            </div>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1 text-sm text-muted-foreground">No questions available</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={randomizeQuestion} disabled={!templateData?.coding_questions?.length}>Random</Button>
            </div>

            <div className="text-xs text-muted-foreground">or paste a custom question</div>
            <Textarea
              rows={5}
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              placeholder="Paste or type your own question prompt here..."
              className="w-full resize-none"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Cancel</Button>
            <Button onClick={assignSelectedQuestion}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Heatmap Report Dialog (kept, but overlay is the primary view now) */}
      <Dialog open={showHeatmapDialog} onOpenChange={setShowHeatmapDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Gaze Heatmap Report</DialogTitle>
            <DialogDescription>
              Aggregated dwell-time weighted gaze across the session.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {heatmapPoints && heatmapPoints.length > 0 ? (
              <div className="w-full flex items-center justify-center">
                <GazeHeatmap points={heatmapPoints} onImageReady={setHeatmapUrl} />
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">No points</div>
            )}

            {heatmapStats && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div><span className="text-muted-foreground">Samples:</span> {heatmapStats.sampleCount}</div>
                <div><span className="text-muted-foreground">Total time:</span> {heatmapStats.totalTimeSec.toFixed(1)}s</div>
                <div><span className="text-muted-foreground">Viewport changes:</span> {heatmapStats.viewportChanges}</div>
                <div><span className="text-muted-foreground">Max cell (sec):</span> {heatmapStats.maxCell.toFixed(3)}</div>
                <div><span className="text-muted-foreground">Mean cell (sec):</span> {heatmapStats.meanCell.toFixed(5)}</div>
                <div><span className="text-muted-foreground">Base viewport:</span> {heatmapStats.baseWidth}×{heatmapStats.baseHeight}</div>
              </div>
            )}
          </div>

          <DialogFooter>
            {heatmapSamples && heatmapSamples.length > 0 && (
              <button
                onClick={() => {
                  try {
                    const lines = heatmapSamples
                      .filter((s) => Number.isFinite(s.x) && Number.isFinite(s.y))
                      .map((s) => `(${Math.round(s.x)}, ${Math.round(s.y)})`)
                      .join("\n")
                    const blob = new Blob([lines], { type: "text/plain;charset=utf-8" })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `gaze-tuples-${meetingCode}.txt`
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                    setTimeout(() => URL.revokeObjectURL(url), 1000)
                  } catch {}
                }}
                className="inline-flex items-center justify-center h-9 px-4 rounded-md border text-sm mr-2"
              >
                Download (x,y) tuples
              </button>
            )}
            {heatmapUrl && (
              <a
                href={heatmapUrl}
                download={`heatmap-${meetingCode}.png`}
                className="inline-flex items-center justify-center h-9 px-4 rounded-md border text-sm"
              >
                Download PNG
              </a>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Heatmap Overlay */}
      {showHeatmapOverlay && (
        <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
          {/* Heatmap layer */}
          <div className="absolute inset-0 flex items-start justify-start" style={{ overflow: 'hidden' }}>
            <GazeHeatmap
              points={heatmapPoints}
              maxOpacity={0.45}
              blur={0.85}
              radius={40}
              fitHeight
              heightRatio={1}
              transparentBackground
              onImageReady={setHeatmapUrl}
            />
          </div>

          {/* Controls bottom-left */}
          <div className="absolute left-3 bottom-3 flex gap-2 pointer-events-auto">
            {heatmapSamples && heatmapSamples.length > 0 && (
              <button
                onClick={() => {
                  try {
                    const lines = heatmapSamples
                      .filter((s) => Number.isFinite(s.x) && Number.isFinite(s.y))
                      .map((s) => `(${Math.round(s.x)}, ${Math.round(s.y)})`)
                      .join("\n")
                    const blob = new Blob([lines], { type: "text/plain;charset=utf-8" })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `gaze-tuples-${meetingCode}.txt`
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                    setTimeout(() => URL.revokeObjectURL(url), 1000)
                  } catch {}
                }}
                className="inline-flex items-center justify-center h-8 px-3 rounded-md border bg-white/90 text-xs shadow"
              >
                Download tuples
              </button>
            )}
            {heatmapUrl && (
              <a
                href={heatmapUrl}
                download={`heatmap-${meetingCode}.png`}
                className="inline-flex items-center justify-center h-8 px-3 rounded-md border bg-white/90 text-xs shadow"
              >
                Download PNG
              </a>
            )}
          </div>

          {/* Overlay is toggled via the header button; no close icon per request */}
        </div>
      )}
    </div>
  )
}
