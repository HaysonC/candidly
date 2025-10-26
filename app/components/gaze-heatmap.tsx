"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"

type Point = { x: number; y: number } | [number, number]

export type GazeHeatmapProps = {
  points: Point[]
  radius?: number
  maxOpacity?: number
  blur?: number // 0..1
  padding?: number
  className?: string
  style?: React.CSSProperties
  onImageReady?: (dataUrl: string) => void
}

export default function GazeHeatmap({
  points,
  radius = 40,
  maxOpacity = 0.6,
  blur = 0.85,
  padding = 20,
  className,
  style,
  onImageReady,
}: GazeHeatmapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [viewport, setViewport] = useState<{ vw: number; vh: number }>({ vw: 1200, vh: 800 })

  // Track window size to scale heatmap to fit within viewport
  useEffect(() => {
    const update = () => setViewport({ vw: window.innerWidth, vh: window.innerHeight })
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  const filtered = useMemo(() => {
    return (points || [])
      .map((p) => (Array.isArray(p) ? { x: p[0], y: p[1] } : p))
      .filter(({ x, y }) => Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0)
  }, [points])

  const { W, H } = useMemo(() => {
    if (!filtered.length) return { W: 640, H: 360 }
    let maxX = 0, maxY = 0
    for (const { x, y } of filtered) {
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
    return { W: Math.ceil(maxX + padding), H: Math.ceil(maxY + padding) }
  }, [filtered, padding])

  useEffect(() => {
    let destroyed = false
    let instance: any = null

    async function run() {
      try {
        const mod: any = await import("heatmap.js")
        const h337: any = mod?.default ?? mod
        const el = containerRef.current
        if (!el || destroyed) return

        // Scale down to fit within viewport (90vw x 65vh), maintain aspect ratio
        const maxW = Math.max(320, Math.floor(viewport.vw * 0.9))
        const maxH = Math.max(240, Math.floor(viewport.vh * 0.65))
        const scale = Math.min(maxW / W, maxH / H, 1)
        const SW = Math.max(1, Math.floor(W * scale))
        const SH = Math.max(1, Math.floor(H * scale))

        // Prepare container size and clear previous contents
        el.style.position = "relative"
        el.style.width = `${SW}px`
        el.style.height = `${SH}px`
        el.innerHTML = ""

        const scaledRadius = Math.max(8, Math.round(radius * scale))
        instance = h337.create({ container: el, radius: scaledRadius, maxOpacity, blur })
        const data = {
          max: 5,
          data: filtered.map(({ x, y }) => ({ x: Math.round(x * scale), y: Math.round(y * scale), value: 1 })),
        }
        instance.setData(data)

        // export PNG if requested
        if (onImageReady) {
          // heatmap.js draws into a canvas inside the container
          const canvas = el.querySelector("canvas") as HTMLCanvasElement | null
          if (canvas) {
            const url = canvas.toDataURL("image/png")
            if (!destroyed) onImageReady(url)
          }
        }
      } catch (e) {
        // no-op
      }
    }
    run()

    return () => {
      destroyed = true
      const el = containerRef.current
      if (el) el.innerHTML = ""
      instance = null
    }
  }, [filtered, W, H, radius, maxOpacity, blur, onImageReady, viewport])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        backgroundColor: "#fff",
        border: "1px solid #ccc",
        background:
          "repeating-linear-gradient(0deg, rgba(0,0,0,.03), rgba(0,0,0,.03) 24px, transparent 24px, transparent 48px)," +
          "repeating-linear-gradient(90deg, rgba(0,0,0,.03), rgba(0,0,0,.03) 24px, transparent 24px, transparent 48px)",
        ...style,
      }}
    />
  )
}
