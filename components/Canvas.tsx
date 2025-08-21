
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
  projects: Project[]; // For linking feature
  updateProject: (project: Project) => void;
  canvasRef: React.RefObject<SVGSVGElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  onNodeContextMenu: (e: React.MouseEvent, nodeId: string) => void;
  onEdgeContextMenu: (e: React.MouseEvent, edgeId: string) => void;
  onLinkClick: (projectId: string) => void;
  closeContextMenu: () => void;
  editingNodeId: string | null;
  setEditingNodeId: (id: string | null) => void;
  editingEdgeId: string | null;
  setEditingEdgeId: (id: string | null) => void;
  pan: Position;
  setPan: (pan: Position) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  isPanning: boolean;
  setIsPanning: (isPanning: boolean) => void;
  startPan: Position;
  setStartPan: (pan: Position) => void;
  mode: 'grab' | 'select';
}

export const Canvas: React.FC<CanvasProps> = ({ 
    project, 
    projects,
    updateProject, 
    canvasRef, 
    containerRef,
    onNodeContextMenu,
    onEdgeContextMenu,
    onLinkClick,
    closeContextMenu,
    editingNodeId,
    setEditingNodeId,
    editingEdgeId,
    setEditingEdgeId,
    pan,
    setPan,
    zoom,
    setZoom,
    isPanning,
    setIsPanning,
    startPan,
    setStartPan,
    mode
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [draggedNode, setDraggedNode] = useState<{ id: string; offset: Position } | null>(null);
  const [draggedNodes, setDraggedNodes] = useState<Map<string, Position>>(new Map());
  const [connecting, setConnecting] = useState<{ sourceId: string; sourceHandleIndex: number; tempTarget: Position } | null>(null);
  const [draggingEdge, setDraggingEdge] = useState<{ edgeId: string; handle: 'source' | 'target' } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ start: Position; end: Position } | null>(null);
  const wasConnectionSuccessful = useRef(false);

  const nodeMap = new Map(project.nodes.map(n => [n.id, n]));

  const getCanvasCoords = (e: React.MouseEvent | MouseEvent | React.WheelEvent): Position => {
    const svg = canvasRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const transformed = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    return { x: transformed.x, y: transformed.y };
  };
  
  const getWorldCoords = (e: React.MouseEvent | MouseEvent | React.DragEvent): Position => {
      const svgCoords = getCanvasCoords(e);
      return {
          x: (svgCoords.x - pan.x) / zoom,
          y: (svgCoords.y - pan.y) / zoom,
      };
  }

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 2) return; // Ignore right-clicks for panning
    closeContextMenu();
    
    if (e.target === canvasRef.current) {
      if (mode === 'grab') {
        setSelectedNodeId(null);
        setSelectedNodeIds(new Set());
        setEditingNodeId(null);
        setEditingEdgeId(null);
        setIsPanning(true);
        setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      } else if (mode === 'select') {
        const worldCoords = getWorldCoords(e);
        setSelectionBox({ start: worldCoords, end: worldCoords });
        setSelectedNodeId(null);
        setSelectedNodeIds(new Set());
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const worldCoords = getWorldCoords(e);
    
    if (mode === 'grab') {
      if (draggedNode && !isPanning) {
        const newNodes = project.nodes.map(n =>
          n.id === draggedNode.id
            ? { ...n, position: { x: worldCoords.x - draggedNode.offset.x, y: worldCoords.y - draggedNode.offset.y } }
            : n
        );
        updateProject({ ...project, nodes: newNodes });
      } else if (connecting) {
        setConnecting({ ...connecting, tempTarget: worldCoords });
      } else if (isPanning) {
        setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
      }
         } else if (mode === 'select') {
       if (selectionBox) {
         setSelectionBox({ ...selectionBox, end: worldCoords });
       } else if (draggedNodes.size > 0) {
         // For multi-selection dragging, we need to calculate the movement delta
         // and apply it to all selected nodes
         const firstNodeId = Array.from(draggedNodes.keys())[0];
         const firstNode = project.nodes.find(n => n.id === firstNodeId);
         if (firstNode) {
           const dragOffset = draggedNodes.get(firstNodeId);
           if (dragOffset) {
             const newX = worldCoords.x - dragOffset.x;
             const newY = worldCoords.y - dragOffset.y;
             const deltaX = newX - firstNode.position.x;
             const deltaY = newY - firstNode.position.y;
             
             const newNodes = project.nodes.map(n => {
               if (draggedNodes.has(n.id)) {
                 return { 
                   ...n, 
                   position: { 
                     x: n.position.x + deltaX, 
                     y: n.position.y + deltaY 
                   } 
                 };
               }
               return n;
             });
             updateProject({ ...project, nodes: newNodes });
           }
         }
       }
     }
  };

  const handleMouseUp = () => {
    if (mode === 'grab') {
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
    } else if (mode === 'select') {
      if (selectionBox) {
        // Calculate which nodes are in the selection box
        const selectedIds = new Set<string>();
        const { start, end } = selectionBox;
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);

        project.nodes.forEach(node => {
          const nodeRight = node.position.x + node.width;
          const nodeBottom = node.position.y + node.height;
          
          if (node.position.x < maxX && nodeRight > minX && 
              node.position.y < maxY && nodeBottom > minY) {
            selectedIds.add(node.id);
          }
        });
        
        setSelectedNodeIds(selectedIds);
        setSelectionBox(null);
      }
      setDraggedNodes(new Map());
    }
  };
  
  const handleNodeMouseDown = (id: string, e: React.MouseEvent) => {
    if (e.button === 2) return; // Ignore right-clicks
    e.stopPropagation();
    closeContextMenu();
    
    if (mode === 'grab') {
      setSelectedNodeId(id);
      setSelectedNodeIds(new Set([id]));
      setEditingNodeId(null);
      setEditingEdgeId(null);
      const node = project.nodes.find(n => n.id === id);
      if (!node) return;
      const worldCoords = getWorldCoords(e);
      setDraggedNode({
        id,
        offset: { x: worldCoords.x - node.position.x, y: worldCoords.y - node.position.y },
      });
    } else if (mode === 'select') {
      const worldCoords = getWorldCoords(e);
      
      if (e.ctrlKey || e.metaKey) {
        // Multi-select with Ctrl/Cmd
        const newSelectedIds = new Set(selectedNodeIds);
        if (newSelectedIds.has(id)) {
          newSelectedIds.delete(id);
        } else {
          newSelectedIds.add(id);
        }
        setSelectedNodeIds(newSelectedIds);
        setSelectedNodeId(newSelectedIds.size === 1 ? id : null);
      } else {
        // Single select or start dragging multiple
        if (selectedNodeIds.has(id)) {
          // Start dragging all selected nodes
          const newDraggedNodes = new Map();
          selectedNodeIds.forEach(nodeId => {
            const node = project.nodes.find(n => n.id === nodeId);
            if (node) {
              newDraggedNodes.set(nodeId, {
                x: worldCoords.x - node.position.x,
                y: worldCoords.y - node.position.y
              });
            }
          });
          setDraggedNodes(newDraggedNodes);
        } else {
          // Select only this node
          setSelectedNodeIds(new Set([id]));
          setSelectedNodeId(id);
          const node = project.nodes.find(n => n.id === id);
          if (node) {
            setDraggedNodes(new Map([[id, {
              x: worldCoords.x - node.position.x,
              y: worldCoords.y - node.position.y
            }]]));
          }
        }
      }
    }
  };

  const handleConnectorMouseDown = (nodeId: string, connectorIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    closeContextMenu();
    const startPos = getWorldCoords(e);
    setConnecting({ sourceId: nodeId, sourceHandleIndex: connectorIndex, tempTarget: startPos });
  };
  
  const handleConnectorMouseUp = (targetNodeId: string, targetHandleIndex: number) => {
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
    if (!targetNode) {
        setConnecting(null);
        return;
    }

    const worldCoords = getWorldCoords(e);
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
        const distance = Math.pow(worldCoords.x - connAbsX, 2) + Math.pow(worldCoords.y - connAbsY, 2);

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
  };

  const handleEdgeLabelChange = (edgeId: string, newLabel: string) => {
    const newEdges = project.edges.map(e => e.id === edgeId ? { ...e, label: newLabel } : e);
    updateProject({ ...project, edges: newEdges });
  };

  const handleStopEditing = () => {
    setEditingNodeId(null);
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

    const worldPos = getWorldCoords(event);
    
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type,
      position: {
          x: worldPos.x - SHAPE_DIMENSIONS[type].width / 2,
          y: worldPos.y - SHAPE_DIMENSIONS[type].height / 2,
      },
      label: type,
      ...SHAPE_DIMENSIONS[type]
    };

    updateProject({ ...project, nodes: [...project.nodes, newNode] });
  };
  
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const newZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
    const clampedZoom = Math.max(0.2, Math.min(newZoom, 3));

    const pointer = getCanvasCoords(e); // Pointer position in SVG space
    
    // Position of pointer in world space before zoom
    const worldPos = {
        x: (pointer.x - pan.x) / zoom,
        y: (pointer.y - pan.y) / zoom,
    };
    
    // New pan to keep the world position under the pointer
    const newPan = {
        x: pointer.x - worldPos.x * clampedZoom,
        y: pointer.y - worldPos.y * clampedZoom,
    };

    setZoom(clampedZoom);
    setPan(newPan);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingNodeId || editingEdgeId) return; // Don't act on keys while editing text

      if ((e.key === 'Backspace' || e.key === 'Delete')) {
        if (mode === 'grab' && selectedNodeId) {
          // Single node deletion in grab mode
          const newNodes = project.nodes.filter(n => n.id !== selectedNodeId);
          const newEdges = project.edges.filter(edge => edge.source !== selectedNodeId && edge.target !== selectedNodeId);
          updateProject({ ...project, nodes: newNodes, edges: newEdges });
          setSelectedNodeId(null);
        } else if (mode === 'select' && selectedNodeIds.size > 0) {
          // Multi-node deletion in select mode
          const newNodes = project.nodes.filter(n => !selectedNodeIds.has(n.id));
          const newEdges = project.edges.filter(edge => 
            !selectedNodeIds.has(edge.source) && !selectedNodeIds.has(edge.target)
          );
          updateProject({ ...project, nodes: newNodes, edges: newEdges });
          setSelectedNodeIds(new Set());
          setSelectedNodeId(null);
        }
      }
      
      if (selectedNodeId && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const selectedNode = project.nodes.find(n => n.id === selectedNodeId);
        if (!selectedNode) return;

        const moveAmount = e.shiftKey ? 10 : 1;
        let newPos = { ...selectedNode.position };

        switch (e.key) {
          case 'ArrowUp':
            newPos.y -= moveAmount;
            break;
          case 'ArrowDown':
            newPos.y += moveAmount;
            break;
          case 'ArrowLeft':
            newPos.x -= moveAmount;
            break;
          case 'ArrowRight':
            newPos.x += moveAmount;
            break;
        }
        
        const newNodes = project.nodes.map(n =>
          n.id === selectedNodeId ? { ...n, position: newPos } : n
        );
        updateProject({ ...project, nodes: newNodes });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, selectedNodeIds, project, updateProject, editingNodeId, editingEdgeId, mode]);
  
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
    <div 
        ref={containerRef} 
        className={`w-full h-full overflow-hidden ${
          mode === 'grab' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
        }`}
        onDrop={onDrop} 
        onDragOver={onDragOver}
        onWheel={handleWheel}
        onMouseDown={(e) => {
          if (e.target === containerRef.current) {
            handleStopEditing();
          }
        }}
    >
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
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Selection Box */}
          {selectionBox && (
            <rect
              x={Math.min(selectionBox.start.x, selectionBox.end.x)}
              y={Math.min(selectionBox.start.y, selectionBox.end.y)}
              width={Math.abs(selectionBox.end.x - selectionBox.start.x)}
              height={Math.abs(selectionBox.end.y - selectionBox.start.y)}
              fill="rgba(99, 102, 241, 0.1)"
              stroke="rgba(99, 102, 241, 0.8)"
              strokeWidth="1"
              strokeDasharray="5,5"
              style={{ pointerEvents: 'none' }}
            />
          )}
          
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
                onStopEditing={handleStopEditing}
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
            
            const isSelected = mode === 'grab' 
              ? selectedNodeId === node.id 
              : selectedNodeIds.has(node.id);
              
            return (
              <NodeComponent
                key={node.id}
                node={node}
                projects={projects}
                isSelected={isSelected}
                isEditing={editingNodeId === node.id}
                onMouseDown={handleNodeMouseDown}
                onConnectorMouseDown={handleConnectorMouseDown}
                onNodeMouseUp={handleNodeMouseUpForConnection}
                onDoubleClick={handleNodeDoubleClick}
                onLabelChange={handleLabelChange}
                onStopEditing={handleStopEditing}
                onContextMenu={(e) => onNodeContextMenu(e, node.id)}
                onLinkClick={onLinkClick}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
};
