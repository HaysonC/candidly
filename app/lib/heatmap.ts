/*
  Heatmap accumulator and renderer for gaze points.
  - Stores screen-space positions as counts in a coarse grid
  - Optional exponential decay (so recent gaze weighs more)
  - Renders a blurred, color-mapped heatmap to a Canvas or DataURL

  Typical usage on interviewer side:

    import { createHeatmap } from "@/lib/heatmap"

    const hm = createHeatmap({ width: pageW, height: pageH, cellSize: 16, decayPerSecond: 0.1 })

    // whenever gaze data arrives (pixel coordinates in candidate's page space):
    hm.addPoint(gaze.x, gaze.y, gaze.confidence ?? 1)

    // occasionally (e.g., every animation frame or every N points):
    const canvas = hm.renderToCanvas({ width: desiredPxW, height: desiredPxH, radius: 30 })
    // append canvas into UI or draw onto an existing canvas as image source

  Notes:
  - width/height are the page coordinate system in which you receive x/y (e.g., candidate viewport size)
  - cellSize trades resolution vs performance/smoothing (8..32 is a good range)
  - radius is the blur radius in pixels (in page space); internally converted to grid cells
*/

export type HeatmapConfig = {
  width: number
  height: number
  cellSize?: number // page-space pixels per cell
  decayPerSecond?: number // exponential decay rate (0 = no decay)
}

export type RenderOptions = {
  width?: number // output canvas width in CSS pixels
  height?: number // output canvas height in CSS pixels
  radius?: number // blur radius in page-space pixels
  alpha?: number // overall opacity multiplier [0..1]
  clampMax?: number // optional fixed max for normalization; if omitted, uses current max
  background?: string // optional background fill for output canvas
  palette?: "inferno" | "turbo" | "red" | "classic" // built-in color palettes
}

export type HeatmapAccumulator = {
  addPoint: (x: number, y: number, weight?: number) => void
  addNormalized: (nx: number, ny: number, weight?: number) => void // x,y in [0,1]
  tick: (dtMs: number) => void // apply decay over elapsed time
  clear: () => void
  getGrid: () => { data: Float32Array; cols: number; rows: number }
  renderToCanvas: (opts?: RenderOptions) => HTMLCanvasElement
  toDataURL: (opts?: RenderOptions) => string
}

