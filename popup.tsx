import { useState, useRef, useEffect } from "react"
import { useStorage } from "@plasmohq/storage/hook"
import { DEFAULT_API_KEY } from "./shared/groq"

import "./style.css"

import { PaperAirplaneIcon, Cog6ToothIcon, XMarkIcon, SparklesIcon } from "@heroicons/react/24/solid"

interface Message {
  role: "user" | "bot"
  text: string
}

function IndexPopup() {
  const [apiKey, setApiKey] = useStorage("groq_api_key", "")
  const [showSettings, setShowSettings] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", text: "Hello! I'm ShadowLight. I can summarize pages, guide you through tasks, or adjust contrast." }
  ])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const hasKey = !!apiKey || !!DEFAULT_API_KEY

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
            console.log("Context fetch failed:", e)
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
            await chrome.tabs.sendMessage(tab.id, { type: "START_GUIDE", steps: res.data })
            setMessages(prev => [...prev, { role: "bot", text: "I've highlighted the steps on the page for you. Follow the spotlight!" }])
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

  const toggleContrast = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_CONTRAST" })
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
          <button
            onClick={toggleContrast}
            className="text-xs font-semibold px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
          >
            Contrast
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="text-gray-400 hover:text-gray-600 transition-colors">
            <Cog6ToothIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

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
