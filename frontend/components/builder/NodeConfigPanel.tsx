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

  if (!definition) return null;

  const colorClasses = getCategoryColorClasses(definition.category);

  const handleChange = (name: string, value: any) => {
    updateNodeData(nodeId, { [name]: value });
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
