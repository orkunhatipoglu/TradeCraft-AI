import axios from 'axios';

const CRYPTOCOMPARE_API_KEY = process.env.CRYPTOCOMPARE_API_KEY || '';

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
}

// Get latest crypto news
export async function getNews(filter: string = 'all'): Promise<NewsData> {
  console.log(`[NEWS] Fetching news with filter: ${filter}`);

  try {
    const response = await axios.get('https://min-api.cryptocompare.com/data/v2/news/', {
      params: {
        lang: 'EN',
        api_key: CRYPTOCOMPARE_API_KEY,
      },
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

    // Apply filter
    if (filter !== 'all') {
      articles = filterArticles(articles, filter);
    }

    // Check for breaking news (published in last hour)
    const oneHourAgo = Date.now() - 3600000;
    const hasBreaking = articles.some(
      (a) => a.publishedAt > oneHourAgo && isBreakingNews(a.title)
    );

    const result = {
      articles: articles.slice(0, 20),
      totalCount: articles.length,
      hasBreaking,
    };

    // Log fetched news
    console.log(`[NEWS] Fetched ${result.articles.length} articles (total: ${result.totalCount})`);
    console.log(`[NEWS] Breaking news: ${hasBreaking ? 'YES' : 'NO'}`);
    result.articles.forEach((article, idx) => {
      console.log(`[NEWS] ${idx + 1}. ${article.title} (${article.source})`);
    });

    return result;
  } catch (error: any) {
    console.error('[NEWS] CryptoCompare news error:', error.message);
    return {
      articles: [],
      totalCount: 0,
      hasBreaking: false,
    };
  }
}

function filterArticles(articles: NewsArticle[], filter: string): NewsArticle[] {
  switch (filter) {
    case 'breaking':
      const oneHourAgo = Date.now() - 3600000;
      return articles.filter(
        (a) => a.publishedAt > oneHourAgo && isBreakingNews(a.title)
      );

    case 'analysis':
      return articles.filter(
        (a) =>
          a.title.toLowerCase().includes('analysis') ||
          a.title.toLowerCase().includes('prediction') ||
          a.categories.some((c) => c.toLowerCase().includes('analysis'))
      );

    case 'regulatory':
      return articles.filter(
        (a) =>
          a.title.toLowerCase().includes('sec') ||
          a.title.toLowerCase().includes('regulation') ||
          a.title.toLowerCase().includes('law') ||
          a.title.toLowerCase().includes('ban') ||
          a.title.toLowerCase().includes('legal')
      );

    default:
      return articles;
  }
}

function isBreakingNews(title: string): boolean {
  const breakingKeywords = [
    'breaking',
    'urgent',
    'just in',
    'flash',
    'alert',
    'crash',
    'surge',
    'soar',
    'plunge',
    'hack',
    'sec',
    'etf approved',
    'etf rejected',
  ];

  const lowerTitle = title.toLowerCase();
  return breakingKeywords.some((keyword) => lowerTitle.includes(keyword));
}

// Get news for specific symbols
export async function getNewsForSymbols(symbols: string[], filter: string = 'all'): Promise<NewsData> {
  // Convert symbols to categories (BTCUSDT -> BTC)
  const categories = symbols.map((s) => s.replace('USDT', '')).join(',');
  console.log(`[NEWS] Fetching news for symbols: ${symbols.join(', ')}`);
  console.log(`[NEWS] Categories: ${categories} | Filter: ${filter}`);

  try {
    const response = await axios.get('https://min-api.cryptocompare.com/data/v2/news/', {
      params: {
        lang: 'EN',
        categories,
        api_key: CRYPTOCOMPARE_API_KEY,
      },
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

    // Apply filter
    if (filter !== 'all') {
      articles = filterArticles(articles, filter);
    }

    const oneHourAgo = Date.now() - 3600000;
    const hasBreaking = articles.some(
      (a) => a.publishedAt > oneHourAgo && isBreakingNews(a.title)
    );

    const result = {
      articles: articles.slice(0, 10),
      totalCount: articles.length,
      hasBreaking,
    };

    // Log fetched news
    console.log(`[NEWS] Fetched ${result.articles.length} articles for ${categories} (total: ${result.totalCount})`);
    console.log(`[NEWS] Breaking news: ${hasBreaking ? 'YES' : 'NO'}`);
    result.articles.forEach((article, idx) => {
      console.log(`[NEWS] ${idx + 1}. ${article.title} (${article.source})`);
    });

    return result;
  } catch (error: any) {
    console.error('[NEWS] CryptoCompare news error:', error.message);
    return {
      articles: [],
      totalCount: 0,
      hasBreaking: false,
    };
  }
}

export const newsService = {
  getNews,
  getNewsForSymbols,
};
