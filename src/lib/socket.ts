'use client'

import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getEngineSocket(): Socket {
  if (!socket) {
    // Caddy gateway: path "/" with XTransformPort query routes to port 3003
    socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    })
  }
  return socket
}

export function disconnectEngine() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
