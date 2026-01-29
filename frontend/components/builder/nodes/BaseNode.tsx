'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Bot,
  Eye,
  Activity,
  Newspaper,
  X,
  ChevronDown,
  Bitcoin,
  Coins,
  LucideIcon
} from 'lucide-react';
import { getNodeDefinition, ConfigField } from '@/lib/nodes/definitions';
import { useWorkflowStore } from '@/stores/workflowStore';

// Lucide icon mapping
const iconMap: Record<string, LucideIcon> = {
  bot: Bot,
  eye: Eye,
  activity: Activity,
  newspaper: Newspaper,
  bitcoin: Bitcoin,
  ethereum: Coins,
  solana: Coins,
  bnb: Coins,
  xrp: Coins,
  coins: Coins,
};

// Category colors
const categoryColors: Record<string, { header: string; accent: string; handle: string }> = {
  ai: {
    header: 'bg-gradient-to-r from-purple-600 to-purple-700',
    accent: 'text-purple-400',
    handle: 'bg-purple-400 border-purple-300',
  },
  data: {
    header: 'bg-gradient-to-r from-cyan-600 to-cyan-700',
    accent: 'text-cyan-400',
    handle: 'bg-cyan-400 border-cyan-300',
  },
  equities: {
    header: 'bg-gradient-to-r from-orange-500 to-amber-600',
    accent: 'text-orange-400',
    handle: 'bg-orange-400 border-orange-300',
  },
};

export interface BaseNodeData extends Record<string, unknown> {
  label?: string;
  weight?: number;
  minAmount?: string;
  source?: string;
  filter?: string;
  model?: string;
  strategy?: string;
  [key: string]: any;
}

function BaseNodeComponent({ id, type, data, selected }: NodeProps<any>) {
  const deleteNode = useWorkflowStore((state) => state.deleteNode);
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  const definition = getNodeDefinition(type);
  if (!definition) return null;

  const category = definition.category;
  const colors = categoryColors[category] || {
    header: 'bg-gradient-to-r from-gray-600 to-gray-700',
    accent: 'text-gray-400',
    handle: 'bg-gray-400 border-gray-300',
  };
  const IconComponent = iconMap[definition.icon];

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteNode(id);
  };

  const handleConfigChange = useCallback((fieldName: string, value: string | number) => {
    updateNodeData(id, { [fieldName]: value });
  }, [id, updateNodeData]);

  const renderConfigField = (field: ConfigField) => {
    const value = data[field.name] ?? field.default ?? '';

    if (field.type === 'select') {
      return (
        <div key={field.name} className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-white/50 font-medium">{field.label}</span>
          <div className="relative">
            <select
              value={value}
              onChange={(e) => handleConfigChange(field.name, e.target.value)}
              className="appearance-none bg-[#0d0d1a] border border-white/20 rounded px-2 py-1 pr-5 text-[10px] text-white cursor-pointer hover:border-white/40 focus:border-purple-500 focus:outline-none transition-colors"
            >
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 size-3 text-white/40 pointer-events-none" />
          </div>
        </div>
      );
    }

    return null;
  };

  // For AI node with left and right inputs
  const isAINode = category === 'ai';
  const leftInputs = definition.inputs.filter(i => i.id === 'data_in');
  const rightInputs = definition.inputs.filter(i => i.id === 'equities_in');
  const hasOutputs = definition.outputs.length > 0;

  // Helper: Get weight label if this is a data source node
  const getWeightLabel = (weight?: number) => {
    if (!weight) return '';
    if (weight <= 35) return '📌 Low';
    if (weight <= 65) return '📊 Med';
    return '⭐ High';
  };

  const isDataSourceNode = ['data.whale', 'data.sentiment', 'data.news'].includes(type);
  const weightDisplay = isDataSourceNode && data.weight ? getWeightLabel(data.weight) : '';

  return (
    <div
      className={`bg-[#1a1a2e]/95 backdrop-blur rounded-lg shadow-2xl flex flex-col overflow-visible relative group ${
        selected
          ? 'ring-2 ring-yellow-400 shadow-yellow-400/20'
          : 'ring-1 ring-white/10 hover:ring-white/20'
      }`}
      style={{ minWidth: isAINode ? '280px' : '180px' }}
    >
      {/* Delete Button */}
      <button
        onClick={handleDelete}
        className="absolute -top-2 -right-2 size-5 bg-red-500/90 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10 shadow-lg"
      >
        <X className="size-3 text-white" />
      </button>

      {/* Header */}
      <div className={`${colors.header} px-3 py-2.5 flex items-center gap-2 justify-between`}>
        <div className="flex items-center gap-2">
          {IconComponent && (
            <IconComponent className="size-4 text-white/90" />
          )}
          <span className="text-xs font-bold text-white tracking-wide">
            {definition.label}
          </span>
        </div>
        
        {/* Weight Badge for Data Nodes */}
        {weightDisplay && (
          <span className="text-[10px] font-bold bg-white/10 px-1.5 py-0.5 rounded border border-white/20 text-white/80">
            {weightDisplay}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        {isAINode ? (
          // AI Node Layout: Left inputs | Config | Right inputs
          <div className="flex gap-3">
            {/* Left - Data Input */}
            <div className="flex flex-col justify-center">
              {leftInputs.map((input) => (
                <div key={input.id} className="flex items-center h-7 relative">
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={input.id}
                    className={`!w-3 !h-3 !rounded-full !border-2 bg-cyan-400 border-cyan-300 !-left-[18px] hover:!scale-125 transition-transform`}
                  />
                  <span className="text-[10px] text-cyan-400 font-medium whitespace-nowrap">
                    {input.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Center - Config */}
            <div className="flex-1 space-y-2 px-2 border-l border-r border-white/10">
              {definition.configSchema.map(renderConfigField)}
            </div>

            {/* Right - Equities Input */}
            <div className="flex flex-col justify-center">
              {rightInputs.map((input) => (
                <div key={input.id} className="flex items-center h-7 relative justify-end">
                  <span className="text-[10px] text-orange-400 font-medium whitespace-nowrap">
                    {input.label}
                  </span>
                  <Handle
                    type="target"
                    position={Position.Right}
                    id={input.id}
                    className={`!w-3 !h-3 !rounded-full !border-2 bg-orange-400 border-orange-300 !-right-[18px] hover:!scale-125 transition-transform`}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Data/Equity Node Layout: Config only, handle is outside
          <div className="flex items-center">
            {/* Config */}
            {definition.configSchema.length > 0 && (
              <div className="flex-1 space-y-2">
                {definition.configSchema.map(renderConfigField)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Output Handle - Data nodes on RIGHT, Equity nodes on LEFT */}
      {!isAINode && hasOutputs && definition.outputs.map((output) => (
        <Handle
          key={output.id}
          type="source"
          position={category === 'data' ? Position.Right : Position.Left}
          id={output.id}
          className={`!w-3 !h-3 !rounded-full !border-2 ${colors.handle} ${category === 'data' ? '!-right-1.5' : '!-left-1.5'} hover:!scale-125 transition-transform`}
          style={{ top: '58%' }}
        />
      ))}

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-white/5">
        <p className="text-[9px] text-white/30">
          {definition.description}
        </p>
      </div>
    </div>
  );
}

// Export with proper memo typing
export const BaseNode = memo(BaseNodeComponent) as React.MemoExoticComponent<
  React.FC<NodeProps<any>>
>;