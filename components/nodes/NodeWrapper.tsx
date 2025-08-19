

import React, { useState, useEffect, useRef } from 'react';
import { Node, ShapeType } from '../../types';

interface NodeWrapperProps {
  node: Node;
  isSelected: boolean;
  isEditing: boolean;
  onMouseDown: (id: string, e: React.MouseEvent) => void;
  onConnectorMouseDown: (id: string, connectorIndex: number, e: React.MouseEvent) => void;
  onNodeMouseUp: (id: string, e: React.MouseEvent) => void;
  onDoubleClick: (id: string) => void;
  onLabelChange: (id: string, label: string) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}

const NodeWrapper: React.FC<NodeWrapperProps> = ({
  node,
  isSelected,
  isEditing,
  onMouseDown,
  onConnectorMouseDown,
  onNodeMouseUp,
  onDoubleClick,
  onLabelChange,
  onContextMenu,
  children,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [tempLabel, setTempLabel] = useState(node.label);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      setTempLabel(node.label);
      setTimeout(() => textAreaRef.current?.select(), 0);
    }
  }, [isEditing, node.label]);

  const handleLabelSubmit = () => {
    onLabelChange(node.id, tempLabel);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleLabelSubmit();
    } else if (e.key === 'Escape') {
      setTempLabel(node.label); // Revert changes
      onLabelChange(node.id, node.label); // This effectively just cancels editing
    }
  };

  const connectors = [
    { x: node.width / 2, y: 0 }, // Top (index 0)
    { x: node.width, y: node.height / 2 }, // Right (index 1)
    { x: node.width / 2, y: node.height }, // Bottom (index 2)
    { x: 0, y: node.height / 2 }, // Left (index 3)
  ];

  const isEmailNode = node.type === ShapeType.Email;
  const labelPadding = 8;
  const emailIconHeight = 45;

  const foreignObjectProps = {
      x: isEmailNode ? 0 : labelPadding,
      y: isEmailNode ? emailIconHeight : labelPadding,
      width: isEmailNode ? node.width : node.width - (labelPadding * 2),
      height: isEmailNode ? node.height - emailIconHeight - 5 : node.height - (labelPadding * 2),
  };

  return (
    <g
      transform={`translate(${node.position.x}, ${node.position.y})`}
      className="cursor-pointer"
      onMouseDown={(e) => onMouseDown(node.id, e)}
      onMouseUp={(e) => onNodeMouseUp(node.id, e)}
      onDoubleClick={() => onDoubleClick(node.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={onContextMenu}
    >
      {isSelected && <rect x="-5" y="-5" width={node.width + 10} height={node.height + 10} fill="none" stroke="#6366f1" strokeWidth="2" strokeDasharray="4" rx={node.type === ShapeType.Start || node.type === ShapeType.End ? (node.height+10)/2 : 12}/>}
      {children}

      {isEditing ? (
        <foreignObject {...foreignObjectProps}>
          {React.createElement(
            'div',
            {
              className: 'w-full h-full flex items-center justify-center',
            },
            <textarea
              ref={textAreaRef}
              value={tempLabel}
              onChange={(e) => setTempLabel(e.target.value)}
              onBlur={handleLabelSubmit}
              onKeyDown={handleKeyDown}
              className="bg-transparent text-white text-center w-full h-full outline-none p-0 resize-none overflow-y-hidden"
              style={{ fontFamily: 'sans-serif', fontSize: '14px' }}
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </foreignObject>
      ) : (
        <foreignObject {...foreignObjectProps} style={{ pointerEvents: 'none' }}>
            <div
                className="w-full h-full flex items-center justify-center text-center text-white font-medium text-sm leading-tight break-words"
            >
                {node.label}
            </div>
        </foreignObject>
      )}

      {(isHovered || isSelected) && node.type !== ShapeType.Email && connectors.map((pos, i) => (
        <circle
          key={i}
          cx={pos.x}
          cy={pos.y}
          r="6"
          className="fill-indigo-500 hover:fill-indigo-300 stroke-gray-900"
          strokeWidth="2"
          cursor="crosshair"
          onMouseDown={(e) => onConnectorMouseDown(node.id, i, e)}
        />
      ))}
    </g>
  );
};

export default NodeWrapper;