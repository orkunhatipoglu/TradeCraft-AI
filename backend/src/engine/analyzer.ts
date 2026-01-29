import { grokService, type AIAnalysisResult, type PortfolioAllocationResult } from '../services/xai';
import { PriceData, bitmexService } from '../services/bitmex';
import { WhaleActivitySummary } from '../services/whale';
import { SentimentData } from '../services/sentiment';
import { NewsData } from '../services/news';

interface ExtendedAIAnalysisResult extends AIAnalysisResult {
  takeProfit: number;
  stopLoss: number;
}

export interface PortfolioAnalyzerInput {
  marketData: MarketData;
  model: string;
  strategy: 'conservative' | 'balanced' | 'aggressive';
  equities: string[];
  availableBalanceUSDT: number;
  totalBalanceUSDT: number;
}

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

function formatWeightPriority(weight: number): string {
  if (weight <= 35) return 'LOW PRIORITY';
  if (weight <= 65) return 'MEDIUM PRIORITY';
  return 'HIGH PRIORITY';
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

  let firstSentence = '';
  switch (strategy) {
    case 'conservative':
      firstSentence = 'You are a top level crypto trader focused on multiplying the account while safeguarding capital.';
      break;
    case 'balanced':
      firstSentence = 'You are a professional crypto FUTURES trading AI.';
      break;
    case 'aggressive':
      firstSentence = 'You are a high-stakes, aggressive crypto futures specialist. Your sole mission is maximum capital growth through high-conviction, high-leverage plays. You don\'t wait for \'perfect\' setups; you exploit momentum, hunt liquidations, and capitalize on extreme volatility.';
      break;
  }

  let prompt = `${firstSentence} Analyze the following market data and provide a futures trading signal (LONG/SHORT/HOLD).

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

  // Add whale activity if available - WITH WEIGHT CONTEXT
  if (marketData.whale) {
    prompt += `
## WHALE ACTIVITY (Last Hour) - [${formatWeightPriority(marketData.whale.weight)}]
⚠️ WEIGHT: This data source has been set to ${formatWeightPriority(marketData.whale.weight).toLowerCase()} priority in your strategy
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

  // Add sentiment data if available - WITH WEIGHT CONTEXT
  if (marketData.sentiment) {
    prompt += `
## MARKET SENTIMENT - [${formatWeightPriority(marketData.sentiment.weight)}]
⚠️ WEIGHT: This data source has been set to ${formatWeightPriority(marketData.sentiment.weight).toLowerCase()} priority in your strategy
- Overall Score: ${marketData.sentiment.score}/100
- Trend: ${marketData.sentiment.trend}
- Summary: ${marketData.sentiment.summary}
`;
  }

  // Add news if available - WITH WEIGHT CONTEXT
  if (marketData.news && marketData.news.articles.length > 0) {
    prompt += `
## RECENT NEWS HEADLINES - [${formatWeightPriority(marketData.news.weight)}]
⚠️ WEIGHT: This data source has been set to ${formatWeightPriority(marketData.news.weight).toLowerCase()} priority in your strategy
${marketData.news.articles
  .slice(0, 5)
  .map((a) => `- ${a.title}`)
  .join('\n')}
${marketData.news.hasBreaking ? '\n⚠️ Breaking news detected!' : ''}
`;
  }

  // Add weight guidance for AI
  prompt += `
## DATA SOURCE WEIGHTING GUIDANCE
The user has configured the following data source priorities for this analysis:
${marketData.whale ? `- Whale Activity: ${formatWeightPriority(marketData.whale.weight)} (weight value: ${marketData.whale.weight})` : ''}
${marketData.sentiment ? `- Market Sentiment: ${formatWeightPriority(marketData.sentiment.weight)} (weight value: ${marketData.sentiment.weight})` : ''}
${marketData.news ? `- News Data: ${formatWeightPriority(marketData.news.weight)} (weight value: ${marketData.news.weight})` : ''}

⚠️ CRITICAL WEIGHT RULES:
1. Give MORE credibility and weight to HIGH PRIORITY sources when making decisions
2. If a LOW PRIORITY source contradicts a HIGH PRIORITY source, TRUST the HIGH PRIORITY source
3. IGNORE or DOWNWEIGHT contradictory signals from LOW PRIORITY sources when HIGH PRIORITY sources are clear
4. For MEDIUM PRIORITY sources, balance them with other signals
5. The weight values reflect the user's confidence in each data source - respect this hierarchy

## Trading Strategy
Risk Level: ${strategy.toUpperCase()}
${getStrategyGuidelines(strategy)}

## Instructions
Based on the above market data, weight priorities, and your analysis, provide a trading recommendation.

IMPORTANT RULES:
1. For CONSERVATIVE strategy: Only signal LONG/SHORT with confidence > 0.8 and strong evidence
2. For BALANCED strategy: Signal LONG/SHORT with confidence > 0.6 and moderate evidence
3. For AGGRESSIVE strategy: Can signal LONG/SHORT with confidence > 0.5
4. ALWAYS provide leverage, takeProfit, and stopLoss based on market volatility and strategy guidelines
5. Higher volatility = lower leverage, tighter stopLoss
6. Strong trend = higher leverage, wider takeProfit
7. RESPECT THE DATA SOURCE WEIGHTS - adjust your confidence based on how many high-priority sources support your signal

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
export async function analyze(input: AnalyzerInput): Promise<ExtendedAIAnalysisResult> {
  const prompt = buildPrompt(input);

  console.log('🤖 Sending analysis request to Gemini AI...');
  console.log(`📊 Analyzing ${input.equities.length} equities with ${input.strategy} strategy`);

  const result = await grokService.analyzeMarket(input.model, prompt) as ExtendedAIAnalysisResult;

  console.log(`📈 AI Signal: ${result.signal} ${result.symbol} (${(result.confidence * 100).toFixed(0)}% confidence)`);
  console.log(`⚡ Leverage: ${result.leverage}x | TP: +${result.takeProfit}% | SL: -${result.stopLoss}%`);

  return result;
}

// Build portfolio allocation prompt
function buildPortfolioAllocationPrompt(input: PortfolioAnalyzerInput): string {
  const { marketData, strategy, equities, availableBalanceUSDT, totalBalanceUSDT } = input;

  let strategyContext = '';
  let maxTotalAllocation = 100;
  let minReserve = 0;

  switch (strategy) {
    case 'conservative':
      strategyContext = `You are extremely cautious. Capital preservation is your top priority.
- Only allocate to assets with very high conviction (80%+ confidence)
- Keep at least 50% in reserve
- Use low leverage (1-5x)
- Prefer fewer, higher-quality positions over diversification
- If market conditions are uncertain, allocate 0% and keep everything in reserve`;
      maxTotalAllocation = 50;
      minReserve = 50;
      break;
    case 'balanced':
      strategyContext = `You balance risk and opportunity.
- Allocate to assets with moderate to high conviction (60%+ confidence)
- Keep at least 20% in reserve for opportunities
- Use moderate leverage (3-20x)
- Diversify across 2-3 assets maximum
- Reduce allocation in uncertain markets`;
      maxTotalAllocation = 80;
      minReserve = 20;
      break;
    case 'aggressive':
      strategyContext = `You are an aggressive trader seeking maximum returns.
- Allocate to any opportunity with decent conviction (50%+ confidence)
- Can use up to 90% of available balance
- Use high leverage (5-50x) when confident
- Concentrate on best opportunities rather than spreading thin
- Act decisively on strong signals`;
      maxTotalAllocation = 90;
      minReserve = 10;
      break;
  }

  let prompt = `## YOUR MISSION
Analyze the market and decide how to allocate ${availableBalanceUSDT.toFixed(2)} USDT (available from ${totalBalanceUSDT.toFixed(2)} USDT total balance) across the following assets.

## STRATEGY: ${strategy.toUpperCase()}
${strategyContext}

## AVAILABLE ASSETS
${equities.join(', ')}

## CURRENT MARKET DATA
`;

  // Add price data
  for (const symbol of equities) {
    const price = marketData.prices[symbol];
    if (price) {
      prompt += `
### ${symbol}
- Current Price: $${price.price.toLocaleString()}
- 24h Change: ${price.change24h >= 0 ? '+' : ''}${price.change24h.toFixed(2)}%`;
      if (!bitmexService.isTestnet) {
        prompt += `
- 24h Volume: ${formatVolume(price.volume24h)}`;
      }
      prompt += '\n';
    }
  }

  // Add whale activity WITH WEIGHT CONTEXT
  if (marketData.whale) {
    prompt += `
## WHALE ACTIVITY (Last Hour) - [${formatWeightPriority(marketData.whale.weight)}]
⚠️ WEIGHT PRIORITY: ${formatWeightPriority(marketData.whale.weight)} (weight value: ${marketData.whale.weight})
- Total Transactions: ${marketData.whale.totalTransactions}
- Total Volume: $${(marketData.whale.totalVolumeUsd / 1e6).toFixed(2)}M
- Net Flow: ${marketData.whale.netFlow} (${marketData.whale.sentiment} signal)
`;
  }

  // Add sentiment WITH WEIGHT CONTEXT
  if (marketData.sentiment) {
    prompt += `
## MARKET SENTIMENT - [${formatWeightPriority(marketData.sentiment.weight)}]
⚠️ WEIGHT PRIORITY: ${formatWeightPriority(marketData.sentiment.weight)} (weight value: ${marketData.sentiment.weight})
- Overall Score: ${marketData.sentiment.score}/100
- Trend: ${marketData.sentiment.trend}
- Summary: ${marketData.sentiment.summary}
`;
  }

  // Add news WITH WEIGHT CONTEXT
  if (marketData.news && marketData.news.articles.length > 0) {
    prompt += `
## RECENT NEWS - [${formatWeightPriority(marketData.news.weight)}]
⚠️ WEIGHT PRIORITY: ${formatWeightPriority(marketData.news.weight)} (weight value: ${marketData.news.weight})
${marketData.news.articles.slice(0, 5).map((a) => `- ${a.title}`).join('\n')}
${marketData.news.hasBreaking ? '\n⚠️ BREAKING NEWS DETECTED!' : ''}
`;
  }

  // Add weighting guidance for AI
  prompt += `
## DATA SOURCE WEIGHTING GUIDANCE
The following priorities have been assigned to each data source:
${marketData.whale ? `- Whale Activity: ${formatWeightPriority(marketData.whale.weight)} (${marketData.whale.weight})` : ''}
${marketData.sentiment ? `- Market Sentiment: ${formatWeightPriority(marketData.sentiment.weight)} (${marketData.sentiment.weight})` : ''}
${marketData.news ? `- News Data: ${formatWeightPriority(marketData.news.weight)} (${marketData.news.weight})` : ''}

⚠️ CRITICAL WEIGHT RULES FOR ALLOCATION:
1. HEAVILY weight HIGH PRIORITY sources when deciding allocation percentages
2. If HIGH PRIORITY sources agree on a direction (LONG/SHORT), allocate MORE to those assets
3. If HIGH PRIORITY and LOW PRIORITY sources DISAGREE, reduce allocation or HOLD
4. Only allocate if HIGH PRIORITY sources support the trade with MODERATE to HIGH conviction
5. Use weight hierarchy to justify your allocation percentages in the reasoning field
6. Never let a LOW PRIORITY source override a HIGH PRIORITY source - if conflicting, reduce allocation

## ALLOCATION RULES
1. Total allocation MUST NOT exceed ${maxTotalAllocation}%
2. Keep at least ${minReserve}% in reserve
3. Each allocation must be at least 5% or 0% (don't do tiny allocations)
4. Allocation amounts should be multiples of 5% for simplicity
5. Risk/Reward ratio should be at least 1.5:1 (takeProfit >= stopLoss * 1.5)
6. HOLD means 0% allocation for that asset
7. Only allocate to assets you have conviction in
8. RESPECT DATA SOURCE WEIGHTS - your conviction level should reflect the weight hierarchy

## IMPORTANT
- BitMEX minimum order is 100 USD. For allocations below this threshold, round up or skip.
- Consider correlation between assets - don't over-expose to similar movements
- In bear markets, SHORT positions can be profitable
- In uncertain markets, keeping reserve is smart
- Weight hierarchy is critical - a single HIGH PRIORITY source in disagreement with multiple LOW PRIORITY sources should carry more weight

Respond with ONLY valid JSON in this exact format:
{
  "marketOutlook": "Brief 1-2 sentence market outlook",
  "riskAssessment": "Brief risk assessment (consider weight hierarchy)",
  "allocations": [
    {
      "symbol": "BTCUSDT",
      "signal": "LONG",
      "allocationPercent": 25,
      "confidence": 0.75,
      "leverage": 10,
      "takeProfit": 3.0,
      "stopLoss": 1.5,
      "reasoning": "Brief reasoning (mention which HIGH/MEDIUM/LOW priority sources support this decision)"
    }
  ]
}

If no good opportunities exist, return empty allocations array with 100% reserve.
`;

  return prompt;
}

// Analyze portfolio and get dynamic allocation
export async function analyzePortfolioAllocation(input: PortfolioAnalyzerInput): Promise<PortfolioAllocationResult> {
  const prompt = buildPortfolioAllocationPrompt(input);

  console.log('🤖 Requesting AI portfolio allocation...');
  console.log(`💰 Available Balance: $${input.availableBalanceUSDT.toFixed(2)} USDT`);
  console.log(`📊 Analyzing ${input.equities.length} assets with ${input.strategy} strategy`);

  const result = await grokService.analyzePortfolioAllocation(input.model, prompt);

  console.log(`\n📈 Portfolio Allocation Result:`);
  console.log(`   Market Outlook: ${result.marketOutlook}`);
  console.log(`   Risk Assessment: ${result.riskAssessment}`);
  console.log(`   Total Allocation: ${result.totalAllocationPercent}%`);
  console.log(`   Reserve: ${result.reservePercent}%`);

  if (result.allocations.length > 0) {
    console.log(`   Allocations:`);
    for (const alloc of result.allocations) {
      if (alloc.allocationPercent > 0) {
        const usdAmount = (input.availableBalanceUSDT * alloc.allocationPercent / 100);
        console.log(`   - ${alloc.symbol}: ${alloc.signal} ${alloc.allocationPercent}% ($${usdAmount.toFixed(2)}) @ ${alloc.leverage}x`);
      }
    }
  } else {
    console.log(`   No allocations - keeping 100% in reserve`);
  }

  return result;
}

export const analyzer = {
  analyze,
  analyzePortfolioAllocation,
  buildPrompt,
  buildPortfolioAllocationPrompt,
};