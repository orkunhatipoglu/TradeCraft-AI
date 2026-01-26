import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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
  prompt: string
): Promise<AIAnalysisResult> {
  try {
    // Map model names to Gemini models
    const geminiModel = mapToGeminiModel(model);
    const generativeModel = genAI.getGenerativeModel({ model: geminiModel });

    const systemPrompt = 'You are a professional crypto futures trading AI. You analyze market data and provide LONG/SHORT/HOLD signals for perpetual futures contracts. Always respond with valid JSON only.';

    const fullPrompt = `${systemPrompt}\n\n${prompt}`;

    // Debug: Prompt'u konsola yazdır
    console.log('\n========== AI PROMPT ==========');
    console.log('Model:', geminiModel);
    console.log('Prompt:');
    console.log(fullPrompt);
    console.log('================================\n');

    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    });

    const response = result.response;
    const content = response.text() || '{}';

    // Debug: AI yanıtını konsola yazdır
    console.log('\n========== AI RESPONSE ==========');
    console.log('Finish Reason:', response.candidates?.[0]?.finishReason);
    console.log('Content Length:', content.length);
    console.log('Raw Response:');
    console.log(content);
    console.log('==================================\n');

    // Clean the response in case it has markdown code blocks
    let cleanedContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Try to fix truncated JSON
    let parsed;
    try {
      parsed = JSON.parse(cleanedContent);
    } catch {
      // Try to extract valid JSON object
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          // Last resort: build minimal valid object
          console.warn('Failed to parse Gemini response, using defaults');
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
    console.error('Gemini API error:', error.message);
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

function mapToGeminiModel(_model: string): string {
  // Use Gemini 2.5 Flash
  return 'gemini-2.5-flash';
}

export async function checkConnection(): Promise<boolean> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    await model.generateContent('Hello');
    return true;
  } catch {
    return false;
  }
}

export const geminiService = {
  analyzeMarket,
  checkConnection,
};
