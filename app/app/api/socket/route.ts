import type { NextRequest } from "next/server"
import { upgradeWebSocket } from "next/server"

// Store active connections per room
const rooms = new Map<string, Set<WebSocket>>()

export async function GET(request: NextRequest) {
  const upgradeHeader = request.headers.get("upgrade")

  if (upgradeHeader !== "websocket") {
    return new Response("Expected websocket", { status: 426 })
  }

  // @ts-ignore - WebSocket upgrade in Next.js
  const { socket, response } = upgradeWebSocket(request)

  let currentRoom: string | null = null

  socket.onopen = () => {
    console.log("[debug] WebSocket connection opened")
  }

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      console.log("[debug] Received message:", data.type)

      switch (data.type) {
        case "join":
          currentRoom = data.roomId
          if (!rooms.has(currentRoom)) {
            rooms.set(currentRoom, new Set())
          }
          rooms.get(currentRoom)!.add(socket)

          // Notify others in the room
          broadcast(
            currentRoom,
            {
              type: "user-joined",
              userId: data.userId,
            },
            socket,
          )
          break

        case "offer":
        case "answer":
        case "ice-candidate":
          // Forward signaling messages to other peers in the room
          if (currentRoom) {
            broadcast(currentRoom, data, socket)
          }
          break

        case "leave":
          if (currentRoom) {
            broadcast(
              currentRoom,
              {
                type: "user-left",
                userId: data.userId,
              },
              socket,
            )
            rooms.get(currentRoom)?.delete(socket)
          }
          break
      }
    } catch (error) {
      console.error("[debug] Error processing message:", error)
    }
  }

  socket.onclose = () => {
    console.log("[debug] WebSocket connection closed")
    if (currentRoom) {
      rooms.get(currentRoom)?.delete(socket)
      if (rooms.get(currentRoom)?.size === 0) {
        rooms.delete(currentRoom)
      }
    }
  }

  return response
}

function broadcast(roomId: string, message: any, exclude?: WebSocket) {
  const room = rooms.get(roomId)
  if (!room) return

  const messageStr = JSON.stringify(message)
  room.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(messageStr)
    }
  })
}
