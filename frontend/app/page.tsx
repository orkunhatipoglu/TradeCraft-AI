'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Plus,
  Workflow,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Play,
  Wallet
} from 'lucide-react';

export default function DashboardPage() {
  const { data: workflows, isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: api.workflows.list,
  });

  const { data: tradeStats } = useQuery({
    queryKey: ['tradeStats'],
    queryFn: api.trades.getStats,
  });

  const { data: balance } = useQuery({
    queryKey: ['balance'],
    queryFn: api.trades.getBalance,
  });

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="h-16 flex items-center justify-between border-b border-border-dark bg-surface-dark px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-8 bg-gradient-to-br from-primary to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
            <Workflow className="size-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">TradeCraft AI</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/trades"
            className="flex h-9 items-center justify-center gap-2 rounded-lg bg-surface-light border border-border-dark hover:bg-border-dark px-4 transition-all"
          >
            <TrendingUp className="size-4" />
            <span className="text-sm font-bold">Trade History</span>
          </Link>
          <Link
            href="/builder/new"
            className="flex h-9 items-center justify-center gap-2 rounded-lg bg-primary hover:bg-blue-600 px-4 shadow-lg shadow-primary/20 transition-all"
          >
            <Plus className="size-4" />
            <span className="text-sm font-bold">New Workflow</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-surface-dark border border-border-dark rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Workflow className="size-5 text-primary" />
              </div>
              <span className="text-sm text-text-secondary">Total Workflows</span>
            </div>
            <p className="text-2xl font-bold">{workflows?.length || 0}</p>
          </div>

          <div className="bg-surface-dark border border-border-dark rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="size-5 text-green-500" />
              </div>
              <span className="text-sm text-text-secondary">Total Trades</span>
            </div>
            <p className="text-2xl font-bold">{tradeStats?.total || 0}</p>
          </div>

          <div className="bg-surface-dark border border-border-dark rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <CheckCircle2 className="size-5 text-yellow-500" />
              </div>
              <span className="text-sm text-text-secondary">Success Rate</span>
            </div>
            <p className="text-2xl font-bold">
              {tradeStats?.successRate?.toFixed(1) || 0}%
            </p>
          </div>

          <div className="bg-surface-dark border border-border-dark rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Wallet className="size-5 text-purple-500" />
              </div>
              <span className="text-sm text-text-secondary">Account Balance</span>
            </div>
            <p className="text-2xl font-bold">
              {balance?.balanceUSDT != null
                ? `$${balance.balanceUSDT.toFixed(2)}`
                : '—'}
            </p>
          </div>
        </div>

        {/* Workflows List */}
        <div className="bg-surface-dark border border-border-dark rounded-lg">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-dark">
            <h2 className="font-bold">Your Workflows</h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-text-secondary">
              Loading workflows...
            </div>
          ) : workflows?.length === 0 ? (
            <div className="p-8 text-center">
              <Workflow className="size-12 mx-auto mb-4 text-text-secondary opacity-50" />
              <p className="text-text-secondary mb-4">No workflows yet</p>
              <Link
                href="/builder/new"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <Plus className="size-4" />
                Create your first workflow
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border-dark">
              {workflows?.map((workflow: any) => (
                <Link
                  key={workflow.id}
                  href={`/builder/${workflow.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-surface-light transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-surface-light flex items-center justify-center border border-border-dark">
                      <Workflow className="size-5 text-text-secondary" />
                    </div>
                    <div>
                      <p className="font-medium">{workflow.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        workflow.status === 'PUBLISHED'
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-yellow-900/30 text-yellow-400'
                      }`}
                    >
                      {workflow.status}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        workflow.isTestnet
                          ? 'bg-blue-900/30 text-blue-400'
                          : 'bg-red-900/30 text-red-400'
                      }`}
                    >
                      {workflow.isTestnet ? 'Testnet' : 'Production'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
