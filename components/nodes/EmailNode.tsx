import React from 'react';
import { Node } from '../../types';
import NodeWrapper from './NodeWrapper';
import { Mail } from '../icons';

interface NodeProps {
  node: Node;
  isSelected: boolean;
  isEditing: boolean;
  onMouseDown: (id: string, e: React.MouseEvent) => void;
  onConnectorMouseDown: (id: string, connectorIndex: number, e: React.MouseEvent) => void;
  onNodeMouseUp: (id: string, e: React.MouseEvent) => void;
  onDoubleClick: (id: string) => void;
  onLabelChange: (id: string, label: string) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const EmailNode: React.FC<NodeProps> = (props) => {
  const { node } = props;
  const iconSize = 32;

  return (
    <NodeWrapper {...props}>
      {/* Invisible rect to capture mouse events for the entire node area */}
      <rect
        x="0"
        y="0"
        width={node.width}
        height={node.height}
        fill="transparent"
      />
      <g
        transform={`translate(${(node.width - iconSize) / 2}, 10)`}
        className="fill-purple-300 stroke-purple-300"
        style={{ pointerEvents: 'none' }}
      >
        <Mail size={iconSize} strokeWidth={1.5} />
      </g>
    </NodeWrapper>
  );
};

export default EmailNode;