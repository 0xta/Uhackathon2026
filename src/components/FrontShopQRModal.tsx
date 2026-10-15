"use client";

import React, { useState } from "react";

interface FrontShopQRModalProps {
  placeId: string;
  venueName: string;
  venueAddress: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function FrontShopQRModal({
  placeId,
  venueName,
  venueAddress,
  isOpen,
  onClose,
}: FrontShopQRModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const checkinPayload = `tastechain://checkin?placeId=${encodeURIComponent(placeId)}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
    checkinPayload
  )}&margin=15`;

  const copyPayload = () => {
    navigator.clipboard.writeText(checkinPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const printQR = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200 print:p-0 print:bg-white">
      <div className="bg-base-100 border border-base-300 shadow-2xl rounded-2xl max-w-md w-full p-6 text-center relative print:border-none print:shadow-none print:max-w-full">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3 text-base-content/60 hover:text-base-content print:hidden"
        >
          ✕
        </button>

        {/* Brand Banner */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-2xl">🍜</span>
          <span className="font-extrabold tracking-wider text-primary text-lg">
            TASTECHAIN BKK
          </span>
          <span className="badge badge-warning badge-xs">OFFICIAL CASHIER QR</span>
        </div>

        <h3 className="text-xl font-bold text-base-content">{venueName}</h3>
        <p className="text-xs text-base-content/60 line-clamp-1 mb-4">{venueAddress}</p>

        {/* QR Code Container */}
        <div className="bg-white p-4 rounded-2xl shadow-inner border border-base-300 inline-block mx-auto mb-4">
          <img
            src={qrImageUrl}
            alt={`Front Shop QR for ${venueName}`}
            className="w-64 h-64 mx-auto rounded-lg"
          />
          <p className="text-[11px] text-gray-500 font-mono mt-2 tracking-tight">
            ID: {placeId.slice(0, 18)}...
          </p>
        </div>

        {/* Reward Rules Callout */}
        <div className="bg-base-200 rounded-xl p-3 text-left border border-base-300 text-xs space-y-1.5 mb-5 print:border-gray-300">
          <div className="flex items-center gap-2 font-semibold text-warning">
            <span>✨</span>
            <span>สิทธิประโยชน์ลูกค้าหน้าร้าน (Proof-of-Visit)</span>
          </div>
          <p className="text-base-content/80">
            • สแกนหน้าร้านรับทันที <strong>3 แต้มความพยายาม</strong> (Daily Activity Points)
          </p>
          <p className="text-base-content/80">
            • ฟังเสียงทักทายสด AI Shop Voice 1 ใน 3 เสียงประจำร้าน
          </p>
          <p className="text-base-content/60 text-[11px]">
            * เงื่อนไข: อยู่ในรัศมี 100 เมตร, สูงสุด 3 ครั้ง/ร้าน/วัน, รวมไม่เกิน 10 ครั้ง/วัน
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 print:hidden">
          <button onClick={printQR} className="btn btn-primary flex-1 gap-2">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" />
            </svg>
            พิมพ์ป้าย QR (Print)
          </button>
          <button onClick={copyPayload} className="btn btn-outline flex-1 gap-2">
            {copied ? "✓ คัดลอกแล้ว" : "คัดลอกลิงก์"}
          </button>
        </div>
      </div>
    </div>
  );
}
