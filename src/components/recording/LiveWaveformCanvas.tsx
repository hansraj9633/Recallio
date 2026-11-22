import React, { useEffect, useRef } from 'react';
import type { RecorderStatus } from '../../hooks/useRecorder';

interface LiveWaveformCanvasProps {
  analyser: AnalyserNode | null;
  status: RecorderStatus;
}

export const LiveWaveformCanvas: React.FC<LiveWaveformCanvasProps> = ({ analyser, status }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number | null = null;
    const barCount = 48;
    const history = new Array<number>(barCount).fill(0.08);
    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

    const renderFrame = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      if (status === 'recording' && analyser && dataArray) {
        analyser.getByteTimeDomainData(dataArray);
        let peak = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = Math.abs(dataArray[i] - 128) / 128;
          if (v > peak) peak = v;
        }
        history.shift();
        history.push(Math.max(0.08, Math.min(1, peak * 2.2)));
      }

      const isDark = document.documentElement.classList.contains('dark');
      const activeColor = status === 'recording' ? '#DC2626' : '#6366F1';
      const idleColor = isDark ? '#334155' : '#CBD5E1';

      const gap = 4;
      const barWidth = Math.max(3, (width - gap * (barCount - 1)) / barCount);

      for (let i = 0; i < barCount; i++) {
        const amp = status === 'idle' ? 0.12 : history[i];
        const barHeight = Math.max(6, amp * (height - 16));
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;

        ctx.fillStyle = status === 'recording' && i > barCount - 12 ? activeColor : status === 'paused' ? '#D97706' : status === 'recording' ? '#4F46E5' : idleColor;
        ctx.beginPath();
        const radius = Math.min(barWidth / 2, barHeight / 2);
        ctx.roundRect(x, y, barWidth, barHeight, radius);
        ctx.fill();
      }

      ctx.restore();
      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [analyser, status]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-32 sm:h-40 block"
      aria-label="Live microphone waveform"
    />
  );
};
