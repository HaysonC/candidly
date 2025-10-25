"use client"

import { Button } from "@/components/ui/button"
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react"

interface VideoControlsProps {
  isAudioEnabled: boolean
  isVideoEnabled: boolean
  onToggleAudio: () => void
  onToggleVideo: () => void
  onEndCall: () => void
}

export function VideoControls({
  isAudioEnabled,
  isVideoEnabled,
  onToggleAudio,
  onToggleVideo,
  onEndCall,
}: VideoControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      <Button
        variant={isAudioEnabled ? "secondary" : "destructive"}
        size="lg"
        onClick={onToggleAudio}
        className="rounded-full w-14 h-14"
      >
        {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
      </Button>

      <Button
        variant={isVideoEnabled ? "secondary" : "destructive"}
        size="lg"
        onClick={onToggleVideo}
        className="rounded-full w-14 h-14"
      >
        {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
      </Button>

      <Button variant="destructive" size="lg" onClick={onEndCall} className="rounded-full w-14 h-14">
        <PhoneOff className="w-5 h-5" />
      </Button>
    </div>
  )
}
