# ShadowLight

**ShadowLight** is an AI-Powered accessibility and guided web interaction assistant Chrome Extension built with [Plasmo](https://docs.plasmo.com/).

## Features

- **AI Summarization**: Get concise summaries of any webpage using Llama3 (via Groq).
- **Visual Guidance**: Step-by-step visual navigation to elements (e.g., "Show me where to login").
- **Accessibility**: High-contrast mode toggle for easier reading.
- **Chatbot Interface**: Natural language interaction with the extension.
- **Privacy Focused**: No data storage, runs locally or via secure API calls.

## Tech Stack

- **Framework**: Plasmo (Manifest V3)
- **UI**: React, TypeScript, Tailwind CSS, Headless UI
- **AI**: Groq Cloud API (Llama3-8B-8192)
- **State**: TanStack Query
- **Messaging**: Chrome Extension Messaging API

## Prerequisites

- Node.js 16+
- NPM or PNPM
- A [Groq Cloud API Key](https://console.groq.com/)

## Installation

1. Clone the repository (if not already local).
2. Install dependencies:
   ```bash
   npm install
   ```

## Development

Run the development server:
```bash
npm run dev
# or
plasmo dev
```
Load the extension in Chrome:
1. Go to `chrome://extensions/`
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `build/chrome-mv3-dev` directory.

## Build for Production

```bash
npm run build
# or
plasmo build
```
The output will be in `build/chrome-mv3-prod`.

## Usage

1. **Set API Key**: Open the extension popup, click the settings icon (gear), and enter your Groq API Key.
2. **Summarize**: Type "Summarize this page" in the chat.
3. **Guidance**: Type "Guide me to [action]" (e.g., "Guide me to the login button").
4. **Contrast**: Click the "Contrast" button to toggle high-contrast mode.

## Example Prompts

- "Summarize this article for me."
- "Where is the checkout button?"
- "Help me find the contact form."

## Structure

- `/background.ts` - AI Controller & Service Worker
- `/content.tsx` - Visual Overlay & Page Scraper
- `/popup.tsx` - Chat Interface
- `/shared` - Utilities & Types
