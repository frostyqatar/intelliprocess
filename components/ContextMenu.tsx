
import React from 'react';
import { Project } from '../types';
import { Edit, Trash2 } from './icons';

interface ContextMenuProps {
  x: number;
  y: number;
  targetId: string;
  targetType: 'node' | 'edge';
  project: Project;
  updateProject: (project: Project) => void;
  onClose: () => void;
  onRename: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, targetId, targetType, project, updateProject, onClose, onRename }) => {
  const handleDelete = () => {
    if (targetType === 'node') {
      const newNodes = project.nodes.filter(n => n.id !== targetId);
      const newEdges = project.edges.filter(edge => edge.source !== targetId && edge.target !== targetId);
      updateProject({ ...project, nodes: newNodes, edges: newEdges });
    } else { // 'edge'
      const newEdges = project.edges.filter(e => e.id !== targetId);
      updateProject({ ...project, edges: newEdges });
    }
    onClose();
  };

  const menuItems = {
    node: [
      { label: 'Rename', icon: <Edit size={16} />, action: onRename },
      { label: 'Delete', icon: <Trash2 size={16} />, action: handleDelete },
    ],
    edge: [
      { label: 'Edit Label', icon: <Edit size={16} />, action: onRename },
      { label: 'Delete', icon: <Trash2 size={16} />, action: handleDelete },
    ],
  };

  const items = menuItems[targetType];

  return (
    <div
      style={{ top: y, left: x }}
      className="absolute z-50 bg-gray-800 border border-gray-700 rounded-md shadow-lg py-1 w-40"
      onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
    >
      <ul>
        {items.map((item) => (
          <li key={item.label}>
            <button
              onClick={item.action}
              className="w-full flex items-center px-3 py-2 text-sm text-gray-200 hover:bg-indigo-600"
            >
              <span className="mr-3">{item.icon}</span>
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
