"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { IconBag } from "./dash-icons";

// Product photos: swipe between them on a phone (scroll-snap, no
// library), tap a thumbnail or the arrows on a computer. With one
// photo it is just the photo.
export function ProductGallery({ images, title, children }: { images: string[]; title: string; children?: React.ReactNode }) {
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const count = images.length;

  function go(i: number) {
    const next = (i + count) % count;
    setIndex(next);
    const track = trackRef.current;
    if (track) track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
  }

  function onScroll() {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== index) setIndex(i);
  }

  if (count === 0) {
    return (
      <div className="relative aspect-square bg-neutral-100 rounded-xl flex items-center justify-center overflow-hidden">
        {children}
        <IconBag className="w-16 h-16 text-neutral-300" />
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-square bg-neutral-100 rounded-xl overflow-hidden">
        {children}
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex h-full w-full overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((src, i) => (
            <div key={src + i} className="relative h-full w-full shrink-0 snap-center">
              <Image
                src={src}
                alt={count > 1 ? `${title} (${i + 1}/${count})` : title}
                fill
                sizes="(max-width: 640px) 100vw, 448px"
                preload={i === 0}
                className="object-cover"
              />
            </div>
          ))}
        </div>
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous photo"
              className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-white/90 shadow text-lg"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next photo"
              className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-white/90 shadow text-lg"
            >
              ›
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-black/60 text-white text-xs font-semibold px-2 py-0.5">
              {index + 1}/{count}
            </span>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => go(i)}
              aria-label={`Photo ${i + 1}`}
              className={`relative w-14 h-14 shrink-0 rounded-lg overflow-hidden border-2 ${i === index ? "border-neutral-900" : "border-transparent opacity-70"}`}
            >
              <Image src={src} alt="" fill sizes="56px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
