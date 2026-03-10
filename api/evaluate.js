// ── MAINSEDGE · SERVERLESS BACKEND ──

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
4. PENALISE heavily: vague statements, filler sentences, zero data, single-dimensional analysis.
5. REWARD: Every specific data point, every recent event with date, every constitutional provision cited.

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
  "score": <number 2.0-7.5, one decimal place>,
  "scaled_score": <score proportionally scaled to total marks, one decimal>,
  "verdict": "<Poor|Average|Good|Excellent>",
  "score_reasoning": "<2-3 lines. Brutally specific>",
  "dimensions": {
    "content_quality":  { "score": <0-10>, "note": "<specific feedback>" },
    "current_affairs":  { "score": <0-10>, "note": "<specific feedback>" },
    "structure":        { "score": <0-10>, "note": "<specific feedback>" },
    "analytical_depth": { "score": <0-10>, "note": "<specific feedback>" },
    "presentation":     { "score": <0-10>, "note": "<specific feedback>" }
  },
  "mistakes": ["<mistake 1>","<mistake 2>","<mistake 3>"],
  "improvements": ["<improvement 1>","<improvement 2>","<improvement 3>"],
  "missing_keywords": ["<kw1>","<kw2>","<kw3>","<kw4>","<kw5>","<kw6>"],
  "current_affairs_gaps": [
    { "date": "<Month Year>", "event": "<specific event>" },
    { "date": "<Month Year>", "event": "<specific event>" },
    { "date": "<Month Year>", "event": "<specific event>" }
  ],
  "model_answer_outline": "<250-300 word model answer like a UPSC topper>"
}`;

// ── GEMINI CALLER ──
async function callGemini(apiKey, base64Image, mimeType, question, totalMarks, subject) {
  const wordLimit = totalMarks <= 5  ? '75-100 words'
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
Be brutally specific about every missing fact, scheme, article, or data point.`;

  const body = {
    contents: [{
      parts: [
        { text: SYSTEM_PROMPT + '\n\n' + userPrompt },
        { inlineData: { mimeType: mimeType, data: base64Image } }
      ]
    }],
    generationConfig: {
      temperature: 0.25,
      maxOutputTokens: 2800
    }
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  // Read response as text first — safer than assuming JSON
  const responseText = await response.text();

  if (!response.ok) {
    // Try to get a meaningful error message
    let errMsg = `Gemini API error ${response.status}`;
    try {
      const errJson = JSON.parse(responseText);
      errMsg = errJson?.error?.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  // Parse the successful response
  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error('Gemini returned unreadable response.');
  }

  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!raw) throw new Error('Gemini returned empty response.');

  // Extract JSON from response
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const start   = cleaned.indexOf('{');
  const end     = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Could not find JSON in AI response.');

  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new Error('AI response was not valid JSON. Please try again.');
  }
}

// ── FALLBACK WATERFALL ──
async function evaluateWithFallback(base64Image, mimeType, question, totalMarks, subject) {
  const keys = [
    process.env.GEMINI_KEY_1,
    process.env.GEMINI_KEY_2,
    process.env.GEMINI_KEY_3,
  ].filter(Boolean);

  if (keys.length === 0) {
    throw new Error('Service not configured. Please contact support.');
  }

  let lastError = null;

  for (let i = 0; i < keys.length; i++) {
    try {
      const result = await callGemini(
        keys[i], base64Image, mimeType, question, totalMarks, subject
      );
      return result;
    } catch (err) {
      lastError = err;
      const msg = err.message || '';
      // Hard failures — don't try next key
      if (msg.includes('403') || msg.includes('API key not valid')) {
        throw new Error(`API key ${i + 1} is invalid. Please contact support.`);
      }
      // Soft failures — try next key
      console.error(`Key ${i + 1} failed: ${msg}`);
    }
  }

  throw new Error(lastError?.message || 'Evaluation failed. Please try again.');
}

// ── MAIN HANDLER ──
export default async function handler(req, res) {

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { base64Image, mimeType, question, totalMarks, subject } = req.body || {};

    // Validate
    if (!base64Image) return res.status(400).json({ error: 'No image data received.' });
    if (!question?.trim()) return res.status(400).json({ error: 'No question received.' });
    if (!mimeType)    return res.status(400).json({ error: 'No file type received.' });

    const marks = parseFloat(totalMarks) || 10;
    const subj  = subject || 'GS2';

    const result = await evaluateWithFallback(
      base64Image, mimeType, question, marks, subj
    );

    return res.status(200).json({ success: true, result });

  } catch (err) {
    console.error('Handler error:', err.message);
    return res.status(500).json({
      error: err.message || 'Evaluation failed. Please try again.'
    });
  }
}
