"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PlaceDetail } from "@/lib/services/places";
import QRScannerModal from "./QRScannerModal";
import FrontShopQRModal from "./FrontShopQRModal";
import AudioGreetingPlayer, { VoiceGreetingData } from "./AudioGreetingPlayer";

interface PlaceDetailClientProps {
  place: PlaceDetail;
}

export default function PlaceDetailClient({ place }: PlaceDetailClientProps) {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);
  const [activeGreeting, setActiveGreeting] = useState<VoiceGreetingData | null>(null);
  const [pointsEarned, setPointsEarned] = useState(3);
  const [loadingVoice, setLoadingVoice] = useState(false);

  // Play a specific voice from the 3 pre-seeded slots
  const playVoice = (v: any) => {
    setActiveGreeting({
      id: v.id,
      slotNumber: v.slot_number,
      title: v.title,
      scriptText: v.script_text || `ยินดีต้อนรับสู่ร้าน ${place.name}`,
      audioUrl: v.audio_url,
      durationSeconds: v.duration_seconds || 3.5,
    });
  };

  // Dispatch a random 1-in-3 voice
  const handleRandomVoiceDispatch = async () => {
    try {
      setLoadingVoice(true);
      const res = await fetch(`/api/merchant/voice?placeId=${place.place_id}`);
      const data = await res.json();
      if (data.voices && data.voices.length > 0) {
        const rand = data.voices[Math.floor(Math.random() * data.voices.length)];
        playVoice(rand);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingVoice(false);
    }
  };

  // QR Check-in Success
  const handleCheckinSuccess = (checkinData: any) => {
    if (checkinData.voiceGreeting) {
      setPointsEarned(checkinData.pointsAwarded || 3);
      setActiveGreeting({
        id: checkinData.voiceGreeting.id,
        slotNumber: checkinData.voiceGreeting.slotNumber,
        title: checkinData.voiceGreeting.title,
        scriptText: checkinData.voiceGreeting.scriptText,
        audioUrl: checkinData.voiceGreeting.audioUrl,
        durationSeconds: checkinData.voiceGreeting.durationSeconds,
      });
    }
  };

  return (
    <div className="min-h-screen bg-base-100 text-base-content pb-20">
      {/* Top Navbar */}
      <header className="border-b border-base-300 bg-base-200/50 backdrop-blur sticky top-0 z-30">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="btn btn-ghost btn-sm gap-2">
            <span>&larr;</span>
            <span>กลับสู่แผนที่กรุงเทพฯ</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="badge badge-outline badge-sm font-mono">
              Avalanche Fuji (43113)
            </span>
            <span className="badge badge-warning badge-sm font-bold">
              10,000 $TASTE/วัน
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Venue Title & Header */}
        <div className="bg-base-200/60 border border-base-300 rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="badge badge-primary badge-sm uppercase font-semibold">
                  {place.service_type || "Restaurant"}
                </span>
                <span className="badge badge-success badge-sm text-white">
                  {place.business_status || "OPERATIONAL"}
                </span>
                {place.pioneer_count < 3 && (
                  <span className="badge badge-warning badge-sm animate-pulse">
                    🔥 เปิดรับ Pioneer ({place.pioneer_count}/3)
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-extrabold text-base-content tracking-tight">
                {place.name}
              </h1>
              <p className="text-sm text-base-content/70 mt-1 max-w-2xl">
                📍 {place.address}
              </p>
            </div>

            {/* Rating Box */}
            <div className="bg-base-100 border border-base-300 rounded-xl p-3 text-right shadow-inner min-w-[120px]">
              <div className="text-2xl font-black text-amber-500 flex items-center justify-end gap-1">
                <span>⭐</span>
                <span>{place.rating ? Number(place.rating).toFixed(1) : "—"}</span>
              </div>
              <div className="text-xs text-base-content/60">
                {place.total_reviews?.toLocaleString() || 0} reviews บน Google
              </div>
            </div>
          </div>

          {/* Action Button Row */}
          <div className="flex flex-wrap items-center gap-3 mt-6 pt-4 border-t border-base-300">
            <button
              onClick={() => setIsScannerOpen(true)}
              className="btn btn-primary gap-2 shadow-md text-white font-bold"
            >
              <span>⚡</span>
              <span>เช็คอิน QR หน้าร้าน (+3 แต้ม)</span>
            </button>

            <button
              onClick={() => setIsQROpen(true)}
              className="btn btn-outline gap-2"
            >
              <span>🏪</span>
              <span>ป้าย QR แคชเชียร์</span>
            </button>

            <button
              onClick={handleRandomVoiceDispatch}
              disabled={loadingVoice}
              className="btn btn-warning btn-outline gap-2"
            >
              {loadingVoice ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : (
                <span>🎙️</span>
              )}
              <span>สุ่มฟังเสียงทักทาย AI (1-in-3)</span>
            </button>

            {place.google_map_url && (
              <a
                href={place.google_map_url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost btn-sm ml-auto gap-1 text-xs"
              >
                <span>Google Maps</span>
                <span>↗</span>
              </a>
            )}
          </div>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Pioneers & Shop Voices (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pioneer Honor Roll Card */}
            <div className="card bg-base-200/50 border border-base-300 shadow-sm">
              <div className="card-body p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="card-title text-base font-bold flex items-center gap-2">
                    <span>👑</span>
                    <span>หอเกียรติยศ Pioneer (3 ท่านแรก)</span>
                  </h3>
                  <span className="badge badge-accent badge-sm font-semibold">
                    แต้มคูณ 2x ทุกรีวิว
                  </span>
                </div>

                <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-xs text-base-content/90 mb-4">
                  💡 <strong>กติกา Pioneer ใหม่:</strong> ผู้บุกเบิกร้าน 3 คนแรก จะได้รับสิทธิ์{" "}
                  <strong className="text-warning">แต้มสะสม x2 เท่า</strong> ทุกครั้งที่มารีวิวร้านนี้
                  เพื่อรับส่วนแบ่ง $TASTE ประจำวันเพิ่มขึ้นเป็นสองเท่า!
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[1, 2, 3].map((slotIdx) => {
                    const pioneer = place.pioneers.find((p) => p.slot_index === slotIdx);
                    return (
                      <div
                        key={slotIdx}
                        className={`rounded-xl p-3 border text-center transition-all ${
                          pioneer
                            ? "bg-base-100 border-warning/60 shadow-sm"
                            : "bg-base-100/40 border-dashed border-base-300"
                        }`}
                      >
                        <div className="text-xl mb-1">
                          {slotIdx === 1 ? "🥇" : slotIdx === 2 ? "🥈" : "🥉"}
                        </div>
                        <div className="font-bold text-xs text-base-content">
                          Pioneer Slot {slotIdx}
                        </div>
                        {pioneer ? (
                          <div className="mt-1">
                            <span className="badge badge-warning badge-xs font-mono font-semibold">
                              {pioneer.pioneer_address.slice(0, 6)}...
                              {pioneer.pioneer_address.slice(-4)}
                            </span>
                            <div className="text-[10px] text-success mt-1 font-semibold">
                              👑 สิทธิ์แต้ม 2x ทำงานอยู่
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 text-[11px] text-base-content/50">
                            ยังไม่มีผู้ครอบครอง
                            <div className="text-warning text-[10px] font-semibold mt-0.5">
                              รีวิวคนแรกเพื่อเคลม
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ElevenLabs AI Shop Voices Studio */}
            <div className="card bg-base-200/50 border border-base-300 shadow-sm">
              <div className="card-body p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="card-title text-base font-bold flex items-center gap-2">
                    <span>🎙️</span>
                    <span>ElevenLabs AI Shop Voices (3 เสียงประจำร้าน)</span>
                  </h3>
                  <span className="badge badge-outline badge-xs">สุ่ม 1 ใน 3 อัตโนมัติ</span>
                </div>

                <p className="text-xs text-base-content/70 mb-3">
                  ระบบจะสุ่มส่งเสียงต้อนรับประจำร้าน 1 เสียงแบบเรียลไทม์เมื่อลูกค้าสแกน QR
                  หน้าร้านหรือยืนยันรีวิว
                </p>

                <div className="space-y-2.5">
                  {[
                    {
                      slot: 1,
                      title: "ยินดีต้อนรับสู่ร้าน",
                      tag: "Host Greeting",
                      desc: "ทักทายอบอุ่นต้อนรับลูกค้าที่มาเยือน",
                    },
                    {
                      slot: 2,
                      title: "เมนูแนะนำประจำร้าน",
                      tag: "Chef's Special",
                      desc: "แนะนำเมนูเด็ดและเคล็ดลับความอร่อย",
                    },
                    {
                      slot: 3,
                      title: "ขอบคุณผู้มีอุปการคุณ",
                      tag: "VIP Patron",
                      desc: "คำขอบคุณสมาชิก TasteChain ทุกท่าน",
                    },
                  ].map((preset) => {
                    const voice = place.shop_voices.find((v) => v.slot_number === preset.slot);
                    return (
                      <div
                        key={preset.slot}
                        className="bg-base-100 rounded-xl p-3 border border-base-300 flex items-center justify-between gap-3 hover:border-amber-400/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-warning/20 text-warning font-bold text-xs flex items-center justify-center shrink-0">
                            #{preset.slot}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-base-content">
                                {voice?.title || preset.title}
                              </span>
                              <span className="badge badge-ghost badge-xs">{preset.tag}</span>
                            </div>
                            <p className="text-[11px] text-base-content/60 line-clamp-1">
                              {preset.desc}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            if (voice) {
                              playVoice(voice);
                            } else {
                              handleRandomVoiceDispatch();
                            }
                          }}
                          className="btn btn-xs btn-outline btn-warning gap-1 shrink-0"
                        >
                          <span>▶</span>
                          <span>ทดลองฟัง</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Verified Reviews Section */}
            <div className="card bg-base-200/50 border border-base-300 shadow-sm">
              <div className="card-body p-5">
                <h3 className="card-title text-base font-bold flex items-center gap-2 mb-3">
                  <span>📝</span>
                  <span>รีวิวที่ผ่านการตรวจสอบบนเชน ({place.recent_reviews.length})</span>
                </h3>

                {place.recent_reviews.length === 0 ? (
                  <div className="text-center py-6 text-xs text-base-content/60">
                    ยังไม่มีรีวิวสำหรับร้านนี้ เป็นคนแรกที่มารีวิวเพื่อรับสิทธิ์ <strong>Pioneer #1</strong>!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {place.recent_reviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="bg-base-100 p-3 rounded-xl border border-base-300 text-xs"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold">
                              {rev.reviewer_address.slice(0, 6)}...
                              {rev.reviewer_address.slice(-4)}
                            </span>
                            {rev.is_pioneer && (
                              <span className="badge badge-warning badge-xs font-semibold">
                                👑 PIONEER 2x
                              </span>
                            )}
                          </div>
                          <span className="text-amber-500 font-bold">
                            {"★".repeat(rev.rating)}
                          </span>
                        </div>
                        <p className="text-base-content/80 mt-1">{rev.review_text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Daily Activity Mining & Promotions (1 Col) */}
          <div className="space-y-6">
            {/* Daily Mining Rules Card */}
            <div className="card bg-amber-500/10 border border-amber-500/30 shadow-sm">
              <div className="card-body p-5 text-xs space-y-3">
                <h3 className="font-extrabold text-sm text-warning flex items-center gap-2">
                  <span>🪙</span>
                  <span>ระบบขุดเหรียญ $TASTE ประจำวัน</span>
                </h3>

                <p className="text-base-content/80">
                  ทุกวันมี Pool รวม <strong>10,000 $TASTE</strong> แจกจ่ายให้ผู้ใช้ตามสัดส่วน
                  คะแนนความพยายาม (Daily Activity Points)
                </p>

                <div className="bg-base-100/70 rounded-lg p-2.5 space-y-1.5 border border-base-300 font-medium">
                  <div className="flex justify-between items-center text-base-content">
                    <span>1. สแกน QR หน้าร้าน</span>
                    <span className="badge badge-warning badge-xs font-bold">+3 แต้ม</span>
                  </div>
                  <div className="flex justify-between items-center text-base-content">
                    <span>2. ถ่ายรูปอาหารสด (pHash)</span>
                    <span className="badge badge-primary badge-xs font-bold">+1 แต้ม</span>
                  </div>
                  <div className="flex justify-between items-center text-base-content">
                    <span>3. สลิป/ใบเสร็จ OCR &lt;150 บ.</span>
                    <span className="badge badge-outline badge-xs font-bold">+1 แต้ม</span>
                  </div>
                  <div className="flex justify-between items-center text-base-content">
                    <span>4. สลิป/ใบเสร็จ OCR &ge;150 บ.</span>
                    <span className="badge badge-success badge-xs font-bold text-white">+3 แต้ม</span>
                  </div>
                  <div className="pt-1.5 mt-1 border-t border-base-300 flex justify-between items-center text-warning font-bold">
                    <span>👑 สิทธิ์ Pioneer ของร้าน</span>
                    <span>คูณ 2x ทั้งหมด!</span>
                  </div>
                </div>

                <div className="text-[11px] text-base-content/60">
                  * จำกัดสิทธิ์: รีวิว/เช็คอินได้สูงสุด 3 ครั้ง/ร้าน/วัน และรวมทั้งหมดไม่เกิน 10 ครั้ง/วัน
                </div>
              </div>
            </div>

            {/* Merchant Promotions */}
            <div className="card bg-base-200/50 border border-base-300 shadow-sm">
              <div className="card-body p-5">
                <h3 className="card-title text-base font-bold flex items-center gap-2 mb-2">
                  <span>🎟️</span>
                  <span>โปรโมชันร้านค้า</span>
                </h3>

                <div className="space-y-3">
                  <div className="bg-base-100 rounded-xl p-3 border border-base-300 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-warning">
                        ส่วนลด 10% (199 $TASTE)
                      </span>
                      <span className="badge badge-outline badge-xs">Tier 1</span>
                    </div>
                    <p className="text-[11px] text-base-content/70 mb-2">
                      ใช้ 199 $TASTE แลกรับส่วนลด 10% เมื่อทานครบ 300 บาท
                    </p>
                    <div className="text-[10px] text-base-content/50">
                      ⚡ 80% เข้าร้านค้า (159.2 $TASTE) | 🔥 20% เผาทำลาย (39.8 $TASTE)
                    </div>
                  </div>

                  <div className="bg-base-100 rounded-xl p-3 border border-base-300 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-primary">
                        ส่วนลด 25% (500 $TASTE)
                      </span>
                      <span className="badge badge-primary badge-xs text-white">VIP</span>
                    </div>
                    <p className="text-[11px] text-base-content/70 mb-2">
                      ใช้ 500 $TASTE แลกรับส่วนลด 25% เมื่อทานครบ 600 บาท
                    </p>
                    <div className="text-[10px] text-base-content/50">
                      ⚡ 80% เข้าร้านค้า (400 $TASTE) | 🔥 20% เผาทำลาย (100 $TASTE)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <QRScannerModal
        placeId={place.place_id}
        venueName={place.name}
        venueLat={place.latitude !== null ? Number(place.latitude) : null}
        venueLng={place.longitude !== null ? Number(place.longitude) : null}
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSuccess={handleCheckinSuccess}
      />

      <FrontShopQRModal
        placeId={place.place_id}
        venueName={place.name}
        venueAddress={place.address}
        isOpen={isQROpen}
        onClose={() => setIsQROpen(false)}
      />

      <AudioGreetingPlayer
        greeting={activeGreeting}
        venueName={place.name}
        pointsAwarded={pointsEarned}
        onClose={() => setActiveGreeting(null)}
      />
    </div>
  );
}
