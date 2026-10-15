"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function JudgeDemoBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [logMessages, setLogMessages] = useState<string[]>([
    "ยินดีต้อนรับคณะกรรมการ Uhackathon 2026 สู่ TasteChain BKK",
  ]);

  const judgeWallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Fuji Judge Account

  const addLog = (msg: string) => {
    setLogMessages((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 8)]);
  };

  const handleSimulateFullDemo = async () => {
    addLog("🚀 กำลังรัน 1-Click Judge Guided Tour...");
    setActiveStep(1);

    try {
      // Step 1: Query Ban That Thong Place
      addLog("📍 ขั้นที่ 1: ค้นหาร้านเด็ดถนนบรรทัดทอง...");
      const placesRes = await fetch("/api/places?q=บรรทัดทอง&limit=1");
      const placesData = await placesRes.json();
      const demoPlace = placesData.places[0] || {
        place_id: "ChIJgz60UgCf4jARR26CSkBTLqU",
        name: "Baobao.. Bar Sathorn",
        latitude: 13.724883,
        longitude: 100.530706,
      };
      addLog(`✓ พบร้าน: "${demoPlace.name}"`);

      // Step 2: Front Shop QR Check-in
      setActiveStep(2);
      addLog("⚡ ขั้นที่ 2: จำลองสแกน QR หน้าร้าน (&le;100m) + ฟังเสียงทักทาย AI...");
      const checkinRes = await fetch("/api/checkin/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: demoPlace.place_id,
          customerAddress: judgeWallet,
          latitude: Number(demoPlace.latitude),
          longitude: Number(demoPlace.longitude),
        }),
      });
      const checkinData = await checkinRes.json();
      if (checkinRes.ok) {
        addLog(`✓ เช็คอินสำเร็จ: +${checkinData.pointsAwarded} แต้ม! เสียงทักทาย: Slot #${checkinData.voiceGreeting?.slotNumber}`);
      } else {
        addLog(`ℹ️ เช็คอิน: ${checkinData.message || checkinData.error}`);
      }

      // Step 3: Verified Review + Slip OCR
      setActiveStep(3);
      addLog("🧾 ขั้นที่ 3: ส่งรีวิว + สลิป PromptPay 185 บ. (&ge;150 บ. = 3 แต้ม) + รูปอาหาร (1 แต้ม)...");
      const reviewRes = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: demoPlace.place_id,
          reviewerAddress: judgeWallet,
          rating: 5,
          reviewText: "รีวิวผ่านระบบ 1-Click Judge Demo: อาหารอร่อยมาก บรรยากาศสุดยอด!",
          simulatedSlipAmount: 185,
          simulatedSlipRefId: `JUDGE-SLIP-${Date.now()}`,
          foodPhotoImageBase64:
            "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
        }),
      });
      const reviewData = await reviewRes.json();
      if (reviewRes.ok) {
        addLog(`✓ รีวิวสำเร็จ: +${reviewData.totalPointsAwarded} แต้มความพยายาม! (Pioneer 2x: ${reviewData.isPioneer ? "ACTIVE" : "Standard"})`);
      } else {
        addLog(`ℹ️ รีวิว: ${reviewData.message || reviewData.error}`);
      }

      // Step 4: Claim Signature (Mechanism B)
      setActiveStep(4);
      addLog("🪙 ขั้นที่ 4: ขอ Oracle ECDSA Signature เคลม $TASTE จาก Pool 10,000 ประจำวัน...");
      const claimRes = await fetch(`/api/rewards/claim-signature?userAddress=${judgeWallet}`);
      const claimData = await claimRes.json();
      if (claimRes.ok) {
        addLog(`✓ ได้รับ Oracle Signature: ${claimData.signature.slice(0, 18)}... สิทธิ์เคลม: ${claimData.rewardTasteFormatted} $TASTE`);
      } else {
        addLog(`ℹ️ เคลม: ${claimData.message || claimData.error}`);
      }

      // Step 5: Promotion 80/20 Burn
      setActiveStep(5);
      addLog("🎟️ ขั้นที่ 5: แลก Voucher 199 $TASTE (80% เข้าร้านค้า 159.2 / 20% เผา 39.8)...");
      const promoRes = await fetch("/api/promotions/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: demoPlace.place_id,
          customerAddress: judgeWallet,
          costInTaste: 199,
          promoTitle: "บัตรส่วนลด 10% (Judge Demo)",
        }),
      });
      const promoData = await promoRes.json();
      if (promoRes.ok) {
        addLog(`✓ แลกสำเร็จ! Voucher Code: ${promoData.redemptionCode} (เผาทำลายแล้ว 39.8 $TASTE 🔥)`);
      }

      addLog("🎉 จบการทดสอบ 1-Click Judge Tour สมบูรณ์แบบทุกขั้นตอน!");
    } catch (e: any) {
      addLog(`❌ ข้อผิดพลาด: ${e.message}`);
    }
  };

  return (
    <>
      {/* Floating Demo Pill in Bottom-Right */}
      <div className="fixed bottom-5 right-5 z-40 print:hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="btn btn-warning shadow-2xl font-black gap-2 border-2 border-white/20 animate-bounce"
        >
          <span>⚖️</span>
          <span>JUDGE DEMO BAR</span>
          <span className="badge badge-neutral badge-xs font-mono">1-Click</span>
        </button>
      </div>

      {/* Slide-over Drawer / Modal */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-base-100 border-l border-base-300 shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-base-300">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚖️</span>
                <div>
                  <h3 className="font-extrabold text-base text-base-content leading-tight">
                    Judge Quick Demo Tour
                  </h3>
                  <p className="text-[11px] text-base-content/60">
                    Avalanche Fuji (43113) &bull; TasteChain BKK v3.0.0
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="btn btn-sm btn-circle btn-ghost text-base-content/60"
              >
                ✕
              </button>
            </div>

            {/* Test Wallet Info */}
            <div className="bg-base-200 rounded-xl p-3 my-4 border border-base-300 text-xs space-y-1.5">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-warning">🔑 Judge Ephemeral Wallet</span>
                <span className="badge badge-success badge-xs text-white">Active</span>
              </div>
              <p className="font-mono text-[11px] text-base-content/80 break-all">
                {judgeWallet}
              </p>
              <div className="flex items-center justify-between text-[11px] text-base-content/60 pt-1 border-t border-base-300">
                <span>Network: Avalanche Fuji Testnet</span>
                <span className="text-success font-semibold">10,000 $TASTE Daily Pool</span>
              </div>
            </div>

            {/* Guided Flow Progress */}
            <div className="space-y-2 mb-4">
              <span className="text-xs font-bold text-base-content uppercase tracking-wider">
                ขั้นตอนการสาธิตระบบ (5-Step Tour)
              </span>

              <div className="grid grid-cols-5 gap-1 text-center text-[10px] font-bold">
                {[
                  { step: 1, label: "Search" },
                  { step: 2, label: "QR Checkin" },
                  { step: 3, label: "Slip OCR" },
                  { step: 4, label: "Claim" },
                  { step: 5, label: "80/20 Burn" },
                ].map((s) => (
                  <div
                    key={s.step}
                    className={`py-1.5 rounded-lg border ${
                      activeStep === s.step
                        ? "bg-warning text-black border-warning font-black"
                        : activeStep > s.step
                        ? "bg-success/20 text-success border-success/40"
                        : "bg-base-200 text-base-content/50 border-base-300"
                    }`}
                  >
                    {s.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Run Button */}
            <button
              onClick={handleSimulateFullDemo}
              className="btn btn-primary w-full gap-2 shadow-lg text-white font-bold mb-4"
            >
              <span>🚀</span>
              <span>รัน 1-Click Guided Demo ทั้งระบบ</span>
            </button>

            {/* Live Event Terminal Logs */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-base-content flex items-center justify-between">
                <span>🖥️ Real-Time Execution Log</span>
                <span className="text-[10px] text-success animate-pulse">&bull; LIVE</span>
              </span>
              <div className="bg-black/90 rounded-xl p-3 font-mono text-[11px] text-emerald-400 h-48 overflow-y-auto border border-neutral space-y-1">
                {logMessages.map((log, i) => (
                  <div key={i} className="leading-tight">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Quick Links */}
          <div className="pt-4 mt-4 border-t border-base-300 text-xs space-y-2">
            <div className="flex gap-2">
              <Link
                href="/place/ChIJgz60UgCf4jARR26CSkBTLqU"
                className="btn btn-outline btn-xs flex-1"
                onClick={() => setIsOpen(false)}
              >
                ดูหน้าร้าน Demo (Sathorn) &rarr;
              </Link>
              <a
                href="https://testnet.snowtrace.io"
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost btn-xs text-base-content/60"
              >
                Snowtrace ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
