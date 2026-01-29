'use client';

import { X } from 'lucide-react';
import { Input, Select, Button } from '@/components/ui';
import { getNodeDefinition, getCategoryColorClasses } from '@/lib/nodes/definitions';
import { useWorkflowStore } from '@/stores/workflowStore';

// Material icon mapping
const iconMap: Record<string, string> = {
  newspaper: 'newspaper',
  schedule: 'schedule',
  trending_up: 'trending_up',
  sentiment_satisfied: 'sentiment_satisfied',
  lightbulb: 'lightbulb',
  account_balance: 'account_balance',
  visibility: 'visibility',
  shopping_cart: 'shopping_cart',
  notifications: 'notifications',
};

// Helper: Get weight priority label
function getWeightLabel(weight: number): string {
  if (weight <= 35) return 'LOW PRIORITY';
  if (weight <= 65) return 'MEDIUM PRIORITY';
  return 'HIGH PRIORITY';
}

// Helper: Get weight color classes
function getWeightColorClasses(weight: number): string {
  if (weight <= 35) return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/50';
  if (weight <= 65) return 'text-cyan-400 bg-cyan-400/10 border-cyan-400/50';
  return 'text-green-400 bg-green-400/10 border-green-400/50';
}

// Helper: Check if node is a data source
function isDataSourceNode(nodeType: string): boolean {
  return ['data.whale', 'data.sentiment', 'data.news'].includes(nodeType);
}

interface NodeConfigPanelProps {
  nodeId: string;
  nodeType: string;
  nodeData: Record<string, any>;
  onClose: () => void;
}

export function NodeConfigPanel({
  nodeId,
  nodeType,
  nodeData,
  onClose,
}: NodeConfigPanelProps) {
  const { updateNodeData, deleteNode } = useWorkflowStore();
  const definition = getNodeDefinition(nodeType);
  const isDataSource = isDataSourceNode(nodeType);
  const currentWeight = nodeData.weight || 50;

  if (!definition) return null;

  const colorClasses = getCategoryColorClasses(definition.category);

  const handleChange = (name: string, value: any) => {
    // Validate weight range
    if (name === 'weight') {
      const numValue = parseInt(value);
      if (isNaN(numValue) || numValue < 25 || numValue > 100) {
        console.warn(`Invalid weight ${value}, must be between 25 and 100`);
        return;
      }
      updateNodeData(nodeId, { [name]: numValue });
    } else {
      updateNodeData(nodeId, { [name]: value });
    }
  };

  const handleDelete = () => {
    deleteNode(nodeId);
    onClose();
  };

  return (
    <div className="w-80 bg-surface-dark border-l border-border-dark flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-dark">
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined ${colorClasses.text} text-[18px]`}>
            {iconMap[definition.icon]}
          </span>
          <span className="font-bold text-white">{definition.label}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-surface-light text-text-secondary hover:text-white transition-colors"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Description */}
      <div className="px-4 py-3 border-b border-border-dark">
        <p className="text-sm text-text-secondary">{definition.description}</p>
      </div>

      {/* Config Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Node Label */}
        <Input
          label="Node Label"
          value={nodeData.label || ''}
          onChange={(e) => handleChange('label', e.target.value)}
          placeholder={definition.label}
        />

        {/* Weight Configuration for Data Source Nodes */}
        {isDataSource && (
          <div className="space-y-3 p-3 bg-background-dark border border-border-dark rounded-lg">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[10px] uppercase tracking-wider font-bold text-text-secondary">
                Priority Weight
              </label>
              <span className={`text-[10px] font-bold px-2 py-1 rounded border ${getWeightColorClasses(currentWeight)}`}>
                {getWeightLabel(currentWeight)}
              </span>
            </div>

            {/* Weight Input */}
            <div className="flex flex-col gap-2">
              <input
                type="range"
                min={25}
                max={100}
                step={5}
                value={currentWeight}
                onChange={(e) => handleChange('weight', e.target.value)}
                className="w-full h-2 bg-border-dark rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] text-text-secondary">
                <span>Low (25)</span>
                <span className="text-white font-bold text-sm">{currentWeight}</span>
                <span>High (100)</span>
              </div>
            </div>

            {/* Weight Description */}
            <div className="text-[10px] text-text-secondary space-y-1">
              {currentWeight <= 35 && (
                <>
                  <p className="font-semibold text-yellow-400">📌 Low Priority</p>
                  <p>This data source has less influence on trading decisions. Signals from high-priority sources will take precedence.</p>
                </>
              )}
              {currentWeight > 35 && currentWeight <= 65 && (
                <>
                  <p className="font-semibold text-cyan-400">📊 Medium Priority</p>
                  <p>This data source is balanced with others. Contradictions with high-priority sources may reduce allocation.</p>
                </>
              )}
              {currentWeight > 65 && (
                <>
                  <p className="font-semibold text-green-400">⭐ High Priority</p>
                  <p>This data source strongly influences trading decisions. Override lower-priority sources when in conflict.</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Schema Fields */}
        {definition.configSchema.map((field) => {
          const value = nodeData[field.name] ?? field.default ?? '';

          switch (field.type) {
            case 'text':
              return (
                <Input
                  key={field.name}
                  label={field.label}
                  value={value}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                />
              );

            case 'number':
              return (
                <Input
                  key={field.name}
                  label={field.label}
                  type="number"
                  value={value}
                  onChange={(e) => handleChange(field.name, parseFloat(e.target.value) || 0)}
                  placeholder={field.placeholder}
                  min={field.min}
                  max={field.max}
                />
              );

            case 'select':
              return (
                <Select
                  key={field.name}
                  label={field.label}
                  value={value}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  options={field.options || []}
                />
              );

            case 'textarea':
              return (
                <div key={field.name} className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-text-secondary">
                    {field.label}
                  </label>
                  <textarea
                    value={value}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    rows={4}
                    className="w-full bg-background-dark border border-border-dark text-white text-sm rounded px-3 py-2 placeholder-text-secondary focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-colors resize-none"
                  />
                </div>
              );

            case 'range':
              return (
                <div key={field.name} className="flex flex-col gap-2">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-text-secondary">
                    {field.label}
                  </label>
                  <input
                    type="range"
                    min={field.min || 0}
                    max={field.max || 100}
                    value={value}
                    onChange={(e) => handleChange(field.name, parseInt(e.target.value))}
                    className="w-full h-1 bg-border-dark rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-text-secondary">
                    <span>{field.min || 0}</span>
                    <span className="text-white font-bold">{value}</span>
                    <span>{field.max || 100}</span>
                  </div>
                </div>
              );

            case 'toggle':
              return (
                <div key={field.name} className="flex items-center justify-between">
                  <label className="text-sm text-text-secondary">{field.label}</label>
                  <button
                    onClick={() => handleChange(field.name, !value)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      value ? 'bg-primary' : 'bg-border-dark'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        value ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>
              );

            default:
              return null;
          }
        })}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border-dark">
        <Button variant="danger" className="w-full" onClick={handleDelete}>
          Delete Node
        </Button>
      </div>
    </div>
  );
}