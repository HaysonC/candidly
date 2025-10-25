// In-memory store for signaling messages
type SignalingMessage = {
  type: string
  data: any
  timestamp: number
}

type Room = {
  users: Set<string>
  messages: SignalingMessage[]
}

class SignalingStore {
  private rooms = new Map<string, Room>()

  joinRoom(roomId: string, userId: string) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        users: new Set(),
        messages: [],
      })
    }

    const room = this.rooms.get(roomId)!
    const isFirstUser = room.users.size === 0
    room.users.add(userId)

    // Clean up old messages (older than 30 seconds)
    const now = Date.now()
    room.messages = room.messages.filter((msg) => now - msg.timestamp < 30000)

    return { isFirstUser, userCount: room.users.size }
  }

  leaveRoom(roomId: string, userId: string) {
    const room = this.rooms.get(roomId)
    if (room) {
      room.users.delete(userId)
      if (room.users.size === 0) {
        this.rooms.delete(roomId)
      }
    }
  }

  addMessage(roomId: string, userId: string, type: string, data: any) {
    const room = this.rooms.get(roomId)
    if (room) {
      room.messages.push({
        type,
        data: { ...data, userId },
        timestamp: Date.now(),
      })
    }
  }

  getMessages(roomId: string, userId: string, since: number) {
    const room = this.rooms.get(roomId)
    if (!room) return []

    // Return messages that are not from this user and are newer than 'since'
    return room.messages.filter((msg) => msg.data.userId !== userId && msg.timestamp > since)
  }

  getRoomInfo(roomId: string) {
    const room = this.rooms.get(roomId)
    return {
      exists: !!room,
      userCount: room?.users.size || 0,
    }
  }
}

export const signalingStore = new SignalingStore()
