
import React, { useState, useEffect, useRef } from 'react';
import { Edge, Node, Position } from '../types';
import { getOrthogonalPath } from '../services/pathService';

interface EdgeProps {
  edge: Edge;
  sourceNode: Node;
  targetNode: Node;
  isEditing: boolean;
  onDoubleClick: (edgeId: string) => void;
  onLabelChange: (edgeId: string, label: string) => void;
  onStopEditing: () => void;
  onEdgeDragStart: (edgeId: string, handle: 'source' | 'target', e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export const EdgeComponent: React.FC<EdgeProps> = ({ edge, sourceNode, targetNode, isEditing, onDoubleClick, onLabelChange, onStopEditing, onEdgeDragStart, onContextMenu }) => {
  const [tempLabel, setTempLabel] = useState(edge.label || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<number | null>(null);
  const pressEvent = useRef<React.MouseEvent | null>(null);


  useEffect(() => {
    if (isEditing) {
        setTempLabel(edge.label || '');
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.setSelectionRange(0, inputRef.current.value.length);
          }
        }, 0);
    }
  }, [isEditing, edge.label]);

  const handleLabelChangeAndBlur = () => {
      onLabelChange(edge.id, tempLabel);
      onStopEditing();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleLabelChangeAndBlur();
      } else if (e.key === 'Escape') {
        onStopEditing();
      }
  };
  
  const { path, startPos, endPos, midPoint } = getOrthogonalPath(sourceNode, targetNode, edge);
  
  const handleMouseDown = (e: React.MouseEvent<SVGPathElement>) => {
    if (e.button === 2) {
        return; 
    }
    e.stopPropagation();
    pressEvent.current = e;
    longPressTimer.current = window.setTimeout(() => {
        if (pressEvent.current) {
            const svg = (pressEvent.current.target as SVGPathElement).ownerSVGElement;
            if (!svg) return;
        
            const pt = svg.createSVGPoint();
            pt.x = pressEvent.current.clientX;
            pt.y = pressEvent.current.clientY;
            const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
            
            const distSq = (p1: Position, p2: Position) => (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;

            const distToStart = distSq(svgP, startPos);
            const distToEnd = distSq(svgP, endPos);
            
            const handle: 'source' | 'target' = distToStart < distToEnd ? 'source' : 'target';
            onEdgeDragStart(edge.id, handle, pressEvent.current);
        }
    }, 300);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    pressEvent.current = null;
  };

  const handleMouseLeave = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    pressEvent.current = null;
  };

  return (
    <g 
      className="group text-gray-400 hover:text-indigo-400"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <path
        d={path}
        stroke="transparent"
        strokeWidth="20"
        fill="none"
        className="cursor-pointer"
        onMouseDown={handleMouseDown}
        onDoubleClick={() => onDoubleClick(edge.id)}
        onContextMenu={onContextMenu}
      />
      <path
        d={path}
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        markerEnd="url(#arrowhead)"
        className="transition-colors"
        style={{ pointerEvents: 'none' }}
      />
      {isEditing ? (
        <foreignObject x={midPoint.x - 50} y={midPoint.y - 18} width="100" height="36">
          {React.createElement(
            'div',
            {
              xmlns: 'http://www.w3.org/1999/xhtml',
              className: 'w-full h-full flex items-center justify-center',
            },
            <input
              ref={inputRef}
              type="text"
              value={tempLabel}
              onChange={(e) => setTempLabel(e.target.value)}
              onBlur={handleLabelChangeAndBlur}
              onKeyDown={handleKeyDown}
              className="bg-gray-900 text-white text-center w-full outline-none p-1 rounded border border-indigo-500"
              style={{ fontFamily: 'sans-serif', fontSize: '12px' }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          )}
        </foreignObject>
      ) : edge.label && (
        <text
          x={midPoint.x}
          y={midPoint.y - 12}
          textAnchor="middle"
          fill="currentColor"
          className="text-xs font-semibold select-none"
          style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: '#1f2937', strokeWidth: '4px', strokeLinecap: 'butt', strokeLinejoin: 'miter' }}
        >
          {edge.label}
        </text>
      )}
    </g>
  );
};
