"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Finger, stylus or mouse signature. The PNG is kept in React state and
// submitted through a hidden input, so it survives the form re-rendering
// after a failed submit.
export function SignaturePad({ name, label, error, defaultValue }: { name: string; label: string; error?: string; defaultValue?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [value, setValue] = useState(defaultValue ?? "");

  const prepare = useCallback((canvas: HTMLCanvasElement) => {
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#13262a";
    return { ctx, width, height };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { ctx, width, height } = prepare(canvas);
    // Resizing the canvas clears it, so redraw whatever has been signed.
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, width, height);
      img.src = value;
    }
    // Only on mount: later redraws would fight with the live stroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepare]);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    canvasRef.current!.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
    save();
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    save();
  }

  function save() {
    setValue(canvasRef.current!.toDataURL("image/png"));
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    save();
  }

  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setValue("");
  }

  return (
    <div className="field">
      <span className="label" id={`${name}-label`}>
        {label} <span className="text-danger" aria-hidden="true">*</span>
      </span>
      <span className="hint">Sign with your finger in the box below.</span>
      <span id={`${name}-error`} className="error-text" role={error ? "alert" : undefined}>{error}</span>
      <canvas
        ref={canvasRef}
        role="img"
        aria-labelledby={`${name}-label`}
        aria-describedby={error ? `${name}-error` : undefined}
        className={`h-44 w-full touch-none rounded-xl border-2 bg-white ${error ? "border-danger" : "border-[#8fa5a8]"}`}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
      />
      <input type="hidden" name={name} value={value} readOnly />
      <div className="flex items-center gap-4">
        <button type="button" className="btn btn-secondary" onClick={clear}>Clear signature</button>
        <span aria-live="polite" className="hint">{value ? "Signature captured." : ""}</span>
      </div>
    </div>
  );
}
