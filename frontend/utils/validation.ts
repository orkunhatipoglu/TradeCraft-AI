// utils/validation.ts
import { Connection, Node } from '@xyflow/react';

export const isValidConnection = (connection: Connection, nodes: Node[]) => {
  const sourceNode = nodes.find((n) => n.id === connection.source);
  const targetNode = nodes.find((n) => n.id === connection.target);

  if (!sourceNode || !targetNode) return false;

  // In TypeScript, we have to tell it that 'data' has these properties
  const outputType = (sourceNode.data as any).outputType;
  const inputType = (targetNode.data as any).inputType;

  if (inputType === 'Any') return true;
  return outputType === inputType;
};