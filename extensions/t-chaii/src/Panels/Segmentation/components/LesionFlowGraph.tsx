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
import type { Study, Segment } from '../../../types';

type LesionNodeData = {
  label: string;
  segmentId: string;
  studyDate: string;
  volume: number;
  axialDiameter: number | null;
  coronalDiameter: number | null;
  sagittalDiameter: number | null;
  affectedOrgans: string;
  classification: string;
  lesionType: string;
  isCurrent: boolean;
  isSelected: boolean;
};

type LesionNode = Node<LesionNodeData>;

const CustomNode = ({ data, id }: NodeProps) => {
  const nodeData = data as LesionNodeData;
  const [isHovered, setIsHovered] = useState(false);

  const bgColor = nodeData.isCurrent && nodeData.isSelected ? 'rgb(37, 99, 235)' : 'white';
  const textColor = nodeData.isCurrent && nodeData.isSelected ? 'white' : 'black';
  const borderColor = nodeData.isSelected ? 'rgb(37, 99, 235)' : 'rgb(156, 163, 175)';

  const maxDiameter = Math.max(
    nodeData.axialDiameter || 0,
    nodeData.coronalDiameter || 0,
    nodeData.sagittalDiameter || 0
  );

  return (
    <>
      <NodeToolbar
        isVisible={isHovered}
        position={Position.Bottom}
        offset={10}
        className="bg-background border-input z-99 rounded-lg border p-4 text-white shadow-lg"
        style={{ zIndex: 999, overflow: 'visible' }}
      >
        <div className="space-y-1">
          <div className="text-center font-bold text-white">{nodeData.label}</div>
          <div className="text-gray-200">
            Volume:{' '}
            <span className="font-bold">
              {nodeData.volume}mm<sup>3</sup>
            </span>
          </div>
          <div className="text-gray-200">
            Max Diameter: <span className="font-bold">{maxDiameter}mm</span>
          </div>
          <div className="text-gray-200">
            Classification: <span className="font-bold">{nodeData.classification}</span>
          </div>
        </div>
      </NodeToolbar>

      <div
        className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border-4 transition-all duration-200 hover:scale-110"
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
  studies: Study[];
  currentStudyId: string;
  selectedSegmentId?: string;
  onSegmentSelect?: (segmentId: string) => void;
};

export function LesionFlowGraph({
  studies,
  currentStudyId,
  selectedSegmentId,
  onSegmentSelect,
}: LesionFlowGraphProps) {
  const getNodesAndEdges = useCallback(() => {
    const nodes: Node<LesionNodeData>[] = [];
    const edges: Edge[] = [];
    const nodeMap = new Map<string, { studyId: string; segment: Segment }>();

    console.log('Initial data:', {
      studies,
      currentStudyId,
      selectedSegmentId,
    });

    // Sort studies by date
    const sortedStudies = [...studies].sort(
      (a, b) => new Date(a.study_date).getTime() - new Date(b.study_date).getTime()
    );

    console.log(
      'Sorted studies:',
      sortedStudies.map(s => ({
        study_id: s.study_id,
        date: s.study_date,
      }))
    );

    // First pass: create nodes and build nodeMap
    sortedStudies.forEach((study, studyIndex) => {
      const yOffset = studyIndex * 150;

      study.series.forEach(series => {
        series.segmentations.forEach(segmentation => {
          console.log('Processing segmentation:', {
            segmentation_id: segmentation.segmentation_id,
            segments: segmentation.segments,
          });

          segmentation.segments.forEach((segment, segmentIndex) => {
            const xOffset = segmentIndex * 150;

            // Store segment in map for edge creation
            nodeMap.set(segment.id, { studyId: study.study_id, segment });

            const node = {
              id: `${study.study_id}-${segment.id}`,
              type: 'lesion',
              position: { x: xOffset, y: yOffset },
              data: {
                label: segment.label,
                segmentId: segment.id,
                studyDate: study.study_date,
                volume: segment.volume,
                axialDiameter: segment.axial_diameter,
                coronalDiameter: segment.coronal_diameter,
                sagittalDiameter: segment.sagittal_diameter,
                affectedOrgans: segment.affected_organs,
                classification: segment.lession_classification,
                lesionType: segment.lession_type,
                isCurrent: study.study_id === currentStudyId,
                isSelected: segment.id === selectedSegmentId,
              },
            };

            console.log('Created node:', {
              nodeId: node.id,
              segmentId: segment.id,
              lesion_segments: segment.lesion_segments,
            });

            nodes.push(node);
          });
        });
      });
    });

    console.log(
      'NodeMap after first pass:',
      Array.from(nodeMap.entries()).map(([key, value]) => ({
        segmentId: key,
        studyId: value.studyId,
        lesion_segments: value.segment.lesion_segments,
      }))
    );

    // Second pass: create edges based on lesion_segments
    nodeMap.forEach(({ studyId, segment }) => {
      if (segment.lesion_segments && segment.lesion_segments.length > 0) {
        console.log('Creating edges for segment:', {
          sourceId: segment.id,
          studyId,
          lesion_segments: segment.lesion_segments,
        });

        segment.lesion_segments.forEach(targetSegmentId => {
          const targetNode = nodeMap.get(targetSegmentId);
          if (targetNode) {
            const edge = {
              id: `e${segment.id}-${targetSegmentId}`,
              source: `${studyId}-${segment.id}`,
              target: `${targetNode.studyId}-${targetSegmentId}`,
              type: 'smoothstep',
              animated: true,
              style: {
                stroke: segment.id === selectedSegmentId ? '#3b82f6' : '#9ca3af',
                strokeWidth: 2,
              },
            };

            console.log('Created edge:', {
              edgeId: edge.id,
              source: edge.source,
              target: edge.target,
            });

            edges.push(edge);
          } else {
            console.warn('Target segment not found:', {
              sourceSegmentId: segment.id,
              targetSegmentId,
            });
          }
        });
      }
    });

    console.log('Final graph data:', {
      nodes: nodes.length,
      edges: edges.length,
      nodeDetails: nodes.map(n => ({
        id: n.id,
        label: n.data.label,
        segmentId: n.data.segmentId,
      })),
      edgeDetails: edges,
    });

    return { nodes, edges };
  }, [studies, currentStudyId, selectedSegmentId]);

  const { nodes, edges } = getNodesAndEdges();

  const handleNodeClick = (event: React.MouseEvent, node: LesionNode) => {
    onSegmentSelect?.(node.data.segmentId);
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
        fitViewOptions={{
          padding: 0.3,
        }}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
