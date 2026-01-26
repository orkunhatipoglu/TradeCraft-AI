import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  workflows: {
    list: async () => {
      const { data } = await client.get('/workflows');
      return data;
    },
    get: async (id: string) => {
      const { data } = await client.get(`/workflows/${id}`);
      return data;
    },
    create: async (workflow: {
      name: string;
      description?: string;
      nodes?: any[];
      edges?: any[];
      isTestnet?: boolean;
    }) => {
      const { data } = await client.post('/workflows', workflow);
      return data;
    },
    update: async (
      id: string,
      updates: {
        name?: string;
        description?: string;
        nodes?: any[];
        edges?: any[];
        viewport?: { x: number; y: number; zoom: number };
        isTestnet?: boolean;
      }
    ) => {
      const { data } = await client.put(`/workflows/${id}`, updates);
      return data;
    },
    delete: async (id: string) => {
      await client.delete(`/workflows/${id}`);
    },
    publish: async (id: string) => {
      const { data } = await client.post(`/workflows/${id}/publish`);
      return data;
    },
    execute: async (id: string, mockData?: any) => {
      const { data } = await client.post(`/workflows/${id}/execute`, { mockData });
      return data;
    },
    getExecutions: async (id: string, limit?: number) => {
      const { data } = await client.get(`/workflows/${id}/executions`, {
        params: { limit },
      });
      return data;
    },
  },

  news: {
    get: async (categories?: string, limit?: number) => {
      const { data } = await client.get('/news', {
        params: { categories, limit },
      });
      return data;
    },
    getCategories: async () => {
      const { data } = await client.get('/news/categories');
      return data;
    },
    search: async (query: string, categories?: string) => {
      const { data } = await client.get('/news/search', {
        params: { q: query, categories },
      });
      return data;
    },
  },

  ai: {
    analyzeSentiment: async (text: string, context?: string) => {
      const { data } = await client.post('/ai/sentiment', { text, context });
      return data;
    },
    generateStrategy: async (
      marketData: {
        symbol: string;
        currentPrice: number;
        priceChange24h?: number;
        volume24h?: number;
      },
      sentiment?: { score: number; confidence: number; summary?: string },
      portfolioContext?: string
    ) => {
      const { data } = await client.post('/ai/strategy', {
        marketData,
        sentiment,
        portfolioContext,
      });
      return data;
    },
    getStatus: async () => {
      const { data } = await client.get('/ai/status');
      return data;
    },
  },

  trades: {
    list: async (params?: { workflowId?: string; limit?: number; status?: string }) => {
      const { data } = await client.get('/trades', { params });
      return data;
    },
    get: async (id: string) => {
      const { data } = await client.get(`/trades/${id}`);
      return data;
    },
    create: async (trade: {
      workflowId: string;
      symbol: string;
      side: 'BUY' | 'SELL';
      type?: 'MARKET' | 'LIMIT';
      quantity: number;
      price?: number;
      isTestnet?: boolean;
      reason?: string;
    }) => {
      const { data } = await client.post('/trades', trade);
      return data;
    },
    getStats: async (workflowId?: string) => {
      const { data } = await client.get('/trades/stats/summary', {
        params: { workflowId },
      });
      return data;
    },
    getBinanceStatus: async () => {
      const { data } = await client.get('/trades/binance/status');
      return data;
    },
  },
};
