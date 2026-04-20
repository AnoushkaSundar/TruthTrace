# TruthTrace — AI Evidence Investigator
### Team F · AI Detective · April 2026 Hackathon

> AI-powered forensic investigation of claims, news, and forwards — in seconds.

---

## 🚀 Quick Start

### 1. Get your free Groq API key
- Visit [console.groq.com](https://console.groq.com) and sign up (free)
- Copy your API key

### 2. Set the API key
Open `backend/.env` and replace the placeholder:
```
GROQ_API_KEY=your_actual_key_here
```

### 3. Start the backend
```bash
cd backend
python app.py
```
Or just double-click **`start_backend.bat`**

Backend will run at → `http://localhost:5000`

### 4. Open the frontend
Open `frontend/index.html` in your browser.

That's it. No build step needed.

---

## 🏗️ Project Structure

```
TruthTrace/
├── backend/
│   ├── app.py           # Flask server — main API
│   ├── prompt.py        # TruthTrace master system prompt
│   ├── requirements.txt # Python dependencies
│   ├── .env             # ← PUT YOUR API KEY HERE
│   └── .env.example     # Template
├── frontend/
│   ├── index.html       # Main UI
│   ├── style.css        # Dark forensic theme
│   └── app.js           # All frontend logic
├── start_backend.bat    # One-click backend launcher (Windows)
└── README.md
```

---

## 🔬 Investigation Pipeline

```
User Claim
    │
    ▼
┌─────────────────┐
│  STAGE 1        │  Decompose → core assertion, facts,
│  DECOMPOSE      │  assumptions, missing context, emotional triggers
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  STAGE 2        │  Interrogate → logical fallacies,
│  INTERROGATE    │  manipulation patterns, motive analysis
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  STAGE 3        │  Verdict → TRUE / MOSTLY TRUE / MISLEADING /
│  VERDICT        │  MOSTLY FALSE / FALSE / UNVERIFIABLE
└─────────────────┘
```

---

## ⚙️ Tech Stack

| Layer     | Technology            |
|-----------|-----------------------|
| Frontend  | HTML5 + CSS3 + Vanilla JS |
| Backend   | Python 3.11 + Flask   |
| AI Engine | Groq API + LLaMA 3 70B |
| Fonts     | Inter + JetBrains Mono (Google Fonts) |

---

## 📋 Verdict Definitions

| Verdict       | Meaning |
|---------------|---------|
| TRUE          | Core claim is accurate and well-supported |
| MOSTLY TRUE   | Substantially accurate with minor inaccuracies |
| MISLEADING    | May contain facts but framed to deceive |
| MOSTLY FALSE  | Contains a kernel of truth but substantially distorted |
| FALSE         | Factually incorrect; contradicted by evidence |
| UNVERIFIABLE  | Insufficient information to confirm or deny |

---

## ⚠️ Disclaimer

TruthTrace generates **AI-powered analysis** — not verified fact.  
Always cross-reference important claims with trusted sources before sharing.

---

*TruthTrace SRS v1.0 · Team F — AI Detective · April 2026*
