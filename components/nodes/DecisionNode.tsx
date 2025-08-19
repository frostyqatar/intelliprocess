import React from 'react';
import { Node } from '../../types';
import NodeWrapper from './NodeWrapper';

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

const DecisionNode: React.FC<NodeProps> = (props) => {
  const { node } = props;
  const { width, height } = node;
  const points = `${width / 2},0 ${width},${height / 2} ${width / 2},${height} 0,${height / 2}`;

  return (
    <NodeWrapper {...props}>
      <polygon
        points={points}
        className="fill-[#2661bf] stroke-sky-400"
        strokeWidth="2"
      />
    </NodeWrapper>
  );
};

export default DecisionNode;