"use client";

import React, { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";

export interface VoiceGreetingData {
  id: string;
  slotNumber: number;
  title: string;
  scriptText: string;
  audioUrl: string;
  durationSeconds?: number;
  playCount?: number;
}

interface AudioGreetingPlayerProps {
  greeting: VoiceGreetingData | null;
  venueName: string;
  pointsAwarded?: number;
  autoPlay?: boolean;
  onClose?: () => void;
}

export default function AudioGreetingPlayer({
  greeting,
  venueName,
  pointsAwarded = 3,
  autoPlay = true,
  onClose,
}: AudioGreetingPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!greeting) return;

    // Trigger celebratory confetti burst!
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#E84142", "#F59E0B", "#10B981", "#3B82F6"],
    });

    if (autoPlay && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => console.log("Audio autoplay prevented by browser policy:", e));
    }
  }, [greeting, autoPlay]);

  if (!greeting) return null;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(console.error);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const cur = audioRef.current.currentTime;
    const dur = audioRef.current.duration || greeting.durationSeconds || 3.5;
    setCurrentTime(cur);
    setProgress((cur / dur) * 100);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(100);
  };

  const slotBadge =
    greeting.slotNumber === 1
      ? "👋 Welcome Host"
      : greeting.slotNumber === 2
      ? "👨‍🍳 Chef's Pick"
      : "👑 VIP Patron";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-base-100 border border-warning/40 shadow-2xl rounded-2xl max-w-lg w-full p-6 relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-16 -right-16 w-44 h-44 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3 text-base-content/60 hover:text-base-content"
          >
            ✕
          </button>
        )}

        {/* Header with Badges */}
        <div className="flex items-center gap-2 mb-3">
          <span className="badge badge-warning badge-sm font-semibold">{slotBadge}</span>
          <span className="badge badge-success badge-sm font-semibold text-white">
            +{pointsAwarded} Daily Points!
          </span>
          <span className="text-xs text-base-content/60 ml-auto">
            Slot {greeting.slotNumber} of 3
          </span>
        </div>

        {/* Title & Venue */}
        <h3 className="text-xl font-bold text-base-content flex items-center gap-2">
          <span>🎙️</span>
          <span>{greeting.title}</span>
        </h3>
        <p className="text-sm text-base-content/70 mt-1 mb-4">
          เสียงทักทายสดจากร้าน <strong className="text-warning">{venueName}</strong>
        </p>

        {/* Animated Audio Waveform Box */}
        <div className="bg-base-200/80 rounded-xl p-4 border border-base-300 mb-4 flex flex-col items-center justify-center">
          <div className="flex items-end justify-center gap-1.5 h-12 w-full mb-3">
            {[40, 75, 55, 95, 60, 85, 45, 100, 70, 50, 80, 65, 90, 40].map((h, i) => (
              <span
                key={i}
                className={`w-1.5 rounded-full transition-all duration-150 ${
                  isPlaying ? "bg-amber-400 animate-pulse" : "bg-base-300"
                }`}
                style={{
                  height: isPlaying ? `${Math.max(15, (h * (i % 2 === 0 ? 1 : 0.75)))}%` : "20%",
                  animationDelay: `${i * 75}ms`,
                }}
              />
            ))}
          </div>

          {/* Audio Controls */}
          <div className="w-full flex items-center gap-3">
            <button
              onClick={togglePlay}
              className={`btn btn-circle ${
                isPlaying ? "btn-warning" : "btn-primary"
              } btn-md shadow-md text-white`}
            >
              {isPlaying ? (
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <div className="flex-1">
              <div className="w-full bg-base-300 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-amber-400 h-full transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-base-content/60 mt-1">
                <span>{currentTime.toFixed(1)}s</span>
                <span>
                  {(greeting.durationSeconds || 3.5).toFixed(1)}s (ElevenLabs AI)
                </span>
              </div>
            </div>
          </div>

          <audio
            ref={audioRef}
            src={greeting.audioUrl}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            preload="auto"
          />
        </div>

        {/* Script Text */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-base-content/90 italic mb-4">
          &ldquo;{greeting.scriptText}&rdquo;
        </div>

        {/* Reward summary footer */}
        <div className="flex items-center justify-between text-xs bg-base-200 rounded-lg px-3 py-2 border border-base-300">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success"></span>
            <span>สะสมแต้มความพยายามสำเร็จ</span>
          </span>
          <span className="font-mono text-warning font-semibold">
            Pool: 10,000 $TASTE/วัน
          </span>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="btn btn-outline btn-warning btn-sm w-full mt-4"
          >
            เสร็จสิ้น (Close)
          </button>
        )}
      </div>
    </div>
  );
}
