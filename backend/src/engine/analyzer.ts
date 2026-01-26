import { geminiService, AIAnalysisResult } from '../services/gemini';
import { PriceData } from '../services/bitmex';
import { WhaleActivitySummary } from '../services/whale';
import { SentimentData } from '../services/sentiment';
import { NewsData } from '../services/news';

export interface MarketData {
  prices: Record<string, PriceData>;
  whale?: WhaleActivitySummary;
  sentiment?: SentimentData;
  news?: NewsData;
}

export interface AnalyzerInput {
  marketData: MarketData;
  model: string;
  strategy: 'conservative' | 'balanced' | 'aggressive';
  equities: string[];
}

// Build the AI prompt from market data
function buildPrompt(input: AnalyzerInput): string {
  const { marketData, strategy, equities } = input;

  let prompt = `You are a professional crypto trading AI. Analyze the following market data and provide a trading signal.

## Trading Pairs Being Monitored
${equities.join(', ')}

## Current Market Prices
`;

  // Add price data for each equity
  for (const symbol of equities) {
    const price = marketData.prices[symbol];
    if (price) {
      prompt += `
### ${symbol}
- Current Price: $${price.price.toLocaleString()}
- 24h Change: ${price.change24h >= 0 ? '+' : ''}${price.change24h.toFixed(2)}%
- 24h Volume: $${(price.volume24h / 1e9).toFixed(2)}B
`;
    }
  }

  // Add whale activity if available
  if (marketData.whale) {
    prompt += `
## Whale Activity (Last Hour)
- Total Transactions: ${marketData.whale.totalTransactions}
- Total Volume: $${(marketData.whale.totalVolumeUsd / 1e6).toFixed(2)}M
- Net Flow: ${marketData.whale.netFlow} (${marketData.whale.sentiment} signal)
`;
    if (marketData.whale.largestTransaction) {
      const tx = marketData.whale.largestTransaction;
      prompt += `- Largest Transaction: $${(tx.amountUsd / 1e6).toFixed(2)}M ${tx.symbol} (${tx.transactionType})
`;
    }
  }

  // Add sentiment data if available
  if (marketData.sentiment) {
    prompt += `
## Market Sentiment
- Overall Score: ${marketData.sentiment.score}/100
- Trend: ${marketData.sentiment.trend}
- Summary: ${marketData.sentiment.summary}
`;
  }

  // Add news if available
  if (marketData.news && marketData.news.articles.length > 0) {
    prompt += `
## Recent News Headlines
${marketData.news.articles
  .slice(0, 5)
  .map((a) => `- ${a.title}`)
  .join('\n')}
${marketData.news.hasBreaking ? '\n⚠️ Breaking news detected!' : ''}
`;
  }

  // Add strategy context
  prompt += `
## Trading Strategy
Risk Level: ${strategy.toUpperCase()}
${getStrategyGuidelines(strategy)}

## Instructions
Based on the above market data and your analysis, provide a trading recommendation.

IMPORTANT RULES:
1. For CONSERVATIVE strategy: Only signal BUY/SELL with confidence > 0.8 and strong evidence
2. For BALANCED strategy: Signal BUY/SELL with confidence > 0.6 and moderate evidence
3. For AGGRESSIVE strategy: Can signal BUY/SELL with confidence > 0.5
4. ALWAYS provide leverage and holdDuration based on market volatility and strategy guidelines
5. Higher volatility = lower leverage and shorter hold duration
6. Strong trend = higher leverage and longer hold duration

Respond with ONLY valid JSON in this exact format:
{
  "signal": "BUY" | "SELL" | "HOLD",
  "symbol": "BTCUSDT",
  "confidence": 0.75,
  "reasoning": "Brief explanation (max 100 words)",
  "leverage": 10,
  "holdDuration": 60
}
`;

  return prompt;
}

function getStrategyGuidelines(strategy: string): string {
  switch (strategy) {
    case 'conservative':
      return `- Only trade on very strong signals
- Prefer HOLD unless highly confident
- Focus on risk management
- Require multiple confirming indicators
- LEVERAGE: Use 1x to 5x only (low risk)
- HOLD DURATION: 120 to 1440 minutes (2-24 hours)`;

    case 'balanced':
      return `- Trade on moderately strong signals
- Balance risk and opportunity
- Consider both short and medium-term trends
- LEVERAGE: Use 3x to 20x (moderate risk)
- HOLD DURATION: 30 to 480 minutes (30 min - 8 hours)`;

    case 'aggressive':
      return `- Trade on emerging opportunities
- Accept higher risk for higher potential returns
- Act quickly on market movements
- LEVERAGE: Use 5x to 50x (high risk)
- HOLD DURATION: 5 to 240 minutes (5 min - 4 hours)`;

    default:
      return '';
  }
}

// Analyze market and get trading signal
export async function analyze(input: AnalyzerInput): Promise<AIAnalysisResult> {
  const prompt = buildPrompt(input);

  console.log('🤖 Sending analysis request to Gemini AI...');
  console.log(`📊 Analyzing ${input.equities.length} equities with ${input.strategy} strategy`);

  const result = await geminiService.analyzeMarket(input.model, prompt);

  console.log(`📈 AI Signal: ${result.signal} ${result.symbol} (${(result.confidence * 100).toFixed(0)}% confidence)`);
  console.log(`⚡ Leverage: ${result.leverage}x | Hold Duration: ${result.holdDuration} minutes`);

  return result;
}

export const analyzer = {
  analyze,
  buildPrompt,
};
