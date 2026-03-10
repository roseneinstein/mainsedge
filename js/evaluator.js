// ── MAINSEDGE · AI EVALUATION ENGINE ──

const Evaluator = (() => {

  // ── SYSTEM PROMPT ──
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
4. PENALISE heavily: vague statements, "it is important to note", "therefore we can say", filler sentences, zero data, single-dimensional analysis.
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
— GS4 (Ethics): Expect thinkers' names, case study analysis, value frameworks, real examples
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
    "<Specific improvement with a contextual hint — e.g. 'Cite Article 21 and Maneka Gandhi case for right to life dimension'>",
    "<Improvement 2 — include exact scheme/data/article to add>",
    "<Improvement 3>",
    "<Improvement 4 — only if applicable>",
    "<Improvement 5 — only if applicable>"
  ],
  "missing_keywords": [
    "<keyword/jargon 1>", "<keyword 2>", "<keyword 3>",
    "<keyword 4>", "<keyword 5>", "<keyword 6>",
    "<keyword 7>", "<keyword 8>"
  ],
  "current_affairs_gaps": [
    { "date": "<Month Year>", "event": "<Specific recent event/report/data that should have been cited>" },
    { "date": "<Month Year>", "event": "<Event 2>" },
    { "date": "<Month Year>", "event": "<Event 3>" }
  ],
  "model_answer_outline": "<A complete 250–300 word model answer written exactly like a UPSC topper. Must include: specific data points, constitutional provisions, government schemes with years, recent current affairs, multi-dimensional analysis, and a structured intro-body-conclusion. Make the student viscerally feel the gap between their answer and the ideal.>"
}`;

  // ── BUILD USER PROMPT ──
  function buildPrompt(question, totalMarks, subject) {
    const wordLimit = totalMarks <= 5  ? '75–100 words'
                    : totalMarks <= 10 ? '150 words'
                    : totalMarks <= 15 ? '250 words'
                    : totalMarks <= 20 ? '300 words'
                    : '350+ words';
    return `SUBJECT: ${subject}
QUESTION: ${question}
TOTAL MARKS: ${totalMarks}
EXPECTED WORD LIMIT: ${wordLimit}

The student's handwritten/typed answer is in the attached document image.

Evaluate this answer strictly as a UPSC Mains examiner.
— Cap score at 7.5/10 no matter how good the answer is
— Be brutally specific about every missing fact, scheme, article, or data point
— Cite exact current affairs from 2024–2025 that are relevant and missing
— The student must feel the precise gap between their answer and the ideal
— Do not encourage. Be clinical, specific, and constructive.`;
  }

  // ── CALL GEMINI API ──
  async function callGemini(apiKey, question, totalMarks, subject, fileBase64, fileMimeType) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{
        parts: [
          { text: SYSTEM_PROMPT + '\n\n' + buildPrompt(question, totalMarks, subject) },
          { inlineData: { mimeType: fileMimeType, data: fileBase64 } }
        ]
      }],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 2800,
        topP: 0.85
      }
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message || `API error ${res.status}`;
      // Friendly messages for common errors
      if (res.status === 400) throw new Error('Invalid API key or request. Please check your Gemini API key.');
      if (res.status === 429) throw new Error('Rate limit hit. Please wait a minute and try again.');
      if (res.status === 403) throw new Error('API key does not have permission. Enable Gemini API at aistudio.google.com.');
      throw new Error(msg);
    }

    const data = await res.json();
    const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON safely
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const start   = cleaned.indexOf('{');
    const end     = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('Could not parse AI response. Please try again.');

    return JSON.parse(cleaned.slice(start, end + 1));
  }

  // ── READ FILE AS BASE64 ──
  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve({
        base64:    e.target.result.split(',')[1],
        mimeType:  file.type || 'image/jpeg'
      });
      reader.onerror = () => reject(new Error('Could not read file. Please try again.'));
      reader.readAsDataURL(file);
    });
  }

  // ── VALIDATE INPUTS ──
  function validate(question, file, apiKey) {
    if (!question || !question.trim())
      return 'Please enter the question before evaluating.';
    if (question.trim().length < 10)
      return 'Question seems too short. Please paste the full UPSC question.';
    if (!file)
      return 'Please upload your answer (image or PDF).';
    if (!apiKey)
      return 'Please enter and save your Gemini API key first.';
    if (file.size > 10 * 1024 * 1024)
      return 'File too large. Please upload a file under 10MB.';
    return null; // no error
  }

  // ── MAIN EVALUATE FUNCTION ──
  async function evaluate({ question, totalMarks, subject, file, apiKey, onStep }) {
    // Validate
    const err = validate(question, file, apiKey);
    if (err) throw new Error(err);

    onStep?.(0, 'Reading document…');
    const { base64, mimeType } = await readFileAsBase64(file);

    onStep?.(1, 'Extracting handwritten content…');
    await delay(400);

    onStep?.(2, 'Cross-referencing UPSC rubric…');
    await delay(300);

    onStep?.(3, 'Checking current affairs relevance…');
    const result = await callGemini(apiKey, question, totalMarks, subject, base64, mimeType);

    onStep?.(4, 'Computing dimension scores…');
    await delay(200);

    onStep?.(5, 'Generating feedback…');
    await delay(200);

    return result;
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── SCORE COLOR HELPER ──
  function scoreColor(s) {
    if (s <= 3.0) return 'var(--rust)';
    if (s <= 4.5) return '#c9922a';
    if (s <= 6.0) return 'var(--sage)';
    return '#2d6b3e';
  }

  // ── VERDICT CLASS HELPER ──
  function verdictClass(v) {
    return {
      Poor:      'verdict-poor',
      Average:   'verdict-average',
      Good:      'verdict-good',
      Excellent: 'verdict-excellent'
    }[v] || 'verdict-average';
  }

  return { evaluate, scoreColor, verdictClass, readFileAsBase64 };
})();
