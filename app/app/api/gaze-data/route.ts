import { type NextRequest, NextResponse } from "next/server"

// In-memory storage for demo (use database in production)
const gazeDataStore: Map<string, any[]> = new Map()

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { meetingCode, ...gazeData } = data

    if (!gazeDataStore.has(meetingCode)) {
      gazeDataStore.set(meetingCode, [])
    }

    gazeDataStore.get(meetingCode)?.push({
      ...gazeData,
      serverTimestamp: Date.now(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[debug] Error storing gaze data:", error)
    return NextResponse.json({ success: false, error: "Failed to store gaze data" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const meetingCode = request.nextUrl.searchParams.get("meetingCode")

  if (!meetingCode) {
    return NextResponse.json({ error: "Meeting code required" }, { status: 400 })
  }

  const data = gazeDataStore.get(meetingCode) || []
  return NextResponse.json({ data })
}
