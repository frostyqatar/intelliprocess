
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Project, Node, Edge, ShapeType, Position } from './types';
import { ProjectPanel } from './components/ProjectPanel';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { Chatbot } from './components/Chatbot';
import { ContextMenu } from './components/ContextMenu';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useAutoBackup } from './hooks/useAutoBackup';
import { exportToPng, exportToJson, exportToText } from './services/exportService';
import { generateDiagramFromPrompt } from './services/geminiService';
import { autoLayout } from './services/layoutService';
import { initialProjects } from './constants';
import { Focus } from './components/icons';

type ContextMenuData = {
  x: number;
  y: number;
  targetId: string;
  targetType: 'node' | 'edge';
};

export default function App() {
  const [projects, setProjects] = useLocalStorage<Project[]>('projects', initialProjects);
  const [activeProjectId, setActiveProjectId] = useLocalStorage<string | null>('activeProjectId', 'proj-1');
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useLocalStorage<string | null>('gemini-api-key', null);

  // Panning state lifted from Canvas
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<SVGSVGElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  
  useAutoBackup(projects);

  const activeProject = projects.find(p => p.id === activeProjectId);

  const updateProject = useCallback((updatedProject: Project) => {
    setProjects(prevProjects =>
      prevProjects.map(p => (p.id === updatedProject.id ? updatedProject : p))
    );
  }, [setProjects]);

  const addProject = () => {
    const id = `proj-${Date.now()}`;
    const newProject: Project = {
      id,
      name: `New Project ${projects.length + 1}`,
      nodes: [],
      edges: [],
    };
    setProjects(prev => [...prev, newProject]);
    setActiveProjectId(id);
  };

  const deleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (activeProjectId === id) {
      setActiveProjectId(projects.length > 1 ? projects[0].id : null);
    }
  };

  const renameProject = (id: string, newName: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name: newName.trim() || "Untitled Project" } : p));
  };

  const handleExport = (type: 'png' | 'json' | 'text') => {
    if (!activeProject) return;
    switch (type) {
      case 'png':
        if (canvasContainerRef.current) exportToPng(canvasContainerRef.current, activeProject.name);
        break;
      case 'json':
        exportToJson(activeProject, `${activeProject.name}.json`);
        break;
      case 'text':
        exportToText(activeProject, `${activeProject.name}.txt`);
        break;
    }
  };

  const handleExportAllProjects = () => {
    exportToJson(projects, 'all-projects-backup.json');
  };

  const handleImportProjects = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const data = JSON.parse(text);
        let projectsToImport: Project[];

        if (Array.isArray(data)) {
          projectsToImport = data;
        } else if (typeof data === 'object' && data !== null && 'id' in data && 'nodes' in data) {
          projectsToImport = [data];
        } else {
          alert('Invalid JSON file format. Expected a single project object or an array of projects.');
          return;
        }

        if (!projectsToImport.every(p => p.id && p.name && Array.isArray(p.nodes) && Array.isArray(p.edges))) {
          alert('JSON data is missing required project properties (id, name, nodes, edges).');
          return;
        }

        const existingIds = new Set(projects.map(p => p.id));
        const sanitizedProjects = projectsToImport.map(p => {
          if (existingIds.has(p.id)) {
            const newId = `${p.id}-${Date.now()}`;
            console.warn(`Project ID conflict: '${p.id}' already exists. Renaming to '${newId}'.`);
            return { ...p, id: newId };
          }
          return p;
        });

        setProjects(prev => [...prev, ...sanitizedProjects]);
        if (sanitizedProjects.length > 0) {
          setActiveProjectId(sanitizedProjects[0].id);
        }
        alert(`Successfully imported ${sanitizedProjects.length} project(s).`);
      } catch (error) {
        alert('Failed to parse JSON file. Please ensure it is valid.');
        console.error("JSON Import Error:", error);
      }
    };
    reader.readAsText(file);
  };


  const handleAiGenerate = async (prompt: string): Promise<string> => {
    if (!activeProject) return "Please select a project first.";
    if (!apiKey) return "Please set your Gemini API key in the chat window first.";
    
    try {
      const { nodes, edges } = await generateDiagramFromPrompt(prompt, apiKey);
      const { newNodes, newEdges } = autoLayout(nodes, edges, 'horizontal');
      updateProject({ ...activeProject, nodes: newNodes, edges: newEdges });
      return `Diagram updated successfully based on your request. ${nodes.length} nodes and ${edges.length} edges were created and automatically arranged.`;
    } catch (error) {
      console.error("AI Generation Error:", error);
      return `Sorry, I encountered an error. ${error instanceof Error ? error.message : 'Please try again.'}`;
    }
  };

  const handleAutoLayout = (orientation: 'horizontal' | 'vertical') => {
    if (!activeProject) return;
    const { nodes, edges } = activeProject;
    const { newNodes, newEdges } = autoLayout(nodes, edges, orientation);
    updateProject({ ...activeProject, nodes: newNodes, edges: newEdges });
  };
  
  const handleRecenter = () => {
    if (!activeProject || activeProject.nodes.length === 0 || !canvasContainerRef.current) return;

    const nodes = activeProject.nodes;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(node => {
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + node.width);
        maxY = Math.max(maxY, node.position.y + node.height);
    });

    const diagramWidth = maxX - minX;
    const diagramHeight = maxY - minY;
    const diagramCenterX = minX + diagramWidth / 2;
    const diagramCenterY = minY + diagramHeight / 2;

    const { clientWidth, clientHeight } = canvasContainerRef.current;
    const viewportCenterX = clientWidth / 2;
    const viewportCenterY = clientHeight / 2;

    const newPan = {
        x: viewportCenterX - diagramCenterX,
        y: viewportCenterY - diagramCenterY
    };

    setPan(newPan);
  };


  const handleNodeContextMenu = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, targetId: nodeId, targetType: 'node' });
  };

  const handleEdgeContextMenu = (e: React.MouseEvent, edgeId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, targetId: edgeId, targetType: 'edge' });
  };
  
  const closeContextMenu = () => setContextMenu(null);

  const handleRenameItem = () => {
    if (!contextMenu) return;

    if (contextMenu.targetType === 'node') {
      setEditingEdgeId(null);
      setEditingNodeId(contextMenu.targetId);
    } else { // 'edge'
      setEditingNodeId(null);
      setEditingEdgeId(contextMenu.targetId);
    }
    closeContextMenu();
  };

  return (
    <div className="flex h-screen w-screen bg-gray-900 text-white font-sans antialiased overflow-hidden" onClick={closeContextMenu}>
      <ProjectPanel
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={setActiveProjectId}
        onAddProject={addProject}
        onDeleteProject={deleteProject}
        onRenameProject={renameProject}
        onExport={handleExport}
        onExportAll={handleExportAllProjects}
        onImport={handleImportProjects}
      />
      <div className="flex-1 flex flex-col">
        <Toolbar onAutoLayout={handleAutoLayout} />
        <main className="flex-1 bg-gray-800 relative" id="canvas-container">
          {activeProject ? (
            <>
              <Canvas
                project={activeProject}
                updateProject={updateProject}
                canvasRef={canvasRef}
                containerRef={canvasContainerRef}
                onNodeContextMenu={handleNodeContextMenu}
                onEdgeContextMenu={handleEdgeContextMenu}
                closeContextMenu={closeContextMenu}
                editingNodeId={editingNodeId}
                setEditingNodeId={setEditingNodeId}
                editingEdgeId={editingEdgeId}
                setEditingEdgeId={setEditingEdgeId}
                pan={pan}
                setPan={setPan}
                isPanning={isPanning}
                setIsPanning={setIsPanning}
                startPan={startPan}
                setStartPan={setStartPan}
              />
              <button 
                onClick={handleRecenter}
                className="absolute bottom-4 left-4 bg-gray-700 hover:bg-gray-600 text-gray-200 p-3 rounded-full shadow-lg transition"
                title="Recenter Diagram"
              >
                <Focus size={20} />
              </button>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <p>Select a project or create a new one to start mapping.</p>
            </div>
          )}
        </main>
      </div>
      <Chatbot 
        isOpen={isChatbotOpen} 
        setIsOpen={setIsChatbotOpen} 
        onSend={handleAiGenerate}
        apiKey={apiKey}
        setApiKey={setApiKey}
      />
      {contextMenu && activeProject && <ContextMenu {...contextMenu} project={activeProject} updateProject={updateProject} onClose={closeContextMenu} onRename={handleRenameItem} />}
    </div>
  );
}
