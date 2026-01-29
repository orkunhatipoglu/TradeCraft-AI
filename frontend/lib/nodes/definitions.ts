import { LucideIcon } from 'lucide-react';

export interface NodeCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  nodes: NodeDefinition[];
}

export interface NodePort {
  id: string;
  label: string;
  type: 'exec' | 'data'; // exec = execution flow (beyaz), data = veri (renkli)
  dataType?: 'string' | 'number' | 'boolean' | 'object' | 'any';
}

export interface NodeDefinition {
  type: string;
  label: string;
  description: string;
  icon: string;
  category: string;
  inputs: NodePort[];
  outputs: NodePort[];
  configSchema: ConfigField[];
}

export interface ConfigField {
  name: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'range' | 'toggle' | 'textarea';
  options?: { value: string; label: string }[];
  default?: any;
  placeholder?: string;
  min?: number;
  max?: number;
}

// Reusable weight config to keep it clean
const weightConfig: ConfigField = {
  name: 'weight',
  label: 'Priority',
  type: 'select',
  options: [
    { value: '25', label: 'Low' },
    { value: '50', label: 'Medium' },
    { value: '75', label: 'High' },
  ],
  default: '50',
};

export const nodeCategories: NodeCategory[] = [
  {
    id: 'ai',
    name: 'AI',
    icon: 'brain',
    color: 'purple',
    nodes: [
      {
        type: 'ai.trader',
        label: 'Trader AI',
        description: 'AI-powered trading decisions',
        icon: 'bot',
        category: 'ai',
        inputs: [
          { id: 'data_in', label: 'Data', type: 'data', dataType: 'any' },
          { id: 'equities_in', label: 'Equities', type: 'data', dataType: 'any' },
        ],
        outputs: [],
        configSchema: [
          {
            name: 'strategy',
            label: 'Strategy',
            type: 'select',
            options: [
              { value: 'conservative', label: 'Conservative' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'aggressive', label: 'Aggressive' },
            ],
            default: 'balanced',
          },
        ],
      },
    ],
  },
  {
    id: 'data',
    name: 'Data',
    icon: 'database',
    color: 'cyan',
    nodes: [
      {
        type: 'data.whale',
        label: 'Whale Watcher',
        description: 'Large wallet movements',
        icon: 'eye',
        category: 'data',
        inputs: [],
        outputs: [
          { id: 'data_out', label: '', type: 'data', dataType: 'object' },
        ],
        configSchema: [
          {
            name: 'minAmount',
            label: 'Min Amount',
            type: 'select',
            options: [
              { value: '100000', label: '$100K+' },
              { value: '500000', label: '$500K+' },
              { value: '1000000', label: '$1M+' },
              { value: '10000000', label: '$10M+' },
            ],
            default: '1000000',
          },
          weightConfig,
        ],
      },
      {
        type: 'data.sentiment',
        label: 'Sentiment Data',
        description: 'Market sentiment analysis',
        icon: 'activity',
        category: 'data',
        inputs: [],
        outputs: [
          { id: 'data_out', label: '', type: 'data', dataType: 'object' },
        ],
        configSchema: [
          {
            name: 'source',
            label: 'Source',
            type: 'select',
            options: [
              { value: 'all', label: 'All Sources' },
              { value: 'twitter', label: 'Twitter/X' },
              { value: 'reddit', label: 'Reddit' },
              { value: 'news', label: 'News' },
            ],
            default: 'all',
          },
          weightConfig,
        ],
      },
      {
        type: 'data.news',
        label: 'News Data',
        description: 'Crypto news feed',
        icon: 'newspaper',
        category: 'data',
        inputs: [],
        outputs: [
          { id: 'data_out', label: '', type: 'data', dataType: 'object' },
        ],
        configSchema: [
          {
            name: 'filter',
            label: 'Filter',
            type: 'select',
            options: [
              { value: 'all', label: 'All News' },
              { value: 'breaking', label: 'Breaking Only' },
              { value: 'analysis', label: 'Analysis' },
              { value: 'regulatory', label: 'Regulatory' },
            ],
            default: 'all',
          },
          weightConfig,
        ],
      },
    ],
  },
  {
    id: 'equities',
    name: 'Equities',
    icon: 'coins',
    color: 'orange',
    nodes: [
      {
        type: 'equity.btc',
        label: 'Bitcoin',
        description: 'BTC/USDT',
        icon: 'bitcoin',
        category: 'equities',
        inputs: [],
        outputs: [
          { id: 'equity_out', label: '', type: 'data', dataType: 'object' },
        ],
        configSchema: [],
      },
      {
        type: 'equity.eth',
        label: 'Ethereum',
        description: 'ETH/USDT',
        icon: 'ethereum',
        category: 'equities',
        inputs: [],
        outputs: [
          { id: 'equity_out', label: '', type: 'data', dataType: 'object' },
        ],
        configSchema: [],
      },
      {
        type: 'equity.sol',
        label: 'Solana',
        description: 'SOL/USDT',
        icon: 'solana',
        category: 'equities',
        inputs: [],
        outputs: [
          { id: 'equity_out', label: '', type: 'data', dataType: 'object' },
        ],
        configSchema: [],
      },
      {
        type: 'equity.bnb',
        label: 'BNB',
        description: 'BNB/USDT',
        icon: 'bnb',
        category: 'equities',
        inputs: [],
        outputs: [
          { id: 'equity_out', label: '', type: 'data', dataType: 'object' },
        ],
        configSchema: [],
      },
      {
        type: 'equity.xrp',
        label: 'XRP',
        description: 'XRP/USDT',
        icon: 'xrp',
        category: 'equities',
        inputs: [],
        outputs: [
          { id: 'equity_out', label: '', type: 'data', dataType: 'object' },
        ],
        configSchema: [],
      },
    ],
  },
];

export function getNodeDefinition(type: string): NodeDefinition | undefined {
  for (const category of nodeCategories) {
    const node = category.nodes.find((n) => n.type === type);
    if (node) return node;
  }
  return undefined;
}

export function getCategoryColor(categoryId: string): string {
  const colorMap: Record<string, string> = {
    triggers: 'yellow',
    ai: 'purple',
    data: 'cyan', // Matched with nodeCategories color
    equities: 'orange',
    actions: 'green',
  };
  return colorMap[categoryId] || 'gray';
}

export function getCategoryColorClasses(categoryId: string): {
  text: string;
  bg: string;
  border: string;
} {
  const colorMap: Record<string, { text: string; bg: string; border: string }> = {
    triggers: {
      text: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/50',
    },
    ai: {
      text: 'text-purple-500',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/50',
    },
    data: {
      text: 'text-cyan-400', // Updated to match cyan theme
      bg: 'bg-cyan-400/10',
      border: 'border-cyan-400/50',
    },
    equities: {
        text: 'text-orange-500',
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/50',
    },
    actions: {
      text: 'text-green-500',
      bg: 'bg-green-500/10',
      border: 'border-green-500/50',
    },
  };
  return colorMap[categoryId] || { text: 'text-gray-500', bg: 'bg-gray-500/10', border: 'border-gray-500/50' };
}