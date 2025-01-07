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
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Study, Segment } from '../../../types';
import { cn } from '@ohif/ui-next/lib/utils';
import { formatValue } from '../../../utils/formatValue';
import { Home } from 'lucide-react';

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
  isBaseline?: boolean;
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
      return 'rgb(59, 130, 246)'; // Blue 500
    }
    if (nodeData.isRelated) {
      return 'rgb(37, 99, 235)'; // Blue 600 - darker border for related
    }
    if (nodeData.isBaseline) {
      return 'rgb(90, 204, 230)'; // Primary light
    }
    return 'rgb(156, 163, 175)'; // Gray 400
  };

  const getBackgroundColor = () => {
    if (nodeData.isSelected) {
      return 'rgb(37, 99, 235)'; // Blue 600
    }
    if (nodeData.isBaseline) {
      return 'rgb(90, 204, 230)'; // Primary light
    }
    if (nodeData.isRelated) {
      return 'rgb(219, 234, 254)'; // Blue 100 - lighter bg for related
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
            Volume: {formatValue(nodeData.volume)}mm<sup>3</sup>
          </div>
          <div className="text-sm">Date: {new Date(nodeData.studyDate).toLocaleDateString()}</div>
          <div className="text-sm">Type: {nodeData.classification}</div>
        </div>
      </NodeToolbar>

      <div
        className="relative flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border-[4px] transition-all duration-200 hover:scale-110"
        style={{
          background: getBackgroundColor(),
          borderColor: getBorderColor(),
          color: getTextColor(),
          boxShadow: nodeData.isRelated ? '0 0 0 2px rgba(37, 99, 235, 0.3)' : 'none',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          style={{
            background: '#555',
            width: '8px',
            height: '8px',
            top: '-4px',
          }}
        />
        <div className="text-sm font-bold">{formatSegmentLabel(nodeData.label)}</div>
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          style={{
            background: '#555',
            width: '8px',
            height: '8px',
            bottom: '-4px',
          }}
        />
      </div>
    </>
  );
};

// Update StudyDateLabel component
const StudyDateLabel = ({ data }: NodeProps<{ date: string; isBaseline?: boolean }>) => (
  <div
    className={cn(
      'rounded px-3 py-1 text-center text-sm font-bold',
      data.isBaseline ? 'bg-[rgb(90,204,230)] text-black' : 'bg-gray-800 text-gray-300'
    )}
  >
    {new Date(data.date).toLocaleDateString()}
  </div>
);

type LesionFlowGraphProps = {
  studies: Study[];
  currentStudyId: string;
  selectedSegmentId?: string;
  onSegmentSelect?: (segmentId: string) => void;
  baselineStudyId?: string;
};

export function LesionFlowGraph({
  studies,
  currentStudyId,
  selectedSegmentId,
  onSegmentSelect,
  baselineStudyId,
}: LesionFlowGraphProps) {
  const debugSegmentConnections = (studies: Study[]) => {
    console.log('=== Debug Segment Connections ===');
    studies.forEach(study => {
      console.log(`Study Date: ${study.study_date}`);
      study.series.forEach(series => {
        series.segmentations.forEach(segmentation => {
          segmentation.segments.forEach(segment => {
            console.log(`Segment ${segment.label}:`, {
              id: segment.id,
              nodeId: `${study.study_id}-${segment.id}`,
              lesion_segments: segment.lesion_segments,
            });
          });
        });
      });
    });
  };

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

    // First, let's modify how we build the connection map
    const buildConnectionMap = (studies: Study[]) => {
      const connectionMap = new Map<string, Set<string>>();
      const parentToChildren = new Map<string, Set<string>>();

      // Helper to add connection
      const addConnection = (sourceId: string, targetId: string) => {
        if (!connectionMap.has(sourceId)) {
          connectionMap.set(sourceId, new Set());
        }
        connectionMap.get(sourceId)!.add(targetId);
      };

      // First pass: build direct connections and track parent-child relationships
      studies.forEach(study => {
        study.series.forEach(series => {
          series.segmentations.forEach(segmentation => {
            segmentation.segments.forEach(segment => {
              segment.lesion_segments?.forEach(targetId => {
                addConnection(segment.id, targetId);
                addConnection(targetId, segment.id);

                // Track parent-child relationship
                if (!parentToChildren.has(segment.id)) {
                  parentToChildren.set(segment.id, new Set());
                }
                parentToChildren.get(segment.id)!.add(targetId);
              });
            });
          });
        });
      });

      // Second pass: connect siblings (segments that share the same parent)
      parentToChildren.forEach((children, _) => {
        const childrenArray = Array.from(children);
        // Connect all children to each other
        for (let i = 0; i < childrenArray.length; i++) {
          for (let j = i + 1; j < childrenArray.length; j++) {
            addConnection(childrenArray[i], childrenArray[j]);
            addConnection(childrenArray[j], childrenArray[i]);
          }
        }
      });

      return connectionMap;
    };

    const connectionMap = buildConnectionMap(sortedStudies);

    // Update how we get related segments
    const getRelatedSegments = (segmentId: string, connectionMap: Map<string, Set<string>>) => {
      const related = new Set<string>();
      const toVisit = [segmentId];
      const visited = new Set<string>();

      while (toVisit.length > 0) {
        const currentId = toVisit.pop()!;
        if (!visited.has(currentId)) {
          visited.add(currentId);
          const connections = connectionMap.get(currentId);
          if (connections) {
            connections.forEach(connectedId => {
              related.add(connectedId);
              if (!visited.has(connectedId)) {
                toVisit.push(connectedId);
              }
            });
          }
        }
      }

      return related;
    };

    // Get highlighted segments and related segments
    const { selectedSegments, relatedSegments } = React.useMemo(() => {
      if (!selectedSegmentId) {
        return { selectedSegments: new Set<string>(), relatedSegments: new Set<string>() };
      }

      const selected = new Set([selectedSegmentId]);
      const related = getRelatedSegments(selectedSegmentId, connectionMap);

      return { selectedSegments: selected, relatedSegments: related };
    }, [selectedSegmentId, connectionMap]);

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
        data: {
          date: study.study_date,
          isBaseline: study.study_id === baselineStudyId,
        },
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
                isBaseline: study.study_id === baselineStudyId,
              },
            });
          });
        });
      });
    });

    // Create edges for connected segments
    nodeMap.forEach(({ studyId, segment }) => {
      if (segment.lesion_segments?.length > 0) {
        segment.lesion_segments.forEach(targetId => {
          const targetInfo = nodeMap.get(targetId);

          if (targetInfo) {
            const { studyId: targetStudyId } = targetInfo;
            const sourceNodeId = `${studyId}-${segment.id}`;
            const targetNodeId = `${targetStudyId}-${targetId}`;

            // Determine if this edge should be highlighted
            const isHighlighted =
              selectedSegments.has(segment.id) ||
              selectedSegments.has(targetId) ||
              (relatedSegments.has(segment.id) && relatedSegments.has(targetId));

            edges.push({
              id: `e${segment.id}-${targetId}`,
              source: sourceNodeId,
              target: targetNodeId,
              type: 'smoothstep',
              animated: isHighlighted,
              style: {
                stroke: isHighlighted ? 'rgb(37, 99, 235)' : '#4b5563', // Blue 600 for highlighted edges
                strokeWidth: isHighlighted ? 2.5 : 1.5,
                opacity: isHighlighted ? 1 : 0.6,
              },
              sourceHandle: 'bottom',
              targetHandle: 'top',
              markerEnd: {
                type: MarkerType.Arrow,
                width: 20,
                height: 20,
                color: isHighlighted ? 'rgb(37, 99, 235)' : '#4b5563',
              },
            });
          }
        });
      }
    });

    return { nodes, edges };
  }, [studies, currentStudyId, selectedSegmentId, baselineStudyId]);

  const { nodes, edges } = getNodesAndEdges();

  const nodeTypes = {
    lesion: CustomNode,
    dateLabel: StudyDateLabel,
  };

  return (
    <div style={{ height: 500 }} className="relative">
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
          animated: false,
          style: { strokeWidth: 1.5 },
        }}
        fitView
        fitViewOptions={{
          padding: 0.2,
          includeHiddenNodes: true,
        }}
        minZoom={0.5}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#2a2b2d" />
        <Controls />
        <Legend />
      </ReactFlow>
    </div>
  );
}

// Add Legend component
const Legend = () => (
  <div className="bg-background text-foreground border-primary-light absolute left-4 top-4 rounded border p-2 shadow-md">
    <div className="mb-2 text-xs font-semibold">Legend</div>
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded-full border-2 border-[rgb(90,204,230)] bg-[rgb(90,204,230)]" />
        <span className="text-xs">Baseline Lesion</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded-full border-2 border-[rgb(37,99,235)] bg-[rgb(37,99,235)]" />
        <span className="text-xs">Selected Lesion</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded-full border-2 border-[rgb(37,99,235)] bg-[rgb(219,234,254)]" />
        <span className="text-xs">Related Lesion</span>
      </div>
    </div>
  </div>
);
