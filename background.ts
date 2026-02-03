import { Storage } from "@plasmohq/storage"
import { initGroq, generateCompletion, DEFAULT_API_KEY } from "./shared/groq"
import type { ExtensionMessage, GuidanceResponse } from "./shared/types"

const storage = new Storage()

// Listen for messages from Content Script or Popup
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
    handleMessage(message, sendResponse)
    return true // Keep channel open for async response
})

async function handleMessage(message: ExtensionMessage, sendResponse: (response: any) => void) {
    try {
        // API key is now only from environment variables (.env file)
        const apiKey = DEFAULT_API_KEY

        if (!apiKey) {
            sendResponse({ error: "API Key missing. Please configure PLASMO_PUBLIC_GROQ_API_KEY in .env file." })
            return
        }
        initGroq(apiKey)

        switch (message.type) {
            case "SUMMARIZE":
                await handleSummarize(message.payload, sendResponse)
                break
            case "CHAT":
                await handleChat(message.payload, sendResponse)
                break
            case "GUIDE":
                await handleGuide(message.payload, sendResponse)
                break
            case "PING":
                sendResponse({ status: "alive" })
                break
            default:
                sendResponse({ error: "Unknown message type" })
        }
    } catch (error) {
        console.error("Background error:", error)
        sendResponse({ error: error.message })
    }
}

async function handleSummarize(content: any, sendResponse: (response: any) => void) {
    if (typeof content !== 'string') {
        sendResponse({ success: false, data: "Could not read page content. Please refresh the page and try again." })
        return
    }
    const prompt = `Summarize this webpage content in simple, accessible language. Keep it concise.\n\nContent:\n${content.substring(0, 15000)}` // Limit context
    const summary = await generateCompletion([{ role: "user", content: prompt }])
    sendResponse({ success: true, data: summary })
}

async function handleChat(payload: { history: any[], context?: string }, sendResponse: (response: any) => void) {
    const { history, context } = payload
    const systemMsg = { role: "system", content: "You are ShadowLight, a helpful accessibility assistant. Answer briefly." }
    const contextMsg = context ? { role: "system", content: `Context of current page:\n${context.substring(0, 5000)}` } : null

    const messages = [systemMsg, ...(contextMsg ? [contextMsg] : []), ...history]
    const reply = await generateCompletion(messages)
    sendResponse({ success: true, data: reply })
}

async function handleGuide(intent: string, sendResponse: (response: any) => void) {
    // This is the complex part. We need to ask LLM to generate selectors. 
    // Ideally, we would need the HTML structure. Since sending full HTML is too heavy, 
    // current implementation relies on generic intent or we ask LLM to specificy WHAT to look for 
    // and the content script tries to match it using heuristic or we just assume common selectors for demo.
    // Real implementation would imply sending reduced accessibility tree.

    // For this demo, let's ask LLM to generate a JSON of steps based on standard practices
    // or return a description that the user can follow, OR we attempt to provide a "Guidance Plan"
    // that the Content Script can try to map.

    const prompt = `You are an automation expert. The user wants to: "${intent}".
    Return a list of steps in JSON format: { "steps": [{ "selector": "css_selector", "instruction": "user_instruction" }] }.
    Guess generic selectors for common sites (e.g. login form inputs, buttons).
    If unsure, provide a best guess likely to exist (e.g. 'input[type="email"]', 'button[type="submit"]').
    Return ONLY JSON.`

    try {
        const result = await generateCompletion([{ role: "user", content: prompt }])
        // Basic cleanup locally if LLM chats too much
        const jsonMatch = result.match(/\{[\s\S]*\}/)
        const jsonStr = jsonMatch ? jsonMatch[0] : "{}"
        const parsed = JSON.parse(jsonStr)
        sendResponse({ success: true, data: parsed.steps || [] })
    } catch (e) {
        sendResponse({ success: false, error: "Failed to generate guidance" })
    }
}
