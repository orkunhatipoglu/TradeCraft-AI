import fetch from 'node-fetch';

// --- Interfaces ---

export interface AIAnalysisResult {
  signal: 'LONG' | 'SHORT' | 'HOLD';
  symbol: string;
  confidence: number;
  reasoning: string;
  leverage: number;      // 1-125 range
  takeProfit: number;    // Percentage (e.g., 2.5 = 2.5%)
  stopLoss: number;      // Percentage (e.g., 1.5 = 1.5%)
}

export interface AssetAllocation {
  symbol: string;
  signal: 'LONG' | 'SHORT' | 'HOLD';
  allocationPercent: number;  // 0-100% of balance
  confidence: number;
  leverage: number;
  takeProfit: number;
  stopLoss: number;
  reasoning: string;
}

export interface PortfolioAllocationResult {
  totalAllocationPercent: number;
  reservePercent: number;
  allocations: AssetAllocation[];
  marketOutlook: string;
  riskAssessment: string;
}

// --- Weight Tracking Interface ---
export interface WeightInfo {
  whale?: number;
  sentiment?: number;
  news?: number;
}

// --- Internal Helpers ---

/**
 * Ensures the AI response is clean of markdown and parses correctly.
 */
function parseGrokResponse(content: string): any {
  const cleaned = content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return {};
      }
    }
    return {};
  }
}

/**
 * Helper: Extract weight info from prompt for logging
 */
function extractWeightContext(prompt: string): WeightInfo {
  const weights: WeightInfo = {};
  
  const whaleMatch = prompt.match(/Whale[^:]*:\s*(\w+\s+PRIORITY)\s*\((\d+)\)/i);
  if (whaleMatch) weights.whale = parseInt(whaleMatch[2]);
  
  const sentimentMatch = prompt.match(/Sentiment[^:]*:\s*(\w+\s+PRIORITY)\s*\((\d+)\)/i);
  if (sentimentMatch) weights.sentiment = parseInt(sentimentMatch[2]);
  
  const newsMatch = prompt.match(/News[^:]*:\s*(\w+\s+PRIORITY)\s*\((\d+)\)/i);
  if (newsMatch) weights.news = parseInt(newsMatch[2]);
  
  return weights;
}

// --- Service Logic ---

/**
 * Professional Crypto Trading AI analysis for a single asset.
 * Now includes weight-aware prompting context.
 */
// Portfolio allocation for a single asset
export interface AssetAllocation {
  symbol: string;
  signal: 'LONG' | 'SHORT' | 'HOLD';
  allocationPercent: number;  // Bakiyenin yüzde kaçı (0-100)
  confidence: number;
  leverage: number;
  takeProfit: number;
  stopLoss: number;
  reasoning: string;
}

// Full portfolio allocation result
export interface PortfolioAllocationResult {
  totalAllocationPercent: number;  // Toplam kullanılan bakiye yüzdesi
  reservePercent: number;          // Yedekte tutulan yüzde
  allocations: AssetAllocation[];
  marketOutlook: string;           // Genel piyasa görünümü
  riskAssessment: string;          // Risk değerlendirmesi
}

