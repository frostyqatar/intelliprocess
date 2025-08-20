
import React, { useState, useRef } from 'react';
import { Project } from '../types';
import { FileDown, FileJson, FileText, Plus, Trash2, FileUp } from './icons';

interface ProjectPanelProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onAddProject: () => void;
  onDeleteProject: (id: string) => void;
  onRenameProject: (id: string, newName: string) => void;
  onExport: (type: 'png' | 'json' | 'text') => void;
  onExportAll: () => void;
  onImport: (file: File) => void;
}

export const ProjectPanel: React.FC<ProjectPanelProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onAddProject,
  onDeleteProject,
  onRenameProject,
  onExport,
  onExportAll,
  onImport,
}) => {
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const handleRenameStart = (project: Project) => {
    setEditingProjectId(project.id);
    setTempName(project.name);
  };

  const handleRenameSubmit = () => {
    if (editingProjectId && tempName.trim()) {
      onRenameProject(editingProjectId, tempName);
    }
    setEditingProjectId(null);
    setTempName('');
  };

  const handleImportClick = () => {
    importFileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImport(file);
      // Reset file input to allow importing the same file again
      event.target.value = '';
    }
  };


  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-700 flex flex-col p-4 shadow-lg">
      <h1 className="text-xl font-bold text-indigo-400 mb-4">IntelliProcess</h1>
      <button
        onClick={onAddProject}
        className="flex items-center justify-center w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg mb-4 transition duration-200"
      >
        <Plus className="mr-2" /> New Project
      </button>
      <nav className="flex-1 overflow-y-auto">
        <ul>
          {projects.map(project => (
            <li key={project.id} className="mb-2">
              {editingProjectId === project.id ? (
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onBlur={handleRenameSubmit}
                  onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
                  className="bg-gray-700 border border-indigo-500 text-white p-2 rounded w-full outline-none"
                  autoFocus
                  onFocus={(e) => e.target.select()}
                />
              ) : (
                <div
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition duration-200 ${
                    activeProjectId === project.id
                      ? 'bg-indigo-700 text-white'
                      : 'hover:bg-gray-700'
                  }`}
                   onClick={() => onSelectProject(project.id)}
                >
                  <span onDoubleClick={(e) => { e.stopPropagation(); handleRenameStart(project); }} className="flex-1 truncate">
                    {project.name}
                  </span>
                  <button
                    onClick={(e) => { 
                        e.stopPropagation();
                        onDeleteProject(project.id);
                    }}
                    className="ml-2 p-1 text-gray-400 hover:text-red-500 rounded-full"
                    aria-label="Delete project"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-auto space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-400 mb-2">Export Active Project</h2>
          <div className="space-y-2">
            <button onClick={() => onExport('png')} className="w-full flex items-center bg-gray-700 hover:bg-gray-600 text-sm font-medium py-2 px-3 rounded-md transition"><FileDown className="mr-2" size={16} /> Export as PNG</button>
            <button onClick={() => onExport('json')} className="w-full flex items-center bg-gray-700 hover:bg-gray-600 text-sm font-medium py-2 px-3 rounded-md transition"><FileJson className="mr-2" size={16} /> Export as JSON</button>
            <button onClick={() => onExport('text')} className="w-full flex items-center bg-gray-700 hover:bg-gray-600 text-sm font-medium py-2 px-3 rounded-md transition"><FileText className="mr-2" size={16} /> Export as Text</button>
          </div>
        </div>
        <div className="pt-4 border-t border-gray-700">
          <h2 className="text-sm font-semibold text-gray-400 mb-2">Global Actions</h2>
          <div className="space-y-2">
            <input type="file" ref={importFileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".json" />
            <button onClick={handleImportClick} className="w-full flex items-center bg-gray-700 hover:bg-gray-600 text-sm font-medium py-2 px-3 rounded-md transition">
                <FileUp className="mr-2" size={16} /> Import from JSON
            </button>
            <button onClick={onExportAll} className="w-full flex items-center bg-gray-700 hover:bg-gray-600 text-sm font-medium py-2 px-3 rounded-md transition">
                <FileJson className="mr-2" size={16} /> Export All as JSON
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
