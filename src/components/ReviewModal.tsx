"use client";

import React, { useState, useEffect } from "react";

interface ReviewModalProps {
  placeId: string;
  venueName: string;
  isPioneer?: boolean;
  pioneerSlot?: number | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (reviewResult: any) => void;
}

export default function ReviewModal({
  placeId,
  venueName,
  isPioneer = false,
  pioneerSlot = null,
  isOpen,
  onClose,
  onSuccess,
}: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [walletAddress, setWalletAddress] = useState(
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" // Fuji Test wallet
  );
  const [hasFoodPhoto, setHasFoodPhoto] = useState(true);
  const [slipAmount, setSlipAmount] = useState<number>(185); // Default >= 150 THB
  const [includeSlip, setIncludeSlip] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Live Points Calculation
  let basePoints = 0;
  if (hasFoodPhoto) basePoints += 1;
  if (includeSlip) {
    basePoints += slipAmount >= 150 ? 3 : 1;
  }
  if (basePoints === 0) basePoints = 1;

  const multiplier = isPioneer ? 2 : 1;
  const totalEstimatedPoints = basePoints * multiplier;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const payload: any = {
        placeId,
        reviewerAddress: walletAddress,
        rating,
        reviewText: reviewText.trim() || `อาหารอร่อยมาก รสชาติต้นตำรับ บริการประทับใจที่ ${venueName}!`,
      };

      if (hasFoodPhoto) {
        // Generate a synthetic test food photo data URL (1x1 pixel JPEG placeholder)
        payload.foodPhotoImageBase64 =
          "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
      }

      if (includeSlip) {
        payload.simulatedSlipAmount = slipAmount;
        payload.simulatedSlipRefId = `PPAY-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
      }

      const res = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || data.error || "เกิดข้อผิดพลาดในการส่งรีวิว");
        setLoading(false);
        return;
      }

      onSuccess(data);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || "การเชื่อมต่อขัดข้อง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-base-100 border border-base-300 shadow-2xl rounded-2xl max-w-lg w-full p-6 relative my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3 text-base-content/60 hover:text-base-content"
        >
          ✕
        </button>

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-warning badge-sm font-semibold">PROOF-OF-VISIT REVIEW</span>
            {isPioneer && (
              <span className="badge badge-success badge-sm font-bold text-white animate-pulse">
                👑 Pioneer 2x Boost Active
              </span>
            )}
          </div>
          <h3 className="text-xl font-extrabold text-base-content">
            เขียนรีวิว &amp; ขุดเหรียญ $TASTE
          </h3>
          <p className="text-xs text-base-content/70 mt-0.5">{venueName}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Wallet Address */}
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-xs font-semibold">Wallet Address:</span>
            </label>
            <input
              type="text"
              className="input input-sm input-bordered font-mono text-xs w-full"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              required
            />
          </div>

          {/* Star Rating */}
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-xs font-semibold">คะแนนความอร่อย (Rating):</span>
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  className={`text-2xl transition-transform hover:scale-125 ${
                    star <= rating ? "text-amber-400" : "text-base-300"
                  }`}
                >
                  ★
                </button>
              ))}
              <span className="text-xs text-base-content/60 ml-2">({rating}/5 ดาว)</span>
            </div>
          </div>

          {/* Review Text */}
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-xs font-semibold">คำรีวิวและข้อแนะนำ:</span>
            </label>
            <textarea
              className="textarea textarea-bordered text-xs w-full h-20"
              placeholder="รสชาติอาหาร เมนูแนะนำ บรรยากาศ และความประทับใจ..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
            />
          </div>

          {/* Proof Options */}
          <div className="bg-base-200 rounded-xl p-3 border border-base-300 space-y-3 text-xs">
            <div className="font-semibold text-base-content flex items-center justify-between">
              <span>📸 หลักฐานยืนยันการรับประทานจริง</span>
              <span className="text-warning text-[11px]">เพื่อรับแต้มขุด $TASTE</span>
            </div>

            {/* Food Photo Toggle */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="flex items-center gap-2">
                <span>🥗</span>
                <span>ถ่ายรูปอาหารสด (pHash Unique)</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="badge badge-primary badge-xs">+1 แต้ม</span>
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm checkbox-primary"
                  checked={hasFoodPhoto}
                  onChange={(e) => setHasFoodPhoto(e.target.checked)}
                />
              </div>
            </label>

            {/* PromptPay Slip Toggle */}
            <div className="pt-2 border-t border-base-300">
              <label className="flex items-center justify-between cursor-pointer mb-2">
                <span className="flex items-center gap-2">
                  <span>🧾</span>
                  <span>อัปโหลดสลิป PromptPay / ใบเสร็จ OCR</span>
                </span>
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm checkbox-warning"
                  checked={includeSlip}
                  onChange={(e) => setIncludeSlip(e.target.checked)}
                />
              </label>

              {includeSlip && (
                <div className="pl-6 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base-content/70">ยอดเงินในสลิป:</span>
                    <input
                      type="number"
                      className="input input-xs input-bordered w-24 font-mono font-bold"
                      value={slipAmount}
                      onChange={(e) => setSlipAmount(Number(e.target.value))}
                      min="1"
                    />
                    <span className="text-base-content/70">บาท (THB)</span>
                  </div>

                  <div className="text-[11px] text-base-content/60">
                    {slipAmount < 150 ? (
                      <span className="text-amber-500 font-semibold">
                        ยอด &lt; 150 บาท &rarr; ได้รับ +1 แต้ม
                      </span>
                    ) : (
                      <span className="text-success font-semibold">
                        ยอด &ge; 150 บาท &rarr; ได้รับ +3 แต้มเต็ม!
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live Points Calculator Summary Card */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs">
            <div className="flex items-center justify-between font-bold text-sm text-base-content">
              <span>คะแนนความพยายามที่จะได้รับ:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-lg text-warning">{totalEstimatedPoints}</span>
                <span>แต้ม</span>
                {isPioneer && (
                  <span className="badge badge-warning badge-xs font-bold">2x PIONEER</span>
                )}
              </div>
            </div>

            <div className="flex justify-between text-[11px] text-base-content/70 mt-1">
              <span>ฐานคะแนน: {basePoints} แต้ม</span>
              <span>ตัวคูณ: {multiplier}x {isPioneer ? "(Pioneer Slot)" : "(Standard)"}</span>
            </div>

            <div className="text-[10px] text-base-content/50 mt-1 border-t border-amber-500/20 pt-1">
              * ผู้ใช้รีวิวได้สูงสุด 3 ครั้ง/ร้าน/วัน และไม่เกิน 10 ครั้ง/วันทั่วแพลตฟอร์ม
            </div>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="alert alert-error text-xs py-2 px-3 rounded-lg flex items-start gap-2">
              <svg className="w-4 h-4 shrink-0 fill-current mt-0.5" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full gap-2 shadow-md text-white font-bold"
          >
            {loading ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                กำลังประมวลผล OCR และส่งรีวิว...
              </>
            ) : (
              <>
                <span>🚀 ส่งรีวิว &amp; เคลมแต้มความพยายาม</span>
                <span className="badge badge-warning badge-sm text-black font-semibold">
                  +{totalEstimatedPoints} แต้ม
                </span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
