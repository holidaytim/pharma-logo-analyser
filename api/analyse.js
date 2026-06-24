import Anthropic from '@anthropic-ai/sdk';

const ANALYSIS_PROMPT = (brandName, innName, context, auditType) => `You are a pharmaceutical brand and regulatory expert with deep knowledge of FDA drug labeling guidelines, EMA standards, and pharmaceutical brand design best practices.

Analyse this pharmaceutical logo for the drug "${brandName}"${innName ? ` (INN/generic name: ${innName})` : ''}.

Analysis context: ${context === 'both' ? 'Both labelling/packaging and promotional/DTC materials' : context === 'labelling' ? 'Labelling and packaging only' : 'Promotional and DTC materials only'}
Audit type: ${auditType === 'competitor' ? 'Competitor brand audit' : 'Own brand review'}

Examine the logo carefully and return ONLY a valid JSON object — no markdown, no code blocks, no extra text. Use this exact structure:

{
  "overallScore": <integer 0-100>,
  "overallStatus": "<pass|warn|fail>",
  "summary": "<2-3 sentence overall assessment>",
  "drugName": "${brandName}",
  "innName": "${innName || 'not specified'}",
  "tests": {
    "fdaGuidance": {
      "score": <integer 0-100>,
      "status": "<pass|warn|fail>",
      "headline": "<one sentence finding>",
      "detail": "<2-4 sentences of detailed analysis>",
      "regulations": ["<specific regulation cited, e.g. 21 CFR 201.10(g)(1)>"],
      "recommendations": ["<actionable recommendation>"]
    },
    "innRatio": {
      "score": <integer 0-100>,
      "status": "<pass|warn|fail>",
      "headline": "<one sentence finding>",
      "detail": "<2-4 sentences>",
      "labellingStatus": "<pass|warn|fail|na>",
      "promotionalStatus": "<pass|warn|fail|na>",
      "brandNameRelativeSize": <integer 1-10, where 10 is the largest element>,
      "innRelativeSize": <integer 1-10>,
      "estimatedRatioPercent": <integer, INN size as % of brand name size>,
      "fdaRequirementPercent": 50,
      "recommendations": ["<actionable recommendation>"]
    },
    "regulatoryLegibility": {
      "score": <integer 0-100>,
      "status": "<pass|warn|fail>",
      "headline": "<one sentence finding>",
      "detail": "<2-4 sentences>",
      "recommendations": ["<recommendation>"]
    },
    "colorblindness": {
      "score": <integer 0-100>,
      "status": "<pass|warn|fail>",
      "headline": "<one sentence finding>",
      "detail": "<2-4 sentences>",
      "affectedTypes": ["<e.g. deuteranopia, protanopia, tritanopia>"],
      "recommendations": ["<recommendation>"]
    },
    "monochrome": {
      "score": <integer 0-100>,
      "status": "<pass|warn|fail>",
      "headline": "<one sentence finding>",
      "detail": "<2-4 sentences>",
      "faxPerformance": "<pass|warn|fail>",
      "regulatorySubmissionRisk": "<low|medium|high>",
      "recommendations": ["<recommendation>"]
    },
    "contrast": {
      "score": <integer 0-100>,
      "status": "<pass|warn|fail>",
      "headline": "<one sentence finding>",
      "detail": "<2-4 sentences>",
      "wcagLevel": "<AAA|AA|below-AA>",
      "darkBackgroundPerformance": "<pass|warn|fail>",
      "recommendations": ["<recommendation>"]
    },
    "sizeScaling": {
      "score": <integer 0-100>,
      "status": "<pass|warn|fail>",
      "headline": "<one sentence finding>",
      "detail": "<2-4 sentences>",
      "pillBottle": "<pass|warn|fail>",
      "packageInsert": "<pass|warn|fail>",
      "digitalAd": "<pass|warn|fail>",
      "minimumRecommendedSize": "<e.g. 15mm width minimum>",
      "recommendations": ["<recommendation>"]
    },
    "balance": {
      "score": <integer 0-100>,
      "status": "<pass|warn|fail>",
      "headline": "<one sentence finding>",
      "detail": "<2-4 sentences>",
      "visualWeightDistribution": "<e.g. centred, left-heavy, right-heavy>",
      "recommendations": ["<recommendation>"]
    },
    "brandPersonality": {
      "score": <integer 0-100>,
      "status": "<pass|warn|fail>",
      "headline": "<one sentence finding>",
      "detail": "<2-4 sentences>",
      "traits": ["<trait 1>", "<trait 2>", "<trait 3>", "<trait 4>"],
      "patientPerception": "<one sentence on how patients likely perceive this brand>",
      "hcpPerception": "<one sentence on how HCPs likely perceive this brand>",
      "recommendations": ["<recommendation>"]
    },
    "therapeuticAreaFit": {
      "score": <integer 0-100>,
      "status": "<pass|warn|fail>",
      "headline": "<one sentence finding>",
      "detail": "<2-4 sentences>",
      "inferredArea": "<e.g. immunology, oncology, cardiology, rare disease>",
      "colorMoodAlignment": "<positive|neutral|misaligned>",
      "recommendations": ["<recommendation>"]
    },
    "containersProportions": {
      "score": <integer 0-100>,
      "status": "<pass|warn|fail>",
      "headline": "<one sentence finding>",
      "detail": "<2-4 sentences>",
      "aspectRatioAssessment": "<e.g. well-proportioned, overly wide, overly tall>",
      "containerEffect": "<description of any enclosure, framing, or bounding elements>",
      "recommendations": ["<recommendation>"]
    }
  }
}

Scoring thresholds:
- 80–100 → pass (fully compliant / strong)
- 50–79 → warn (acceptable but improvements needed)
- 0–49 → fail (significant issues requiring remediation)

FDA INN ratio rule (21 CFR 201.10(g)(1)): The established (generic/INN) name must appear in type at least half as large as the proprietary name on prescription drug labeling. Similar prominence requirements apply to promotional materials. Score 80+ if INN is visually ≥50% of brand name size, 50–79 if borderline (30–49%), below 50 if clearly non-compliant or INN is absent.

Overall score = weighted average: regulatory tests 40%, visual tests 35%, brand tests 25%.

Be specific, clinical, and reference exact FDA regulations where applicable.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mimeType, brandName, innName, context, auditType } = req.body;

  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });
  if (!brandName) return res.status(400).json({ error: 'brandName is required' });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType || 'image/png',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: ANALYSIS_PROMPT(brandName, innName, context, auditType),
            },
          ],
        },
      ],
    });

    const raw = response.content[0].text.trim();
    // Strip markdown code fences if present
    const jsonStr = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();
    const analysis = JSON.parse(jsonStr);
    return res.status(200).json(analysis);

  } catch (err) {
    console.error('Analysis error:', err);
    if (err instanceof SyntaxError) {
      return res.status(500).json({ error: 'Failed to parse AI response. Please try again.' });
    }
    return res.status(500).json({ error: err.message || 'Analysis failed' });
  }
}
