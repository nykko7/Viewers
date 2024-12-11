import React, { useCallback } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  Handle,
  Position,
  NodeProps,
  NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@ohif/ui-next';

// Type for the node data only
type LesionNodeData = {
  label: string;
  date: string;
  volume: number;
  diameter: number;
  isCurrent: boolean;
  isSelected: boolean;
  type: 'maintained' | 'joined' | 'separated';
};

// Complete node type extending Node
type LesionNode = Node<LesionNodeData>;

const CustomNode = ({ data, id }: NodeProps) => {
  const nodeData = data as LesionNodeData;

  const bgColor = nodeData.isSelected
    ? 'rgb(37, 99, 235)'
    : nodeData.isCurrent
      ? 'rgb(156, 163, 175)'
      : 'white';
  const textColor = nodeData.isSelected ? 'white' : 'black';
  const borderColor = nodeData.isSelected
    ? 'rgb(37, 99, 235)'
    : nodeData.isCurrent
      ? 'rgb(156, 163, 175)'
      : 'rgb(209, 213, 219)';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div
            className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border-2 transition-all duration-200 hover:scale-110"
            style={{
              background: bgColor,
              borderColor: borderColor,
            }}
          >
            <Handle type="target" position={Position.Top} style={{ background: 'transparent' }} />
            <div className={`text-sm font-bold text-${textColor}`}>{nodeData.label}</div>
            <Handle
              type="source"
              position={Position.Bottom}
              style={{ background: 'transparent' }}
            />
          </div>
          <TooltipContent
            side="right"
            className="max-w-sm rounded-lg bg-white p-2 shadow-lg"
            sideOffset={5}
          >
            <div className="space-y-2">
              <div className="font-bold text-gray-900">{nodeData.label}</div>
              <div className="text-gray-600">Date: {nodeData.date}</div>
              <div className="text-gray-600">Volume: {nodeData.volume}ml</div>
              <div className="text-gray-600">Diameter: {nodeData.diameter}mm</div>
            </div>
          </TooltipContent>
        </TooltipTrigger>
      </Tooltip>
    </TooltipProvider>
  );
};

const nodeTypes: NodeTypes = {
  lesion: CustomNode,
};

type LesionFlowGraphProps = {
  type: 'maintained' | 'joined' | 'separated';
  currentControl: number;
  selectedLesionId?: string;
  onLesionSelect?: (lesionId: string) => void;
};

export function LesionFlowGraph({
  type,
  currentControl,
  selectedLesionId,
  onLesionSelect,
}: LesionFlowGraphProps) {
  const getNodesAndEdges = useCallback(() => {
    const nodes: Node<LesionNodeData>[] = [];
    const edges: Edge[] = [];

    const lesions = [
      {
        id: 'L1',
        controls: Array.from({ length: 5 }, (_, i) => ({
          date: `Control ${i + 1}`,
          volume: Math.round(Math.random() * 10),
          diameter: Math.round(Math.random() * 20),
        })),
      },
      {
        id: 'L2',
        controls: Array.from({ length: 5 }, (_, i) => ({
          date: `Control ${i + 1}`,
          volume: Math.round(Math.random() * 10),
          diameter: Math.round(Math.random() * 20),
        })),
      },
    ];

    lesions.forEach((lesion, lesionIndex) => {
      const xOffset = lesionIndex * 150;

      lesion.controls.forEach((control, i) => {
        nodes.push({
          id: `${lesion.id}-${i}`,
          type: 'lesion',
          position: { x: xOffset, y: i * 100 },
          data: {
            label: lesion.id,
            date: control.date,
            volume: control.volume,
            diameter: control.diameter,
            isCurrent: i === currentControl,
            isSelected: lesion.id === selectedLesionId,
            type: 'maintained',
          },
        });

        if (i > 0) {
          edges.push({
            id: `e${lesion.id}-${i}`,
            source: `${lesion.id}-${i - 1}`,
            target: `${lesion.id}-${i}`,
            type: 'smoothstep',
            style: {
              stroke: lesion.id === selectedLesionId ? '#3b82f6' : '#9ca3af',
            },
          });
        }
      });
    });

    return { nodes, edges };
  }, [type, currentControl, selectedLesionId]);

  const { nodes, edges } = getNodesAndEdges();

  const handleNodeClick = (event: React.MouseEvent, node: LesionNode) => {
    const lesionId = node.data.label;
    onLesionSelect?.(lesionId);
  };

  return (
    <div style={{ height: 600 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        defaultEdgeOptions={{ type: 'smoothstep', animated: true }}
        fitView
        proOptions={{ hideAttribution: true }}
        className="bg-white"
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
