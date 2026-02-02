import React, { Component, useState, useRef, useEffect } from "react"
import { useStorage } from "@plasmohq/storage/hook"
import { Storage } from "@plasmohq/storage"
import { DEFAULT_API_KEY } from "./shared/groq"

import "./style.css"

import { PaperAirplaneIcon, Cog6ToothIcon, XMarkIcon, SparklesIcon, EyeIcon, SunIcon, MoonIcon, PaintBrushIcon } from "@heroicons/react/24/solid"

interface Message {
  role: "user" | "bot"
  text: string
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Popup Error Boundary caught:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-red-600">
          <h2>Something went wrong.</h2>
          <pre className="text-xs whitespace-pre-wrap mt-2">{this.state.error?.toString()}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

function IndexPopup() {
  return (
    <ErrorBoundary>
      <IndexPopupContent />
    </ErrorBoundary>
  )
}

function IndexPopupContent() {
  const [apiKey, setApiKey] = useStorage("groq_api_key", "")
  const [showSettings, setShowSettings] = useState(false)
  const [currentDomain, setCurrentDomain] = useState("")
  const [activeMode, setActiveMode] = useState("none")
  const [showModeSelector, setShowModeSelector] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", text: "👋 Hi! I can help you:\n\n📄 Summarize pages\n🎯 Adjust contrast\n🔍 Guide you through tasks" }
  ])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const hasKey = !!apiKey || !!DEFAULT_API_KEY

  // Get current domain and load per-site mode
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const url = tabs[0]?.url
      if (url) {
        const domain = new URL(url).hostname
        setCurrentDomain(domain)
        const storage = new Storage()
        const mode = await storage.get(`accessibility_mode_${domain}`) || "none"
        setActiveMode(mode)
      }
    })
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(scrollToBottom, [messages, isLoading])

  const handleSend = async () => {
    if (!input.trim()) return
    if (!hasKey) {
      setShowSettings(true)
      return
    }

    const userMsg = input
    setMessages(prev => [...prev, { role: "user", text: userMsg }])
    setInput("")
    setIsLoading(true)

    try {
      // Check for mode changes first
      const msgLower = userMsg.toLowerCase()
      if (msgLower.includes("auto fix") || msgLower.includes("default fix")) {
        await updateMode("default-fix")
        setMessages(prev => [...prev, { role: "bot", text: "\u2705 Auto Fix mode activated! Low contrast elements will be adjusted." }])
        setIsLoading(false)
        return
      } else if (msgLower.includes("high light") || msgLower.includes("light mode")) {
        await updateMode("high-contrast-light")
        setMessages(prev => [...prev, { role: "bot", text: "\u2705 High Contrast Light mode activated!" }])
        setIsLoading(false)
        return
      } else if (msgLower.includes("high dark") || msgLower.includes("dark mode")) {
        await updateMode("high-contrast-dark")
        setMessages(prev => [...prev, { role: "bot", text: "\u2705 High Contrast Dark mode activated!" }])
        setIsLoading(false)
        return
      } else if (msgLower.includes("color-blind") || msgLower.includes("color blind")) {
        await updateMode("color-blind")
        setMessages(prev => [...prev, { role: "bot", text: "\u2705 Color-Blind Friendly mode activated!" }])
        setIsLoading(false)
        return
      } else if (msgLower.includes("turn off") || msgLower.includes("disable") || msgLower.includes("reset")) {
        await updateMode("none")
        setMessages(prev => [...prev, { role: "bot", text: "\u2705 Accessibility mode turned off." }])
        setIsLoading(false)
        return
      }

      let type = "CHAT"
      let payload: any = {
        history: messages.map(m => ({ role: m.role === "bot" ? "assistant" : "user", content: m.text })),
        context: ""
      }

      if (userMsg.toLowerCase().includes("summarize")) {
        type = "SUMMARIZE"
      } else if (userMsg.toLowerCase().includes("guide") || userMsg.toLowerCase().includes("show me") || userMsg.toLowerCase().includes("navigate")) {
        type = "GUIDE"
        payload = userMsg
      }

      // Context Fetching
      if (type === "SUMMARIZE" || type === "CHAT") {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tab?.id) {
          try {
            const contentRes = await chrome.tabs.sendMessage(tab.id, { type: "GET_TEXT" })
            if (contentRes?.text) {
              type === "SUMMARIZE" ? (payload = contentRes.text) : (payload.context = contentRes.text)
            }
          } catch (e) {
            console.log("Content script not loaded. Refresh the page and try again.")
            if (type === "SUMMARIZE") {
              setMessages(prev => [...prev, { role: "bot", text: "Please refresh the web page first, then try again." }])
              setIsLoading(false)
              return
            }
          }
        }
      }

      const res = await chrome.runtime.sendMessage({ type, payload })

      if (res.error) {
        setMessages(prev => [...prev, { role: "bot", text: "Error: " + res.error }])
      } else if (res.data) {
        if (type === "GUIDE") {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
          if (tab?.id) {
            try {
              await chrome.tabs.sendMessage(tab.id, { type: "START_GUIDE", steps: res.data })
              setMessages(prev => [...prev, { role: "bot", text: "I've highlighted the steps on the page for you. Follow the spotlight!" }])
            } catch (e) {
              setMessages(prev => [...prev, { role: "bot", text: "Please refresh the page first, then try the guide again." }])
            }
          }
        } else {
          setMessages(prev => [...prev, { role: "bot", text: typeof res.data === 'string' ? res.data : JSON.stringify(res.data) }])
        }
      }
    } catch (err: any) {
      console.error(err)
      let msg = "Connection failed. " + err.message
      if (err.message.includes("Extension context invalidated")) {
        msg = "Extension updated. Please REFRESH the web page to reconnect."
      }
      setMessages(prev => [...prev, { role: "bot", text: msg }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSummarize = async () => {
    if (!hasKey) {
      setShowSettings(true)
      return
    }

    setMessages(prev => [...prev, { role: "user", text: "📄 Summarize this page" }])
    setIsLoading(true)

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      let content = ""

      if (tab?.id) {
        try {
          const contentRes = await chrome.tabs.sendMessage(tab.id, { type: "GET_TEXT" })
          content = contentRes?.text || ""
        } catch (e) {
          setMessages(prev => [...prev, { role: "bot", text: "⚠️ Please refresh the page first, then try again." }])
          setIsLoading(false)
          return
        }
      }

      const res = await chrome.runtime.sendMessage({ type: "SUMMARIZE", payload: content })

      if (res.success) {
        setMessages(prev => [...prev, { role: "bot", text: res.data }])
      } else {
        setMessages(prev => [...prev, { role: "bot", text: `❌ Error: ${res.error || 'Unknown error'}` }])
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: "bot", text: `❌ ${err.message}` }])
    } finally {
      setIsLoading(false)
    }
  }

  const updateMode = async (mode: string) => {
    const newMode = activeMode === mode ? "none" : mode
    setActiveMode(newMode)

    // Save per-domain
    if (currentDomain) {
      const storage = new Storage()
      await storage.set(`accessibility_mode_${currentDomain}`, newMode)
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: "SET_ACCESSIBILITY_MODE", mode: newMode })
      } catch (e) {
        console.log("Content script not ready. Mode will apply on page load.")
      }
    }
  }

  return (
    <div className="w-[360px] h-[550px] flex flex-col bg-slate-50 font-sans text-slate-800">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 p-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2 text-brand-600">
          <SparklesIcon className="w-5 h-5" />
          <h1 className="text-lg font-bold tracking-tight">
            ShadowLight
          </h1>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={() => setShowSettings(!showSettings)} className="text-gray-400 hover:text-gray-600 transition-colors">
            <Cog6ToothIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Action Buttons Bar */}
      {!showSettings && (
        <div className="bg-gradient-to-r from-brand-50 to-blue-50 border-b border-brand-100 px-3 py-2.5">
          <div className="flex gap-2">
            <button
              onClick={handleSummarize}
              disabled={isLoading}
              className="flex-1 bg-white hover:bg-brand-50 text-brand-600 font-semibold px-4 py-2.5 rounded-lg shadow-sm border border-brand-200 transition-all hover:shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm">Summarize</span>
            </button>
            <button
              onClick={() => setShowModeSelector(true)}
              className="flex-1 bg-white hover:bg-brand-50 text-brand-600 font-semibold px-4 py-2.5 rounded-lg shadow-sm border border-brand-200 transition-all hover:shadow flex items-center justify-center gap-2"
            >
              <EyeIcon className="w-4 h-4" />
              <span className="text-sm">Contrast</span>
            </button>
          </div>
        </div>
      )}

      {/* Mode Selection Panel */}
      {showModeSelector && (
        <div className="bg-white border-b border-gray-200 p-3">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-gray-700">🎨 Select Contrast Mode</h3>
            <button onClick={() => setShowModeSelector(false)} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={async () => {
                await updateMode("default-fix")
                setShowModeSelector(false)
              }}
              className={`p-3 rounded-lg border-2 transition-all text-left ${activeMode === "default-fix"
                  ? "border-brand-500 bg-brand-50"
                  : "border-gray-200 hover:border-brand-300 bg-white"
                }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <EyeIcon className="w-4 h-4 text-brand-600" />
                <span className="font-semibold text-xs text-gray-800">Auto Fix</span>
              </div>
              <p className="text-[10px] text-gray-500">Adjusts low contrast</p>
            </button>
            <button
              onClick={async () => {
                await updateMode("high-contrast-light")
                setShowModeSelector(false)
              }}
              className={`p-3 rounded-lg border-2 transition-all text-left ${activeMode === "high-contrast-light"
                  ? "border-brand-500 bg-brand-50"
                  : "border-gray-200 hover:border-brand-300 bg-white"
                }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <SunIcon className="w-4 h-4 text-yellow-500" />
                <span className="font-semibold text-xs text-gray-800">High Light</span>
              </div>
              <p className="text-[10px] text-gray-500">White background</p>
            </button>
            <button
              onClick={async () => {
                await updateMode("high-contrast-dark")
                setShowModeSelector(false)
              }}
              className={`p-3 rounded-lg border-2 transition-all text-left ${activeMode === "high-contrast-dark"
                  ? "border-brand-500 bg-brand-50"
                  : "border-gray-200 hover:border-brand-300 bg-white"
                }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <MoonIcon className="w-4 h-4 text-indigo-600" />
                <span className="font-semibold text-xs text-gray-800">High Dark</span>
              </div>
              <p className="text-[10px] text-gray-500">Black background</p>
            </button>
            <button
              onClick={async () => {
                await updateMode("color-blind")
                setShowModeSelector(false)
              }}
              className={`p-3 rounded-lg border-2 transition-all text-left ${activeMode === "color-blind"
                  ? "border-brand-500 bg-brand-50"
                  : "border-gray-200 hover:border-brand-300 bg-white"
                }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <PaintBrushIcon className="w-4 h-4 text-purple-500" />
                <span className="font-semibold text-xs text-gray-800">Color-Blind</span>
              </div>
              <p className="text-[10px] text-gray-500">Enhanced colors</p>
            </button>
          </div>
          {activeMode !== "none" && (
            <button
              onClick={async () => {
                await updateMode("none")
                setShowModeSelector(false)
              }}
              className="mt-2 w-full py-2 text-xs text-red-600 hover:text-red-700 font-medium"
            >
              ✕ Turn Off Accessibility Mode
            </button>
          )}
        </div>
      )}

      {showSettings ? (
        <div className="flex-1 p-6 bg-slate-50 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-xl text-gray-800">Settings</h2>
            <button onClick={() => setShowSettings(false)}><XMarkIcon className="w-5 h-5 text-gray-500" /></button>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <label className="text-sm font-semibold text-gray-700 block mb-2">Groq API Key</label>
            {DEFAULT_API_KEY ? (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 p-2 rounded text-sm font-medium">
                <span>Verified & Configured via Code</span>
              </div>
            ) : (
              <>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm transition-all"
                  placeholder="Enter key starting with gsk_..."
                />
                <p className="text-xs text-gray-500 mt-2">Required for AI features.</p>
              </>
            )}
          </div>

          <div className="mt-auto text-center text-xs text-gray-400">
            ShadowLight v0.0.1
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-slate-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3.5 text-sm shadow-sm ${m.role === 'user'
                  ? 'bg-brand-600 text-white rounded-2xl rounded-tr-sm'
                  : 'bg-white text-gray-700 border border-gray-100 rounded-2xl rounded-tl-sm'
                  }`}>
                  {m.text}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 p-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce"></div>
                  </div>
                  <span className="text-xs text-gray-400 font-medium">Processing...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-white border-t border-gray-100">
            <div className="relative flex items-center">
              <input
                className="w-full bg-gray-50 border border-gray-200 rounded-full py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all shadow-sm"
                placeholder={isLoading ? "Please wait..." : "Ask ShadowLight..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input}
                className="absolute right-1.5 bg-brand-600 hover:bg-brand-700 text-white p-2 rounded-full disabled:opacity-50 disabled:hover:bg-brand-600 transition-all shadow-md active:scale-95"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default IndexPopup
