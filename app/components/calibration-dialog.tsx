"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface CalibrationDialogProps {
  open: boolean
  onComplete: () => void
  onCancel: () => void
}

export function CalibrationDialog({ open, onComplete, onCancel }: CalibrationDialogProps) {
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [currentDot, setCurrentDot] = useState(0)
  const [clicksPerDot, setClicksPerDot] = useState<number[]>(Array(9).fill(0))
  const [message, setMessage] = useState("Click 'Start Calibration' to begin")

  const CLICKS_REQUIRED = 3
  const calibrationPoints = [
    { x: 10, y: 10 },
    { x: 50, y: 10 },
    { x: 90, y: 10 },
    { x: 10, y: 50 },
    { x: 50, y: 50 },
    { x: 90, y: 50 },
    { x: 10, y: 90 },
    { x: 50, y: 90 },
    { x: 90, y: 90 },
  ]

  const handleStartCalibration = () => {
    setIsCalibrating(true)
    setMessage("Look at each point and click it 3 times. Keep your head steady.")
    console.log("[debug] Calibration started")
  }

  const handleDotClick = async (index: number) => {
    if (!isCalibrating) return

    const newClicks = [...clicksPerDot]
    newClicks[index]++
    setClicksPerDot(newClicks)

    console.log(`[debug] Calibration point ${index + 1}/9 - Click ${newClicks[index]}/${CLICKS_REQUIRED}`)

    if (newClicks[index] >= CLICKS_REQUIRED) {
      const allComplete = newClicks.every((clicks) => clicks >= CLICKS_REQUIRED)
      if (allComplete) {
        setMessage("Calibration complete! Processing...")
        console.log("[debug] Calibration complete")
        setTimeout(() => {
          onComplete()
        }, 1000)
      } else {
        setMessage(`Point ${index + 1} complete! Continue to the next point.`)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Eye Tracking Calibration</DialogTitle>
          <DialogDescription>
            This calibration helps us accurately track where you're looking on the screen. It only takes a moment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative w-full bg-muted rounded-lg" style={{ paddingTop: "66%" }}>
            {calibrationPoints.map((point, index) => (
              <button
                key={index}
                onClick={() => handleDotClick(index)}
                disabled={!isCalibrating}
                className={`absolute w-5 h-5 rounded-full transition-all transform -translate-x-1/2 -translate-y-1/2 ${
                  clicksPerDot[index] >= CLICKS_REQUIRED
                    ? "bg-blue-500 scale-110"
                    : isCalibrating
                      ? "bg-gray-900 hover:bg-gray-700 hover:scale-125 cursor-pointer"
                      : "bg-gray-400 cursor-not-allowed"
                }`}
                style={{
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                }}
                title={`Click ${CLICKS_REQUIRED - clicksPerDot[index]} more time${CLICKS_REQUIRED - clicksPerDot[index] !== 1 ? "s" : ""}`}
              >
                {clicksPerDot[index] > 0 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-bold">
                    {clicksPerDot[index]}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="text-center text-sm text-muted-foreground">{message}</div>

          <div className="flex justify-end gap-2">
            {!isCalibrating ? (
              <>
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button onClick={handleStartCalibration}>Start Calibration</Button>
              </>
            ) : (
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