export function createHeatmap(cfg: HeatmapConfig): HeatmapAccumulator {
  const cellSize = Math.max(1, Math.floor(cfg.cellSize ?? 16))
  const cols = Math.max(1, Math.ceil(cfg.width / cellSize))
  const rows = Math.max(1, Math.ceil(cfg.height / cellSize))
  const grid = new Float32Array(cols * rows)
  const decayRate = Math.max(0, cfg.decayPerSecond ?? 0)

  const clampIdx = (ix: number, iy: number) => {
    const x = ix < 0 ? 0 : ix >= cols ? cols - 1 : ix
    const y = iy < 0 ? 0 : iy >= rows ? rows - 1 : iy
    return y * cols + x
  }

  const addPoint = (x: number, y: number, weight = 1) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    // Convert page-space pixels to grid coordinates
    const gx = Math.floor(x / cellSize)
    const gy = Math.floor(y / cellSize)
    if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return
    grid[gy * cols + gx] += weight
  }

  const addNormalized = (nx: number, ny: number, weight = 1) => {
    // nx, ny in [0..1]
    const x = nx * cfg.width
    const y = ny * cfg.height
    addPoint(x, y, weight)
  }

  const tick = (dtMs: number) => {
    if (decayRate <= 0) return
    const k = Math.exp(-decayRate * (dtMs / 1000))
    for (let i = 0; i < grid.length; i++) grid[i] *= k
  }

  const clear = () => grid.fill(0)

  const getGrid = () => ({ data: grid, cols, rows })

  // --- Rendering ---
  function renderToCanvas(opts: RenderOptions = {}): HTMLCanvasElement {
    const outW = Math.round(opts.width ?? cfg.width)
    const outH = Math.round(opts.height ?? cfg.height)
    const radiusPx = Math.max(0, Math.round(opts.radius ?? 24))
    const alpha = Math.min(1, Math.max(0, opts.alpha ?? 1))

    // 1) Copy grid into working buffer and apply separable Gaussian blur
    const blurred = new Float32Array(grid.length)

    if (radiusPx > 0) {
      const sigmaPx = radiusPx / 3 // heuristic: radius ≈ 3σ
      const sigmaCells = Math.max(0.5, sigmaPx / cellSize)
      const kernel = gaussianKernel1D(sigmaCells)
      separableConvolve(grid, blurred, cols, rows, kernel)
    } else {
      blurred.set(grid)
    }

    // 2) Normalize by max (or clampMax)
    let maxVal = 0
    for (let i = 0; i < blurred.length; i++) if (blurred[i] > maxVal) maxVal = blurred[i]
    const denom = Math.max(1e-6, opts.clampMax ?? maxVal)

    // 3) Build a low-res ImageData at grid resolution, then scale up
    const lowW = cols
    const lowH = rows
    const off = document.createElement("canvas")
    off.width = lowW
    off.height = lowH
    const ictx = off.getContext("2d")!
    const img = ictx.createImageData(lowW, lowH)

    const palette = buildPalette(opts.palette ?? "classic")

    for (let y = 0; y < lowH; y++) {
      for (let x = 0; x < lowW; x++) {
        const v = blurred[y * lowW + x] / denom // 0..1
        const [r, g, b, a] = mapValueToRGBA(v, alpha, palette)
        const idx = (y * lowW + x) * 4
        img.data[idx + 0] = r
        img.data[idx + 1] = g
        img.data[idx + 2] = b
        img.data[idx + 3] = a
      }
    }
    ictx.putImageData(img, 0, 0)

    // 4) Scale to requested output size
    const out = document.createElement("canvas")
    out.width = outW
    out.height = outH
    const octx = out.getContext("2d")!
    if (opts.background) {
      octx.fillStyle = opts.background
      octx.fillRect(0, 0, outW, outH)
    }

    octx.imageSmoothingEnabled = true
    octx.imageSmoothingQuality = "high"

    // Scale grid canvas to output using the same aspect as cfg.width x cfg.height
    octx.drawImage(off, 0, 0, off.width, off.height, 0, 0, outW, outH)

    return out
  }

  const toDataURL = (opts?: RenderOptions) => renderToCanvas(opts).toDataURL("image/png")

  return { addPoint, addNormalized, tick, clear, getGrid, renderToCanvas, toDataURL }
}

// --- Helpers ---
function gaussianKernel1D(sigma: number): Float32Array {
  // Kernel radius = ceil(3σ)
  const radius = Math.max(1, Math.ceil(3 * sigma))
  const size = radius * 2 + 1
  const k = new Float32Array(size)
  const s2 = 2 * sigma * sigma
  let sum = 0
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / s2)
    k[i + radius] = v
    sum += v
  }
  // normalize
  for (let i = 0; i < size; i++) k[i] /= sum
  return k
}

function separableConvolve(
  src: Float32Array,
  dst: Float32Array,
  cols: number,
  rows: number,
  kernel: Float32Array,
) {
  // temp buffer
  const tmp = new Float32Array(src.length)
  const radius = (kernel.length - 1) >> 1

  // Horizontal pass
  for (let y = 0; y < rows; y++) {
    const base = y * cols
    for (let x = 0; x < cols; x++) {
      let acc = 0
      for (let k = -radius; k <= radius; k++) {
        const ix = clamp(x + k, 0, cols - 1)
        acc += src[base + ix] * kernel[k + radius]
      }
      tmp[base + x] = acc
    }
  }

  // Vertical pass
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      let acc = 0
      for (let k = -radius; k <= radius; k++) {
        const iy = clamp(y + k, 0, rows - 1)
        acc += tmp[iy * cols + x] * kernel[k + radius]
      }
      dst[y * cols + x] = acc
    }
  }
}

function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v
}

type Palette = Array<{ t: number; r: number; g: number; b: number }>

