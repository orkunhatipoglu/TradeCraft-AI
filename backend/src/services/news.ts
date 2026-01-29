import { spawn } from 'child_process';
import path from 'path';
import Sentiment from 'sentiment';
import axios from 'axios';
import { coingeckoService } from './coingecko';

// --- Configuration & Setup ---
const sentimentAnalyzer = new Sentiment();
const SCRAPER_TIMEOUT_MS = 30000;
const CRYPTOCOMPARE_API_KEY = process.env.CRYPTOCOMPARE_API_KEY || '';

// --- Interfaces ---

export interface NewsArticle {
  id: string;
  title: string;
  body: string;
  url: string;
  source: string;
  categories: string[];
  publishedAt: number;
  imageUrl: string | null;
}

export interface NewsData {
  articles: NewsArticle[];
  totalCount: number;
  hasBreaking: boolean;
  weight: number;
}

export interface SentimentData {
  score: number; // 0-100 normalized
  trend: 'bullish' | 'bearish' | 'neutral';
  summary: string;
  weight: number; 
  sources: {
    fearGreed: number | null;
    socialVolume: number;
    marketMomentum: number | null;
    socialSentimentScore: number | null;
    newsBreaking: boolean;
  };
}

// --- News Helpers ---

function isBreakingNews(title: string): boolean {
  const breakingKeywords = ['breaking', 'urgent', 'crash', 'surge', 'hack', 'sec', 'etf', 'liquidation'];
  const lowerTitle = title.toLowerCase();
  return breakingKeywords.some((keyword) => lowerTitle.includes(keyword));
}

function filterArticles(articles: NewsArticle[], filter: string): NewsArticle[] {
  const oneHourAgo = Date.now() - 3600000;
  switch (filter) {
    case 'breaking': return articles.filter(a => a.publishedAt > oneHourAgo && isBreakingNews(a.title));
    case 'regulatory': return articles.filter(a => /sec|regulation|law|ban|legal/i.test(a.title));
    case 'analysis': return articles.filter(a => /analysis|prediction/i.test(a.title) || a.categories.some(c => /analysis/i.test(c)));
    default: return articles;
  }
}

// --- Core Logic ---

/**
 * Runs the Python scraper for social media data.
 */
async function fetchRawSocialData(symbols: string[]): Promise<string[]> {
  return new Promise((resolve) => {
    const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';
    const scraperPath = path.resolve(__dirname, './scraper.py');
    const pythonProcess = spawn(pythonExecutable, [scraperPath, ...symbols], {
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'inherit']
    });

    let dataString = '';
    let killed = false;
    const timeout = setTimeout(() => {
      killed = true;
      pythonProcess.kill('SIGTERM');
      console.warn('⚠️ Scraper timed out. Skipping social data.');
      resolve([]);
    }, SCRAPER_TIMEOUT_MS);

    pythonProcess.stdout.on('data', (chunk) => { dataString += chunk.toString(); });
    pythonProcess.on('close', (code) => {
      clearTimeout(timeout);
      if (killed) return;
      try {
        resolve(code === 0 ? JSON.parse(dataString.trim()) : []);
      } catch { resolve([]); }
    });
  });
}

function analyzeRawTexts(texts: string[]): { score: number; count: number } {
  if (!texts || texts.length === 0) return { score: 50, count: 0 };
  let totalComp = 0;
  texts.forEach(text => { totalComp += sentimentAnalyzer.analyze(text).comparative; });
  const avg = totalComp / texts.length;
  const normalized = Math.min(100, Math.max(0, ((avg + 1) / 2) * 100));
  return { score: Math.round(normalized), count: texts.length };
}

/**
 * Fetches general crypto news.
 */
export async function getNews(filter: string = 'all', weight: number = 1): Promise<NewsData> {
  try {
    const response = await axios.get('https://min-api.cryptocompare.com/data/v2/news/', {
      params: { lang: 'EN', api_key: CRYPTOCOMPARE_API_KEY },
    });
    let articles: NewsArticle[] = response.data.Data.map((item: any) => ({
      id: item.id, 
      title: item.title, 
      body: item.body?.substring(0, 500) || '',
      url: item.url, 
      source: item.source_info?.name || item.source,
      categories: item.categories?.split('|') || [], 
      publishedAt: item.published_on * 1000,
      imageUrl: item.imageurl || null,
    }));
    
    if (filter !== 'all') articles = filterArticles(articles, filter);
    
    // WEIGHT-AWARE: Adjust article count based on weight
    // Low weight (25) = fewer articles (5), High weight (75) = more articles (30)
    const articleCount = Math.ceil((weight / 100) * 40); // 40 is max
    
    return {
      articles: articles.slice(0, Math.max(5, articleCount)),
      totalCount: articles.length,
      hasBreaking: articles.some(a => a.publishedAt > (Date.now() - 3600000) && isBreakingNews(a.title)),
      weight
    };
  } catch { return { articles: [], totalCount: 0, hasBreaking: false, weight }; }
}

