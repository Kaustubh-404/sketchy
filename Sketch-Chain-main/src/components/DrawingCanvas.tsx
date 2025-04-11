
// src/components/DrawingCanvas.tsx
import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';

interface Point {
  x: number;
  y: number;
}

interface Line {
  start: Point;
  end: Point;
}

interface DrawData {
  lines: Line[];
}

interface SocketProps {
  on: (event: string, callback: (data: DrawData) => void) => void;
  emit: (event: string, data: DrawData) => void;
}

export const DrawingCanvas = ({ socket }: { socket: SocketProps }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPoint, setLastPoint] = useState<Point | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 400 });
  const { isDrawing: canDraw, roundActive } = useGameStore();

  // Resize canvas based on container size
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const container = containerRef.current;
        const width = container.clientWidth;
        // Maintain 3:2 aspect ratio
        const height = width * (2/3);
        setCanvasSize({ width, height });
      }
    };

    window.addEventListener('resize', handleResize);
    // Initial size setting
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.strokeStyle = '#000000';
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    // Listen for drawing updates from other players
    if (socket) {
      socket.on('drawUpdate', (data: DrawData) => {
        const drawData = data.lines;
        drawFromData(drawData);
      });
    }
  }, [socket]);

  // Set up touch events with non-passive listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Touch event handlers
    const handleTouchStart = (e: TouchEvent) => {
      if (!canDraw) return;
      e.preventDefault(); // Prevent scrolling while drawing

      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (touch.clientX - rect.left) * scaleX;
      const y = (touch.clientY - rect.top) * scaleY;

      setIsDrawing(true);
      setLastPoint({ x, y });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDrawing || !canDraw || !lastPoint || !socket) return;
      e.preventDefault(); // Prevent scrolling while drawing

      const context = canvas.getContext('2d');
      if (!context) return;

      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (touch.clientX - rect.left) * scaleX;
      const y = (touch.clientY - rect.top) * scaleY;

      context.beginPath();
      context.moveTo(lastPoint.x, lastPoint.y);
      context.lineTo(x, y);
      context.stroke();

      // Emit drawing data
      socket.emit('draw', {
        lines: [{
          start: lastPoint,
          end: { x, y }
        }]
      });

      setLastPoint({ x, y });
    };

    const handleTouchEnd = () => {
      setIsDrawing(false);
      setLastPoint(null);
    };

    // Add event listeners with { passive: false }
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    // Clean up event listeners
    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [canDraw, isDrawing, lastPoint, socket]);

  // Effect to clear canvas when round ends
  useEffect(() => {
    if (!roundActive) {
      clearCanvas();
    }
  }, [roundActive]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const drawFromData = (lines: Line[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    lines.forEach(line => {
      context.beginPath();
      context.moveTo(line.start.x, line.start.y);
      context.lineTo(line.end.x, line.end.y);
      context.stroke();
    });
  };

  // Helper function to get precise cursor position
  const getCursorPosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;

    const { x, y } = getCursorPosition(e);
    setIsDrawing(true);
    setLastPoint({ x, y });
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canDraw || !lastPoint || !socket) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const { x, y } = getCursorPosition(e);

    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(x, y);
    context.stroke();

    // Emit drawing data
    socket.emit('draw', {
      lines: [{
        start: lastPoint,
        end: { x, y }
      }]
    });

    setLastPoint({ x, y });
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    setLastPoint(null);
  };

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="border border-white/20 rounded-lg bg-white shadow-lg touch-none"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        
      />
    </div>
  );
};