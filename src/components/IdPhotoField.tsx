"use client";

import { useState } from "react";

const MAX_SIDE = 1400;

// Resizes the photo on the tablet so a phone camera's 10MB image becomes a
// few hundred KB before it is uploaded and encrypted.
// The file is read as a data: URL because the Content Security Policy only
// allows images from the app itself and data: URLs (no blob:).
async function toJpeg(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

export function IdPhotoField({ name, onFile, error }: { name: string; onFile?: string; error?: string }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const shown = value || onFile;

  return (
    <div className="field">
      <span className="label">Photo of ID document <span className="font-normal text-muted">(optional)</span></span>
      <span className="hint" id={`${name}-hint`}>{onFile && !value ? "A photo is already on file. Take a new one to replace it." : "Instead of typing the details, or as well."}</span>
      {(error || problem) && <span id={`${name}-error`} className="error-text">{error || problem}</span>}
      <input type="hidden" name={name} value={value} readOnly />
      {shown && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shown} alt="Photo of the patient's ID document" className="max-h-56 w-auto self-start rounded-lg border border-line bg-white" />
      )}
      <div className="flex flex-wrap gap-3">
        <label className="btn btn-secondary cursor-pointer">
          {busy ? "Processing…" : shown ? "Take a new photo" : "Take photo of ID"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            aria-describedby={`${name}-hint`}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setBusy(true);
              setProblem("");
              try {
                setValue(await toJpeg(file));
              } catch {
                setProblem("That photo couldn't be read. Please try again.");
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        {value && <button type="button" className="btn btn-secondary" onClick={() => setValue("")}>Remove new photo</button>}
      </div>
    </div>
  );
}
