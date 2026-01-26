import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface AIAnalysisResult {
  signal: 'BUY' | 'SELL' | 'HOLD';
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

    const systemPrompt = 'You are a professional crypto trading AI. You analyze market data and provide trading signals. Always respond with valid JSON only.';

    const fullPrompt = `${systemPrompt}\n\n${prompt}`;

    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 500,
        responseMimeType: 'application/json',
      },
    });

    const response = result.response;
    const content = response.text() || '{}';

    // Clean the response in case it has markdown code blocks
    const cleanedContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleanedContent);

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
  // Always use Gemini 2.5 Flash regardless of selected model
  return 'gemini-2.5-flash-preview-05-20';
}

export async function checkConnection(): Promise<boolean> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' });
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
