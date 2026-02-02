import Groq from "groq-sdk"

// PASTE YOUR GROQ API KEY HERE
export const DEFAULT_API_KEY = ""

let groq: Groq | null = null

export const initGroq = (apiKey?: string) => {
    const keyToUse = apiKey || DEFAULT_API_KEY
    if (!keyToUse) return // Don't init if no key

    groq = new Groq({
        apiKey: keyToUse,
        dangerouslyAllowBrowser: true // Allowed in background service worker context or carefully in extension
    })
}

export const getGroqClient = () => {
    // In a real extension, we might fetch API key from storage if not initialized
    return groq
}

export const generateCompletion = async (messages: any[]): Promise<string> => {
    if (!groq) throw new Error("Groq API Key not initialized")

    const chatCompletion = await groq.chat.completions.create({
        messages: messages,
        model: "llama-3.1-8b-instant",
        temperature: 0.5,
        max_tokens: 1024,
    })

    return chatCompletion.choices[0]?.message?.content || ""
}