export async function analyzeMarket(
  model: string = 'grok-4',
  prompt: string
): Promise<AIAnalysisResult> {
  try {
    const apiKey = process.env.XAI_API_KEY || '';
    if (!apiKey) throw new Error('XAI_API_KEY is not set');

    const systemPrompt = `You are a professional crypto futures trading AI. Analyze market data and provide LONG/SHORT/HOLD signals for perpetual futures contracts. 
Always respect the DATA SOURCE WEIGHTING hierarchy provided in the analysis—high-priority sources should override low-priority ones when in conflict.
Always respond with valid JSON only, following the exact format specified.`;

    // Extract weight info from prompt for logging
    const weights = extractWeightContext(prompt);

    console.log(`\n========== AI MARKET ANALYSIS [${model}] ==========`);
    console.log('Data Source Weights:', weights);
    console.log('User Prompt:', prompt.substring(0, 200) + '...');

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
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
      const error = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${error}`);
    }

    const result = await response.json() as any;
    const content = result.choices[0]?.message?.content || '{}';
    const parsed = parseGrokResponse(content);

    const analysis: AIAnalysisResult = {
      signal: parsed.signal || 'HOLD',
      symbol: parsed.symbol || 'BTCUSDT',
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
      reasoning: parsed.reasoning || 'No analysis provided',
      leverage: Math.min(125, Math.max(1, parsed.leverage || 1)),
      takeProfit: Math.min(50, Math.max(0.5, parsed.takeProfit || 2)),
      stopLoss: Math.min(25, Math.max(0.5, parsed.stopLoss || 1)),
    };

    console.log(`✅ Analysis Result: ${analysis.signal} ${analysis.symbol} (${(analysis.confidence * 100).toFixed(0)}% confidence)`);

    return analysis;
  } catch (error: any) {
    console.error('❌ Grok Market Analysis error:', error.message);
    return {
      signal: 'HOLD',
      symbol: 'BTCUSDT',
      confidence: 0,
      reasoning: `AI analysis failed: ${error.message}`,
      leverage: 1,
      takeProfit: 2,
      stopLoss: 1,
    };
  }
}

/**
 * Elite Portfolio Manager AI. Allocates capital across multiple assets.
 * Now includes weight-aware decision making.
 */
export async function analyzePortfolioAllocation(
  model: string = 'grok-4',
  prompt: string
): Promise<PortfolioAllocationResult> {
  try {
    const apiKey = process.env.XAI_API_KEY || '';
    if (!apiKey) throw new Error('XAI_API_KEY is not set');

    const systemPrompt = `You are an elite crypto portfolio manager AI. Dynamically allocate capital across assets based on market conditions and DATA SOURCE WEIGHTS.
Key rules:
- Respect the weight hierarchy: HIGH PRIORITY sources override LOW PRIORITY sources in conflicts
- Allocate more capital to assets supported by HIGH PRIORITY sources
- Reduce allocation if contradicted by HIGH PRIORITY sources
- Be strategic—focus capital on the highest confidence, highest-weight opportunities
- Always respond with valid JSON only, following the exact format specified.`;

    // Extract weight info from prompt for logging
    const weights = extractWeightContext(prompt);

    console.log(`\n========== PORTFOLIO ALLOCATION [${model}] ==========`);
    console.log('Data Source Weights:', weights);
    console.log('User Prompt:', prompt.substring(0, 200) + '...');

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
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
      const error = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${error}`);
    }

    const result = await response.json() as any;
    const content = result.choices[0]?.message?.content || '{}';
    const parsed = parseGrokResponse(content);

    const allocations: AssetAllocation[] = (parsed.allocations || []).map((a: any) => ({
      symbol: a.symbol || 'BTCUSDT',
      signal: a.signal || 'HOLD',
      allocationPercent: Math.min(100, Math.max(0, a.allocationPercent || 0)),
      confidence: Math.min(1, Math.max(0, a.confidence || 0.5)),
      leverage: Math.min(125, Math.max(1, a.leverage || 1)),
      takeProfit: Math.min(50, Math.max(0.5, a.takeProfit || 2)),
      stopLoss: Math.min(25, Math.max(0.5, a.stopLoss || 1)),
      reasoning: a.reasoning || 'No reasoning provided',
    }));

    const totalAllocation = allocations.reduce((sum, a) => sum + a.allocationPercent, 0);
    const result_obj: PortfolioAllocationResult = {
      totalAllocationPercent: Math.min(100, totalAllocation),
      reservePercent: Math.max(0, 100 - totalAllocation),
      allocations,
      marketOutlook: parsed.marketOutlook || 'Neutral',
      riskAssessment: parsed.riskAssessment || 'Moderate risk environment',
    };

    console.log(`✅ Allocation Result: ${result_obj.totalAllocationPercent}% deployed, ${result_obj.reservePercent}% reserve`);
    console.log(`   Allocations: ${allocations.map(a => `${a.symbol} ${a.signal} ${a.allocationPercent}%`).join(', ')}`);

    return result_obj;
  } catch (error: any) {
    console.error('❌ Portfolio allocation analysis error:', error.message);
    return {
      totalAllocationPercent: 0,
      reservePercent: 100,
      allocations: [],
      marketOutlook: `Analysis failed: ${error.message}`,
      riskAssessment: 'Unable to assess risk',
    };
  }
}

