'use client';

import { useState } from 'react';
import {
  Search,
  ChevronDown,
  GripVertical,
  Brain,
  Database,
  Bot,
  Eye,
  Activity,
  Newspaper,
  Coins,
  Bitcoin,
  LucideIcon
} from 'lucide-react';
import { nodeCategories, getCategoryColorClasses } from '@/lib/nodes/definitions';

interface SidebarProps {
  onDragStart: (event: React.DragEvent, nodeType: string) => void;
}

// Lucide icon mapping for categories
const categoryIconMap: Record<string, LucideIcon> = {
  brain: Brain,
  database: Database,
  coins: Coins,
};

// Lucide icon mapping for nodes
const nodeIconMap: Record<string, LucideIcon> = {
  bot: Bot,
  eye: Eye,
  activity: Activity,
  newspaper: Newspaper,
  bitcoin: Bitcoin,
  ethereum: Coins,
  solana: Coins,
  bnb: Coins,
  xrp: Coins,
};

// Category colors for Blueprint style
const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  ai: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/50' },
  data: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/50' },
  equities: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50' },
};

export function Sidebar({ onDragStart }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(nodeCategories.map((c) => c.id))
  );

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const filteredCategories = nodeCategories
    .map((category) => ({
      ...category,
      nodes: category.nodes.filter(
        (node) =>
          node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          node.description.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((category) => category.nodes.length > 0);

  return (
    <aside className="w-72 flex flex-col bg-[#1e1e1e] border-r border-white/10 z-20">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <h2 className="text-xs font-bold text-white/60 uppercase tracking-widest">
          Node Library
        </h2>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-white/10">
        <div className="relative group">
          <input
            type="text"
            className="w-full h-9 bg-[#2a2a2a] border border-white/10 rounded pl-9 pr-3 text-sm text-white placeholder-white/40 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="absolute left-3 top-2.5 size-4 text-white/40 group-focus-within:text-purple-400 transition-colors" />
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
        {filteredCategories.map((category) => {
          const colors = categoryColors[category.id] || { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/50' };
          const isExpanded = expandedCategories.has(category.id);
          const CategoryIcon = categoryIconMap[category.icon];

          return (
            <div key={category.id} className="rounded overflow-hidden">
              {/* Category Header */}
              <button
                className={`w-full flex items-center justify-between px-3 py-2.5 ${colors.bg} hover:brightness-110 transition-all`}
                onClick={() => toggleCategory(category.id)}
              >
                <div className="flex items-center gap-2">
                  {CategoryIcon && (
                    <CategoryIcon className={`size-4 ${colors.text}`} />
                  )}
                  <span className={`text-sm font-semibold ${colors.text}`}>
                    {category.name}
                  </span>
                  <span className="text-[10px] text-white/40 bg-white/10 px-1.5 py-0.5 rounded">
                    {category.nodes.length}
                  </span>
                </div>
                <ChevronDown
                  className={`size-4 ${colors.text} transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Nodes */}
              {isExpanded && (
                <div className="bg-[#151515] py-1">
                  {category.nodes.map((node) => {
                    const NodeIcon = nodeIconMap[node.icon];
                    return (
                      <div
                        key={node.type}
                        draggable
                        onDragStart={(e) => onDragStart(e, node.type)}
                        className="flex items-center gap-3 px-3 py-2 mx-1 rounded hover:bg-white/5 cursor-grab active:cursor-grabbing group transition-colors"
                      >
                        <div className={`size-8 rounded ${colors.bg} ${colors.border} border flex items-center justify-center`}>
                          {NodeIcon && (
                            <NodeIcon className={`size-4 ${colors.text}`} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white/90 font-medium truncate">
                            {node.label}
                          </div>
                          <div className="text-[10px] text-white/40 truncate">
                            {node.description}
                          </div>
                        </div>
                        <GripVertical className="size-4 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filteredCategories.length === 0 && (
          <div className="text-center py-8 text-white/40 text-sm">
            No nodes found
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-3 border-t border-white/10">
        <p className="text-[10px] text-white/30 text-center">
          Drag nodes to canvas to build workflow
        </p>
      </div>
    </aside>
  );
}
