import axios from 'axios';

// Using Whale Alert API (or mock data for now)
const WHALE_ALERT_API_KEY = process.env.WHALE_ALERT_API_KEY || '';

export interface WhaleTransaction {
  hash: string;
  blockchain: string;
  symbol: string;
  amount: number;
  amountUsd: number;
  from: string;
  to: string;
  timestamp: number;
  transactionType: 'exchange_inflow' | 'exchange_outflow' | 'transfer';
}

export interface WhaleActivitySummary {
  totalTransactions: number;
  totalVolumeUsd: number;
  netFlow: 'inflow' | 'outflow' | 'neutral';
  sentiment: 'bullish' | 'bearish' | 'neutral';
  largestTransaction: WhaleTransaction | null;
  recentTransactions: WhaleTransaction[];
}

// Mock data for development (real API requires paid subscription)
function generateMockWhaleData(minAmount: number): WhaleActivitySummary {
  const mockTransactions: WhaleTransaction[] = [
    {
      hash: '0x' + Math.random().toString(16).slice(2, 10),
      blockchain: 'bitcoin',
      symbol: 'BTC',
      amount: Math.random() * 1000 + 100,
      amountUsd: Math.random() * 50000000 + minAmount,
      from: 'unknown',
      to: 'binance',
      timestamp: Date.now() - Math.random() * 3600000,
      transactionType: 'exchange_inflow',
    },
    {
      hash: '0x' + Math.random().toString(16).slice(2, 10),
      blockchain: 'ethereum',
      symbol: 'ETH',
      amount: Math.random() * 10000 + 500,
      amountUsd: Math.random() * 30000000 + minAmount,
      from: 'coinbase',
      to: 'unknown',
      timestamp: Date.now() - Math.random() * 3600000,
      transactionType: 'exchange_outflow',
    },
  ];

  const inflowVolume = mockTransactions
    .filter((t) => t.transactionType === 'exchange_inflow')
    .reduce((sum, t) => sum + t.amountUsd, 0);

  const outflowVolume = mockTransactions
    .filter((t) => t.transactionType === 'exchange_outflow')
    .reduce((sum, t) => sum + t.amountUsd, 0);

  let netFlow: 'inflow' | 'outflow' | 'neutral' = 'neutral';
  let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';

  if (inflowVolume > outflowVolume * 1.2) {
    netFlow = 'inflow';
    sentiment = 'bearish'; // More going to exchanges = selling pressure
  } else if (outflowVolume > inflowVolume * 1.2) {
    netFlow = 'outflow';
    sentiment = 'bullish'; // More leaving exchanges = accumulation
  }

  return {
    totalTransactions: mockTransactions.length,
    totalVolumeUsd: mockTransactions.reduce((sum, t) => sum + t.amountUsd, 0),
    netFlow,
    sentiment,
    largestTransaction: mockTransactions.sort((a, b) => b.amountUsd - a.amountUsd)[0] || null,
    recentTransactions: mockTransactions,
  };
}

// Get whale activity (uses mock data if no API key)
export async function getWhaleActivity(minAmountUsd: number): Promise<WhaleActivitySummary> {
  // If we have Whale Alert API key, use real data
  if (WHALE_ALERT_API_KEY) {
    try {
      const response = await axios.get('https://api.whale-alert.io/v1/transactions', {
        params: {
          api_key: WHALE_ALERT_API_KEY,
          min_value: minAmountUsd,
          start: Math.floor((Date.now() - 3600000) / 1000), // Last hour
        },
      });

      const transactions: WhaleTransaction[] = response.data.transactions.map((t: any) => ({
        hash: t.hash,
        blockchain: t.blockchain,
        symbol: t.symbol,
        amount: t.amount,
        amountUsd: t.amount_usd,
        from: t.from?.owner || 'unknown',
        to: t.to?.owner || 'unknown',
        timestamp: t.timestamp * 1000,
        transactionType: determineTransactionType(t.from?.owner_type, t.to?.owner_type),
      }));

      return summarizeTransactions(transactions);
    } catch (error: any) {
      console.error('Whale Alert API error:', error.message);
    }
  }

  // Return mock data
  return generateMockWhaleData(minAmountUsd);
}

function determineTransactionType(
  fromType: string,
  toType: string
): 'exchange_inflow' | 'exchange_outflow' | 'transfer' {
  if (toType === 'exchange') return 'exchange_inflow';
  if (fromType === 'exchange') return 'exchange_outflow';
  return 'transfer';
}

function summarizeTransactions(transactions: WhaleTransaction[]): WhaleActivitySummary {
  if (transactions.length === 0) {
    return {
      totalTransactions: 0,
      totalVolumeUsd: 0,
      netFlow: 'neutral',
      sentiment: 'neutral',
      largestTransaction: null,
      recentTransactions: [],
    };
  }

  const inflowVolume = transactions
    .filter((t) => t.transactionType === 'exchange_inflow')
    .reduce((sum, t) => sum + t.amountUsd, 0);

  const outflowVolume = transactions
    .filter((t) => t.transactionType === 'exchange_outflow')
    .reduce((sum, t) => sum + t.amountUsd, 0);

  let netFlow: 'inflow' | 'outflow' | 'neutral' = 'neutral';
  let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';

  if (inflowVolume > outflowVolume * 1.2) {
    netFlow = 'inflow';
    sentiment = 'bearish';
  } else if (outflowVolume > inflowVolume * 1.2) {
    netFlow = 'outflow';
    sentiment = 'bullish';
  }

  return {
    totalTransactions: transactions.length,
    totalVolumeUsd: transactions.reduce((sum, t) => sum + t.amountUsd, 0),
    netFlow,
    sentiment,
    largestTransaction: transactions.sort((a, b) => b.amountUsd - a.amountUsd)[0],
    recentTransactions: transactions.slice(0, 10),
  };
}

export const whaleService = {
  getWhaleActivity,
};
