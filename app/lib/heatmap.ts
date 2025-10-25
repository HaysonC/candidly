// Lightweight heatmap utilities for gaze analytics
// Provides: buildHeatmapReportFromSamples(samples, options)
// - Aggregates dwell-time weighted gaze samples into a grid
// - Renders a PNG data URL with simple palette and optional blur

export type GazeSample = {
	x: number
	y: number
	timestamp: number // ms
	confidence?: number // 0..1 (if missing or <=0 we treat as 1)
	pageW?: number
	pageH?: number
}

export type HeatmapOptions = {
	cellSize?: number // grid cell size in px (base viewport)
	dwellCapMs?: number // cap any single dwell dt in ms
	renderWidth?: number
	renderHeight?: number
	baseWidth?: number
	baseHeight?: number
	blurRadius?: number // CSS pixel blur applied when drawing
	palette?: "classic" | "red" // simple palettes
	alpha?: number // overall opacity multiplier 0..1
}

export type HeatmapStats = {
	sampleCount: number
	totalTimeSec: number
	maxCell: number
	meanCell: number
	viewportChanges: number
}

export type HeatmapReport = {
	dataUrl: string
	canvas: HTMLCanvasElement
	grid: Float32Array
	cols: number
	rows: number
	baseWidth: number
	baseHeight: number
	stats: HeatmapStats
}

// Helper: find the most frequent viewport or fallback to first/guess
function pickBaseViewport(samples: GazeSample[], optW?: number, optH?: number): { w: number; h: number } {
	if (optW && optH) return { w: optW, h: optH }
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
	if (counts.size > 0) {
		let best: { w: number; h: number; c: number } | null = null
		for (const e of counts.values()) if (!best || e.c > best.c) best = e
		if (best) return { w: best.w, h: best.h }
	}
	// Fallback to first sample dims or a sensible default
	const first = samples.find((s) => (s.pageW || 0) > 0 && (s.pageH || 0) > 0)
	if (first?.pageW && first?.pageH) return { w: Math.round(first.pageW), h: Math.round(first.pageH) }
	return { w: 1280, h: 720 }
}

function classicPalette(t: number): [number, number, number] {
	// Simple blue -> cyan -> green -> yellow -> red gradient
	const clamp = (v: number) => Math.max(0, Math.min(1, v))
	t = clamp(t)
	const fourT = 4 * t
	const r = Math.min(255, Math.max(0, Math.floor(255 * Math.max(Math.min(fourT - 1.5, -fourT + 4.5), 0))))
	const g = Math.min(255, Math.max(0, Math.floor(255 * Math.max(Math.min(fourT - 0.5, -fourT + 3.5), 0))))
	const b = Math.min(255, Math.max(0, Math.floor(255 * Math.max(Math.min(fourT + 0.5, -fourT + 2.5), 0))))
	return [r, g, b]
}

function redPalette(t: number): [number, number, number] {
	const clamp = (v: number) => Math.max(0, Math.min(1, v))
	t = clamp(t)
	const r = 255
	const g = Math.floor(255 * t)
	const b = 0
	return [r, g, b]
}

function drawGridToCanvas(
	grid: Float32Array,
	cols: number,
	rows: number,
	cellSize: number,
	renderW: number,
	renderH: number,
	palette: "classic" | "red",
	alpha: number,
	blurRadius: number,
): HTMLCanvasElement {
	const max = grid.length ? Math.max(...grid as any) : 0
	const canvas = document.createElement("canvas")
	canvas.width = renderW
	canvas.height = renderH

	const tmp = document.createElement("canvas")
	tmp.width = cols
	tmp.height = rows
	const tctx = tmp.getContext("2d")!
	const img = tctx.createImageData(cols, rows)
	const data = img.data

	for (let y = 0; y < rows; y++) {
		for (let x = 0; x < cols; x++) {
			const idx = y * cols + x
			const v = grid[idx]
			const n = max > 0 ? v / max : 0
			const [r, g, b] = palette === "classic" ? classicPalette(n) : redPalette(n)
			const a = Math.max(0, Math.min(255, Math.floor((alpha * n) * 255)))
			const di = idx * 4
			data[di + 0] = r
			data[di + 1] = g
			data[di + 2] = b
			data[di + 3] = a
		}
	}
	tctx.putImageData(img, 0, 0)

	const ctx = canvas.getContext("2d")!
	if (blurRadius > 0) {
		ctx.filter = `blur(${blurRadius}px)`
	}
	ctx.imageSmoothingEnabled = true
	// Scale the low-res heat grid up to render size proportionally
	ctx.drawImage(tmp, 0, 0, renderW, renderH)
	return canvas
}

