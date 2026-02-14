import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, X, Youtube, Instagram, Terminal as TerminalIcon, Shield } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export default function App() {
  const [url, setUrl] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [quality, setQuality] = useState('best')
  const [downloadPath, setDownloadPath] = useState('downloads')
  const ws = useRef<WebSocket | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Load Config
  useEffect(() => {
    fetch('http://localhost:8001/config')
      .then(res => res.json())
      .then(data => {
        if (data.download_path) setDownloadPath(data.download_path)
      })
      .catch(err => console.error("Config load failed", err))
  }, [])

  const changeFolder = async () => {
    try {
      const res = await fetch('http://localhost:8001/change_folder', { method: 'POST' })
      const data = await res.json()
      if (data.path) setDownloadPath(data.path)
    } catch (e) {
      console.error(e)
    }
  }

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  // Connection logic
  useEffect(() => {
    const connect = () => {
      const socket = new WebSocket('ws://localhost:8001/ws/client_1')

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'log') {
          setLogs(prev => [...prev.slice(-99), data.message])
        } else if (data.type === 'status') {
          if (data.status === 'completed' || data.status === 'failed' || data.status === 'stopped') {
            setIsRecording(false)
          }
        }
      }

      socket.onclose = () => {
        setTimeout(connect, 3000)
      }

      ws.current = socket
    }

    connect()
    return () => { ws.current?.close() }
  }, [])

  // Window resize logic (Persistent)
  useEffect(() => {
    const enforceDimensions = () => {
      if (window.outerWidth !== 1280 || window.outerHeight !== 720) {
        try { window.resizeTo(1280, 720) } catch (e) { /* ignore */ }
      }
    }
    // Only try once to avoid annoying the user if they really want to resize
    setTimeout(enforceDimensions, 100)
  }, [])

  const startRecording = () => {
    if (!url) return
    setIsRecording(true)
    setShowLogs(true)
    setLogs([])
    ws.current?.send(JSON.stringify({
      action: 'start_download',
      url: url,
      is_live: true,
      quality: quality
    }))
  }

  const stopRecording = () => {
    ws.current?.send(JSON.stringify({ action: 'stop_download' }))
  }

  const openFolder = async () => {
    try { await fetch('http://localhost:8001/open_folder', { method: 'POST' }) } catch (e) { console.error(e) }
  }

  return (
    <div className="w-full h-screen text-white bg-[#050000] font-sans overflow-hidden relative selection:bg-red-500/30">

      {/* 1. Background Gradient Spotlights (Red/Dark Theme) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Deep red/black gradient base */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#450a0a_0%,#000000_100%)]"></div>

        {/* Subtle glow spots */}
        <div className="absolute top-[10%] left-[20%] w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[10%] right-[20%] w-[700px] h-[700px] bg-red-900/10 rounded-full blur-[120px] animate-pulse delay-1000"></div>
      </div>

      {/* 2. Floating Blurred Icons (Background) */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0">
        {/* Youtube (The King of Live) */}
        <motion.div animate={{ y: [0, -25, 0], rotate: [0, 5, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} className="absolute top-[15%] left-[10%] opacity-20 blur-sm">
          <Youtube className="w-40 h-40 text-red-600 transform -rotate-12 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
        </motion.div>

        {/* TikTok / Vertical Stream Vibe */}
        <motion.div animate={{ y: [0, 30, 0], rotate: [0, -10, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }} className="absolute bottom-[20%] left-[20%] opacity-15 blur-md">
          {/* Styled like a TikTok glitch note */}
          <div className="w-28 h-28 rounded-2xl border-4 border-red-500/50 bg-black/20 backdrop-blur-sm transform rotate-6"></div>
        </motion.div>

        {/* Twitch / Gaming Vibe */}
        <motion.div animate={{ y: [0, -20, 0], rotate: [0, 8, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 0.5 }} className="absolute top-[25%] right-[15%] opacity-10 blur-sm">
          <div className="w-32 h-32 bg-purple-600/30 rounded-lg transform rotate-12 flex items-center justify-center">
            <div className="w-20 h-20 bg-black/50 rounded flex gap-4 items-center justify-center">
              <div className="w-4 h-12 bg-white/50 rounded-full"></div>
              <div className="w-4 h-12 bg-white/50 rounded-full"></div>
            </div>
          </div>
        </motion.div>

        {/* Instagram / Live Badge Vibe */}
        <motion.div animate={{ y: [0, 35, 0], rotate: [0, -5, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }} className="absolute bottom-[15%] right-[25%] opacity-15 blur-[2px]">
          <Instagram className="w-32 h-32 text-pink-600/80 transform -rotate-12" />
        </motion.div>
      </div>

      {/* 3. Main Interface Layer */}
      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-6">

        {/* Top Right Settings */}
        <div className="absolute top-8 right-8 cursor-pointer hover:rotate-90 transition-transform duration-500 opacity-50 hover:opacity-100" onClick={() => setShowSettings(true)}>
          <Settings className="w-6 h-6 text-white" />
        </div>

        {/* Title Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-8xl font-black tracking-tighter mb-4 select-none relative group">
            <span className="text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">VOID</span>
            <span className="text-red-600 drop-shadow-[0_0_30px_rgba(220,38,38,0.6)] group-hover:drop-shadow-[0_0_50px_rgba(220,38,38,0.8)] transition-all duration-500">STREAM</span>
          </h1>
          <div className="flex items-center justify-center gap-4 text-xs tracking-[0.4em] text-red-500/50 uppercase font-bold">
            <span>Rec</span>
            <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_red]"></div>
            <span>Live</span>
          </div>
        </motion.div>

        {/* Input Capsule */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-2xl relative group"
        >
          <div className="relative">
            {/* Intense Red Glow behind input */}
            <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-orange-600 rounded-full opacity-25 group-hover:opacity-50 blur-lg transition duration-700"></div>

            <div className="relative bg-[#0a0000]/90 backdrop-blur-2xl border border-red-500/20 rounded-full p-2 flex items-center shadow-2xl">
              <div className="pl-6 pr-4">
                <Shield className="w-5 h-5 text-red-500/50" />
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste Stream URL..."
                className="flex-1 bg-transparent border-none outline-none text-white/90 font-medium placeholder:text-white/20 text-lg h-14 tracking-wide"
              />
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={cn("h-12 px-10 rounded-full font-black text-sm tracking-widest transition-all uppercase shadow-lg flex items-center gap-2 overflow-hidden relative",
                  isRecording
                    ? "bg-white text-black hover:bg-white/90"
                    : "bg-red-600 text-white hover:bg-red-500 hover:shadow-[0_0_20px_rgba(220,38,38,0.5)]"
                )}
              >
                <span className="relative z-10">{isRecording ? "STOP" : "RECORD"}</span>
                {isRecording && <div className="absolute inset-0 bg-red-500/20 animate-pulse"></div>}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Terminal/Logs Drawer (Optional/Contextual) */}
        <AnimatePresence>
          {showLogs && (
            <motion.div
              initial={{ opacity: 0, y: 20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: 20, height: 0 }}
              className="w-full max-w-2xl mt-8 overflow-hidden"
            >
              <div className="bg-black/50 border border-white/5 rounded-xl p-4 backdrop-blur-md">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2 text-xs text-white/40 uppercase font-bold tracking-wider">
                    <TerminalIcon className="w-3 h-3" /> System Output
                  </div>
                  <div onClick={() => setShowLogs(false)} className="text-xs text-white/20 hover:text-white cursor-pointer ml-auto">
                    HIDE
                  </div>
                </div>
                <div className="h-32 overflow-y-auto font-mono text-xs text-green-400/90 space-y-1">
                  {logs.length === 0 && <span className="text-white/20 italic animate-pulse">Initializing core subsystems... System Ready.</span>}
                  {logs.map((log, i) => (
                    <div key={i} className="break-all opacity-90 border-l-2 border-transparent hover:border-white/20 pl-2">
                      <span className="text-white/30 mr-2">[{new Date().toLocaleTimeString()}]</span>{log}
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="absolute bottom-8 flex gap-6 text-white/20 text-xs font-medium uppercase tracking-widest"
        >
          <button onClick={openFolder} className="hover:text-red-500 transition-colors">Open Storage</button>
          <span>•</span>
          <a href="#" className="hover:text-orange-500 transition-colors">Documentation</a>
        </motion.div>

      </div>


      {/* Settings Modal (Minimalist) */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={() => setShowSettings(false)}
          >
            <div onClick={e => e.stopPropagation()} className="bg-[#151515] border border-white/10 p-8 rounded-2xl w-80 shadow-2xl transform scale-100">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-white font-bold uppercase tracking-widest text-sm">Config</h3>
                <X onClick={() => setShowSettings(false)} className="w-5 h-5 text-white/30 hover:text-white cursor-pointer" />
              </div>

              <div className="space-y-6">

                {/* Download Location */}
                <div>
                  <label className="text-xs text-white/40 font-bold uppercase block mb-2">Target Directory</label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white/70 overflow-hidden text-ellipsis whitespace-nowrap leading-7">
                      {downloadPath || "Loading..."}
                    </div>
                    <button
                      onClick={changeFolder}
                      className="px-4 bg-white/10 hover:bg-white/20 text-white/80 rounded-lg text-xs font-bold uppercase transition-colors"
                    >
                      Change
                    </button>
                  </div>
                </div>

                {/* Quality Selection */}
                <div>
                  <label className="text-xs text-white/40 font-bold uppercase block mb-2">Quality Preservation</label>
                  <div className="flex gap-2">
                    {['best', 'worst'].map(q => (
                      <button
                        key={q}
                        onClick={() => setQuality(q)}
                        className={cn("flex-1 py-3 rounded-lg border text-xs font-bold uppercase transition-all",
                          quality === q
                            ? "bg-red-600/20 border-red-600 text-red-500 shadow-[0_0_15px_rgba(220,38,38,0.2)]"
                            : "bg-white/5 border-transparent text-white/40 hover:bg-white/10"
                        )}         >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
