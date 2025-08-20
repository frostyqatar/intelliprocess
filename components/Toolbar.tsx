
import React, { useState, useRef, useEffect } from 'react';
import { ShapeType } from '../types';
import { Square, Diamond, Circle, LayoutGrid, ChevronDown, Mail } from './icons';

const DraggableShape: React.FC<{ type: ShapeType; children: React.ReactNode; label: string }> = ({ type, children, label }) => {
  const onDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('application/reactflow', type);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex flex-col items-center p-2 text-gray-300 hover:bg-gray-600 rounded-lg cursor-grab transition duration-200"
      title={`Drag to add ${label}`}
    >
      {children}
      <span className="text-xs mt-1">{label}</span>
    </div>
  );
};

interface ToolbarProps {
  onAutoLayout: (orientation: 'horizontal' | 'vertical') => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onAutoLayout }) => {
  const [isLayoutOpen, setIsLayoutOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsLayoutOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4 shadow-md z-10">
      <div className="flex space-x-4">
        <DraggableShape type={ShapeType.Start} label="Start">
          <Circle className="text-green-400" />
        </DraggableShape>
        <DraggableShape type={ShapeType.Process} label="Process">
          <Square className="text-sky-400" />
        </DraggableShape>
        <DraggableShape type={ShapeType.Decision} label="Decision">
          <Diamond className="text-[#2661bf]" />
        </DraggableShape>
        <DraggableShape type={ShapeType.Email} label="Email">
          <Mail className="text-purple-400" />
        </DraggableShape>
        <DraggableShape type={ShapeType.End} label="End">
          <Circle className="text-amber-400" />
        </DraggableShape>
      </div>
      <div className="relative" ref={dropdownRef}>
        <button 
          onClick={() => setIsLayoutOpen(prev => !prev)}
          className="flex items-center p-2 text-gray-300 hover:bg-gray-600 rounded-lg transition duration-200"
          title="Auto Layout Options"
        >
          <LayoutGrid className="text-indigo-400" />
          <span className="text-sm ml-2 font-medium">Auto Layout</span>
          <ChevronDown className={`ml-1 transition-transform ${isLayoutOpen ? 'rotate-180' : ''}`} />
        </button>
        {isLayoutOpen && (
          <div className="absolute right-0 mt-2 w-40 bg-gray-700 border border-gray-600 rounded-md shadow-lg z-20 py-1">
            <button
              onClick={() => { onAutoLayout('horizontal'); setIsLayoutOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-indigo-600"
            >
              Horizontal
            </button>
            <button
              onClick={() => { onAutoLayout('vertical'); setIsLayoutOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-indigo-600"
            >
              Vertical
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
