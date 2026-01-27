'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/utils';
import {
  ArrowLeft,
  Workflow,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';

export default function TradesPage() {
  const { data: trades, isLoading } = useQuery({
    queryKey: ['trades'],
    queryFn: () => api.trades.list({ limit: 100 }),
  });

  const { data: stats } = useQuery({
    queryKey: ['tradeStats'],
    queryFn: api.trades.getStats,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'FILLED':
        return <CheckCircle2 className="size-4 text-green-500" />;
      case 'PENDING':
        return <Clock className="size-4 text-yellow-500" />;
      case 'REJECTED':
      case 'CANCELLED':
        return <XCircle className="size-4 text-red-500" />;
      default:
        return <AlertCircle className="size-4 text-text-secondary" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FILLED':
        return 'bg-green-900/30 text-green-400';
      case 'PENDING':
        return 'bg-yellow-900/30 text-yellow-400';
      case 'REJECTED':
      case 'CANCELLED':
        return 'bg-red-900/30 text-red-400';
      default:
        return 'bg-gray-900/30 text-gray-400';
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="h-16 flex items-center justify-between border-b border-border-dark bg-surface-dark px-6 shrink-0">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3 text-white hover:opacity-80 transition-opacity">
            <ArrowLeft className="size-5 text-text-secondary" />
            <div className="size-8 bg-gradient-to-br from-primary to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
              <Workflow className="size-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">TradeCraft AI</h1>
          </Link>
          <div className="h-6 w-px bg-border-dark" />
          <span className="text-base font-bold text-white">Trade History</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-surface-dark border border-border-dark rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="size-5 text-primary" />
              </div>
              <span className="text-sm text-text-secondary">Total Trades</span>
            </div>
            <p className="text-2xl font-bold">{stats?.total || 0}</p>
          </div>

          <div className="bg-surface-dark border border-border-dark rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="size-5 text-green-500" />
              </div>
              <span className="text-sm text-text-secondary">Filled</span>
            </div>
            <p className="text-2xl font-bold">{stats?.filled || 0}</p>
          </div>

          <div className="bg-surface-dark border border-border-dark rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Clock className="size-5 text-yellow-500" />
              </div>
              <span className="text-sm text-text-secondary">Pending</span>
            </div>
            <p className="text-2xl font-bold">{stats?.pending || 0}</p>
          </div>

          <div className="bg-surface-dark border border-border-dark rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <AlertCircle className="size-5 text-purple-500" />
              </div>
              <span className="text-sm text-text-secondary">Success Rate</span>
            </div>
            <p className="text-2xl font-bold">{formatNumber(stats?.successRate || 0, 1)}%</p>
          </div>
        </div>

        {/* Trades Table */}
        <div className="bg-surface-dark border border-border-dark rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border-dark">
            <h2 className="font-bold">Recent Trades</h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-text-secondary">Loading trades...</div>
          ) : trades?.length === 0 ? (
            <div className="p-8 text-center">
              <TrendingUp className="size-12 mx-auto mb-4 text-text-secondary opacity-50" />
              <p className="text-text-secondary">No trades yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background-dark/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">
                      Workflow
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">
                      Symbol
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">
                      Side
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-text-secondary uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-text-secondary uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">
                      Network
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-dark">
                  {trades?.map((trade: any) => (
                    <tr key={trade.id} className="hover:bg-surface-light/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {formatDate(trade.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/builder/${trade.workflowId}`}
                          className="text-sm text-primary hover:underline"
                        >
                          {trade.workflow?.name || 'Unknown'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono font-bold text-white">
                        {trade.symbol}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 ${
                            trade.side === 'LONG' ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {trade.side === 'LONG' ? (
                            <TrendingUp className="size-4" />
                          ) : (
                            <TrendingDown className="size-4" />
                          )}
                          {trade.side}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {trade.type}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-white">
                        {formatNumber(trade.quantity, 6)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-white">
                        {trade.filledPrice
                          ? `$${formatNumber(trade.filledPrice, 2)}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                            trade.status
                          )}`}
                        >
                          {getStatusIcon(trade.status)}
                          {trade.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            trade.isTestnet
                              ? 'bg-blue-900/30 text-blue-400'
                              : 'bg-red-900/30 text-red-400'
                          }`}
                        >
                          {trade.isTestnet ? 'Testnet' : 'Production'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
