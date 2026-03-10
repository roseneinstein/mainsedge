// ── MAINSEDGE · AI EVALUATION ENGINE ──

const Evaluator = (() => {

  // ── YOUR GEMINI API KEYS ──
  // These call Gemini directly from the browser — free tier works client-side
  const KEYS = [
    'AIzaSyDy_Y6550LlqYX0oqMotVTT57PwiqghYeE',
    'AIzaSyA4SENFtzfFuD-hPxd-rLZ_P3IGvgx3LZc',
    'AIzaSyDEvwsAB0760NHb6l6ob1JeTNGxVJHU1YY',
  ];

  const MODELS = [
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
  ];

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
   — Structured format: intro to body (multi-dimensional) to conclusion
   — Creative elements: tables, flowcharts, diagrams (described in text)
   — Multi-dimensional analysis: social / economic / political / environmental / ethical
   — International comparisons, SDG linkages, India's global commitments
4. PENALISE heavily: vague statements, filler sentences, zero data, single-dimensional analysis.
5. REWARD: Every specific data point, every recent event with date, every constitutional provision cited.

SCORING SCALE:
2.0-3.0 : Generic answer, no substance, no facts, no structure
3.0-4.0 : Minimal relevant content, very little data, poor structure
4.0-5.0 : Decent structure, some facts, lacks analytical depth
5.0-6.0 : Good content, several facts/schemes, average multi-dimensional analysis
6.0-7.0 : Strong answer with specific data, current affairs, good structure, solid analysis
7.0-7.5 : Exceptional with precise data, very recent events, multi-dimensional, creative structure

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
  "mistakes": [
    "<mistake 1>", "<mistake 2>", "<mistake 3>",
    "<mistake 4 if applicable>", "<mistake 5 if applicable>"
  ],
  "improvements": [
    "<improvement 1>", "<improvement 2>", "<improvement 3>",
    "<improvement 4 if applicable>", "<improvement 5 if applicable>"
  ],
  "missing_keywords": [
    "<kw1>","<kw2>","<kw3>","<kw4>","<kw5>","<kw6>","<kw7>","<kw8>"
  ],
  "current_affairs_gaps": [
    { "date": "<Month Year>", "event": "<specific event>" },
    { "date": "<Month Year>", "event": "<specific event>" },
    { "date": "<Month Year>", "event": "<specific event>" }
  ],
  "model_answer_outline": "<250-300 word model answer like a UPSC topper with specific data, schemes, articles, recent events, multi-dimensional analysis>"
}`;

  // ── VALIDATE ──
  function validate(question, file) {
    if (!question || !question.trim())
      return 'Please enter the question before evaluating.';
    if (question.trim().length < 10)
      return 'Question seems too short. Please paste the full UPSC question.';
    if (!file)
      return 'Please upload your answer (image or PDF).';
    if (file.size > 10 * 1024 * 1024)
      return 'File too large. Please upload a file under 10MB.';
    return null;
  }

  // ── READ FILE ──
  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve({
        base64:   e.target.result.split(',')[1],
        mimeType: file.type || 'image/jpeg'
      });
      reader.onerror = () => reject(new Error('Could not read file. Please try again.'));
      reader.readAsDataURL(file);
    });
  }

  // ── CALL GEMINI ──
  async function callGemini(apiKey, modelName, base64Image, mimeType, question, totalMarks, subject) {
    const wordLimit = totalMarks <= 5  ? '75-100 words'
                    : totalMarks <= 10 ? '150 words'
                    : totalMarks <= 15 ? '250 words'
                    : totalMarks <= 20 ? '300 words'
                    : '350+ words';

    const userPrompt = `SUBJECT: ${subject}
QUESTION: ${question}
TOTAL MARKS: ${totalMarks}
EXPECTED WORD LIMIT: ${wordLimit}

The student's handwritten or typed answer is in the attached image.
Evaluate strictly as a UPSC Mains examiner.
Cap score at 7.5/10 no matter how good.
Be brutally specific about every missing fact, scheme, article, or data point.
Cite exact current affairs from 2024-2025 that are relevant and missing.`;

    const body = {
      contents: [{
        parts: [
          { text: SYSTEM_PROMPT + '\n\n' + userPrompt },
          { inlineData: { mimeType: mimeType, data: base64Image } }
        ]
      }],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 1500,
        topP: 0.85
      }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const responseText = await response.text();

    if (!response.ok) {
      let errMsg = `API error ${response.status}`;
      try {
        const errJson = JSON.parse(responseText);
        errMsg = errJson?.error?.message || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error('Unreadable response from AI.');
    }

    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!raw) throw new Error('Empty response from AI.');

    const cleaned = raw.replace(/```json|```/g, '').trim();
    const start   = cleaned.indexOf('{');
    const end     = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('Could not parse AI response.');

    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      throw new Error('AI response was not valid JSON. Please try again.');
    }
  }

  // ── FALLBACK WATERFALL ──
  // 3 keys × 3 models = 9 attempts before giving up
  async function callWithFallback(base64Image, mimeType, question, totalMarks, subject) {
    let lastError = null;

    for (const key of KEYS) {
      if (!key || key.startsWith('PASTE_YOUR')) continue;
      for (const model of MODELS) {
        try {
          const result = await callGemini(
            key, model, base64Image, mimeType, question, totalMarks, subject
          );
          return result;
        } catch (err) {
          lastError = err;
          const msg = err.message || '';
          if (msg.includes('403') || msg.includes('API key not valid')) break;
          console.warn(`[MainsEdge] ${model} failed: ${msg}`);
        }
      }
    }

    throw new Error(lastError?.message || 'Evaluation failed. Please try again.');
  }

  // ── MAIN EVALUATE ──
  async function evaluate({ question, totalMarks, subject, file, onStep }) {
    const err = validate(question, file);
    if (err) throw new Error(err);

    onStep?.(0, 'Reading document...');
    const { base64, mimeType } = await readFileAsBase64(file);

    onStep?.(1, 'Extracting handwritten content...');
    await delay(400);

    onStep?.(2, 'Cross-referencing UPSC rubric...');
    await delay(300);

    onStep?.(3, 'Checking current affairs relevance...');
    const result = await callWithFallback(base64, mimeType, question, totalMarks, subject);

    onStep?.(4, 'Computing dimension scores...');
    await delay(200);

    onStep?.(5, 'Generating feedback...');
    await delay(200);

    return result;
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── HELPERS ──
  function scoreColor(s) {
    if (s <= 3.0) return 'var(--rust)';
    if (s <= 4.5) return '#c9922a';
    if (s <= 6.0) return 'var(--sage)';
    return '#2d6b3e';
  }

  function verdictClass(v) {
    return {
      Poor:      'verdict-poor',
      Average:   'verdict-average',
      Good:      'verdict-good',
      Excellent: 'verdict-excellent'
    }[v] || 'verdict-average';
  }

  return { evaluate, scoreColor, verdictClass };
})();
