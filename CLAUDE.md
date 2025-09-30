# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based manufacturing sensor monitoring application with AI-powered chat capabilities. The app integrates OpenAI's GPT-4 for conversational AI and provides real-time sensor monitoring with voice interaction support.

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Architecture Overview

### Frontend Stack
- **React 19** with React Router for SPA navigation
- **Vite** as build tool and dev server
- **OpenAI SDK** for GPT-4 chat integration
- Voice capabilities via Web Speech API and OpenAI TTS/STT

### Key Components

1. **Main Application Entry** (`src/main.jsx`):
   - Sets up React Router and renders `Case1` as the main component

2. **Case1 Component** (`src/Case1.jsx`):
   - Central dashboard managing sensor states, chat interface, and voice interactions
   - Integrates LogPanel for conversation history
   - Manages sensor status (正常/異常) with visual indicators

3. **API Integration** (`src/api/openai.js`):
   - Direct OpenAI API calls from browser (uses `dangerouslyAllowBrowser: true`)
   - Manages conversation context with sensor states
   - Uses GPT-4o-mini model for responses

4. **Voice Features**:
   - `src/hooks/useSpeechRecognition.js`: Browser speech recognition
   - `src/hooks/useSpeechSynthesis.js`: Browser text-to-speech
   - `src/utils/audioClient.js`: OpenAI STT/TTS via Netlify Functions

5. **Netlify Functions** (`netlify/functions/`):
   - `transcribe.js`: Speech-to-text using OpenAI Whisper
   - `speak.js`: Text-to-speech using OpenAI TTS

### State Management
- React useState for local component state
- Conversation history maintained in Case1 component
- Sensor states persisted to CSV via LogManager utility

## Environment Configuration

Required environment variables (create `.env.local` from `.env.sample`):

```bash
# Frontend OpenAI access
VITE_OPENAI_API_KEY=sk-...

# Netlify Functions OpenAI access
OPENAI_API_KEY=sk-...
```

## Deployment

Configured for Netlify deployment:
- Build output: `dist/`
- Node version: 20
- SPA routing configured with redirects

## Important Considerations

1. **Security**: Currently makes direct OpenAI API calls from browser. Production deployments should proxy through backend.

2. **Sensor Context**: The AI assistant always prioritizes current sensor states over conversation history when providing responses.

3. **Voice Interaction**: Supports both browser-native speech APIs and OpenAI's speech services through Netlify Functions.

4. **Logging**: LogManager (`src/utils/logManager.js`) handles conversation persistence and CSV export functionality.