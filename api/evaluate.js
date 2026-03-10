// ── MAINSEDGE · SERVERLESS BACKEND ──
// Vercel serverless function — API keys never exposed to frontend

const SYSTEM_PROMPT = `You are a brutally honest, highly experienced UPSC Mains examiner and mentor with 20+ years of evaluation experience. You evaluate answers exactly like the UPSC examination board — no leniency, no encouragement bias.

SCORING RULES — NON-NEGOTIABLE:
1. MAXIMUM score you can ever give is 7.5/10. UPSC never awards full marks. Ever.
2. A generic answer with no specific facts, data, jargon, or current affairs = 2–3/10 MAXIMUM.
3. Every 0.5 mark increase must be EARNED by:
   — Specific facts, statistics, survey data, index rankings
   — Committee/Commission names (e.g. Narasimham, Kelkar, ARC)
   — Constitutional Articles, Schedules, Amendments
   — Government schemes with launch year (e.g. PM-KISAN 2019, MGNREGS 2005)
   — Recent current affairs from last 6–12 months with dates
   — Structured format: intro → body (multi-dimensional) → conclusion
   — Creative elements: tables, flowcharts, diagrams (described in text)
   — Multi-dimensional analysis: social / economic / political / environmental / ethical
   — International comparisons, SDG linkages, India's global commitments
4. PENALISE heavily: vague statements, "it is important to note", "therefore we can say",
   filler sentences, zero data, single-dimensional analysis.
5. REWARD: Every specific data point, every recent event with date,
   every constitutional provision cited.

SCORING SCALE:
2.0–3.0 : Generic answer, no substance, no facts, no structure
3.0–4.0 : Minimal relevant content, very little data, poor structure
4.0–5.0 : Decent structure, some facts, lacks analytical depth
5.0–6.0 : Good content, several facts/schemes, average multi-dimensional analysis
6.0–7.0 : Strong answer — specific data, current affairs, good structure, solid analysis
7.0–7.5 : Exceptional — precise data, very recent events, multi-dimensional, creative structure

SUBJECT-SPECIFIC NOTES:
— GS1: Expect historical facts, geographical data, social movements, art/culture specifics
— GS2: Expect constitutional articles, polity data, international relations, schemes
— GS3: Expect economic data, indices (GHI, HDI, EoDB), technology, environment targets
— GS4 (Ethics): Expect thinkers names, case study analysis, value frameworks, real examples
— Essay: Expect quotes, literary references, multi-dimensional flow, strong intro/conclusion

You MUST respond ONLY in this exact JSON format. No markdown. No preamble. No explanation outside JSON:
{
  "score": <number 2.0–7.5, one decimal place>,
  "scaled_score": <score proportionally scaled to total marks, one decimal>,
  "verdict": "<Poor|Average|Good|Excellent>",
  "score_reasoning": "<2–3 lines. Brutally specific — name exactly what earned or lost marks>",
  "dimensions": {
    "content_quality":  { "score": <0–10>, "note": "<specific — what data was present/absent>" },
    "current_affairs":  { "score": <0–10>, "note": "<specific recent events present/missing>" },
    "structure":        { "score": <0–10>, "note": "<intro/body/conclusion quality>" },
    "analytical_depth": { "score": <0–10>, "note": "<multi-dimensional or single-track?>" },
    "presentation":     { "score": <0–10>, "note": "<tables/flowcharts/diagrams/formatting>" }
  },
  "mistakes": [
    "<Specific mistake 1 — name exactly what was wrong or missing>",
    "<Specific mistake 2>",
    "<Specific mistake 3>",
    "<Specific mistake 4 — only if applicable>",
    "<Specific mistake 5 — only if applicable>"
  ],
  "improvements": [
    "<Specific improvement with contextual hint>",
    "<Improvement 2 — include exact scheme/data/article to add>",
    "<Improvement 3>",
    "<Improvement 4 — only if applicable>",
    "<Improvement 5 — only if applicable>"
  ],
  "missing_keywords": [
    "<keyword 1>", "<keyword 2>", "<keyword 3>",
    "<keyword 4>", "<keyword 5>", "<keyword 6>",
    "<keyword 7>", "<keyword 8>"
  ],
  "current_affairs_gaps": [
    { "date": "<Month Year>", "event": "<Specific recent event that should have been cited>" },
    { "date": "<Month Year>", "event": "<Event 2>" },
    { "date": "<Month Year>", "event": "<Event 3>" }
  ],
  "model_answer_outline": "<A complete 250–300 word model answer written exactly like a UPSC topper. Must include: specific data points, constitutional provisions, government schemes with years, recent current affairs, multi-dimensional analysis, structured intro-body-conclusion. Make the student viscerally feel the gap.>"
}`;

