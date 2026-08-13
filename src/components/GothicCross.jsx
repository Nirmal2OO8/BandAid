import { useEffect, useRef, useState } from "react";

export default function GothicCross({ size = 200, color = "#8B0015" }) {
  const canvasRef = useRef(null);
  const [imgSrc, setImgSrc] = useState(null);

  useEffect(() => {
    // Load image via IPC so it resolves correctly in both dev and production
    if (window.api?.getCrossImage) {
      window.api.getCrossImage().then((src) => {
        if (src) setImgSrc(src);
      });
    } else {
      // Fallback for dev when running outside Electron
      setImgSrc("/gothic-cross-pixel.png");
    }
  }, []);

  useEffect(() => {
    if (!imgSrc) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame;
    const img = new Image();
    img.src = imgSrc;

    img.onload = () => {
      const draw = () => {
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        const cx = width / 2;
        const cy = height / 2;
        const flicker = 0.86 + Math.sin(Date.now() * 0.007) * 0.08;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.globalAlpha = flicker;

        // Fake thickness / extrusion
        const depth = 10;
        for (let i = depth; i > 0; i -= 1) {
          ctx.save();
          ctx.globalAlpha = flicker * (0.08 + i * 0.02);
          ctx.shadowColor = "#000000";
          ctx.shadowBlur = 0;
          ctx.drawImage(img, -size / 2 + i, -size / 2 + i * 0.12, size, size);
          ctx.restore();
        }

        // Main glow pass
        ctx.shadowColor = color;
        ctx.shadowBlur = 30;
        ctx.drawImage(img, -size / 2, -size / 2, size, size);

        // Inner glow pass
        ctx.shadowBlur = 12;
        ctx.drawImage(img, -size / 2, -size / 2, size, size);

        ctx.restore();

        // Scanlines
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        for (let y = 0; y < height; y += 2) {
          ctx.fillRect(0, y, width, 1);
        }

        // Occasional glitch streak
        if (Math.random() > 0.94) {
          ctx.fillStyle = "rgba(139,0,21,0.10)";
          ctx.fillRect(0, Math.random() * height, width, 2);
        }

        frame = requestAnimationFrame(draw);
      };

      draw();
    };

    img.onerror = () => {
      console.warn("GothicCross: failed to load image from", imgSrc);
    };

    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  }, [imgSrc, size, color]);

  return (
    <div className="cross-3d-wrapper">
      <canvas
        ref={canvasRef}
        width={size + 60}
        height={size + 60}
        className="cross-canvas"
      />
    </div>
  );
}
