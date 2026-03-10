// ── MAINSEDGE · AI EVALUATION ENGINE ──

const Evaluator = (() => {

  // ── VALIDATE INPUTS ──
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

  // ── READ FILE AS BASE64 ──
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

  // ── CALL BACKEND (keys hidden server-side) ──
  async function callBackend(question, totalMarks, subject, fileBase64, fileMimeType) {
    const response = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64Image: fileBase64,
        mimeType:    fileMimeType,
        question,
        totalMarks,
        subject
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      const msg = data?.error || `Server error ${response.status}`;
      if (response.status === 429) throw new Error('Too many requests. Please try again in a moment.');
      throw new Error(msg);
    }

    return data.result;
  }

  // ── MAIN EVALUATE FUNCTION ──
  async function evaluate({ question, totalMarks, subject, file, onStep }) {

    // Validate
    const err = validate(question, file);
    if (err) throw new Error(err);

    onStep?.(0, 'Reading document…');
    const { base64, mimeType } = await readFileAsBase64(file);

    onStep?.(1, 'Extracting handwritten content…');
    await delay(400);

    onStep?.(2, 'Cross-referencing UPSC rubric…');
    await delay(300);

    onStep?.(3, 'Checking current affairs relevance…');
    const result = await callBackend(question, totalMarks, subject, base64, mimeType);

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
