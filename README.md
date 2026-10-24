# CivicLens AI

> **AI-Powered Civic Issue Detection and Reporting**  
> *See the issue. Understand the impact. Take action.*

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Model: gemma-4-26b-a4b-it](https://img.shields.io/badge/Model-Gemma%204%20(26B%20MoE)-cyan)](https://ai.google.dev)
[![SDK: @google/genai](https://img.shields.io/badge/SDK-%40google%2Fgenai-blue)](https://www.npmjs.com/package/@google/genai)

---

## Problem Statement

Citizens often witness visible civic infrastructure failures — potholes, waterlogging, overflowing garbage, broken footpaths — but lack the tools to quickly understand the severity or prepare an effective complaint for civic authorities. Manual reporting is inconsistent, and images alone are rarely submitted with structured context.

## Solution Overview

CivicLens AI lets a citizen upload a single street photograph to receive an instant, structured AI analysis:

- **Issue Category** — e.g. Potholes & Road Damage, Drainage & Waterlogging, Footpath Hazard
- **Visible Evidence** — extracted directly from the image
- **Apparent Severity** — Low / Moderate / High (visual triage, not an engineering certificate)
- **Potential Impact** — on pedestrians, vehicles, and public infrastructure
- **Recommended Actions** — practical next steps for citizens and responders
- **Ready-to-Submit Report Draft** — formatted for civic complaint portals

The application is honest about what AI can and cannot determine from a photograph.

---

## Architecture

```
Browser (React + Vite)
        │  FormData (image + optional location & description)
        ▼
Express Backend (Node.js)
        │  Multipart validation, rate limiting, base64 encoding
        ▼
Google Gen AI SDK (@google/genai)
        │  Hosted Gemma 4 API — multimodal image + text input
        ▼
gemma-4-26b-a4b-it (MoE, 4B active params, hosted via Gemini API key)
        │  Structured JSON response
        ▼
Express Backend  →  Returns validated JSON report
        │
Browser  →  Renders structured report, copy-to-clipboard
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 8 + JavaScript |
| Styling | Vanilla CSS (custom design system) |
| Backend | Node.js + Express 5 |
| AI SDK | **@google/genai** (official Google Gen AI JS SDK) |
| AI Model | **gemma-4-26b-a4b-it** (Gemma 4, hosted via Gemini API) |
| Image Upload | Multer (in-memory, 10 MB limit) |
| Config | dotenv |

---

## How the Gemma 4 API is Used

CivicLens AI uses the **hosted Gemma 4 MoE model** (`gemma-4-26b-a4b-it`) accessed via the official Google Gen AI JavaScript SDK (`@google/genai`).

The backend:
1. Encodes the uploaded image as base64
2. Submits it alongside a structured analysis prompt using `inlineData` multimodal input
3. Passes a system instruction directing the model to act as a civic infrastructure observer
4. Requests `responseMimeType: 'application/json'` with `temperature: 0.2` for factual, consistent output
5. Parses and validates the structured JSON report before returning it to the browser

**The API key is only used server-side. It is never exposed to the browser.**

---

## Project Structure

```
civiclens-ai/
├── backend/
│   ├── server.js          # Express API — /api/analyze + /api/status
│   ├── package.json
│   ├── .env               # Real API key — never commit
│   ├── .env.example       # Template — safe to commit
│   └── .gitignore
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── StatusBadge.jsx   # Model connection indicator
│   │   │   ├── UploadPanel.jsx   # Drag-drop upload + form
│   │   │   └── ResultPanel.jsx   # Structured report display
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css      # Full design system (dark navy + cyan/teal)
│   ├── index.html
│   ├── vite.config.js     # Proxy: /api → localhost:5000
│   └── package.json
├── .gitignore
├── LICENSE                # MIT
└── README.md
```

---

## Installation

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- A Google Gen AI API key with access to hosted Gemma 4 models

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd civiclens-ai
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Install frontend dependencies

```bash
cd ../frontend
npm install
```

---

## Environment Configuration

Copy the example file and add your real API key:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
GEMINI_API_KEY=your_actual_api_key_here
GEMINI_MODEL=gemma-4-26b-a4b-it
PORT=5000
```

> **Never commit `backend/.env` to version control.** It is already listed in `.gitignore`.

### Verifying model availability

To check whether your key can access the target model, run:

```bash
cd backend
node -e "
import('@google/genai').then(({ GoogleGenAI }) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const list = ai.models.list();
  list.then(async r => { for await (const m of r) console.log(m.name); });
});
" --input-type=module
```

Or check the `/api/status` endpoint after starting the backend.

---

## Running the Application

### Start the backend

```bash
cd backend
npm start
# Backend starts on http://localhost:5000
```

### Start the frontend (separate terminal)

```bash
cd frontend
npm run dev
# Frontend starts on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## Example Workflow

1. Open `http://localhost:5173`
2. Drag and drop or click to upload a street photograph (JPEG, PNG, or WebP, max 10 MB)
3. Optionally enter the approximate location (e.g. "MG Road near signal junction, Bengaluru") and a brief note
4. Click **Analyze Civic Issue**
5. The AI analyzes visible evidence in the image and returns a structured report:
   - Category (e.g. Potholes & Road Damage)
   - Summary and visible evidence
   - Apparent severity (Low / Moderate / High)
   - Potential impact on pedestrians, vehicles, and infrastructure
   - Recommended next actions
   - A ready-to-copy civic complaint draft
6. Use the **⎘ Copy** button to copy the report for submission to your civic authority portal

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/status` | Returns backend and model configuration status |
| `POST` | `/api/analyze` | Upload image and receive a structured civic issue report |

### POST /api/analyze

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `image` | File | ✅ | JPEG, PNG, or WebP image (max 10 MB) |
| `location` | String | ❌ | Optional user-provided location note |
| `description` | String | ❌ | Optional user observation |

**Response:** JSON report with `issueCategory`, `severity`, `visibleEvidence`, `potentialImpact`, `recommendedActions`, `suggestedReport`, `uncertaintyAndAssumptions`, and metadata.

---

## Known Limitations

- **Image content only**: The AI analyzes visual evidence in the photo. It cannot determine exact GPS coordinates, subsurface damage, or underground drainage conditions.
- **No automated submission**: CivicLens AI generates a report draft. It does not submit a complaint on behalf of the citizen.
- **Severity is visual triage**: The Low / Moderate / High rating is an apparent visual assessment, not an official engineering or safety certification.
- **Location is unverified**: User-provided location text is passed as context only. The model does not geolocate images.
- **Network dependency**: The model runs hosted via the Google Gen AI API. An internet connection is required.
- **Rate limiting**: The backend enforces 30 requests per minute per IP for demo protection.
- **10 MB upload limit**: Very large images should be resized before upload.

---

## Privacy Considerations

- Uploaded images are processed in memory and are not persisted to disk on the backend.
- Images are sent to the Google Gen AI API for inference. Review [Google's AI usage policies](https://ai.google.dev/gemini-api/terms) before deploying publicly.
- No user account data, location, or image is stored by this application.
- The API key is server-side only and is not exposed to the browser.

---

## Future Improvements

- Real geolocation via browser GPS (with explicit user consent)
- One-click export to PDF / shareable link
- Integration with public civic complaint APIs (e.g., Open311)
- Multi-image batch analysis for larger inspections
- History / session persistence (optional, with local storage)
- Admin dashboard for aggregated community-submitted reports
- Image compression before upload to stay within API size limits
- Progressive Web App (PWA) support for mobile field use

---

## Acknowledgements

| Component | Details |
|---|---|
| AI Model | `gemma-4-26b-a4b-it` — Gemma 4 MoE, 26B total parameters, 4B active, by Google DeepMind |
| AI SDK | `@google/genai` v2.x — Official Google Gen AI JavaScript SDK |
| API Platform | [Google Gen AI / Gemini API](https://ai.google.dev) |
| Frontend | React 18, Vite 8 |
| Backend | Express 5, Multer 2 |
| Fonts | Inter + Space Grotesk via Google Fonts |

---

## License

[MIT License](LICENSE) — See LICENSE file for details.

This project was built for a hackathon demonstration using free and open-source tools and the public Google Gen AI API.