function buildPalette(name: RenderOptions["palette"]): Palette {
  switch (name) {
    case "red":
      return [
        { t: 0.0, r: 0, g: 0, b: 0 },
        { t: 0.2, r: 64, g: 0, b: 0 },
        { t: 0.4, r: 128, g: 16, b: 0 },
        { t: 0.6, r: 200, g: 32, b: 0 },
        { t: 0.8, r: 255, g: 80, b: 0 },
        { t: 1.0, r: 255, g: 0, b: 0 },
      ]
    case "turbo":
      // Simplified Turbo-like
      return [
        { t: 0.0, r: 48, g: 18, b: 59 },
        { t: 0.25, r: 31, g: 128, b: 169 },
        { t: 0.5, r: 67, g: 201, b: 126 },
        { t: 0.75, r: 229, g: 181, b: 28 },
        { t: 1.0, r: 255, g: 88, b: 0 },
      ]
    case "inferno":
      return [
        { t: 0.0, r: 0, g: 0, b: 4 },
        { t: 0.25, r: 87, g: 15, b: 109 },
        { t: 0.5, r: 187, g: 55, b: 84 },
        { t: 0.75, r: 249, g: 142, b: 8 },
        { t: 1.0, r: 252, g: 255, b: 164 },
      ]
    case "classic":
    default:
      // blue -> cyan -> green -> yellow -> red (classic heatmap)
      return [
        { t: 0.0, r: 0, g: 0, b: 64 },
        { t: 0.25, r: 0, g: 128, b: 255 },
        { t: 0.5, r: 0, g: 255, b: 128 },
        { t: 0.75, r: 255, g: 255, b: 0 },
        { t: 1.0, r: 255, g: 0, b: 0 },
      ]
  }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function mapValueToRGBA(v: number, alpha: number, palette: Palette): [number, number, number, number] {
  if (!(v > 0)) return [0, 0, 0, 0]
  const t = v < 0 ? 0 : v > 1 ? 1 : v

  // find bracketing colors
  let i = 0
  while (i < palette.length && t > palette[i].t) i++
  if (i === 0) i = 1
  if (i >= palette.length) i = palette.length - 1

  const c0 = palette[i - 1]
  const c1 = palette[i]
  const lt = (t - c0.t) / (c1.t - c0.t || 1)

  const r = Math.round(lerp(c0.r, c1.r, lt))
  const g = Math.round(lerp(c0.g, c1.g, lt))
  const b = Math.round(lerp(c0.b, c1.b, lt))

  // alpha grows with intensity
  const a = Math.round(255 * Math.min(1, Math.max(0.05, t)) * alpha)
  return [r, g, b, a]
}

// =============================
// End-of-interview report utils
// =============================

export type GazeSample = {
  x: number
  y: number
  timestamp: number // ms
  confidence?: number
  pageW?: number
  pageH?: number
}

export type HeatmapReportOptions = {
  baseWidth?: number // base coordinate system; if omitted, inferred from samples
  baseHeight?: number
  cellSize?: number
  dwellCapMs?: number // cap per-sample dwell time to avoid long-idle spikes (default 200ms)
  renderWidth?: number // output image width; if omitted, uses baseWidth
  renderHeight?: number // output image height; if omitted, uses baseHeight
  palette?: RenderOptions["palette"]
  blurRadius?: number // blur in page-space pixels
  alpha?: number
  clampMax?: number // optional fixed max for normalization
}

export type HeatmapReport = {
  dataUrl: string
  canvas: HTMLCanvasElement
  grid: Float32Array // raw dwell-time (seconds * confidence) per cell
  cols: number
  rows: number
  baseWidth: number
  baseHeight: number
  stats: {
    sampleCount: number
    totalTimeSec: number
    maxCell: number
    meanCell: number
    viewportChanges: number
  }
}

/**
 * Build an end-of-interview heatmap report from a sequence of gaze samples.
 * Aggregation is dwell-time weighted (dt seconds * confidence) so longer looks count more.
 * Raw grid is returned alongside a normalized rendered image; no raw information is lost.
 *
 * Note: Must be called on the client (uses Canvas APIs).
 */
export function buildHeatmapReportFromSamples(samples: GazeSample[], opts: HeatmapReportOptions = {}): HeatmapReport {
  if (!samples || samples.length === 0) {
    const bw = opts.baseWidth ?? 1920
    const bh = opts.baseHeight ?? 1080
    const hm = createHeatmap({ width: bw, height: bh, cellSize: opts.cellSize ?? 16 })
    const canvas = hm.renderToCanvas({ width: opts.renderWidth ?? bw, height: opts.renderHeight ?? bh })
    return {
      dataUrl: canvas.toDataURL("image/png"),
      canvas,
      grid: hm.getGrid().data,
      cols: hm.getGrid().cols,
      rows: hm.getGrid().rows,
      baseWidth: bw,
      baseHeight: bh,
      stats: { sampleCount: 0, totalTimeSec: 0, maxCell: 0, meanCell: 0, viewportChanges: 0 },
    }
  }

  // Infer base viewport: prefer user-specified; otherwise most frequent (pageW,pageH); fallback to first or 1920x1080
  let baseW = opts.baseWidth
  let baseH = opts.baseHeight
  if (!baseW || !baseH) {
    const counts = new Map<string, { w: number; h: number; c: number }>()
    for (const s of samples) {
      const w = s.pageW ?? 0, h = s.pageH ?? 0
      if (!w || !h) continue
      const key = `${w}x${h}`
      const cur = counts.get(key)
      if (cur) cur.c++
      else counts.set(key, { w, h, c: 1 })
    }
    if (counts.size > 0) {
      const best = Array.from(counts.values()).sort((a, b) => b.c - a.c)[0]
      baseW = best.w
      baseH = best.h
    } else {
      baseW = samples[0].pageW ?? 1920
      baseH = samples[0].pageH ?? 1080
    }
  }

  const cellSize = Math.max(1, Math.floor(opts.cellSize ?? 16))
  const hm = createHeatmap({ width: baseW!, height: baseH!, cellSize, decayPerSecond: 0 })

  const dwellCap = opts.dwellCapMs ?? 200
  let totalTimeMs = 0
  let viewportChanges = 0

  // Track last viewport to count changes
  let lastVW = samples[0].pageW ?? baseW!
  let lastVH = samples[0].pageH ?? baseH!

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]
    if ((s.pageW ?? lastVW) !== lastVW || (s.pageH ?? lastVH) !== lastVH) {
      viewportChanges++
      lastVW = s.pageW ?? lastVW
      lastVH = s.pageH ?? lastVH
    }

    const next = samples[i + 1] ?? samples[i]
    let dt = Math.max(0, (next.timestamp ?? s.timestamp) - s.timestamp)
    if (i === samples.length - 1) {
      // assume frame interval ~16ms for last sample if no next timestamp
      if (dt <= 0) dt = 16
    }
    dt = Math.min(dt, dwellCap)
    totalTimeMs += dt

    const conf = s.confidence ?? 1
    // Reproject to base viewport if needed
    const sw = s.pageW || baseW!
    const sh = s.pageH || baseH!
    const scaleX = baseW! / sw
    const scaleY = baseH! / sh
    const bx = s.x * scaleX
    const by = s.y * scaleY

    // Weight by dwell seconds and confidence
    hm.addPoint(bx, by, (dt / 1000) * conf)
  }

  // Compute stats from raw grid
  const { data: grid, cols, rows } = hm.getGrid()
  let maxCell = 0
  let sum = 0
  for (let i = 0; i < grid.length; i++) {
    const v = grid[i]
    if (v > maxCell) maxCell = v
    sum += v
  }
  const meanCell = sum / grid.length

  // Render normalized image; raw grid remains available in report
  const rw = opts.renderWidth ?? baseW!
  const rh = opts.renderHeight ?? baseH!
  const canvas = hm.renderToCanvas({
    width: rw,
    height: rh,
    radius: opts.blurRadius ?? 30,
    palette: opts.palette ?? "classic",
    alpha: opts.alpha ?? 0.95,
    clampMax: opts.clampMax,
  })

  return {
    dataUrl: canvas.toDataURL("image/png"),
    canvas,
    grid,
    cols,
    rows,
    baseWidth: baseW!,
    baseHeight: baseH!,
    stats: {
      sampleCount: samples.length,
      totalTimeSec: totalTimeMs / 1000,
      maxCell,
      meanCell,
      viewportChanges,
    },
  }
}

/** Normalize a raw grid (copy) to 0..1 based on its current max value. */
export function normalizeGridCopy(grid: Float32Array): Float32Array {
  let max = 0
  for (let i = 0; i < grid.length; i++) if (grid[i] > max) max = grid[i]
  const denom = Math.max(1e-6, max)
  const out = new Float32Array(grid.length)
  for (let i = 0; i < grid.length; i++) out[i] = grid[i] / denom
  return out
}
