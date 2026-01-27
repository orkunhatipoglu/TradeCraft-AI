import fetch from 'node-fetch';

export interface AIAnalysisResult {
  signal: 'LONG' | 'SHORT' | 'HOLD';
  symbol: string;
  confidence: number;
  reasoning: string;
  leverage: number;      // 1-125 arası kaldıraç
  holdDuration: number;  // Dakika cinsinden tutma süresi
}

export async function analyzeMarket(
  model: string,
  prompt: string  // ← This should now contain ONLY market data
): Promise<AIAnalysisResult> {
  try {
    const apiKey = process.env.XAI_API_KEY || '';
    if (!apiKey) {
      throw new Error('XAI_API_KEY is not set');
    }

    const grokModel = mapToGrokModel(model);

    const systemPrompt = `You are a professional crypto futures trading AI. You analyze market data and provide LONG/SHORT/HOLD signals for perpetual futures contracts. 
Always respond with valid JSON only. Do not include any explanations, markdown, or extra text outside the JSON object.`;

    // Debug: Print separately
    console.log('\n========== AI PROMPT ==========');
    console.log('Model:', grokModel);
    console.log('System Prompt:');
    console.log(systemPrompt);
    console.log('\nUser Prompt (Market Data):');
    console.log(prompt);
    console.log('================================\n');

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: grokModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 8192,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json() as {
      choices: Array<{
        message?: { content?: string };
        finish_reason?: string;
      }>;
    };

    const content = result.choices[0]?.message?.content || '{}';

    console.log('\n========== AI RESPONSE ==========');
    console.log('Finish Reason:', result.choices?.[0]?.finish_reason);
    console.log('Content Length:', content.length);
    console.log('Raw Response:');
    console.log(content);
    console.log('==================================\n');

    // Clean & parse (your existing robust logic)
    let cleanedContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanedContent);
    } catch {
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          console.warn('Failed to parse Grok response, using defaults');
          parsed = {};
        }
      } else {
        parsed = {};
      }
    }

    return {
      signal: parsed.signal || 'HOLD',
      symbol: parsed.symbol || 'BTCUSDT',
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
      reasoning: parsed.reasoning || 'No analysis provided',
      leverage: Math.min(125, Math.max(1, parsed.leverage || 1)),
      holdDuration: Math.min(1440, Math.max(5, parsed.holdDuration || 60)),
    };
  } catch (error: any) {
    console.error('Grok API error:', error.message);
    return {
      signal: 'HOLD',
      symbol: 'BTCUSDT',
      confidence: 0,
      reasoning: `AI analysis failed: ${error.message}`,
      leverage: 1,
      holdDuration: 60,
    };
  }
}

function mapToGrokModel(_model: string): string {
  return 'grok-4';
}

// checkConnection remains unchanged (simple test)
export async function checkConnection(): Promise<boolean> {
  try {
    const apiKey = process.env.XAI_API_KEY || '';
    if (!apiKey) return false;

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-4',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

export const grokService = {
  analyzeMarket,
  checkConnection,
};