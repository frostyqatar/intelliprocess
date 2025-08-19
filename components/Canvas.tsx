import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Project, Node, Edge, ShapeType, Position } from '../types';
import { SHAPE_DIMENSIONS } from '../constants';
import ProcessNode from './nodes/ProcessNode';
import DecisionNode from './nodes/DecisionNode';
import StartNode from './nodes/StartNode';
import EndNode from './nodes/EndNode';
import EmailNode from './nodes/EmailNode';
import { EdgeComponent } from './Edge';
import { getConnectorPos, getOrthogonalPath } from '../services/pathService';

interface CanvasProps {
  project: Project;
  updateProject: (project: Project) => void;
  canvasRef: React.RefObject<SVGSVGElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  onNodeContextMenu: (e: React.MouseEvent, nodeId: string) => void;
  onEdgeContextMenu: (e: React.MouseEvent, edgeId: string) => void;
  closeContextMenu: () => void;
  editingNodeId: string | null;
  setEditingNodeId: (id: string | null) => void;
  editingEdgeId: string | null;
  setEditingEdgeId: (id: string | null) => void;
  pan: Position;
  setPan: (pan: Position) => void;
  isPanning: boolean;
  setIsPanning: (isPanning: boolean) => void;
  startPan: Position;
  setStartPan: (pan: Position) => void;
}