export function buildHeatmapReportFromSamples(
	inputSamples: GazeSample[],
	options: HeatmapOptions = {},
): HeatmapReport {
	const cellSize = options.cellSize ?? 16
	const dwellCapMs = options.dwellCapMs ?? 200
	const alpha = options.alpha ?? 0.95
	const palette = options.palette ?? "classic"
	const blurRadius = options.blurRadius ?? 20

	const samples = (Array.isArray(inputSamples) ? inputSamples : [])
		.filter((s) => Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.timestamp))
		.sort((a, b) => a.timestamp - b.timestamp)

	const stats: HeatmapStats = {
		sampleCount: samples.length,
		totalTimeSec:
			samples.length > 1 ? Math.max(0, (samples[samples.length - 1].timestamp - samples[0].timestamp) / 1000) : 0,
		maxCell: 0,
		meanCell: 0,
		viewportChanges: 0,
	}

	// Determine base viewport
	const base = pickBaseViewport(samples, options.baseWidth, options.baseHeight)
	const baseWidth = base.w
	const baseHeight = base.h

	const cols = Math.max(1, Math.ceil(baseWidth / cellSize))
	const rows = Math.max(1, Math.ceil(baseHeight / cellSize))
	const grid = new Float32Array(cols * rows)

	let prevTs = samples.length ? samples[0].timestamp : 0
	let prevVW = samples.length ? (samples[0].pageW || baseWidth) : baseWidth
	let prevVH = samples.length ? (samples[0].pageH || baseHeight) : baseHeight

	for (const s of samples) {
		const sw = s.pageW && s.pageW > 0 ? s.pageW : baseWidth
		const sh = s.pageH && s.pageH > 0 ? s.pageH : baseHeight
		if (sw !== prevVW || sh !== prevVH) stats.viewportChanges += 1
		prevVW = sw
		prevVH = sh

		// Reproject to base viewport
		const sx = (s.x / sw) * baseWidth
		const sy = (s.y / sh) * baseHeight
		if (!Number.isFinite(sx) || !Number.isFinite(sy)) continue

		const gx = Math.floor(sx / cellSize)
		const gy = Math.floor(sy / cellSize)
		if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue

		let dtMs = s.timestamp - prevTs
		if (!Number.isFinite(dtMs) || dtMs <= 0) dtMs = 16 // minimal dwell to avoid all-zero
		dtMs = Math.min(dtMs, dwellCapMs)

		// Confidence fallback: treat missing/zero as 1 to avoid blank maps
		let c = s.confidence
		if (!Number.isFinite(c as number) || (c as number) <= 0) c = 1

		const weightSec = (dtMs / 1000) * (c as number)
		grid[gy * cols + gx] += weightSec

		prevTs = s.timestamp
	}

	// Compute stats
	let max = 0
	let sum = 0
	for (let i = 0; i < grid.length; i++) {
		const v = grid[i]
		if (v > max) max = v
		sum += v
	}
	stats.maxCell = max
	stats.meanCell = grid.length > 0 ? sum / grid.length : 0

	const renderW = options.renderWidth ?? baseWidth
	const renderH = options.renderHeight ?? baseHeight
	const canvas = drawGridToCanvas(grid, cols, rows, cellSize, renderW, renderH, palette, alpha, blurRadius)
	const dataUrl = canvas.toDataURL("image/png")

	return { dataUrl, canvas, grid, cols, rows, baseWidth, baseHeight, stats }
}

// Utility: returns a normalized copy of a grid (0..1)
export function normalizeGridCopy(grid: Float32Array): Float32Array {
	const out = new Float32Array(grid.length)
	let max = 0
	for (let i = 0; i < grid.length; i++) if (grid[i] > max) max = grid[i]
	if (max <= 0) return out
	for (let i = 0; i < grid.length; i++) out[i] = grid[i] / max
	return out
}

