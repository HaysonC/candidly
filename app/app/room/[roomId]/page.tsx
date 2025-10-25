"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Copy, Mic, MicOff, Phone, Video, VideoOff, Monitor, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const roomId = params.roomId as string

  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [candidateReady, setCandidateReady] = useState(false)
  const [templateData, setTemplateData] = useState<any | null>(null)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)

  // Load template by query param (?template=ID)
  useEffect(() => {
    const tid = searchParams.get("template")
    if (!tid) return
    const load = async () => {
      try {
        // Try plain /api path first
        let res = await fetch(`/api/templates/${tid}`)
        if (!res.ok) {
          // Fallback to nested /app/api path if project routes are nested
          res = await fetch(`/app/api/templates/${tid}`)
        }
        if (res.ok) {
          const data = await res.json()
          setTemplateData(data)
        } else {
          setTemplateData(null)
          toast({
            title: "Template not found",
            description: `Could not load template ${tid}`,
            variant: "destructive",
          })
        }
      } catch (e) {
        setTemplateData(null)
        toast({
          title: "Template error",
          description: "Failed to fetch template data",
          variant: "destructive",
        })
      }
    }
    load()
    // do not include setTemplateData in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    initializeCall()

    return () => {
      cleanup()
    }
  }, [roomId])

  const initializeCall = async () => {
    try {
      // Get local media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })

      localStreamRef.current = stream

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      setIsLoading(false)

      const signalingServer = process.env.NEXT_PUBLIC_SIGNALING_SERVER || "ws://localhost:8000"
      const wsUrl = `${signalingServer}/ws/${roomId}`

      console.log("[debug] Connecting to signaling server:", wsUrl)
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log("[debug] Connected to signaling server")
        toast({
          title: "Connected",
          description: "Connected to signaling server",
        })
      }

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data)
        console.log("[debug] Received signaling message:", data.type)

        switch (data.type) {
          case "room-joined":
            console.log("[debug] Joined room with", data.participants, "participants")
            break

          case "user-joined":
            // Another user joined, create offer
            console.log("[debug] User joined, creating offer")
            await createOffer()
            setIsConnected(true)
            toast({
              title: "User joined",
              description: "Another participant has joined the call",
            })
            break
          case "calibration-complete":
          case "calibration_complete":
          case "calibrationComplete":
            // Candidate finished calibration; unlock assignment actions
            console.log("[debug] Calibration complete received")
            setCandidateReady(true)
            toast({
              title: "Calibration complete",
              description: "You can now assign the questions to the candidate.",
            })
            break
          case "calibration-complete":
            // Candidate finished calibration; unlock assignment actions
            console.log("[debug] Calibration complete received")
            setCandidateReady(true)
            toast({
              title: "Calibration complete",
              description: "You can now assign the questions to the candidate.",
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
          case "gaze-data":
            // If we're receiving gaze updates, the candidate is active; unlock if not already
            if (!candidateReady) {
              setCandidateReady(true)
              console.log("[debug] Gaze data received — unlocking assign button")
            }
            break

          case "user-left":
            console.log("[debug] User left")
            handleUserLeft()
            toast({
              title: "User left",
              description: "The other participant has left the call",
            })
            break
        }
      }

      ws.onerror = (error) => {
        console.error("[debug] WebSocket error:", error)
        toast({
          title: "Connection Error",
          description: "Failed to connect to signaling server. Make sure the server is running.",
          variant: "destructive",
        })
      }

      ws.onclose = () => {
        console.log("[debug] WebSocket closed")
        if (isConnected) {
          toast({
            title: "Disconnected",
            description: "Connection to server lost",
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      console.error("[debug] Error initializing call:", error)
      setIsLoading(false)
      toast({
        title: "Media Error",
        description: "Failed to access camera or microphone. Please check permissions.",
        variant: "destructive",
      })
    }
  }

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
    })

    // Add local stream tracks to peer connection
    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!)
    })

    // Handle incoming remote stream
    pc.ontrack = (event) => {
      console.log("[debug] Received remote track")
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0]
      }
    }

    // Handle ICE candidates
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
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        toast({
          title: "Connection Issue",
          description: "The connection quality is poor or lost",
          variant: "destructive",
        })
      }
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
      // Stop screen sharing
      screenStreamRef.current?.getTracks().forEach((track) => track.stop())
      screenStreamRef.current = null

      // Switch back to camera
      if (localStreamRef.current && localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current
      }

      // Replace track in peer connection
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
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        })

        screenStreamRef.current = screenStream

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream
        }

        // Replace track in peer connection
        if (peerConnectionRef.current) {
          const screenTrack = screenStream.getVideoTracks()[0]
          const sender = peerConnectionRef.current.getSenders().find((s) => s.track?.kind === "video")
          if (sender && screenTrack) {
            await sender.replaceTrack(screenTrack)
          }

          // Handle when user stops sharing via browser UI
          screenTrack.onended = () => {
            toggleScreenShare()
          }
        }

        setIsScreenSharing(true)
      } catch (error) {
        console.error("[debug] Error sharing screen:", error)
        toast({
          title: "Screen Share Error",
          description: "Failed to start screen sharing",
          variant: "destructive",
        })
      }
    }
  }

  const endCall = () => {
    cleanup()
    router.push("/")
  }

  // Prepare and send assignment payload to the peer
  const assignTemplateToEditor = () => {
    if (!templateData) return
    // Create a commented header compatible with multiple languages
    const line = (s: string) => `// ${s}`
    const crit: string[] = Array.isArray(templateData?.criteria) ? templateData.criteria : []
    const questions: string[] = Array.isArray(templateData?.coding_questions)
      ? templateData.coding_questions
      : []
    const header = [
      line("=== Interview Template ==="),
      line(`Name: ${templateData?.name || "Untitled"}`),
      line(""),
      line("Criteria:"),
      ...crit.map((c) => line(`- ${c}`)),
      line(""),
      line("Questions:"),
      ...questions.map((q, i) => line(`${i + 1}. ${q}`)),
      line("=========================="),
      "",
    ].join("\n")

    try {
      wsRef.current?.send(
        JSON.stringify({
          type: "editor",
          payload: { kind: "update", value: header },
        }),
      )
      toast({ title: "Assigned", description: "Questions sent to the candidate." })
    } catch (e) {
      toast({
        title: "Assignment failed",
        description: "Could not send questions to the candidate.",
        variant: "destructive",
      })
    }
  }

  const cleanup = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    screenStreamRef.current?.getTracks().forEach((track) => track.stop())
    peerConnectionRef.current?.close()
    wsRef.current?.close()
  }

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId)
    toast({
      title: "Copied!",
      description: "Room code copied to clipboard",
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Setting up your call...</h2>
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
            <h1 className="text-2xl font-bold">Video Call</h1>
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
          </div>
          <div className="flex items-center gap-2">
            {candidateReady && templateData && (
              <Button size="sm" onClick={assignTemplateToEditor}>
                Assign Template Questions
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={copyRoomId}>
              <Copy className="w-4 h-4 mr-2" />
              Copy Room Code
            </Button>
          </div>
        </div>

        {/* Video Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Remote Video */}
          <Card className="relative aspect-video bg-muted overflow-hidden">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            {!isConnected && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Video className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">Waiting for participant</p>
                    <p className="text-sm text-muted-foreground">Share the room code to invite someone</p>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Local Video */}
          <Card className="relative aspect-video bg-muted overflow-hidden">
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            <div className="absolute bottom-4 left-4 flex items-center gap-2">
              <span className="px-2 py-1 text-xs bg-black/70 text-white rounded backdrop-blur-sm">
                You {isScreenSharing && "(Sharing)"}
              </span>
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
          </Card>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-3">
          <Button
            variant={isAudioEnabled ? "secondary" : "destructive"}
            size="lg"
            onClick={toggleAudio}
            className="rounded-full w-14 h-14 transition-all hover:scale-105"
            title={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
          >
            {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </Button>

          <Button
            variant={isVideoEnabled ? "secondary" : "destructive"}
            size="lg"
            onClick={toggleVideo}
            className="rounded-full w-14 h-14 transition-all hover:scale-105"
            title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
          >
            {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </Button>

          <Button
            variant={isScreenSharing ? "default" : "secondary"}
            size="lg"
            onClick={toggleScreenShare}
            className="rounded-full w-14 h-14 transition-all hover:scale-105"
            title={isScreenSharing ? "Stop sharing" : "Share screen"}
          >
            <Monitor className="w-5 h-5" />
          </Button>

          <Button
            variant="destructive"
            size="lg"
            onClick={endCall}
            className="rounded-full w-14 h-14 transition-all hover:scale-105"
            title="End call"
          >
            <Phone className="w-5 h-5 rotate-[135deg]" />
          </Button>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>End-to-end encrypted peer-to-peer connection</p>
        </div>
      </div>
    </div>
  )
}
