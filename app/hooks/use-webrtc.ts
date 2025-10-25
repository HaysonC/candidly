"use client"

import type React from "react"

import { useCallback, useEffect, useRef, useState } from "react"

type ConnectionState = "new" | "connecting" | "connected" | "disconnected"

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
}

export function useWebRTC(
  roomId: string,
  localVideoRef: React.RefObject<HTMLVideoElement>,
  remoteVideoRef: React.RefObject<HTMLVideoElement>,
) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>("new")
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const userIdRef = useRef(crypto.randomUUID())

  const initializeMedia = useCallback(async () => {
    try {
      console.log("[debug] Requesting media access...")
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })

      setLocalStream(stream)

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      console.log("[debug] Media stream obtained")
      return stream
    } catch (error) {
      console.error("[debug] Error accessing media devices:", error)
      return null
    }
  }, [localVideoRef])

  const createPeerConnection = useCallback(() => {
    console.log("[debug] Creating peer connection...")
    const pc = new RTCPeerConnection(ICE_SERVERS)

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        console.log("[debug] Sending ICE candidate")
        socketRef.current.send(
          JSON.stringify({
            type: "ice-candidate",
            candidate: event.candidate,
            roomId,
          }),
        )
      }
    }

    pc.ontrack = (event) => {
      console.log("[debug] Received remote track")
      const [stream] = event.streams
      setRemoteStream(stream)

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream
      }
    }

    pc.onconnectionstatechange = () => {
      console.log("[debug] Connection state:", pc.connectionState)
      setConnectionState(pc.connectionState as ConnectionState)
    }

    peerConnectionRef.current = pc
    return pc
  }, [roomId, remoteVideoRef])

  const startCall = useCallback(async () => {
    console.log("[debug] Starting call...")
    const stream = await initializeMedia()
    if (!stream) return

    const pc = createPeerConnection()

    // Add local tracks to peer connection
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream)
    })

    // Connect to signaling server
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const wsUrl = `${protocol}//${window.location.host}/api/socket`

    console.log("[debug] Connecting to signaling server...")
    const socket = new WebSocket(wsUrl)
    socketRef.current = socket

    socket.onopen = () => {
      console.log("[debug] WebSocket connected")
      socket.send(
        JSON.stringify({
          type: "join",
          roomId,
          userId: userIdRef.current,
        }),
      )
    }

    socket.onmessage = async (event) => {
      const data = JSON.parse(event.data)
      console.log("[debug] Received signaling message:", data.type)

      switch (data.type) {
        case "user-joined":
          // Create and send offer to new user
          console.log("[debug] Creating offer...")
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          socket.send(
            JSON.stringify({
              type: "offer",
              offer,
              roomId,
            }),
          )
          break

        case "offer":
          console.log("[debug] Received offer, creating answer...")
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          socket.send(
            JSON.stringify({
              type: "answer",
              answer,
              roomId,
            }),
          )
          break

        case "answer":
          console.log("[debug] Received answer")
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer))
          break

        case "ice-candidate":
          console.log("[debug] Received ICE candidate")
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
          break

        case "user-left":
          console.log("[debug] User left")
          setRemoteStream(null)
          break
      }
    }

    socket.onerror = (error) => {
      console.error("[debug] WebSocket error:", error)
    }

    socket.onclose = () => {
      console.log("[debug] WebSocket closed")
    }
  }, [roomId, initializeMedia, createPeerConnection])

  const endCall = useCallback(() => {
    console.log("[debug] Ending call...")

    if (socketRef.current) {
      socketRef.current.send(
        JSON.stringify({
          type: "leave",
          roomId,
          userId: userIdRef.current,
        }),
      )
      socketRef.current.close()
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
    }

    setLocalStream(null)
    setRemoteStream(null)
    setConnectionState("disconnected")
  }, [roomId, localStream])

  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsAudioEnabled(audioTrack.enabled)
      }
    }
  }, [localStream])

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoEnabled(videoTrack.enabled)
      }
    }
  }, [localStream])

  useEffect(() => {
    return () => {
      endCall()
    }
  }, [endCall])

  return {
    localStream,
    remoteStream,
    connectionState,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    toggleVideo,
    startCall,
    endCall,
  }
}
