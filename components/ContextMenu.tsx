
import React, { useState } from 'react';
import { Project } from '../types';
import { Edit, Trash2, Link, MinusCircle } from './icons';

interface ContextMenuProps {
  x: number;
  y: number;
  targetId: string;
  targetType: 'node' | 'edge';
  project: Project;
  projects: Project[];
  updateProject: (project: Project) => void;
  onClose: () => void;
  onRename: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, targetId, targetType, project, projects, updateProject, onClose, onRename }) => {
  const [showProjectList, setShowProjectList] = useState(false);

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

  const handleLink = (linkedProjectId: string | null) => {
    const newNodes = project.nodes.map(n => {
        if (n.id === targetId) {
            if (linkedProjectId) {
                return { ...n, linkedProjectId };
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { linkedProjectId: _, ...rest } = n; // Remove property
            return rest;
        }
        return n;
    });
    updateProject({ ...project, nodes: newNodes });
    onClose();
  };
  
  const targetNode = targetType === 'node' ? project.nodes.find(n => n.id === targetId) : null;
  const otherProjects = projects.filter(p => p.id !== project.id);


  if (targetType === 'node' && showProjectList) {
    return (
       <div
          style={{ top: y, left: x }}
          className="absolute z-50 bg-gray-800 border border-gray-700 rounded-md shadow-lg py-1 w-48 max-h-60 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
            <ul>
                {targetNode?.linkedProjectId && (
                    <li key="unlink">
                        <button onClick={() => handleLink(null)} className="w-full flex items-center px-3 py-2 text-sm text-red-400 hover:bg-red-800 hover:text-white">
                            <span className="mr-3"><MinusCircle size={16} /></span> Unlink Project
                        </button>
                    </li>
                )}
                 {otherProjects.map(p => (
                    <li key={p.id}>
                        <button onClick={() => handleLink(p.id)} className="w-full flex items-center px-3 py-2 text-sm text-gray-200 hover:bg-indigo-600 truncate">
                             <span className="mr-3 invisible"><Link size={16} /></span>
                            {p.name}
                        </button>
                    </li>
                 ))}
                 {otherProjects.length === 0 && (
                     <li className="px-3 py-2 text-sm text-gray-400">No other projects to link.</li>
                 )}
            </ul>
       </div>
    );
  }


  const menuItems = {
    node: [
      { label: 'Rename', icon: <Edit size={16} />, action: onRename },
      { label: 'Link to Project', icon: <Link size={16} />, action: () => setShowProjectList(true) },
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
      className="absolute z-50 bg-gray-800 border border-gray-700 rounded-md shadow-lg py-1 w-48"
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
