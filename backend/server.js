import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemma-4-26b-a4b-it';

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? (process.env.FRONTEND_URL || 'http://localhost:5173') 
    : '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// In-memory rate limiting for public demo protection (e.g. 20 requests per minute per IP)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;

const rateLimiter = (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const clientData = rateLimitMap.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };

  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + RATE_LIMIT_WINDOW_MS;
  } else {
    clientData.count += 1;
  }

  rateLimitMap.set(ip, clientData);

  if (clientData.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      error: 'Too many requests. Please wait a minute before analyzing another image.'
    });
  }

  next();
};

// Configure Multer for in-memory file uploads with limits
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file format. Please upload a JPEG, PNG, or WebP image.'));
    }
  }
});

// Helper to initialize Google Gen AI Client
const getAiClient = () => {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_actual_api_key') {
    throw new Error('GEMINI_API_KEY is not configured in backend environment.');
  }
  return new GoogleGenAI({ apiKey: GEMINI_API_KEY });
};

// Clean and parse JSON response from the model
function parseModelJson(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Empty response received from AI model.');
  }

  // Remove potential markdown fences
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  cleaned = cleaned.trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    // Attempt extracting substring between first { and last }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const extracted = cleaned.substring(firstBrace, lastBrace + 1);
      parsed = JSON.parse(extracted);
    } else {
      throw new Error(`Failed to parse AI output as JSON: ${err.message}`);
    }
  }

  // Unwrap if the model returned a numeric-keyed wrapper object ({"0": {...}})
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const keys = Object.keys(parsed);
    if (keys.length === 1 && /^\d+$/.test(keys[0]) && typeof parsed[keys[0]] === 'object') {
      parsed = parsed[keys[0]];
    }
    // Also unwrap if wrapped in a 'report' key
    if (keys.length === 1 && keys[0] === 'report' && typeof parsed['report'] === 'object') {
      parsed = parsed['report'];
    }
  }

  // Handle array — take first element
  if (Array.isArray(parsed) && parsed.length > 0) {
    parsed = parsed[0];
  }

  return parsed;
}


// GET /api/status - Check backend status and model configuration
app.get('/api/status', async (req, res) => {
  const isKeyConfigured = Boolean(GEMINI_API_KEY && GEMINI_API_KEY !== 'your_actual_api_key');
  res.json({
    status: 'online',
    model: GEMINI_MODEL,
    keyConfigured: isKeyConfigured,
    provider: 'Google Gen AI (Hosted)',
    timestamp: new Date().toISOString()
  });
});

