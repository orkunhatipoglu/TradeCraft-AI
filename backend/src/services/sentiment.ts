import { spawn } from 'child_process';
import path from 'path';
import Sentiment from 'sentiment'; // npm install sentiment
import { coingeckoService } from './coingecko';

// --- Configuration & Setup ---
const sentimentAnalyzer = new Sentiment();

export interface SentimentData {
  score: number; // 0-100 (Genel Skor)
  trend: 'bullish' | 'bearish' | 'neutral';
  summary: string;
  sources: {
    fearGreed: number | null;
    socialVolume: number; // Toplam mesaj sayısı
    marketMomentum: number | null;
    socialSentimentScore: number | null; // Sadece sosyal medyanın skoru
  };
}

/**
 * Python scriptini çalıştırır ve ham metinleri çeker.
 */
const SCRAPER_TIMEOUT_MS = 30000; // 30 saniye timeout

async function fetchRawSocialData(symbols: string[]): Promise<string[]> {
  return new Promise((resolve) => {
    const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';
    const scraperPath = path.resolve(__dirname, './scraper.py');

    const pythonProcess = spawn(pythonExecutable, [scraperPath, ...symbols], {
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'inherit'], // stderr direkt terminale düşsün
    });

    let dataString = '';
    let killed = false;

    // Timeout: Asılı kalma durumunda process'i öldür
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
      if (killed) return; // Timeout'tan öldürüldüyse zaten resolve edildi

      if (code !== 0) {
        console.warn(`⚠️  Scraper process exited with code ${code}. Returning empty.`);
        resolve([]);
        return;
      }
      try {
        const texts: string[] = JSON.parse(dataString.trim());
        resolve(texts);
      } catch (e) {
        console.error('Failed to parse scraper output:', e);
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
 * Ham metinleri analiz eder ve skor üretir.
 */
function analyzeRawTexts(texts: string[]): { score: number; count: number } {
  if (!texts || texts.length === 0) return { score: 50, count: 0 };

  let totalComparativeScore = 0;

  texts.forEach(text => {
    // TypeScript tarafındaki sentiment kütüphanesi ile analiz
    const result = sentimentAnalyzer.analyze(text);
    // result.comparative: -1 (negatif) ile +1 (pozitif) arası değer döner
    totalComparativeScore += result.comparative;
  });

  const averageScore = totalComparativeScore / texts.length;

  // Skoru 0-100 arasına normalize et
  // -1 -> 0, 0 -> 50, +1 -> 100
  let normalizedScore = ((averageScore + 1) / 2) * 100;
  
  // Sınırları zorlama
  normalizedScore = Math.min(100, Math.max(0, normalizedScore));

  return {
    score: Math.round(normalizedScore),
    count: texts.length
  };
}

// --- Main Analysis Logic ---

export async function analyzeSentiment(symbols: string[]): Promise<SentimentData> {
  // 1. Verileri Paralel Çek
  const [fearGreed, globalData, rawTexts] = await Promise.all([
    coingeckoService.getFearGreedIndex(),
    coingeckoService.getGlobalMarketData(),
    fetchRawSocialData(symbols) // Python'dan ham veri geliyor
  ]);

  // 2. Ham Veriyi Analiz Et
  const socialAnalysis = analyzeRawTexts(rawTexts);

  // 3. Ağırlıklı Skor Hesabı
  let weightedScore = 0;
  let totalWeight = 0;
  let factors: string[] = [];

  // Fear & Greed Index (%40 Ağırlık)
  if (fearGreed) {
    weightedScore += fearGreed.value * 0.4;
    totalWeight += 0.4;
    factors.push(`Fear & Greed: ${fearGreed.value}`);
  }

  // Market Momentum (%30 Ağırlık)
  if (globalData) {
    const momentum = globalData.marketCapChangePercentage24h;
    const momentumScore = Math.min(100, Math.max(0, 50 + (momentum * 5)));
    weightedScore += momentumScore * 0.3;
    totalWeight += 0.3;
    factors.push(`Momentum: ${momentum.toFixed(2)}%`);
  }

  // Sosyal Medya Analizi (%30 Ağırlık)
  if (socialAnalysis.count > 0) {
    weightedScore += socialAnalysis.score * 0.3;
    totalWeight += 0.3;
    factors.push(`Social (${socialAnalysis.count} mentions): ${socialAnalysis.score}/100`);
  }

  // Varsayılan Nötr Skor (Veri yoksa)
  const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 50;

  // Trend Belirleme
  let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (finalScore >= 60) trend = 'bullish';
  else if (finalScore <= 40) trend = 'bearish';

  return {
    score: Math.round(finalScore),
    trend,
    summary: `Market sentiment is ${trend}. Key factors: ${factors.join(' | ')}`,
    sources: {
      fearGreed: fearGreed?.value || null,
      socialVolume: socialAnalysis.count,
      marketMomentum: globalData?.marketCapChangePercentage24h || null,
      socialSentimentScore: socialAnalysis.count > 0 ? socialAnalysis.score : null
    },
  };
}

export const sentimentService = {
  analyzeSentiment,
};