/**
 * Main Analysis: Combines Fear/Greed, Momentum, Social, and News status.
 */
/**
 * Main Analysis: NOW RESPECTS NEWS WEIGHT
 */
export async function analyzeSentiment(symbols: string[], weight: number = 1): Promise<SentimentData> {
  const [fearGreed, globalData, rawTexts, newsData] = await Promise.all([
    coingeckoService.getFearGreedIndex(),
    coingeckoService.getGlobalMarketData(),
    fetchRawSocialData(symbols),
    getNews('all', weight) // PASS WEIGHT HERE
  ]);

  const socialAnalysis = analyzeRawTexts(rawTexts);
  let weightedScore = 0;
  let totalWeight = 0;
  let factors: string[] = [];

  if (fearGreed) {
    weightedScore += fearGreed.value * 0.4;
    totalWeight += 0.4;
    factors.push(`F&G: ${fearGreed.value}`);
  }

  if (globalData) {
    const momentum = globalData.marketCapChangePercentage24h;
    const mScore = Math.min(100, Math.max(0, 50 + (momentum * 5)));
    weightedScore += mScore * 0.3;
    totalWeight += 0.3;
    factors.push(`Momentum: ${momentum.toFixed(2)}%`);
  }

  if (socialAnalysis.count > 0) {
    weightedScore += socialAnalysis.score * 0.3;
    totalWeight += 0.3;
    factors.push(`Social: ${socialAnalysis.score}`);
  }

  let finalScore = totalWeight > 0 ? weightedScore / totalWeight : 50;
  
  // WEIGHT-AWARE: Breaking news impact scales with news weight
  if (newsData.hasBreaking) {
    factors.push("BREAKING NEWS DETECTED");
    // Only apply heavy caution if news weight is significant
    const newsInfluence = (newsData.weight / 100); // 0.25 to 0.75+
    finalScore = finalScore * (1 - (0.05 * newsInfluence)); // scales 0.95 to 0.96+ based on weight
  }

  const trend = finalScore >= 60 ? 'bullish' : finalScore <= 40 ? 'bearish' : 'neutral';

  return {
    score: Math.round(finalScore),
    trend,
    weight,
    summary: `Sentiment: ${trend}. Factors: ${factors.join(' | ')}`,
    sources: {
      fearGreed: fearGreed?.value || null,
      socialVolume: socialAnalysis.count,
      marketMomentum: globalData?.marketCapChangePercentage24h || null,
      socialSentimentScore: socialAnalysis.count > 0 ? socialAnalysis.score : null,
      newsBreaking: newsData.hasBreaking
    },
  };
}

export const marketIntelligenceService = {
  analyzeSentiment,
  getNews,
  getNewsForSymbols: async (symbols: string[], filter: string = 'all', weight: number = 1): Promise<NewsData> => {
    const categories = symbols.map((s) => s.replace('USDT', '')).join(',');
    try {
      const response = await axios.get('https://min-api.cryptocompare.com/data/v2/news/', {
        params: { lang: 'EN', categories, api_key: CRYPTOCOMPARE_API_KEY },
      });
      let articles: NewsArticle[] = response.data.Data.map((item: any) => ({
        id: item.id, title: item.title, body: item.body?.substring(0, 500) || '',
        url: item.url, source: item.source_info?.name || item.source,
        categories: item.categories?.split('|') || [], publishedAt: item.published_on * 1000,
        imageUrl: item.imageurl || null,
      }));
      if (filter !== 'all') articles = filterArticles(articles, filter);
      return {
        articles: articles.slice(0, 10),
        totalCount: articles.length,
        hasBreaking: articles.some(a => a.publishedAt > (Date.now() - 3600000) && isBreakingNews(a.title)),
        weight
      };
    } catch { return { articles: [], totalCount: 0, hasBreaking: false, weight }; }
  }
};