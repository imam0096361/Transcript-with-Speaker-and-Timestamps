import React, { useRef, useEffect } from 'react';

interface AudioVisualizerProps {
  analyserNode: AnalyserNode | null;
  isRecording: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ analyserNode, isRecording }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserNode) return;

    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
      if (!isRecording) {
        // Clear canvas when not recording
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      animationFrameRef.current = requestAnimationFrame(draw);
      
      analyserNode.getByteTimeDomainData(dataArray);

      canvasCtx.fillStyle = 'rgb(248 250 252 / 0)'; // Transparent background
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      canvasCtx.lineWidth = 2;
      
      // Create a gradient for the line
      const gradient = canvasCtx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, '#60a5fa'); // light blue (Tailwind blue-400)
      gradient.addColorStop(0.5, '#3b82f6'); // blue (Tailwind blue-500)
      gradient.addColorStop(1, '#60a5fa'); // light blue (Tailwind blue-400)
      canvasCtx.strokeStyle = gradient;

      canvasCtx.beginPath();

      const sliceWidth = (canvas.width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      canvasCtx.lineTo(canvas.width, canvas.height / 2);
      canvasCtx.stroke();
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Ensure canvas is cleared on component unmount or props change
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [analyserNode, isRecording]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
};