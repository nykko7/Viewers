import React, { useCallback, useState } from 'react';
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
  NodeToolbar,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { LesionInfo } from '../types';

// Type for the node data only
type LesionNodeData = {
  label: string;
  date: string;
  volume: number;
  diameter: number;
  isCurrent: boolean;
  isSelected: boolean;
  type: 'maintained' | 'joined' | 'separated';
  control: string;
};

// Complete node type extending Node
type LesionNode = Node<LesionNodeData>;

const CustomNode = ({ data, id }: NodeProps) => {
  const nodeData = data as LesionNodeData;
  const [isHovered, setIsHovered] = useState(false);

  const bgColor = nodeData.isCurrent && nodeData.isSelected ? 'rgb(37, 99, 235)' : 'white';
  const textColor = nodeData.isCurrent && nodeData.isSelected ? 'white' : 'black';
  const borderColor = nodeData.isSelected ? 'rgb(37, 99, 235)' : 'rgb(209, 213, 219)';

  return (
    <>
      <NodeToolbar
        isVisible={isHovered}
        position={Position.Right}
        offset={10}
        className="bg-background rounded-lg border p-3 text-white shadow-lg"
      >
        <div className="space-y-1">
          <div className="text-center font-bold text-white">{nodeData.label}</div>
          <div className="font-bold text-gray-200">
            Control: <span className="font-normal">{nodeData.control}</span>
          </div>
          <div className="font-bold text-gray-200">
            Date: <span className="font-normal">{nodeData.date}</span>
          </div>
          <div className="font-bold text-gray-200">
            Volume:{' '}
            <span className="font-normal">
              {nodeData.volume}mm<sup>3</sup>
            </span>
          </div>
          <div className="font-bold text-gray-200">
            Diameter: <span className="font-normal">{nodeData.diameter}mm</span>
          </div>
        </div>
      </NodeToolbar>

      <div
        className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border-2 transition-all duration-200 hover:scale-110"
        style={{
          background: bgColor,
          borderColor: borderColor,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Handle type="target" position={Position.Top} style={{ background: 'transparent' }} />
        <div className={`text-sm font-bold text-${textColor}`}>{nodeData.label}</div>
        <Handle type="source" position={Position.Bottom} style={{ background: 'transparent' }} />
      </div>
    </>
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
  lesionInfo?: LesionInfo;
};

export function LesionFlowGraph({
  type,
  currentControl,
  selectedLesionId,
  onLesionSelect,
  lesionInfo,
}: LesionFlowGraphProps) {
  const getNodesAndEdges = useCallback(() => {
    const nodes: Node<LesionNodeData>[] = [];
    const edges: Edge[] = [];

    // Use actual controls from lesionInfo if available
    const controls = lesionInfo?.controls || [];

    // Define lesions based on the type
    const lesions = [
      {
        id: 'L1',
        controls: controls.map(control => ({
          control: control.control,
          date: control.date,
          volume: control.volume,
          diameter: control.majorDiameter,
        })),
      },
      {
        id: 'L2',
        controls: controls.map(control => ({
          control: control.control,
          date: control.date,
          volume: control.volume,
          diameter: control.majorDiameter,
        })),
      },
      {
        id: 'L3',
        controls: controls.map(control => ({
          control: control.control,
          date: control.date,
          volume: control.volume,
          diameter: control.majorDiameter,
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
            control: control.control,
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
  }, [type, currentControl, selectedLesionId, lesionInfo]);

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
        colorMode="dark"
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
