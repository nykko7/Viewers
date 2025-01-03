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
  isRelated: boolean;
};

type LesionNode = Node<LesionNodeData>;

// Add utility function to format segment label
const formatSegmentLabel = (label: string): string => {
  const match = label.match(/Segment #(\d+)/);
  return match ? `S${match[1]}` : label;
};

// Update CustomNode component
const CustomNode = ({ data, id }: NodeProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const nodeData = data as LesionNodeData;

  const getBorderColor = () => {
    if (nodeData.isSelected) {
      return 'rgb(37, 99, 235)';
    }
    if (nodeData.isRelated) {
      return 'rgb(59, 130, 246)';
    }
    return 'rgb(156, 163, 175)';
  };

  const getBackgroundColor = () => {
    if (nodeData.isSelected) {
      return 'rgb(37, 99, 235)';
    }
    if (nodeData.isRelated) {
      return 'rgb(191, 219, 254)';
    }
    return 'white';
  };

  const getTextColor = () => {
    if (nodeData.isSelected) {
      return 'white';
    }
    return 'black';
  };

  return (
    <>
      <NodeToolbar
        isVisible={isHovered}
        position={Position.Top}
        offset={10}
        className="rounded-lg border bg-gray-900 p-4 text-white shadow-lg"
      >
        <div className="space-y-1">
          <div className="text-center font-bold">{nodeData.label}</div>
          <div className="text-sm">
            Volume: {nodeData.volume}mm<sup>3</sup>
          </div>
          <div className="text-sm">Date: {new Date(nodeData.studyDate).toLocaleDateString()}</div>
          <div className="text-sm">Type: {nodeData.classification}</div>
        </div>
      </NodeToolbar>

      <div
        className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border-[4px] transition-all duration-200 hover:scale-110"
        style={{
          background: getBackgroundColor(),
          borderColor: getBorderColor(),
          color: nodeData.isSelected ? 'white' : 'black',
          boxShadow: nodeData.isRelated ? '0 0 0 2px rgba(59, 130, 246, 0.3)' : 'none',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Handle type="target" position={Position.Top} />
        <div className="text-sm font-bold">{formatSegmentLabel(nodeData.label)}</div>
        <Handle type="source" position={Position.Bottom} />
      </div>
    </>
  );
};

// Update StudyDateLabel component
const StudyDateLabel = ({ data }: NodeProps) => (
  <div className="rounded bg-gray-800 px-3 py-1 text-center text-xs text-gray-300">
    {new Date(data.date).toLocaleDateString()}
  </div>
);

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
    const nodeMap = new Map<
      string,
      { studyId: string; segment: Segment; position: { x: number; y: number } }
    >();

    // Sort studies by date
    const sortedStudies = [...studies].sort(
      (a, b) => new Date(a.study_date).getTime() - new Date(b.study_date).getTime()
    );

    // Calculate layout dimensions
    const VERTICAL_SPACING = 120;
    const HORIZONTAL_SPACING = 100;
    const DATE_OFFSET = 50; // Increased offset for dates
    const START_Y = 80; // Increased starting Y to accommodate dates

    // First pass: count segments per study to calculate center position
    const studySegmentCounts = new Map<string, number>();
    sortedStudies.forEach(study => {
      let count = 0;
      study.series.forEach(series => {
        series.segmentations.forEach(segmentation => {
          count += segmentation.segments.length;
        });
      });
      studySegmentCounts.set(study.study_id, count);
    });

    // Build a map of all connected segments (both directions)
    const connectionMap = new Map<string, Set<string>>();
    sortedStudies.forEach(study => {
      study.series.forEach(series => {
        series.segmentations.forEach(segmentation => {
          segmentation.segments.forEach(segment => {
            if (!connectionMap.has(segment.id)) {
              connectionMap.set(segment.id, new Set());
            }
            // Add forward connections
            segment.lesion_segments?.forEach(targetId => {
              connectionMap.get(segment.id)?.add(targetId);
              // Add backward connections
              if (!connectionMap.has(targetId)) {
                connectionMap.set(targetId, new Set());
              }
              connectionMap.get(targetId)?.add(segment.id);
            });
          });
        });
      });
    });

    // Function to get all connected segments recursively
    const getAllConnectedSegments = (
      segmentId: string,
      visited = new Set<string>()
    ): Set<string> => {
      visited.add(segmentId);
      const connected = connectionMap.get(segmentId) || new Set();

      connected.forEach(connectedId => {
        if (!visited.has(connectedId)) {
          getAllConnectedSegments(connectedId, visited);
        }
      });

      return visited;
    };

    // Get highlighted segments and related segments
    const { selectedSegments, relatedSegments } = React.useMemo(() => {
      if (!selectedSegmentId) {
        return { selectedSegments: new Set<string>(), relatedSegments: new Set<string>() };
      }

      const selected = new Set([selectedSegmentId]);
      const related = new Set<string>();

      // Add direct connections
      sortedStudies.forEach(study => {
        study.series.forEach(series => {
          series.segmentations.forEach(segmentation => {
            segmentation.segments.forEach(segment => {
              if (segment.id === selectedSegmentId) {
                // Add forward connections
                segment.lesion_segments?.forEach(targetId => related.add(targetId));
              } else if (segment.lesion_segments?.includes(selectedSegmentId)) {
                // Add backward connections
                related.add(segment.id);
              }
            });
          });
        });
      });

      return { selectedSegments: selected, relatedSegments: related };
    }, [selectedSegmentId, sortedStudies]);

    // Second pass: create nodes
    sortedStudies.forEach((study, studyIndex) => {
      const yOffset = START_Y + studyIndex * VERTICAL_SPACING;
      let segmentCount = 0;
      const totalSegments = studySegmentCounts.get(study.study_id) || 0;
      const studyWidth = totalSegments * HORIZONTAL_SPACING;
      const startX = (600 - studyWidth) / 2; // Center the study group

      // Add date label
      nodes.push({
        id: `date-${study.study_id}`,
        type: 'dateLabel',
        position: {
          x: startX + studyWidth / 2 - 40,
          y: yOffset - DATE_OFFSET,
        },
        data: { date: study.study_date },
      });

      study.series.forEach(series => {
        series.segmentations.forEach(segmentation => {
          segmentation.segments.forEach(segment => {
            const xOffset = startX + segmentCount * HORIZONTAL_SPACING;
            segmentCount++;
            const position = { x: xOffset, y: yOffset };

            // Store node info for edge creation
            nodeMap.set(segment.id, {
              studyId: study.study_id,
              segment,
              position,
            });

            // Create node
            nodes.push({
              id: `${study.study_id}-${segment.id}`,
              type: 'lesion',
              position,
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
                isSelected: selectedSegments.has(segment.id),
                isRelated: relatedSegments.has(segment.id),
              },
            });
          });
        });
      });
    });

    // Create edges for connected segments
    nodeMap.forEach(({ studyId, segment, position: sourcePos }) => {
      if (segment.lesion_segments?.length > 0) {
        segment.lesion_segments.forEach(targetId => {
          const targetInfo = nodeMap.get(targetId);
          if (targetInfo) {
            const { position: targetPos } = targetInfo;
            const isHighlighted =
              selectedSegments.has(segment.id) ||
              selectedSegments.has(targetId) ||
              relatedSegments.has(segment.id) ||
              relatedSegments.has(targetId);

            edges.push({
              id: `e${segment.id}-${targetId}`,
              source: `${studyId}-${segment.id}`,
              target: `${targetInfo.studyId}-${targetId}`,
              type: 'smoothstep',
              animated: isHighlighted,
              style: {
                stroke: isHighlighted ? 'rgb(37, 99, 235)' : '#4b5563',
                strokeWidth: isHighlighted ? 3 : 1.5,
                opacity: isHighlighted ? 1 : 0.5,
              },
              sourceHandle: targetPos.y > sourcePos.y ? 'bottom' : 'top',
              targetHandle: targetPos.y > sourcePos.y ? 'top' : 'bottom',
            });
          }
        });
      }
    });

    return { nodes, edges };
  }, [studies, currentStudyId, selectedSegmentId]);

  const { nodes, edges } = getNodesAndEdges();

  const nodeTypes = {
    lesion: CustomNode,
    dateLabel: StudyDateLabel,
  };

  return (
    <div style={{ height: 500 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => {
          if (node.type === 'lesion') {
            onSegmentSelect?.(node.data.segmentId);
          }
        }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          style: { strokeWidth: 1 },
        }}
        fitView
        fitViewOptions={{
          padding: 0.1,
          includeHiddenNodes: true,
        }}
        minZoom={0.5}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        // className="bg-[#0a0b0d]"
      >
        <Background color="#2a2b2d" />
        <Controls />
      </ReactFlow>
    </div>
  );
}
