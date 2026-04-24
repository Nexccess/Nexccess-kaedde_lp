module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { answers } = req.body || {};
  if (!Array.isArray(answers) || answers.length !== 5 || answers.some(a => !a)) {
    res.status(400).json({ error: '5つの回答が必要です' }); return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'APIキーが設定されていません' }); return; }

  const prompt = `あなたはメンズ脱毛サロン「kaede楓salon」（東京浅草）の専任カウンセラーです。
以下はお客様の5つの回答です。

Q1（気になる部位）: ${answers[0]}
Q2（経験）: ${answers[1]}
Q3（きっかけ）: ${answers[2]}
Q4（重視すること）: ${answers[3]}
Q5（初回イメージ）: ${answers[4]}

以下のJSONのみを返してください。マークダウン・コードブロック不要。
{"section1":"現状の整理（2文）","section2":"おすすめのケアプラン（2文。都度払い・freeコースに触れる）","section3":"kaede salonでできること（2文。初回700円〜・コース不要・勧誘なし）"}`;

  let aiText;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 600 }
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini API error ${response.status}`);
    }
    const data = await response.json();
    aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (e) {
    res.status(502).json({ error: `AI呼び出しエラー: ${e.message}` }); return;
  }

  try {
    const cleaned = aiText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.section1 || !parsed.section2 || !parsed.section3) throw new Error('parse error');
    res.status(200).json({ section1: parsed.section1, section2: parsed.section2, section3: parsed.section3 });
  } catch {
    res.status(422).json({ error: '診断結果の解析に失敗しました。もう一度お試しください。' });
  }
};
