"use client"

import { useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/card"

interface GazeData {
  x: number
  y: number
  confidence: number
  timestamp: number
  pageW?: number
  pageH?: number
}

interface GazeTrackingCanvasProps {
  gazeData: GazeData | null
  showMetrics?: boolean
  remoteVideoElement: HTMLVideoElement | null
}

export function GazeTrackingCanvas({ gazeData, showMetrics = false, remoteVideoElement }: GazeTrackingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 320, height: 180 })
  const gazeHistoryRef = useRef<GazeData[]>([])
  const smoothedPositionRef = useRef<{ x: number; y: number } | null>(null)
  const animationFrameRef = useRef<number>()

  useEffect(() => {
    const updateCanvasSize = () => {
      const screenWidth = window.innerWidth
      // Canvas should be ~20% of screen width to show full screen representation
      const width = Math.min(Math.floor(screenWidth * 0.2), 480)
      // Assume candidate's screen is 16:9
      const height = Math.floor((width * 9) / 16)

      setCanvasSize({ width, height })
    }

    updateCanvasSize()
    window.addEventListener("resize", updateCanvasSize)

    return () => {
      window.removeEventListener("resize", updateCanvasSize)
    }
  }, [])

  // Set canvas dimensions
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = canvasSize.width
    canvas.height = canvasSize.height
  }, [canvasSize])

  useEffect(() => {
    if (!gazeData) return

    // Apply exponential smoothing for smoother movement
    if (smoothedPositionRef.current) {
      const smoothingFactor = 0.3
      smoothedPositionRef.current = {
        x: smoothedPositionRef.current.x * (1 - smoothingFactor) + gazeData.x * smoothingFactor,
        y: smoothedPositionRef.current.y * (1 - smoothingFactor) + gazeData.y * smoothingFactor,
      }
    } else {
      smoothedPositionRef.current = { x: gazeData.x, y: gazeData.y }
    }

    const smoothedGaze = {
      ...gazeData,
      x: smoothedPositionRef.current.x,
      y: smoothedPositionRef.current.y,
    }

    gazeHistoryRef.current.push(smoothedGaze)
    if (gazeHistoryRef.current.length > 30) {
      gazeHistoryRef.current.shift()
    }
  }, [gazeData])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const draw = () => {
      // Clear with lighter trail effect
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const candidateScreenWidth = gazeData?.pageW || 1920
      const candidateScreenHeight = gazeData?.pageH || 1080

      console.log(
        `[debug] Candidate viewport: ${candidateScreenWidth}x${candidateScreenHeight}, Canvas: ${canvas.width}x${canvas.height}`,
      )

      // Scale gaze coordinates from candidate's screen to our canvas
      const scaleX = canvas.width / candidateScreenWidth
      const scaleY = canvas.height / candidateScreenHeight

      // Draw dashed box showing where the video area is on candidate's screen
      // Assume video is centered and takes up most of the screen (e.g., 90% width)
      const videoBoxWidth = canvas.width * 0.9
      const videoBoxHeight = canvas.height * 0.9
      const videoBoxX = (canvas.width - videoBoxWidth) / 2
      const videoBoxY = (canvas.height - videoBoxHeight) / 2

      ctx.strokeStyle = "rgba(100, 100, 100, 0.5)"
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.strokeRect(videoBoxX, videoBoxY, videoBoxWidth, videoBoxHeight)
      ctx.setLineDash([])

      // Draw trail
      gazeHistoryRef.current.forEach((point, index) => {
        const progress = index / gazeHistoryRef.current.length
        const alpha = progress * 0.4
        const scaledX = point.x * scaleX
        const scaledY = point.y * scaleY
        const radius = 3 + progress * 3

        ctx.fillStyle = `rgba(255, 50, 50, ${alpha * point.confidence})`
        ctx.beginPath()
        ctx.arc(scaledX, scaledY, radius, 0, Math.PI * 2)
        ctx.fill()
      })

      // Draw current gaze dot
      if (gazeData && smoothedPositionRef.current) {
        const scaledX = smoothedPositionRef.current.x * scaleX
        const scaledY = smoothedPositionRef.current.y * scaleY

        console.log(
          `[debug] Drawing dot at: (${smoothedPositionRef.current.x}, ${smoothedPositionRef.current.y}) -> scaled: (${scaledX.toFixed(1)}, ${scaledY.toFixed(1)})`,
        )

        // Draw bright red dot (no bounds check - can appear anywhere on screen)
        ctx.fillStyle = `rgba(255, 0, 0, 0.9)`
        ctx.beginPath()
        ctx.arc(scaledX, scaledY, 12, 0, Math.PI * 2)
        ctx.fill()
      }

      animationFrameRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [gazeData, canvasSize])

  return (
    <Card
      ref={containerRef}
      className="fixed bottom-6 right-6 z-50 overflow-hidden shadow-2xl border-2"
      style={{ width: canvasSize.width, height: canvasSize.height }}
    >
      <canvas ref={canvasRef} className="w-full h-full bg-background" />
      <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground font-medium">Gaze Tracking</div>
    </Card>
  )
}
