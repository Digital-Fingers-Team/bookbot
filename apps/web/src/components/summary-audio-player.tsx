"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Music2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useT } from "@/lib/i18n";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Player for a book's summary audio.
 *
 * Replaces a native `<audio controls>` element, which could not be laid out
 * next to the label: the built-in player refuses to shrink below an intrinsic
 * width of roughly 300px, so in a flex row it won the space fight and squeezed
 * the title into a one-word-per-line column on narrow screens. Custom controls
 * have no such floor, and they can follow the app's own styling.
 */
export function SummaryAudioPlayer({ src }: { src: string }) {
  const t = useT();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // A new book means a new track: reset rather than carry over the old
  // position and playing state.
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setReady(false);
    setFailed(false);
  }, [src]);

  function onLoadedMetadata(): void {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    setReady(true);
  }

  async function togglePlay(): Promise<void> {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch {
      // Autoplay policies and decode errors both land here; surfacing the
      // message beats a button that silently does nothing.
      setFailed(true);
      setPlaying(false);
    }
  }

  function onSeek(event: ChangeEvent<HTMLInputElement>): void {
    const audio = audioRef.current;
    if (!audio) return;
    const next = Number(event.target.value);
    audio.currentTime = next;
    setCurrentTime(next);
  }

  function toggleMute(): void {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-moss/[0.04] px-4 py-2.5 dark:border-white/10 dark:bg-sea/[0.05]">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          setFailed(true);
          setReady(false);
        }}
      />

      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-moss/10 text-moss dark:bg-sea/15 dark:text-sea">
        <Music2 className="h-4 w-4" />
      </span>

      {/* Never the element that gives way: the label keeps its own line on
          narrow screens instead of collapsing to one word per line. */}
      <div className="min-w-0 flex-1 basis-32">
        <p className="truncate text-xs font-semibold text-ink dark:text-white">{t("audio.summaryTitle")}</p>
        <p className="truncate text-[11px] text-ink/65 dark:text-white/65">
          {failed ? t("audio.error") : ready ? t("audio.summarySubtitle") : t("audio.loading")}
        </p>
      </div>

      {/* Wraps to a full-width row of its own once the header gets tight. */}
      <div className="flex min-w-0 flex-1 basis-full items-center gap-2.5 sm:basis-48">
        <button
          type="button"
          onClick={togglePlay}
          disabled={failed}
          aria-label={playing ? t("audio.pause") : t("audio.play")}
          title={playing ? t("audio.pause") : t("audio.play")}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-moss text-white transition hover:bg-moss/90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-sea dark:hover:bg-sea/90"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ltr:ml-0.5 rtl:mr-0.5" />}
        </button>

        {/* A timeline reads left-to-right even in an Arabic layout, so this
            group opts out of RTL mirroring. */}
        <div dir="ltr" className="flex min-w-0 flex-1 items-center gap-2">
          <span className="w-9 shrink-0 text-right text-[11px] font-medium tabular-nums text-ink/60 dark:text-white/60">
            {formatTime(currentTime)}
          </span>

          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={onSeek}
            disabled={!ready || failed}
            aria-label={t("audio.seek")}
            className="summary-audio-range h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-ink/15 disabled:cursor-not-allowed dark:bg-white/15"
            style={{ backgroundSize: `${progress}% 100%` }}
          />

          <span className="w-9 shrink-0 text-[11px] font-medium tabular-nums text-ink/60 dark:text-white/60">
            {formatTime(duration)}
          </span>
        </div>

        <button
          type="button"
          onClick={toggleMute}
          disabled={failed}
          aria-label={muted ? t("audio.unmute") : t("audio.mute")}
          title={muted ? t("audio.unmute") : t("audio.mute")}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink/60 transition hover:bg-ink/5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
