"use client"

import { useEffect, useRef, useState } from "react"

interface GazeData {
  x: number
  y: number
  confidence: number
  timestamp: number
}

interface GazeOverlayProps {
  gazeData: GazeData | null
  showMetrics?: boolean
  videoElement: HTMLVideoElement | null
}

export function GazeOverlay({ gazeData, showMetrics = false, videoElement }: GazeOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [metrics, setMetrics] = useState({
    avgConfidence: 0,
    gazePoints: 0,
  })
  const gazeHistoryRef = useRef<GazeData[]>([])
  const animationFrameRef = useRef<number>()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !videoElement) return

    const resizeCanvas = () => {
      const rect = videoElement.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [videoElement])

  useEffect(() => {
    if (!gazeData) return

    // Add to history
    gazeHistoryRef.current.push(gazeData)
    if (gazeHistoryRef.current.length > 20) {
      gazeHistoryRef.current.shift()
    }

    // Update metrics
    setMetrics((prev) => ({
      avgConfidence: (prev.avgConfidence * prev.gazePoints + gazeData.confidence) / (prev.gazePoints + 1),
      gazePoints: prev.gazePoints + 1,
    }))
  }, [gazeData])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const draw = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      gazeHistoryRef.current.forEach((point, index) => {
        const alpha = (index / gazeHistoryRef.current.length) * 0.6
        const radius = 20 + (index / gazeHistoryRef.current.length) * 15

        const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius)
        gradient.addColorStop(0, `rgba(255, 50, 50, ${alpha * point.confidence})`)
        gradient.addColorStop(0.5, `rgba(255, 100, 100, ${alpha * point.confidence * 0.5})`)
        gradient.addColorStop(1, "rgba(255, 50, 50, 0)")

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
        ctx.fill()
      })

      if (gazeData) {
        // Outer glow - bright red
        const outerGradient = ctx.createRadialGradient(gazeData.x, gazeData.y, 0, gazeData.x, gazeData.y, 40)
        outerGradient.addColorStop(0, `rgba(255, 50, 50, ${0.8 * gazeData.confidence})`)
        outerGradient.addColorStop(0.5, `rgba(255, 100, 100, ${0.4 * gazeData.confidence})`)
        outerGradient.addColorStop(1, "rgba(255, 50, 50, 0)")

        ctx.fillStyle = outerGradient
        ctx.beginPath()
        ctx.arc(gazeData.x, gazeData.y, 40, 0, Math.PI * 2)
        ctx.fill()

        // Middle ring - solid red
        ctx.fillStyle = `rgba(255, 50, 50, ${0.9 * gazeData.confidence})`
        ctx.beginPath()
        ctx.arc(gazeData.x, gazeData.y, 12, 0, Math.PI * 2)
        ctx.fill()

        // Inner dot - bright red
        ctx.fillStyle = `rgba(255, 0, 0, ${0.95 * gazeData.confidence})`
        ctx.beginPath()
        ctx.arc(gazeData.x, gazeData.y, 8, 0, Math.PI * 2)
        ctx.fill()

        // White center for contrast
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)"
        ctx.beginPath()
        ctx.arc(gazeData.x, gazeData.y, 4, 0, Math.PI * 2)
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
  }, [gazeData])

  if (!videoElement) return null

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-50" />
      {showMetrics && gazeData && (
        <div className="absolute top-4 right-4 bg-black/90 text-white p-3 rounded-lg text-xs space-y-1 z-[60] font-mono">
          <div>
            Position: ({gazeData.x}, {gazeData.y})
          </div>
          <div>Confidence: {gazeData.confidence.toFixed(2)}</div>
          <div>Points: {metrics.gazePoints}</div>
          <div>Avg Conf: {metrics.avgConfidence.toFixed(2)}</div>
        </div>
      )}
    </>
  )
}
