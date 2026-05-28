# 🎮 CodeQuest — AI-Powered Coding Education

> Free, accessible, AI-driven coding education for anyone with a browser. No GPU. No install. No price tag.

![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.4-brightgreen)
![Spring AI](https://img.shields.io/badge/Spring%20AI-1.0-blue)
![React](https://img.shields.io/badge/React-18-61dafb)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 🎯 The Mission

CodeQuest is an open-source, AI-powered coding education platform built for learners who don't have access to expensive tools, powerful hardware, or paid tutoring.

Students register, choose their programming language and skill level, and immediately receive AI-generated bug-hunting challenges tailored to their level. A real-time AI tutor accompanies every session — responding in the student's own language using the **Socratic method**, guiding through questions rather than handing out answers.

Built on Spring Boot 3 and Spring AI, with Groq's free LLM tier as the inference engine, **CodeQuest costs nothing to run and nothing to use**. It is designed to be deployed once and accessed by anyone, anywhere — from a phone, a tablet, or an old laptop with a browser.

---

## ✅ What Exists Today

- 🐛 **AI-generated bug-hunt challenges** across any programming language
- 💬 **Real-time streaming AI tutor** with full conversation memory and Socratic method
- 🏆 **XP system with level progression** — from Beginner to Master
- 🗣️ **Multilingual support** — the AI detects and responds in the student's own language
- 💾 **Session persistence** — tutor chat, current challenge, and solution draft survive reloads
- 🎯 **Session focus mode** — learners can steer the next generated challenge toward a topic like arrays, recursion, SQL, or React state
- 🏗️ **Production-ready Spring Boot backend** — PostgreSQL, Redis, Flyway, Docker
- 🖥️ **Clean React frontend** with Monaco Editor (the same editor as VS Code)
- 🚀 **One-command local setup** and free cloud deployment guide

---

## 🗺️ Roadmap — What Is Planned

| Feature | Description |
|---|---|
| 📚 **Quest system** | Structured learning paths from beginner to senior across multiple languages |
| ⚔️ **Code Battle mode** | Two students compete live on the same challenge via WebSocket |
| 👾 **AI Villain boss fights** | End-of-quest challenges where the AI plays a broken production system |
| 🌍 **Global leaderboard** | Streak tracking and worldwide rankings |
| 🎓 **University dashboard** | Lecturers assign challenges, track student progress, and export results |
| 📱 **Mobile-first PWA** | Learn on any device without installation |
| 🏢 **Institutional SaaS tier** | White-label deployment for universities and bootcamps |

---

## 💡 Product Ideas Worth Building Next

These are concrete additions that fit the current product instead of generic "AI app" ideas:

| Idea | Why it matters |
|---|---|
| 🧭 **Bug taxonomy map** | Tag challenges by concepts like loops, state, async, SQL, recursion, and show which categories a learner struggles with most |
| 🧪 **Test-first mode** | Give learners failing tests and ask them to make the suite pass, which is closer to real engineering work |
| 🧱 **Progressive hint ladder** | Replace one big hint with 3 levels: nudge, pinpoint, walkthrough |
| 🪞 **Post-challenge reflection** | Ask “what bug pattern did you miss?” and save the answer as part of learning memory |
| 🧠 **Weakness-driven generation** | Generate the next challenge from the learner’s repeated failure patterns rather than random topics |
| 👥 **Pair-debug mode** | Two learners solve the same bug together with shared chat and editor state |
| 📊 **Coach dashboard** | Show time-to-fix, hint usage, repeated bug categories, and XP trends for mentors or lecturers |
| 🧾 **Portfolio of fixes** | Save solved bugs and model explanations into a learner-facing history of debugging wins |

---

## 🚀 Quick Start (3 commands)

### Prerequisites
- Java 17+, Node 20+, Docker

```bash
# 1. Clone and enter project
git clone https://github.com/rrezartprebreza/codequest.git && cd codequest

# 2. Start everything (local Ollama + PostgreSQL + Redis + backend + frontend)
./start.sh
```

Open **http://localhost:5173** 🎉

### Manual start (if you prefer)
```bash
# Terminal 1 — Infrastructure
cd backend && docker-compose up -d

# Pull a local model once (first run only)
docker exec -it codequest-ollama ollama pull llama3.2:3b

# Terminal 2 — Backend
cd backend && ./mvnw spring-boot:run

# Terminal 3 — Frontend
cd frontend && npm install && npm run dev
```

---

## 🤖 AI Provider Modes

### Local development (default)
- Uses Docker Ollama on `http://localhost:11434`
- Default model: `llama3.2:3b`

### Production with Groq
Set these env vars before starting backend:

```bash
export AI_BASE_URL=https://api.groq.com/openai
export AI_API_KEY=your_groq_api_key
export AI_MODEL=llama-3.3-70b-versatile
```

---

## 🏗️ Architecture

```
React (Vite + TypeScript + Monaco Editor)
        ↕ REST / SSE Streaming
Spring Boot 3.4 (Java 17)
   ├── Spring AI 1.0 → Ollama (local) or Groq (production)
   ├── PostgreSQL + Flyway — player progress
   └── Redis — session & conversation memory
```

---

## 🌐 Deploy Free

| Service | What |
|---|---|
| [Render.com](https://render.com) | Spring Boot backend (free tier) |
| [Vercel](https://vercel.com) | React frontend (free tier) |
| [Supabase](https://supabase.com) | PostgreSQL (free tier) |
| [Upstash](https://upstash.com) | Redis (free tier) |
| [Groq](https://console.groq.com) | LLM API (free tier) |

**Total cost: $0/month**

### Render deployment
1. Connect GitHub repo to Render
2. Set env vars: `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `DATABASE_URL`, `REDIS_HOST`, `CORS_ORIGINS`
3. Render auto-detects the `Dockerfile` and deploys

### Vercel deployment
1. Connect GitHub repo to Vercel
2. Set `VITE_API_URL=https://your-app.onrender.com/api/v1`
3. Deploy

---

## 📡 API Reference

```
# Players
POST   /api/v1/players                         Register
POST   /api/v1/players/login                   Login by username or email
GET    /api/v1/players/{id}                    Get player
PATCH  /api/v1/players/{id}/preferences        Update language/level

# Challenges
POST   /api/v1/challenges/generate/{playerId}  Generate AI challenge
POST   /api/v1/challenges/submit               Submit solution
GET    /api/v1/challenges/history/{playerId}   Get history

# Sessions
POST   /api/v1/sessions/{sessionId}/challenge  Set challenge context

# Tutor (SSE)
POST   /api/v1/tutor/chat/{sessionId}          Stream AI tutor
```

---

## 🧰 Tech Stack

**Backend:** Java 17 · Spring Boot 3.4 · Spring AI 1.0 · Ollama (local) / Groq (prod) · PostgreSQL · Flyway · Redis · WebFlux SSE

**Frontend:** React 18 · TypeScript · Vite · Monaco Editor · Tailwind CSS · Server-Sent Events

---

## 👤 About

Built by a **senior Java engineer and university lecturer** with the conviction that quality coding education should be free, accessible, and actually engaging — regardless of where in the world a student is, what device they own, or how much money they have.

---

## 📄 License

MIT © [Rrezart Prebreza](https://github.com/rrezartprebreza)

---

⭐ If CodeQuest helped you — star this repo to help others find it!
