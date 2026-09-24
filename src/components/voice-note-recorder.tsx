"use client";

import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/lib/i18n";

const MAX_SECONDS = 60;

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

// Records a short voice note (up to 60 s) in the browser for a product
// listing — many sellers explain a product better by voice than in
// writing. The parent gets the recorded Blob (to upload on save), or
// null when the note is removed.
export function VoiceNoteRecorder({
  existingUrl,
  t,
  onChange,
}: {
  existingUrl: string | null;
  t: Dictionary;
  onChange: (value: { blob: Blob; ext: string } | null) => void;
}) {
  const [state, setState] = useState<"idle" | "recording" | "recorded">(existingUrl ? "recorded" : "idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function start() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError(t.dashboard.voiceUnsupported);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        setPreviewUrl(URL.createObjectURL(blob));
        setState("recorded");
        onChange({ blob, ext });
      };
      recorderRef.current = recorder;
      recorder.start();
      setSeconds(0);
      setState("recording");
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) recorder.stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      setError(t.dashboard.voiceMicDenied);
    }
  }

  function stop() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function remove() {
    setPreviewUrl(null);
    setState("idle");
    onChange(null);
  }

  return (
    <div>
      <label className="text-sm font-medium block mb-1">{t.dashboard.voiceLabel}</label>
      <p className="text-xs text-neutral-500 mb-2">{t.dashboard.voiceHint}</p>
      {state === "idle" && (
        <button
          type="button"
          onClick={start}
          className="text-sm rounded-full border border-neutral-300 px-4 py-1.5 hover:border-neutral-900 inline-flex items-center gap-2"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-red-600" aria-hidden /> {t.dashboard.voiceRecord}
        </button>
      )}
      {state === "recording" && (
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-red-700">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" aria-hidden />
            {t.dashboard.voiceRecording} 0:{String(seconds).padStart(2, "0")} / 1:00
          </span>
          <button type="button" onClick={stop} className="text-sm rounded-full bg-neutral-900 text-white px-4 py-1.5">
            {t.dashboard.voiceStop}
          </button>
        </div>
      )}
      {state === "recorded" && previewUrl && (
        <div className="flex flex-wrap items-center gap-3">
          <audio controls src={previewUrl} className="h-9 max-w-full" />
          <button type="button" onClick={start} className="text-xs rounded-full border border-neutral-300 px-3 py-1 hover:border-neutral-900">
            {t.dashboard.voiceRedo}
          </button>
          <button type="button" onClick={remove} className="text-xs rounded-full border border-neutral-300 px-3 py-1 text-red-700 hover:border-red-600">
            {t.dashboard.voiceRemove}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
