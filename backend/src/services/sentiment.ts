import { spawn } from 'child_process';
import path from 'path';
import Sentiment from 'sentiment';
import { coingeckoService } from './coingecko';

// --- Configuration & Setup ---
const sentimentAnalyzer = new Sentiment();
const SCRAPER_TIMEOUT_MS = 30000; // 30 second safety net

export interface SentimentData {
  score: number; // 0-100 normalized global score
  trend: 'bullish' | 'bearish' | 'neutral';
  summary: string;
  weight: number; 
  sources: {
    fearGreed: number | null;
    socialVolume: number; // Total message count
    marketMomentum: number | null;
    socialSentimentScore: number | null; // Just the social media component score
  };
}

/**
 * Runs the Python script to fetch raw social data.
 * Includes environment variables, stderr inheritance, and a hard timeout.
 */
async function fetchRawSocialData(symbols: string[]): Promise<string[]> {
  return new Promise((resolve) => {
    const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';
    const scraperPath = path.resolve(__dirname, './scraper.py');

    const pythonProcess = spawn(pythonExecutable, [scraperPath, ...symbols], {
      env: { ...process.env }, // Pass .env variables for API keys/config
      stdio: ['pipe', 'pipe', 'inherit'] // pipe stdout, inherit stderr for direct debugging
    });

    let dataString = '';
    let killed = false;

    // Timeout: Kill the process if it hangs too long
    const timeout = setTimeout(() => {
      killed = true;
      pythonProcess.kill('SIGTERM');
      console.warn(`⚠️  Scraper timed out after ${SCRAPER_TIMEOUT_MS / 1000}s. Skipping social data.`);
      resolve([]);
    }, SCRAPER_TIMEOUT_MS);

    pythonProcess.stdout.on('data', (chunk) => {
      dataString += chunk.toString();
    });

    pythonProcess.on('close', (code) => {
      clearTimeout(timeout);
      if (killed) return; 

      if (code !== 0) {
        console.warn(`⚠️  Scraper process exited with code ${code}. Returning empty array.`);
        resolve([]);
        return;
      }
      try {
        // Expected output: ["Text 1", "Text 2"]
        const texts: string[] = JSON.parse(dataString.trim());
        resolve(texts);
      } catch (e) {
        console.error('❌ Failed to parse scraper output:', e);
        resolve([]);
      }
    });

    pythonProcess.on('error', (err) => {
      clearTimeout(timeout);
      console.error(`❌ Scraper spawn error: ${err.message}`);
      resolve([]);
    });
  });
}

/**
 * Analyzes raw text arrays and produces a 0-100 score.
 */
function analyzeRawTexts(texts: string[]): { score: number; count: number } {
  if (!texts || texts.length === 0) return { score: 50, count: 0 };

  let totalComparativeScore = 0;

  texts.forEach(text => {
    // sentimentAnalyzer.analyze(text).comparative ranges from -1 to 1
    const result = sentimentAnalyzer.analyze(text);
    totalComparativeScore += result.comparative;
  });

  const averageScore = totalComparativeScore / texts.length;

  // Normalize: -1 -> 0, 0 -> 50, +1 -> 100
  const normalizedScore = Math.min(100, Math.max(0, ((averageScore + 1) / 2) * 100));

  return {
    score: Math.round(normalizedScore),
    count: texts.length
  };
}

/**
 * Main Analysis Logic
 * Combines Fear & Greed, Market Momentum, and Social Sentiment.
 */
export async function analyzeSentiment(symbols: string[], weight: number = 1): Promise<SentimentData> {
  // 1. Fetch data in parallel
  const [fearGreed, globalData, rawTexts] = await Promise.all([
    coingeckoService.getFearGreedIndex(),
    coingeckoService.getGlobalMarketData(),
    fetchRawSocialData(symbols)
  ]);

  // 2. Analyze social media sentiment
  const socialAnalysis = analyzeRawTexts(rawTexts);

  // 3. DYNAMIC WEIGHTING: Adjust component weights based on input weight
  // weight ranges from 25 (Low) to 75+ (High)
  // Normalize weight to a multiplier: 25 -> 0.5x, 50 -> 1.0x, 75 -> 1.5x
  const weightMultiplier = weight / 50;
  
  // Base weights
  const baseWeights = { fearGreed: 0.4, momentum: 0.3, social: 0.3 };
  
  // Apply weight multiplier to all components
  const adjustedWeights = {
    fearGreed: baseWeights.fearGreed * weightMultiplier,
    momentum: baseWeights.momentum * weightMultiplier,
    social: baseWeights.social * weightMultiplier,
  };
  
  // Renormalize so weights sum to 1.0
  const sumWeights = adjustedWeights.fearGreed + adjustedWeights.momentum + adjustedWeights.social;
  const normalizedWeights = {
    fearGreed: adjustedWeights.fearGreed / sumWeights,
    momentum: adjustedWeights.momentum / sumWeights,
    social: adjustedWeights.social / sumWeights,
  };

  // 4. Weighted Score Calculation with dynamic weights
  let weightedScore = 0;
  let factors: string[] = [];

  // Fear & Greed Index
  if (fearGreed) {
    weightedScore += fearGreed.value * normalizedWeights.fearGreed;
    factors.push(`Fear & Greed: ${fearGreed.value}`);
  }

  // Market Momentum
  if (globalData) {
    const momentum = globalData.marketCapChangePercentage24h;
    const momentumScore = Math.min(100, Math.max(0, 50 + (momentum * 5)));
    weightedScore += momentumScore * normalizedWeights.momentum;
    factors.push(`Momentum: ${momentum.toFixed(2)}%`);
  }

  // Social Sentiment
  if (socialAnalysis.count > 0) {
    weightedScore += socialAnalysis.score * normalizedWeights.social;
    factors.push(`Social (${socialAnalysis.count}): ${socialAnalysis.score}/100`);
  }

  // Fallback to neutral if no data sources responded
  const finalScore = fearGreed || globalData || socialAnalysis.count > 0 ? weightedScore : 50;
  
  // Define trend based on score thresholds
  const trend = finalScore >= 60 ? 'bullish' : finalScore <= 40 ? 'bearish' : 'neutral';

  return {
    score: Math.round(finalScore),
    trend,
    weight, // Now meaningfully used
    summary: `Sentiment: ${trend} (Weight influence: ${weightMultiplier.toFixed(2)}x). Factors: ${factors.join(' | ')}`,
    sources: {
      fearGreed: fearGreed?.value || null,
      socialVolume: socialAnalysis.count,
      marketMomentum: globalData?.marketCapChangePercentage24h || null,
      socialSentimentScore: socialAnalysis.count > 0 ? socialAnalysis.score : null
    },
  };
}

export const sentimentService = { analyzeSentiment };