// Diagnostic socket client: connects to the engine and triggers a download
// so we can observe the engine's behavior/crash directly.
import { io } from 'socket.io-client'

const socket = io('http://localhost:3003/', {
  transports: ['websocket', 'polling'],
  forceNew: true,
})

socket.on('connect', () => {
  console.log('[client] connected, sending add_download')
  socket.emit(
    'add_download',
    { url: 'https://proof.ovh.net/files/100Mb.dat', connections: 1 },
    (ack: any) => {
      console.log('[client] ack:', JSON.stringify(ack))
    },
  )
})

socket.on('download.created', (d: any) => console.log('[client] created:', d.filename, d.id))
socket.on('download.progress', (p: any) =>
  console.log('[client] progress:', p.id?.slice(0, 8), 'dl:', p.downloaded, '/', p.size, 'spd:', p.speed),
)
socket.on('download.completed', (p: any) => {
  console.log('[client] COMPLETED:', p)
  socket.disconnect()
  process.exit(0)
})
socket.on('download.failed', (p: any) => {
  console.log('[client] FAILED:', p)
  socket.disconnect()
  process.exit(0)
})
socket.on('engine.error', (p: any) => console.log('[client] engine.error:', p))

setTimeout(() => {
  console.log('[client] timeout (90s)')
  socket.disconnect()
  process.exit(0)
}, 90000)