/**
 * Simple connection check to verify API key and Grok availability.
 */
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
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

// Analyze portfolio allocation - AI decides how much to allocate to each asset
export async function analyzePortfolioAllocation(
  model: string,
  prompt: string
): Promise<PortfolioAllocationResult> {
  try {
    const apiKey = process.env.XAI_API_KEY || '';
    if (!apiKey) {
      throw new Error('XAI_API_KEY is not set');
    }

    const grokModel = mapToGrokModel(model);

    const systemPrompt = `You are an elite crypto portfolio manager AI. Your job is to dynamically allocate capital across multiple assets based on market conditions. You analyze market data and decide:
1. Which assets to trade (LONG/SHORT/HOLD)
2. What percentage of the portfolio to allocate to each asset
3. Optimal leverage, take-profit, and stop-loss for each position

You must be strategic - don't blindly allocate to all assets. Focus capital on the best opportunities.
Always respond with valid JSON only.`;

    console.log('\n========== PORTFOLIO ALLOCATION PROMPT ==========');
    console.log('Model:', grokModel);
    console.log('System Prompt:');
    console.log(systemPrompt);
    console.log('\nUser Prompt:');
    console.log(prompt);
    console.log('==================================================\n');

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

    console.log('\n========== PORTFOLIO ALLOCATION RESPONSE ==========');
    console.log('Finish Reason:', result.choices?.[0]?.finish_reason);
    console.log('Content Length:', content.length);
    console.log('Raw Response:');
    console.log(content);
    console.log('====================================================\n');

    // Clean and parse response
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
          console.warn('Failed to parse portfolio allocation response, using defaults');
          parsed = {};
        }
      } else {
        parsed = {};
      }
    }

    // Validate and normalize allocations
    const allocations: AssetAllocation[] = (parsed.allocations || []).map((a: any) => ({
      symbol: a.symbol || 'BTCUSDT',
      signal: a.signal || 'HOLD',
      allocationPercent: Math.min(100, Math.max(0, a.allocationPercent || 0)),
      confidence: Math.min(1, Math.max(0, a.confidence || 0.5)),
      leverage: Math.min(125, Math.max(1, a.leverage || 1)),
      takeProfit: Math.min(50, Math.max(0.5, a.takeProfit || 2)),
      stopLoss: Math.min(25, Math.max(0.5, a.stopLoss || 1)),
      reasoning: a.reasoning || 'No reasoning provided',
    }));

    // Calculate total allocation
    const totalAllocation = allocations.reduce((sum, a) => sum + a.allocationPercent, 0);

    return {
      totalAllocationPercent: Math.min(100, totalAllocation),
      reservePercent: Math.max(0, 100 - totalAllocation),
      allocations,
      marketOutlook: parsed.marketOutlook || 'Neutral',
      riskAssessment: parsed.riskAssessment || 'Moderate risk environment',
    };
  } catch (error: any) {
    console.error('Portfolio allocation analysis error:', error.message);
    return {
      totalAllocationPercent: 0,
      reservePercent: 100,
      allocations: [],
      marketOutlook: `Analysis failed: ${error.message}`,
      riskAssessment: 'Unable to assess risk',
    };
  }
}

export const grokService = {
  analyzeMarket,
  analyzePortfolioAllocation,
  checkConnection,
};