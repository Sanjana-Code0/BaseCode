import cssText from "data-text:./style.css"
import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState } from "react"
import { useStorage } from "@plasmohq/storage/hook"
import { Storage } from "@plasmohq/storage"
import { getContrastRatio, parseColor, adjustColorForContrast, type RGB } from "./shared/colors"

export const config: PlasmoCSConfig = {
    matches: ["<all_urls>"]
}

export const getStyle = () => {
    const style = document.createElement("style")
    style.textContent = cssText
    return style
}

// Global listener for non-React tasks (Scraping, Contrast)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "GET_TEXT") {
        // Remove scripts and styles for cleaner text
        const clone = document.body.cloneNode(true) as HTMLElement
        const scripts = clone.querySelectorAll("script, style, noscript")
        scripts.forEach(el => el.remove())
        sendResponse({ text: clone.innerText })
    }

    if (msg.type === "SET_ACCESSIBILITY_MODE") {
        setAccessibilityMode(msg.mode)
        sendResponse({ success: true })
    }

    // START_GUIDE handled by React component via event or storage, 
    // but we can also dispatch a custom event to valid React component if it's listening.
    if (msg.type === "START_GUIDE") {
        window.dispatchEvent(new CustomEvent("project-shadow-guide", { detail: msg.steps }))
        sendResponse({ received: true })
    }
})

    // Load per-site accessibility mode on page load
    ; (async () => {
        const storage = new Storage()
        const domain = window.location.hostname
        const mode = await storage.get(`accessibility_mode_${domain}`)
        if (mode && mode !== "none") {
            setAccessibilityMode(mode)
        }
    })()

function setAccessibilityMode(mode: string) {
    // Clear existing styles
    const contrastId = "shadowlight-contrast-style"
    document.getElementById(contrastId)?.remove()

    // Revert fixes
    document.querySelectorAll("[data-shadow-fixed]").forEach(el => {
        if (el instanceof HTMLElement) {
            el.style.removeProperty("color")
            el.style.removeProperty("background-color")
            el.style.removeProperty("border-color")
            el.removeAttribute("data-shadow-fixed")
        }
    })

    if (mode === "none") return

    if (mode === "high-contrast-light") {
        applyStaticStyle(contrastId, `
            * {
                background-color: #ffffff !important;
                color: #000000 !important;
                border-color: #000000 !important;
                text-shadow: none !important;
                box-shadow: none !important;
            }
            a { color: #0000ee !important; text-decoration: underline !important; }
            img, video { filter: grayscale(100%); }
        `)
    } else if (mode === "high-contrast-dark") {
        applyStaticStyle(contrastId, `
            * {
                background-color: #000000 !important;
                color: #ffffff !important;
                border-color: #ffffff !important;
                text-shadow: none !important;
                box-shadow: none !important;
            }
            a { color: #ffff00 !important; text-decoration: underline !important; }
            img, video { filter: grayscale(100%) invert(100%); }
        `)
    } else if (mode === "color-blind") {
        // Simple color-blind friendly filter (e.g., avoid red/green conflicts)
        // This is a basic approach; more advanced would involve SVG filters.
        applyStaticStyle(contrastId, `
            * {
                filter: saturate(1.5) hue-rotate(10deg);
            }
        `)
    } else if (mode === "default-fix") {
        applyDefaultFix()
    }
}

function applyStaticStyle(id: string, css: string) {
    const style = document.createElement("style")
    style.id = id
    style.textContent = css
    document.head.appendChild(style)
}

function applyDefaultFix() {
    const elements = document.querySelectorAll("body *")
    const styleId = "shadowlight-fix-style"
    let styleContent = ""

    elements.forEach((el, index) => {
        if (!(el instanceof HTMLElement)) return

        const style = window.getComputedStyle(el)
        const textStr = el.innerText?.trim()
        if (!textStr && !el.tagName.match(/INPUT|TEXTAREA|SELECT|BUTTON/)) return

        const color = parseColor(style.color)
        const bgColor = getEffectiveBackgroundColor(el)

        if (!color || !bgColor) return

        const ratio = getContrastRatio(color, bgColor)
        const targetRatio = isLargeText(el) ? 3.0 : 4.5

        if (ratio < targetRatio) {
            const newColor = adjustColorForContrast(bgColor, targetRatio)
            const rgbStr = `rgb(${newColor.r}, ${newColor.g}, ${newColor.b})`

            // Generate a unique class or just use data attributes/inline styles
            // Inline styles are easiest to ensure override
            el.style.setProperty("color", rgbStr, "important")
            el.setAttribute("data-shadow-fixed", "true")

            // If still not enough (unlikely with black/white), change background
            if (getContrastRatio(newColor, bgColor) < targetRatio) {
                const newBg = newColor.r > 128 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 }
                el.style.setProperty("background-color", `rgb(${newBg.r}, ${newBg.g}, ${newBg.b})`, "important")
            }
        }

        // Check icons/borders if they are important (e.g. form elements)
        if (el.tagName.match(/INPUT|TEXTAREA|SELECT|BUTTON/)) {
            const borderColor = parseColor(style.borderColor)
            if (borderColor && getContrastRatio(borderColor, bgColor) < 3.0) {
                const newBorderColor = adjustColorForContrast(bgColor, 3.0)
                el.style.setProperty("border-color", `rgb(${newBorderColor.r}, ${newBorderColor.g}, ${newBorderColor.b})`, "important")
                el.setAttribute("data-shadow-fixed", "true")
            }
        }
    })
}

