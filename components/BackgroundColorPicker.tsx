import React, { useState, useRef, useEffect } from 'react';
import { Palette } from './icons';

interface BackgroundColorPickerProps {
  backgroundColor: string;
  onBackgroundColorChange: (color: string) => void;
}

export const BackgroundColorPicker: React.FC<BackgroundColorPickerProps> = ({
  backgroundColor,
  onBackgroundColorChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customColor, setCustomColor] = useState('#1f2937');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const presetColors = [
    { name: 'Dark Gray (Default)', value: '#1f2937' },
    { name: 'Transparent', value: 'transparent' },
    { name: 'White', value: '#ffffff' },
    { name: 'Light Gray', value: '#f3f4f6' },
    { name: 'Black', value: '#000000' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#10b981' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Yellow', value: '#f59e0b' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Indigo', value: '#6366f1' },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleColorSelect = (color: string) => {
    onBackgroundColorChange(color);
    setIsOpen(false);
  };

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setCustomColor(color);
    onBackgroundColorChange(color);
  };

  const getDisplayColor = () => {
    if (backgroundColor === 'transparent') {
      return '#ffffff';
    }
    return backgroundColor;
  };

  const getBackgroundStyle = () => {
    if (backgroundColor === 'transparent') {
      return {
        background: `repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 8px 8px`,
        border: '2px solid #6366f1'
      };
    }
    return { backgroundColor: backgroundColor };
  };

  return (
    <div className="relative z-40" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center p-2 text-gray-300 hover:bg-gray-600 rounded-lg transition duration-200"
        title="Background Color"
      >
        <Palette className="text-indigo-400" />
        <span className="text-sm ml-2 font-medium">Background</span>
        <div 
          className="w-4 h-4 ml-2 rounded border border-gray-400"
          style={getBackgroundStyle()}
        />
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-gray-700 border border-gray-600 rounded-md shadow-lg z-50 p-4">
          <div className="mb-3">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Background Color</h4>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {presetColors.map((color) => (
                <button
                  key={color.value}
                  onClick={() => handleColorSelect(color.value)}
                  className={`w-12 h-8 rounded border-2 transition ${
                    backgroundColor === color.value ? 'border-indigo-400' : 'border-gray-500'
                  } hover:border-indigo-300`}
                  style={
                    color.value === 'transparent'
                      ? {
                          background: `repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 8px 8px`
                        }
                      : { backgroundColor: color.value }
                  }
                  title={color.name}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Custom Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={customColor}
                onChange={handleCustomColorChange}
                className="w-12 h-8 rounded border border-gray-500 bg-transparent cursor-pointer"
              />
              <input
                type="text"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                onBlur={(e) => onBackgroundColorChange(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-500 rounded px-2 py-1 text-sm text-white"
                placeholder="#ffffff"
              />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-600">
            <div className="text-xs text-gray-400">Preview:</div>
            <div 
              className="w-full h-8 mt-1 rounded border border-gray-500"
              style={getBackgroundStyle()}
            />
          </div>
        </div>
      )}
    </div>
  );
};