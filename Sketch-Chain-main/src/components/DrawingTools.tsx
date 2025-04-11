

import { useState } from 'react';

interface DrawingSettings {
  color?: string;
  size?: number;
}

interface SocketProps {
  emit: (event: string, data?: DrawingSettings) => void;
}

interface DrawingToolsProps {
  socket: SocketProps;
}

export const DrawingTools = ({ socket }: DrawingToolsProps) => {
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(2);

  const colors = [
    '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
    '#ffff00', '#ff00ff', '#00ffff', '#ff9900', '#9900ff'
  ];

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    console.log('Changing color to:', color, 'Socket connected:', !!socket);
    if (socket) {
      socket.emit('updateDrawingSettings', { color });
      console.log('Color change event emitted');
    }
  };

  const handleSizeChange = (size: number) => {
    setBrushSize(size);
    if (socket) {
      socket.emit('updateDrawingSettings', { size });
    }
  };

  const clearCanvas = () => {
    if (socket) {
      socket.emit('clearCanvas');
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 sm:p-4 bg-white rounded-lg shadow">
      <div className="flex flex-wrap justify-center gap-2">
        {colors.map((color) => (
          <button
            key={color}
            className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 transition-transform hover:scale-110 ${
              selectedColor === color ? 'border-gray-900 scale-110' : 'border-gray-200'
            }`}
            style={{ backgroundColor: color }}
            onClick={() => handleColorChange(color)}
            aria-label={`Select ${color} color`}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        <label className="text-sm whitespace-nowrap">Size:</label>
        <input
          type="range"
          min="1"
          max="20"
          value={brushSize}
          onChange={(e) => handleSizeChange(Number(e.target.value))}
          className="w-24 sm:w-32"
        />
        <span className="text-xs bg-gray-100 px-2 py-1 rounded-md">{brushSize}</span>
      </div>

      <button
        onClick={clearCanvas}
        className="px-3 py-1 sm:px-4 sm:py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors w-full sm:w-auto"
        aria-label="Clear canvas"
      >
        Clear
      </button>
    </div>
  );
};