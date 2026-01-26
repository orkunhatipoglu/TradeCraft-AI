import axios from 'axios';
import { coingeckoService } from './coingecko';

export interface SentimentData {
  score: number; // 0-100
  trend: 'bullish' | 'bearish' | 'neutral';
  summary: string;
  sources: {
    fearGreed: number | null;
    socialVolume: number | null;
    marketMomentum: number | null;
  };
}

// Combine multiple sentiment sources
export async function analyzeSentiment(symbols: string[]): Promise<SentimentData> {
  const [fearGreed, globalData] = await Promise.all([
    coingeckoService.getFearGreedIndex(),
    coingeckoService.getGlobalMarketData(),
  ]);

  // Calculate composite sentiment score
  let totalScore = 50; // Default neutral
  let factors: string[] = [];

  // Fear & Greed Index (0-100)
  if (fearGreed) {
    totalScore = (totalScore + fearGreed.value) / 2;
    factors.push(`Fear & Greed: ${fearGreed.value} (${fearGreed.classification})`);
  }

  // Market momentum from 24h change
  if (globalData) {
    const momentum = globalData.marketCapChangePercentage24h;
    const momentumScore = Math.min(100, Math.max(0, 50 + momentum * 5));
    totalScore = (totalScore + momentumScore) / 2;
    factors.push(`Market momentum: ${momentum.toFixed(2)}%`);
  }

  // Determine trend
  let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (totalScore >= 60) trend = 'bullish';
  else if (totalScore <= 40) trend = 'bearish';

  // Generate summary
  const summary = generateSummary(trend, factors);

  return {
    score: Math.round(totalScore),
    trend,
    summary,
    sources: {
      fearGreed: fearGreed?.value || null,
      socialVolume: null, // Would need social API
      marketMomentum: globalData?.marketCapChangePercentage24h || null,
    },
  };
}

function generateSummary(trend: string, factors: string[]): string {
  const trendDescriptions: Record<string, string> = {
    bullish: 'Market sentiment is positive with optimistic indicators.',
    bearish: 'Market sentiment is negative with cautious indicators.',
    neutral: 'Market sentiment is mixed with no clear direction.',
  };

  return `${trendDescriptions[trend]} Key factors: ${factors.join(', ')}`;
}

// Get sentiment for specific source (Twitter, Reddit - would need APIs)
export async function getSocialSentiment(
  source: string,
  symbols: string[]
): Promise<{ score: number; mentions: number } | null> {
  // This would require Twitter API, Reddit API, etc.
  // For now, return mock data
  return {
    score: Math.random() * 40 + 30, // 30-70
    mentions: Math.floor(Math.random() * 10000),
  };
}

export const sentimentService = {
  analyzeSentiment,
  getSocialSentiment,
};
