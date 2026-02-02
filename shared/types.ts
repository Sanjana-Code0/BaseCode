export type MessageType = "SUMMARIZE" | "GUIDE" | "CHAT" | "TOGGLE_CONTRAST" | "PING"

export interface ExtensionMessage {
    type: MessageType
    payload?: any
}

export interface Step {
    selector: string
    instruction: string
}

export interface GuidanceResponse {
    type: "summary" | "guidance" | "chat"
    message: string
    steps?: Step[]
}

export interface ChatMessage {
    role: "user" | "assistant" | "system"
    content: string
}

export interface AppState {
    contrastMode: boolean
    chatHistory: ChatMessage[]
    isLoading: boolean
}
