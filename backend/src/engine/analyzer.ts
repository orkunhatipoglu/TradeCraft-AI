import { geminiService, AIAnalysisResult } from '../services/gemini';
import { PriceData, bitmexService } from '../services/bitmex';
import { WhaleActivitySummary } from '../services/whale';
import { SentimentData } from '../services/sentiment';
import { NewsData } from '../services/news';

export interface MarketData {
  prices: Record<string, PriceData>;
  whale?: WhaleActivitySummary;
  sentiment?: SentimentData;
  news?: NewsData;
}

// Format volume with appropriate suffix (K, M, B)
function formatVolume(volume: number): string {
  if (volume >= 1e9) {
    return `$${(volume / 1e9).toFixed(2)}B`;
  } else if (volume >= 1e6) {
    return `$${(volume / 1e6).toFixed(2)}M`;
  } else if (volume >= 1e3) {
    return `$${(volume / 1e3).toFixed(2)}K`;
  } else {
    return `$${volume.toFixed(2)}`;
  }
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

  let prompt = `You are a professional crypto FUTURES trading AI. Analyze the following market data and provide a futures trading signal (LONG/SHORT/HOLD).

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
- 24h Change: ${price.change24h >= 0 ? '+' : ''}${price.change24h.toFixed(2)}%`;
      // Only show volume on mainnet (testnet volume is unreliable)
      if (!bitmexService.isTestnet) {
        prompt += `
- 24h Volume: ${formatVolume(price.volume24h)}`;
      }
      prompt += '\n';
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
1. For CONSERVATIVE strategy: Only signal LONG/SHORT with confidence > 0.8 and strong evidence
2. For BALANCED strategy: Signal LONG/SHORT with confidence > 0.6 and moderate evidence
3. For AGGRESSIVE strategy: Can signal LONG/SHORT with confidence > 0.5
4. ALWAYS provide leverage, takeProfit, and stopLoss based on market volatility and strategy guidelines
5. Higher volatility = lower leverage, tighter stopLoss
6. Strong trend = higher leverage, wider takeProfit

This is FUTURES TRADING:
- LONG = Open a long position (profit when price goes UP)
- SHORT = Open a short position (profit when price goes DOWN)
- HOLD = Do not open any position

RISK MANAGEMENT:
- takeProfit: Target profit percentage (e.g., 2.5 means close position when +2.5% profit)
- stopLoss: Maximum loss percentage (e.g., 1.0 means close position when -1.0% loss)
- Risk/Reward ratio should typically be at least 1.5:1 (takeProfit >= stopLoss * 1.5)

Respond with ONLY valid JSON in this exact format:
{
  "signal": "LONG" | "SHORT" | "HOLD",
  "symbol": "BTCUSDT",
  "confidence": 0.75,
  "reasoning": "Brief explanation (max 100 words)",
  "leverage": 10,
  "takeProfit": 2.5,
  "stopLoss": 1.0
}
`;

  return prompt;
}

function getStrategyGuidelines(strategy: string): string {
  switch (strategy) {
    case 'conservative':
      return `- Only open LONG/SHORT positions on very strong signals
- Prefer HOLD unless highly confident
- Focus on risk management
- Require multiple confirming indicators
- LEVERAGE: Use 1x to 5x only (low risk)
- TAKE PROFIT: 1% to 3% (small but safe gains)
- STOP LOSS: 0.5% to 1% (tight risk control)`;

    case 'balanced':
      return `- Open LONG/SHORT positions on moderately strong signals
- Balance risk and opportunity
- Consider both short and medium-term trends
- LEVERAGE: Use 3x to 20x (moderate risk)
- TAKE PROFIT: 2% to 5% (moderate gains)
- STOP LOSS: 1% to 2% (balanced risk)`;

    case 'aggressive':
      return `- Open LONG/SHORT positions on emerging opportunities
- Accept higher risk for higher potential returns
- Act quickly on market movements
- LEVERAGE: Use 5x to 50x (high risk)
- TAKE PROFIT: 3% to 10% (high reward targets)
- STOP LOSS: 1.5% to 3% (wider stops for volatility)`;

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
  console.log(`⚡ Leverage: ${result.leverage}x | TP: +${result.takeProfit}% | SL: -${result.stopLoss}%`);

  return result;
}

export const analyzer = {
  analyze,
  buildPrompt,
};