// ── GEMINI API CALLER ──
async function callGemini(apiKey, base64Image, mimeType, question, totalMarks, subject) {
  const wordLimit = totalMarks <= 5  ? '75–100 words'
                  : totalMarks <= 10 ? '150 words'
                  : totalMarks <= 15 ? '250 words'
                  : totalMarks <= 20 ? '300 words'
                  : '350+ words';

  const userPrompt = `SUBJECT: ${subject}
QUESTION: ${question}
TOTAL MARKS: ${totalMarks}
EXPECTED WORD LIMIT: ${wordLimit}

The student's handwritten/typed answer is in the attached image.
Evaluate strictly as a UPSC Mains examiner.
Cap score at 7.5/10 no matter how good.
Be brutally specific about every missing fact, scheme, article, or data point.
Cite exact current affairs from 2024–2025 that are relevant and missing.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: SYSTEM_PROMPT + '\n\n' + userPrompt },
            { inlineData: { mimeType, data: base64Image } }
          ]
        }],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 2800,
          topP: 0.85
        }
      })
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini error ${response.status}`);
  }

  const data = await response.json();
  const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Parse JSON from response
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const start   = cleaned.indexOf('{');
  const end     = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Invalid AI response format.');

  return JSON.parse(cleaned.slice(start, end + 1));
}

// ── FALLBACK WATERFALL ──
// Tries each key in order — if one hits rate limit, moves to next
async function evaluateWithFallback(base64Image, mimeType, question, totalMarks, subject) {
  const keys = [
    process.env.GEMINI_KEY_1,
    process.env.GEMINI_KEY_2,
    process.env.GEMINI_KEY_3,
  ].filter(Boolean); // ignore any undefined keys

  if (keys.length === 0) {
    throw new Error('No API keys configured. Please contact support.');
  }

  let lastError = null;

  for (let i = 0; i < keys.length; i++) {
    try {
      const result = await callGemini(
        keys[i], base64Image, mimeType, question, totalMarks, subject
      );
      return result; // success — return immediately
    } catch (err) {
      lastError = err;
      const msg = err.message || '';
      // Only fall through to next key on rate limit or quota errors
      // For bad request / auth errors, fail immediately
      if (msg.includes('400') || msg.includes('403') || msg.includes('API key')) {
        throw new Error(`API key ${i + 1} error: ${msg}`);
      }
      // 429 = rate limit, 500/503 = server error → try next key
      console.log(`Key ${i + 1} failed (${msg}), trying next key…`);
    }
  }

  throw new Error(`All API keys exhausted. Last error: ${lastError?.message}`);
}

// ── MAIN HANDLER ──
export default async function handler(req, res) {

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers — allow your own domain only in production
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const { base64Image, mimeType, question, totalMarks, subject } = req.body;

    // Validate inputs
    if (!base64Image)  return res.status(400).json({ error: 'No image provided.' });
    if (!question?.trim()) return res.status(400).json({ error: 'No question provided.' });
    if (!mimeType)     return res.status(400).json({ error: 'No file type provided.' });

    const marks   = parseFloat(totalMarks) || 10;
    const subj    = subject || 'GS2';

    // Run evaluation with fallback
    const result = await evaluateWithFallback(
      base64Image, mimeType, question, marks, subj
    );

    return res.status(200).json({ success: true, result });

  } catch (err) {
    console.error('Evaluation error:', err.message);
    return res.status(500).json({
      error: err.message || 'Evaluation failed. Please try again.'
    });
  }
}