// POST /api/analyze - Upload image and analyze civic issue
app.post('/api/analyze', rateLimiter, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image size exceeds the 10MB limit.' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded. Please select a valid photo.' });
    }

    const { location, description } = req.body;
    const userLocation = location ? String(location).trim() : null;
    const userDescription = description ? String(description).trim() : null;

    let ai;
    try {
      ai = getAiClient();
    } catch (configErr) {
      return res.status(500).json({
        error: configErr.message,
        code: 'MISSING_API_KEY',
        hint: 'Please set GEMINI_API_KEY in the backend/.env file.'
      });
    }

    const imageBase64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    const systemInstruction = `You are an expert, objective Civic Infrastructure Observation Assistant.
Your task is to analyze user-submitted photographs of public or urban infrastructure to detect visible issues (such as potholes, road damage, waterlogging, drainage issues, overflowing garbage, broken pavements, downed branches/debris, damaged guardrails or streetlights).

CRITICAL OPERATIONAL RULES:
1. Base your analysis STRICTLY on visible, direct evidence in the photo. Do NOT invent, assume, or hallucinate details.
2. Distinguish clearly between observed facts (what is directly visible) and possible consequences.
3. NEVER invent an exact street address, postal code, municipal ticket/complaint ID, verified repair timeline, or official civil engineering safety rating.
4. Apparent severity MUST be assessed only as: "Low", "Moderate", "High", or "Uncertain", representing an initial visual triage, NOT an official engineering certification.
5. If the photograph does not show a civic issue (e.g. an indoor photo, portrait, food, intact street with no defects), set issueCategory to "No Civic Issue Detected" or "Uncertain / Unclear Image" with honest explanations. Do not force an issue where none exists.
6. If the image is blurry, dark, low-resolution, or obstructed, explicitly state the visual uncertainty.
7. Any user-provided location or notes must be treated strictly as unverified citizen context. Do NOT claim you geolocated or verified the place.
8. NEVER state that a complaint has already been submitted or that live crews have been dispatched.
9. You must respond with valid JSON matching the exact schema requested.`;

    const userPrompt = `Analyze this civic infrastructure image.
${userLocation ? `User-Provided Location Note (Unverified): "${userLocation}"\n` : ''}${userDescription ? `User-Provided Issue Note: "${userDescription}"\n` : ''}

Provide your analysis in strictly valid JSON with these exact fields:
{
  "issueCategory": "Category name (e.g. Potholes & Road Damage, Drainage & Waterlogging, Waste & Garbage Accumulation, Footpath & Pedestrian Hazard, Obstruction & Debris, Public Asset Damage, No Civic Issue Detected, or Uncertain / Unclear Image)",
  "isCivicIssue": true or false,
  "summary": "1-2 sentence concise factual summary of the visible condition",
  "visibleEvidence": [
    "Direct visual observation 1",
    "Direct visual observation 2"
  ],
  "severity": {
    "level": "Low" | "Moderate" | "High" | "Uncertain",
    "rationale": "Clear plain-language explanation of why this apparent visual severity was assigned based only on visible evidence"
  },
  "potentialImpact": {
    "pedestrians": "Potential impact on pedestrians, wheelchair users, or walkers based on observable hazards",
    "vehicles": "Potential impact on two-wheelers, cars, cyclists, or transit based on visible road conditions",
    "infrastructure": "Potential impact on adjacent drainage, utility lines, road foundation, or public property"
  },
  "recommendedActions": [
    "Practical recommendation 1 (e.g., Caution drivers, Report to municipal ward office)",
    "Practical recommendation 2"
  ],
  "suggestedReport": {
    "title": "Clear, concise report title suitable for civic authority portal",
    "locationContext": "${userLocation ? userLocation : 'Citizen-reported visual evidence (precise coordinates unverified)'}",
    "description": "Professional, objective issue description ready for citizen submission to municipal or local public works department",
    "urgencyNote": "Standard triage note emphasizing apparent visual concern without claiming official certification"
  },
  "uncertaintyAndAssumptions": "Explicit plain-language explanation of what cannot be determined from this photo alone (e.g., subsurface depth, exact coordinates, underground drainage state, structural stability under load)",
  "confidenceScore": "High" | "Medium" | "Low"
}`;

    // Call Hosted Gemma 4 model via official Google Gen AI SDK
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          inlineData: {
            data: imageBase64,
            mimeType: mimeType
          }
        },
        userPrompt
      ],
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.2 // Low temperature for factual, reliable assessment
      }
    });

    const parsedReport = parseModelJson(response.text);

    // Attach verified metadata
    const finalReport = {
      ...parsedReport,
      meta: {
        model: GEMINI_MODEL,
        analyzedAt: new Date().toISOString(),
        imageSize: req.file.size,
        mimeType: req.file.mimetype,
        providedLocation: userLocation,
        providedDescription: userDescription
      }
    };

    return res.json({
      success: true,
      report: finalReport
    });

  } catch (error) {
    console.error('Error during AI analysis:', error);

    // Distinguish model availability errors, invalid keys, or generic API errors
    const errorMessage = error?.message || 'An unexpected error occurred during analysis.';
    const isModelNotFound = errorMessage.includes('not found') || errorMessage.includes('404') || errorMessage.includes('is not supported');
    const isAuthError = errorMessage.includes('API key') || errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('permission');
    const isRateLimit = errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('ResourceExhausted');

    return res.status(500).json({
      success: false,
      error: errorMessage,
      code: isModelNotFound ? 'MODEL_UNAVAILABLE' : (isAuthError ? 'AUTH_ERROR' : (isRateLimit ? 'RATE_LIMIT' : 'AI_API_ERROR')),
      modelRequested: GEMINI_MODEL,
      details: {
        message: errorMessage,
        suggestion: isModelNotFound 
          ? `The requested model "${GEMINI_MODEL}" may not be accessible to this key. Verify model name or check available models using the Google Gen AI models.list() API.`
          : (isAuthError ? 'Check your GEMINI_API_KEY in backend/.env' : 'Check network connectivity or retry after a moment.')
      }
    });
  }
});

// Root route
app.get('/', (req, res) => {
  res.json({
    app: 'CivicLens AI API',
    description: 'AI-Powered Civic Issue Detection and Reporting using hosted Google Gemma 4',
    endpoints: {
      status: 'GET /api/status',
      analyze: 'POST /api/analyze'
    }
  });
});

app.listen(PORT, () => {
  console.log(`CivicLens AI backend running on http://localhost:${PORT}`);
  console.log(`Configured Model: ${GEMINI_MODEL}`);
  console.log(`API Key configured: ${Boolean(GEMINI_API_KEY && GEMINI_API_KEY !== 'your_actual_api_key')}`);
});