function isLargeText(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element)
    const fontSize = parseFloat(style.fontSize)
    const fontWeight = style.fontWeight
    const isBold = fontWeight === "bold" || parseInt(fontWeight) >= 700

    if (isBold && fontSize >= 18.66) return true // 14pt
    if (fontSize >= 24) return true // 18pt
    return false
}

function getEffectiveBackgroundColor(element: HTMLElement): RGB {
    let current: HTMLElement | null = element
    while (current) {
        const bg = window.getComputedStyle(current).backgroundColor
        if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
            return parseColor(bg) || { r: 255, g: 255, b: 255 }
        }
        current = current.parentElement
    }
    return { r: 255, g: 255, b: 255 }
}

// Overlay Component
export default function ShadowOverlay() {
    const [steps, setSteps] = useState<any[]>([])
    const [activeStep, setActiveStep] = useState(0)
    const [isVisible, setIsVisible] = useState(false)
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
    const [activeMode] = useStorage("accessibility_mode", "none")

    useEffect(() => {
        if (activeMode) setAccessibilityMode(activeMode)
    }, [activeMode])

    useEffect(() => {
        const handler = (e: CustomEvent) => {
            setSteps(e.detail)
            setActiveStep(0)
            setIsVisible(true)
        }
        window.addEventListener("project-shadow-guide" as any, handler)
        return () => window.removeEventListener("project-shadow-guide" as any, handler)
    }, [])

    useEffect(() => {
        if (!isVisible || !steps[activeStep]) return

        const selector = steps[activeStep].selector
        const el = document.querySelector(selector)
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" })
            // Wait for scroll
            setTimeout(() => {
                setTargetRect(el.getBoundingClientRect())
            }, 600)

            // Poll for position changes
            const interval = setInterval(() => {
                setTargetRect(el.getBoundingClientRect())
            }, 500)
            return () => clearInterval(interval)
        } else {
            // Element not found - maybe fallback or alert
            console.warn("Element not found:", selector)
        }
    }, [activeStep, isVisible, steps])

    if (!isVisible) return null

    const currentReq = steps[activeStep]

    // Spotlight styles using mixed-blend-mode or simple overlay with hole (using clip-path or huge borders)
    // Simple approach: 4 divs for dimming around the target.
    // Or simpler: transparent div with huge box-shadow.

    // We'll use a semi-transparent SVG overlay with a hole or just absolute positioned divs.
    // using box-shadow on the highlight box is easiest: box-shadow: 0 0 0 9999px rgba(0,0,0,0.7);

    const finish = () => {
        setIsVisible(false)
        setSteps([])
        setActiveStep(0)
    }

    return (
        <div className="fixed inset-0 z-[99999] pointer-events-none font-sans text-base">
            {/* Provide Click-through for the actionable element if needed, or block everything and force "Next" */}
            {/* For guidance, we usually want user to Click the element. So we should NOT block pointer events on the target. */}

            {targetRect && (
                <div
                    className="absolute border-4 border-brand-500 rounded transition-all duration-300 ease-out z-[99999]"
                    style={{
                        top: targetRect.top + window.scrollY - 4,
                        // Wait, Plasmo CSUI is usually injected in a shadow root.
                        // Standard 'fixed' in shadow root works relative to viewport. Good.
                        // But getBoundingClientRect is relative to viewport.
                        // So top = targetRect.top.
                        left: targetRect.left - 4,
                        width: targetRect.width + 8,
                        height: targetRect.height + 8,
                        boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.45), 0 0 20px rgba(14, 165, 233, 0.6)"
                    }}
                >
                    {/* Pulse Effect */}
                    <div className="absolute inset-0 border-4 border-brand-400 opacity-0 animate-ping rounded"></div>

                    {/* Tooltip */}
                    <div className="absolute left-0 -top-36 w-72 bg-white text-slate-800 p-5 rounded-xl shadow-2xl pointer-events-auto flex flex-col gap-3 font-sans border border-gray-100 z-[100000]">
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                            <div className="font-bold text-sm text-brand-600 uppercase tracking-wide">Step {activeStep + 1} of {steps.length}</div>
                            <div className="text-xs text-gray-400">ShadowLight</div>
                        </div>
                        <p className="text-sm leading-relaxed font-medium">{currentReq.instruction}</p>
                        <div className="flex justify-between mt-1 items-center">
                            <button
                                onClick={finish}
                                className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1 hover:bg-red-50 rounded"
                            >
                                Stop
                            </button>
                            <div className="flex gap-2">
                                <button
                                    disabled={activeStep === 0}
                                    onClick={() => setActiveStep(s => s - 1)}
                                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium disabled:opacity-50 transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={() => {
                                        if (activeStep < steps.length - 1) setActiveStep(s => s + 1)
                                        else finish()
                                    }}
                                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold shadow-sm shadow-brand-500/30 transition-all active:scale-95"
                                >
                                    {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
                                </button>
                            </div>
                        </div>
                        {/* Triangle */}
                        <div className="absolute bottom-[-8px] left-6 w-0 h-0 border-l-[8px] border-l-transparent border-t-[8px] border-t-white border-r-[8px] border-r-transparent filter drop-shadow-sm"></div>
                    </div>
                </div>
            )}
        </div>
    )
}
