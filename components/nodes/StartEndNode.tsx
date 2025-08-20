
import React from 'react';
import { Node, Project } from '../../types';
import NodeWrapper from './NodeWrapper';

interface NodeProps {
  node: Node;
  projects: Project[];
  isSelected: boolean;
  isEditing: boolean;
  onMouseDown: (id: string, e: React.MouseEvent) => void;
  onConnectorMouseDown: (id: string, connectorIndex: number, e: React.MouseEvent) => void;
  onNodeMouseUp: (id: string, e: React.MouseEvent) => void;
  onDoubleClick: (id: string) => void;
  onLabelChange: (id: string, label: string) => void;
  onStopEditing: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onLinkClick: (projectId: string) => void;
}

const StartEndNode: React.FC<NodeProps> = (props) => {
  const { node } = props;
  return (
    <NodeWrapper {...props}>
      <rect
        x="0"
        y="0"
        width={node.width}
        height={node.height}
        rx={node.height / 2}
        ry={node.height / 2}
        className="fill-green-700 stroke-green-400"
        strokeWidth="2"
      />
    </NodeWrapper>
  );
};

export default StartEndNode;
