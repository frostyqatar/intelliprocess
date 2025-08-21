
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Project, Node, Edge, ShapeType, Position } from './types';
import { ProjectPanel } from './components/ProjectPanel';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { Chatbot } from './components/Chatbot';
import { ContextMenu } from './components/ContextMenu';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useAutoBackup } from './hooks/useAutoBackup';
import { exportToPng, exportToJson, exportToText, exportToPdf, exportToVisio } from './services/exportService';
import { generateDiagramFromPrompt } from './services/geminiService';
import { autoLayout } from './services/layoutService';
import { initialProjects } from './constants';
import { Focus, ZoomIn, ZoomOut, Hand, MousePointer } from './components/icons';

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
  const [mode, setMode] = useState<'grab' | 'select'>('grab');

  // File System Access-based working database file
  const dbFileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const [dbFileName, setDbFileName] = useState<string | undefined>(undefined);
  const autosaveIntervalRef = useRef<number | null>(null);

  // Undo stack
  const undoStackRef = useRef<Project[][]>([]);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<SVGSVGElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  
  useAutoBackup(projects);

  const activeProject = projects.find(p => p.id === activeProjectId);

  const updateProject = useCallback((updatedProject: Project) => {
    // Push current state to undo stack before changing
    undoStackRef.current.push(projects);
    setProjects(prevProjects =>
      prevProjects.map(p => (p.id === updatedProject.id ? updatedProject : p))
    );
  }, [setProjects]);

  const addProject = () => {
    undoStackRef.current.push(projects);
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
    if (window.confirm(`Are you sure you want to delete this project? This action cannot be undone.`)) {
        undoStackRef.current.push(projects);
        setProjects(prev => prev.filter(p => p.id !== id));
        if (activeProjectId === id) {
            setActiveProjectId(projects.length > 1 ? projects[0].id : null);
        }
    }
  };

  const renameProject = (id: string, newName: string) => {
    undoStackRef.current.push(projects);
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name: newName.trim() || "Untitled Project" } : p));
  };

  const handleExport = (type: 'png' | 'json' | 'text' | 'pdf' | 'visio') => {
    if (!activeProject) return;
    switch (type) {
      case 'png':
        if (canvasContainerRef.current) exportToPng(canvasContainerRef.current, activeProject.name);
        break;
      case 'pdf':
        if (canvasRef.current) exportToPdf(activeProject, canvasRef.current, `${activeProject.name}.pdf`);
        break;
      case 'visio':
        exportToVisio(activeProject, `${activeProject.name}.vdx`);
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

        undoStackRef.current.push(projects);
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
      handleRecenterAndZoom();
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
    undoStackRef.current.push(projects);
    updateProject({ ...activeProject, nodes: newNodes, edges: newEdges });
    // Use a timeout to ensure the DOM has updated before recentering
    setTimeout(handleRecenterAndZoom, 0);
  };
  
  const handleRecenterAndZoom = () => {
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

    if (diagramWidth === 0 || diagramHeight === 0) {
        setPan({x: 0, y: 0});
        setZoom(1);
        return;
    }

    const diagramCenterX = minX + diagramWidth / 2;
    const diagramCenterY = minY + diagramHeight / 2;

    const { clientWidth, clientHeight } = canvasContainerRef.current;
    const padding = 80;
    
    const zoomX = (clientWidth - padding * 2) / diagramWidth;
    const zoomY = (clientHeight - padding * 2) / diagramHeight;
    const newZoom = Math.min(zoomX, zoomY, 1.5);
    
    const newPan = {
        x: (clientWidth / 2) - (diagramCenterX * newZoom),
        y: (clientHeight / 2) - (diagramCenterY * newZoom)
    };

    setPan(newPan);
    setZoom(newZoom);
  };

  const handleZoom = (direction: 'in' | 'out') => {
      if (!canvasContainerRef.current) return;
      const { clientWidth, clientHeight } = canvasContainerRef.current;
      const zoomFactor = 1.2;
      const newZoom = direction === 'in' ? zoom * zoomFactor : zoom / zoomFactor;
      const clampedZoom = Math.max(0.2, Math.min(newZoom, 3));

      // Zoom towards the center of the viewport
      const viewportCenter = { x: clientWidth / 2, y: clientHeight / 2 };

      const worldPos = { x: (viewportCenter.x - pan.x) / zoom, y: (viewportCenter.y - pan.y) / zoom };
      const newPan = { x: viewportCenter.x - worldPos.x * clampedZoom, y: viewportCenter.y - worldPos.y * clampedZoom };
      
      setZoom(clampedZoom);
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

  // Ctrl+Z undo and Space to toggle mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isUndo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z';
      if (isUndo) {
        const prev = undoStackRef.current.pop();
        if (prev) {
          setProjects(prev);
          e.preventDefault();
        }
      }
      
      // Space to toggle between grab and select modes
      if (e.key === ' ' && !editingNodeId && !editingEdgeId) {
        e.preventDefault();
        setMode(prev => prev === 'grab' ? 'select' : 'grab');
      }
      
      // G key for grab mode, S key for select mode
      if (!editingNodeId && !editingEdgeId) {
        if (e.key.toLowerCase() === 'g') {
          e.preventDefault();
          setMode('grab');
        } else if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          setMode('select');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setProjects, editingNodeId, editingEdgeId]);

  // Database file selection and autosave every 10 minutes
  const handleSelectDatabaseFile = async () => {
    try {
      // File System Access API (supported in Chromium-based browsers)
      // @ts-ignore
      const handle: FileSystemFileHandle = await window.showSaveFilePicker({
        suggestedName: 'db_working.json',
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      });
      dbFileHandleRef.current = handle;
      setDbFileName(handle.name);

      // Write immediately to initialize
      const writable = await handle.createWritable();
      await writable.write(new Blob([JSON.stringify(projects, null, 2)], { type: 'application/json' }));
      await writable.close();

      // Clear existing interval and start a new 10-minute autosave
      if (autosaveIntervalRef.current) {
        window.clearInterval(autosaveIntervalRef.current);
      }
      autosaveIntervalRef.current = window.setInterval(async () => {
        try {
          if (!dbFileHandleRef.current) return;
          const w = await dbFileHandleRef.current.createWritable();
          await w.write(new Blob([JSON.stringify(projects, null, 2)], { type: 'application/json' }));
          await w.close();
          console.log('Autosaved database file');
        } catch (err) {
          console.error('Autosave failed:', err);
        }
      }, 10 * 60 * 1000);
      alert('Database file selected. Autosave enabled every 10 minutes.');
    } catch (err) {
      if ((err as any)?.name !== 'AbortError') {
        console.error('Selecting database file failed:', err);
        alert('Failed to select a database file.');
      }
    }
  };

  // When projects change and DB file is selected, optionally do a light-touch append/remove to "touch" file every 10 minutes cycle
  useEffect(() => {
    // If desired, we could write on every change; but that may be too frequent. We'll keep interval-based autosave.
  }, [projects]);

  useEffect(() => () => {
    if (autosaveIntervalRef.current) {
      window.clearInterval(autosaveIntervalRef.current);
    }
  }, []);

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
        onSelectDatabaseFile={handleSelectDatabaseFile}
        databaseFileName={dbFileName}
        databaseModeNote={'autosave every 10 min'}
      />
      <div className="flex-1 flex flex-col">
        <Toolbar onAutoLayout={handleAutoLayout} mode={mode} onModeChange={setMode} />
        <main className="flex-1 bg-gray-800 relative" id="canvas-container">
          {activeProject ? (
            <>
              <Canvas
                project={activeProject}
                projects={projects}
                updateProject={updateProject}
                canvasRef={canvasRef}
                containerRef={canvasContainerRef}
                onNodeContextMenu={handleNodeContextMenu}
                onEdgeContextMenu={handleEdgeContextMenu}
                onLinkClick={setActiveProjectId}
                closeContextMenu={closeContextMenu}
                editingNodeId={editingNodeId}
                setEditingNodeId={setEditingNodeId}
                editingEdgeId={editingEdgeId}
                setEditingEdgeId={setEditingEdgeId}
                pan={pan}
                setPan={setPan}
                zoom={zoom}
                setZoom={setZoom}
                isPanning={isPanning}
                setIsPanning={setIsPanning}
                startPan={startPan}
                setStartPan={setStartPan}
                mode={mode}
              />
              <div className="absolute bottom-4 left-4 flex flex-col items-start space-y-2">
                <div className="flex bg-gray-700 rounded-full shadow-lg p-1">
                    <button 
                        onClick={() => handleZoom('in')}
                        className="p-2 text-gray-200 hover:bg-gray-600 rounded-full"
                        title="Zoom In"
                    >
                        <ZoomIn size={20} />
                    </button>
                    <button 
                        onClick={() => handleZoom('out')}
                        className="p-2 text-gray-200 hover:bg-gray-600 rounded-full"
                        title="Zoom Out"
                    >
                        <ZoomOut size={20} />
                    </button>
                </div>
                <button 
                  onClick={handleRecenterAndZoom}
                  className="bg-gray-700 hover:bg-gray-600 text-gray-200 p-3 rounded-full shadow-lg transition"
                  title="Fit to View"
                >
                  <Focus size={20} />
                </button>
              </div>
              
              {/* Mode Status Indicator */}
              <div className="absolute top-4 right-4 bg-gray-700 rounded-lg shadow-lg px-3 py-2 z-10">
                <div className="flex items-center space-x-2">
                  {mode === 'grab' ? (
                    <>
                      <Hand size={16} className="text-indigo-400" />
                      <span className="text-sm text-gray-200">Grab Mode</span>
                      <span className="text-xs text-gray-400 ml-2">(G)</span>
                    </>
                  ) : (
                    <>
                      <MousePointer size={16} className="text-indigo-400" />
                      <span className="text-sm text-gray-200">Select Mode</span>
                      <span className="text-xs text-gray-400 ml-2">(S)</span>
                    </>
                  )}
                </div>
              </div>
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
      {contextMenu && activeProject && <ContextMenu {...contextMenu} project={activeProject} projects={projects} updateProject={updateProject} onClose={closeContextMenu} onRename={handleRenameItem} />}
    </div>
  );
}