export const Canvas: React.FC<CanvasProps> = ({ 
    project, 
    updateProject, 
    canvasRef, 
    containerRef,
    onNodeContextMenu,
    onEdgeContextMenu,
    closeContextMenu,
    editingNodeId,
    setEditingNodeId,
    editingEdgeId,
    setEditingEdgeId,
    pan,
    setPan,
    isPanning,
    setIsPanning,
    startPan,
    setStartPan
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<{ id: string; offset: Position } | null>(null);
  const [connecting, setConnecting] = useState<{ sourceId: string; sourceHandleIndex: number; tempTarget: Position } | null>(null);
  const [draggingEdge, setDraggingEdge] = useState<{ edgeId: string; handle: 'source' | 'target' } | null>(null);
  const wasConnectionSuccessful = useRef(false);

  const nodeMap = new Map(project.nodes.map(n => [n.id, n]));

  const getCanvasCoords = (e: React.MouseEvent | MouseEvent): Position => {
    const svg = canvasRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const transformed = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    return { x: transformed.x, y: transformed.y };
  };
  
  const getPannedCanvasCoords = (e: React.MouseEvent | MouseEvent): Position => {
      const coords = getCanvasCoords(e);
      return { x: coords.x - pan.x, y: coords.y - pan.y };
  }

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 2) return; // Ignore right-clicks for panning
    closeContextMenu();
    if (e.target === canvasRef.current) {
        setSelectedNodeId(null);
        setEditingNodeId(null);
        setEditingEdgeId(null);
        setIsPanning(true);
        setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const coords = getPannedCanvasCoords(e);
    if (draggedNode && !isPanning) {
      const newNodes = project.nodes.map(n =>
        n.id === draggedNode.id
          ? { ...n, position: { x: coords.x - draggedNode.offset.x, y: coords.y - draggedNode.offset.y } }
          : n
      );
      updateProject({ ...project, nodes: newNodes });
    } else if (connecting) {
      setConnecting({ ...connecting, tempTarget: coords });
    } else if (isPanning) {
        setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
    }
  };

  const handleMouseUp = () => {
    if (draggingEdge && !wasConnectionSuccessful.current) {
        updateProject({
            ...project,
            edges: project.edges.filter(e => e.id !== draggingEdge.edgeId)
        });
    }
    setDraggedNode(null);
    setConnecting(null);
    setIsPanning(false);
    setDraggingEdge(null);
  };
  
  const handleNodeMouseDown = (id: string, e: React.MouseEvent) => {
    if (e.button === 2) return; // Ignore right-clicks
    e.stopPropagation();
    setSelectedNodeId(id);
    setEditingEdgeId(null);
    closeContextMenu();
    const node = project.nodes.find(n => n.id === id);
    if (!node) return;
    const coords = getPannedCanvasCoords(e);
    setDraggedNode({
      id,
      offset: { x: coords.x - node.position.x, y: coords.y - node.position.y },
    });
  };

  const handleConnectorMouseDown = (nodeId: string, connectorIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    closeContextMenu();
    const node = nodeMap.get(nodeId);
    if (node?.type === ShapeType.Email) return; // Prevent starting connections from Email nodes

    const startPos = getPannedCanvasCoords(e);
    setConnecting({ sourceId: nodeId, sourceHandleIndex: connectorIndex, tempTarget: startPos });
  };
  
  const handleConnectorMouseUp = (targetNodeId: string, targetHandleIndex: number) => {
    const targetNode = nodeMap.get(targetNodeId);
    if (targetNode?.type === ShapeType.Email) {
        setConnecting(null);
        setDraggingEdge(null);
        return;
    }

    if (draggingEdge || connecting) {
        wasConnectionSuccessful.current = true;
    }

    if (draggingEdge && connecting) {
        // Re-attach existing edge
        const newEdges = project.edges.map(e => {
            if (e.id === draggingEdge.edgeId) {
                const updatedEdge = { ...e };
                
                if (draggingEdge.handle === 'source') {
                    if (updatedEdge.target === targetNodeId) return e; // Avoid connecting a node to itself
                    updatedEdge.source = targetNodeId;
                    updatedEdge.sourceHandle = targetHandleIndex;
                } else { // 'target'
                    if (updatedEdge.source === targetNodeId) return e; // Avoid connecting a node to itself
                    updatedEdge.target = targetNodeId;
                    updatedEdge.targetHandle = targetHandleIndex;
                }
                return updatedEdge;
            }
            return e;
        });
        updateProject({ ...project, edges: newEdges });

    } else if (connecting && connecting.sourceId !== targetNodeId) {
      // Create new edge
      const newEdge: Edge = {
        id: `edge-${Date.now()}`,
        source: connecting.sourceId,
        target: targetNodeId,
        sourceHandle: connecting.sourceHandleIndex,
        targetHandle: targetHandleIndex,
      };
      const edgeExists = project.edges.some(e => 
        (e.source === newEdge.source && e.target === newEdge.target && e.sourceHandle === newEdge.sourceHandle && e.targetHandle === newEdge.targetHandle) ||
        (e.source === newEdge.target && e.target === newEdge.source && e.sourceHandle === newEdge.targetHandle && e.targetHandle === newEdge.sourceHandle)
      );
      if (!edgeExists) {
        updateProject({ ...project, edges: [...project.edges, newEdge] });
      }
    }
    setConnecting(null);
    setDraggingEdge(null);
  };
  
  const handleNodeMouseUpForConnection = (targetNodeId: string, e: React.MouseEvent) => {
    if (!connecting && !draggingEdge) return;
    
    e.stopPropagation();
    
    const targetNode = nodeMap.get(targetNodeId);
    if (!targetNode || targetNode.type === ShapeType.Email) {
        setConnecting(null);
        return;
    }

    const coords = getPannedCanvasCoords(e);
    const connectors = [
        { x: targetNode.width / 2, y: 0 }, // Top
        { x: targetNode.width, y: targetNode.height / 2 }, // Right
        { x: targetNode.width / 2, y: targetNode.height }, // Bottom
        { x: 0, y: targetNode.height / 2 }, // Left
    ];

    let closestHandleIndex = 0;
    let minDistance = Infinity;

    connectors.forEach((conn, index) => {
        const connAbsX = targetNode.position.x + conn.x;
        const connAbsY = targetNode.position.y + conn.y;
        const distance = Math.pow(coords.x - connAbsX, 2) + Math.pow(coords.y - connAbsY, 2);

        if (distance < minDistance) {
            minDistance = distance;
            closestHandleIndex = index;
        }
    });
    
    handleConnectorMouseUp(targetNodeId, closestHandleIndex);
  };

  const handleEdgeDragStart = (edgeId: string, handle: 'source' | 'target', e: React.MouseEvent) => {
    e.stopPropagation();
    closeContextMenu();
    wasConnectionSuccessful.current = false;
    const edge = project.edges.find(e => e.id === edgeId);
    if (!edge) return;
    
    const otherEndHandle = handle === 'source' ? 'target' : 'source';
    const sourceNodeId = edge[otherEndHandle];
    const sourceNode = nodeMap.get(sourceNodeId);
    const sourceHandleIndex = edge[`${otherEndHandle}Handle`];

    if (!sourceNode || sourceHandleIndex === undefined) return;
    
    const newConnectingTarget = handle === 'source' 
        ? getConnectorPos(nodeMap.get(edge.target)!, edge.targetHandle!) 
        : getConnectorPos(nodeMap.get(edge.source)!, edge.sourceHandle!);
    
    setConnecting({
        sourceId: sourceNodeId,
        sourceHandleIndex: sourceHandleIndex,
        tempTarget: newConnectingTarget,
    });
    setDraggingEdge({ edgeId, handle });
  };

  const handleNodeDoubleClick = (nodeId: string) => {
    setEditingEdgeId(null);
    setEditingNodeId(nodeId);
  };
  
  const handleEdgeDoubleClick = (edgeId: string) => {
    setEditingNodeId(null);
    setEditingEdgeId(edgeId);
  };

  const handleLabelChange = (nodeId: string, newLabel: string) => {
    const newNodes = project.nodes.map(n => n.id === nodeId ? { ...n, label: newLabel } : n);
    updateProject({ ...project, nodes: newNodes });
    setEditingNodeId(null);
  };

  const handleEdgeLabelChange = (edgeId: string, newLabel: string) => {
    const newEdges = project.edges.map(e => e.id === edgeId ? { ...e, label: newLabel } : e);
    updateProject({ ...project, edges: newEdges });
    setEditingEdgeId(null);
  };

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    closeContextMenu();
    
    const type = event.dataTransfer.getData('application/reactflow') as ShapeType;
    if (!Object.values(ShapeType).includes(type)) return;

    const canvasPosition = getPannedCanvasCoords(event);
    
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type,
      position: {
          x: canvasPosition.x - SHAPE_DIMENSIONS[type].width / 2,
          y: canvasPosition.y - SHAPE_DIMENSIONS[type].height / 2,
      },
      label: type,
      ...SHAPE_DIMENSIONS[type]
    };

    updateProject({ ...project, nodes: [...project.nodes, newNode] });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedNodeId && !editingNodeId) {
        const newNodes = project.nodes.filter(n => n.id !== selectedNodeId);
        const newEdges = project.edges.filter(edge => edge.source !== selectedNodeId && edge.target !== selectedNodeId);
        updateProject({ ...project, nodes: newNodes, edges: newEdges });
        setSelectedNodeId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, project, updateProject, editingNodeId]);
  
  const getLivePathForConnecting = () => {
    if (!connecting) return null;
    
    const sourceNode = nodeMap.get(connecting.sourceId);
    if (!sourceNode) return null;
    
    const endPos = connecting.tempTarget;
    
    const tempTargetNode: Node = {
        id: 'temp-target',
        type: ShapeType.Process,
        position: { x: endPos.x, y: endPos.y },
        label: '',
        width: 1,
        height: 1
    };
    
    const tempEdge: Edge = {
        id: 'temp-edge',
        source: connecting.sourceId,
        target: 'temp-target',
        sourceHandle: connecting.sourceHandleIndex,
        targetHandle: (connecting.sourceHandleIndex + 2) % 4 // A reasonable guess
    };
    
    return getOrthogonalPath(sourceNode, tempTargetNode, tempEdge).path;
  }

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing" onDrop={onDrop} onDragOver={onDragOver}>
      <svg
        ref={canvasRef}
        width="100%"
        height="100%"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="bg-gray-800"
      >
        <defs>
          <marker id="arrowhead" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        <g transform={`translate(${pan.x}, ${pan.y})`}>
          {project.edges.map(edge => {
            if (draggingEdge?.edgeId === edge.id) return null;
            const sourceNode = nodeMap.get(edge.source);
            const targetNode = nodeMap.get(edge.target);
            if (!sourceNode || !targetNode) return null;
            return (
              <EdgeComponent 
                key={edge.id} 
                edge={edge} 
                sourceNode={sourceNode} 
                targetNode={targetNode} 
                isEditing={editingEdgeId === edge.id}
                onDoubleClick={handleEdgeDoubleClick}
                onLabelChange={handleEdgeLabelChange}
                onEdgeDragStart={handleEdgeDragStart}
                onContextMenu={(e) => onEdgeContextMenu(e, edge.id)}
              />
            );
          })}
          {connecting && (() => {
              const livePath = getLivePathForConnecting();
              if (!livePath) return null;
              return (
                  <path
                      d={livePath}
                      stroke="#6366f1"
                      strokeWidth="2"
                      fill="none"
                      markerEnd="url(#arrowhead)"
                      style={{ pointerEvents: 'none', color: '#6366f1' }}
                  />
              );
          })()}
          {project.nodes.map(node => {
            const NodeComponent = {
              [ShapeType.Process]: ProcessNode,
              [ShapeType.Decision]: DecisionNode,
              [ShapeType.Start]: StartNode,
              [ShapeType.End]: EndNode,
              [ShapeType.Email]: EmailNode,
            }[node.type];
            return (
              <NodeComponent
                key={node.id}
                node={node}
                isSelected={selectedNodeId === node.id}
                isEditing={editingNodeId === node.id}
                onMouseDown={handleNodeMouseDown}
                onConnectorMouseDown={handleConnectorMouseDown}
                onNodeMouseUp={handleNodeMouseUpForConnection}
                onDoubleClick={handleNodeDoubleClick}
                onLabelChange={handleLabelChange}
                onContextMenu={(e) => onNodeContextMenu(e, node.id)}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
};