"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface CalibrationFullscreenProps {
  open: boolean
  onComplete: () => void
  onCancel: () => void
}

export function CalibrationFullscreen({ open, onComplete, onCancel }: CalibrationFullscreenProps) {
  const [clicksPerDot, setClicksPerDot] = useState<number[]>(Array(9).fill(0))
  const [message, setMessage] = useState("Look at each point and click it 3 times")
  const [showInstructions, setShowInstructions] = useState(false)
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  const CLICKS_REQUIRED = 3
  const INACTIVITY_TIMEOUT = 7500 // 7.5 seconds

  const calibrationPoints = [
    { x: 10, y: 10 }, // Top-left
    { x: 50, y: 10 }, // Top-center
    { x: 90, y: 10 }, // Top-right
    { x: 10, y: 50 }, // Middle-left
    { x: 50, y: 50 }, // Center
    { x: 90, y: 50 }, // Middle-right
    { x: 10, y: 90 }, // Bottom-left
    { x: 50, y: 90 }, // Bottom-center
    { x: 90, y: 90 }, // Bottom-right
  ]

  useEffect(() => {
    if (open) {
      setShowInstructions(true)
      lastActivityRef.current = Date.now()
      console.log("[debug] Full-screen calibration auto-started")
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const checkInactivity = () => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current
      if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
        setShowInstructions(true)
      }
    }

    inactivityTimerRef.current = setInterval(checkInactivity, 1000)

    return () => {
      if (inactivityTimerRef.current) {
        clearInterval(inactivityTimerRef.current)
      }
    }
  }, [open])

  const handleDotClick = async (index: number) => {
    lastActivityRef.current = Date.now()
    setShowInstructions(false)

    const newClicks = [...clicksPerDot]
    newClicks[index]++
    setClicksPerDot(newClicks)

    console.log(`[debug] Calibration point ${index + 1}/9 - Click ${newClicks[index]}/${CLICKS_REQUIRED}`)

    if (newClicks[index] >= CLICKS_REQUIRED) {
      const allComplete = newClicks.every((clicks) => clicks >= CLICKS_REQUIRED)
      if (allComplete) {
        setMessage("Calibration complete! Processing...")
        console.log("[debug] Full-screen calibration complete")
        setTimeout(() => {
          onComplete()
        }, 1000)
      } else {
        const nextIncomplete = newClicks.findIndex((clicks) => clicks < CLICKS_REQUIRED)
        setMessage(`Point ${index + 1} complete! Move to point ${nextIncomplete + 1}.`)
      }
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {showInstructions && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/20 rounded-2xl p-8 max-w-lg mx-4 shadow-2xl relative">
            <button
              onClick={() => setShowInstructions(false)}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-2xl font-bold text-white mb-4">Calibration Instructions</h3>
            <div className="space-y-3 text-white/90">
              <p className="text-lg">• Look directly at each point on the screen</p>
              <p className="text-lg">• Click each point 3 times</p>
              <p className="text-lg">• Keep your head steady during calibration</p>
              <p className="text-lg">• Complete all 9 points for best accuracy</p>
            </div>
            <div className="flex items-center justify-center gap-3 mt-6 pt-6 border-t border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-gray-400"></div>
                <span className="text-sm text-white/70">Not clicked</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                <span className="text-sm text-white/70">In progress</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <span className="text-sm text-white/70">Complete</span>
              </div>
            </div>
            <Button
              onClick={() => setShowInstructions(false)}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white"
            >
              Got it!
            </Button>
          </div>
        </div>
      )}

      {/* Calibration points - positioned across entire screen */}
      {calibrationPoints.map((point, index) => {
        const clicks = clicksPerDot[index]
        const isComplete = clicks >= CLICKS_REQUIRED
        const isInProgress = clicks > 0 && clicks < CLICKS_REQUIRED

        return (
          <button
            key={index}
            onClick={() => handleDotClick(index)}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
              isComplete
                ? "w-16 h-16 bg-green-500 scale-110 shadow-lg shadow-green-500/50"
                : isInProgress
                  ? "w-14 h-14 bg-yellow-500 scale-105 shadow-lg shadow-yellow-500/50"
                  : "w-12 h-12 bg-white hover:bg-blue-400 hover:scale-125 cursor-pointer shadow-lg shadow-white/30"
            } rounded-full flex items-center justify-center font-bold text-lg`}
            style={{
              left: `${point.x}%`,
              top: `${point.y}%`,
            }}
            title={`Point ${index + 1}: Click ${CLICKS_REQUIRED - clicks} more time${CLICKS_REQUIRED - clicks !== 1 ? "s" : ""}`}
          >
            {clicks > 0 && !isComplete && <span className="text-white drop-shadow-lg">{clicks}</span>}
            {isComplete && <span className="text-white text-2xl">✓</span>}
          </button>
        )
      })}

      <div className="absolute bottom-8" style={{ left: "70%", transform: "translateX(-50%)" }}>
        <Button
          variant="outline"
          size="lg"
          onClick={onCancel}
          className="bg-black/60 backdrop-blur-md border-white/20 text-white hover:bg-black/80"
        >
          Cancel Calibration
        </Button>
      </div>

      <div className="absolute bottom-8" style={{ left: "30%", transform: "translateX(-50%)" }}>
        <div className="bg-black/60 backdrop-blur-md rounded-full px-6 py-3 border border-white/10">
          <div className="text-white text-sm font-medium">
            Progress: {clicksPerDot.filter((c) => c >= CLICKS_REQUIRED).length} / 9 points complete
          </div>
        </div>
      </div>
    </div>
  )
}
