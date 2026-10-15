"use client";

import React, { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface QRScannerModalProps {
  placeId: string;
  venueName: string;
  venueLat?: number | null;
  venueLng?: number | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (checkinData: any) => void;
}

export default function QRScannerModal({
  placeId,
  venueName,
  venueLat,
  venueLng,
  isOpen,
  onClose,
  onSuccess,
}: QRScannerModalProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<string>("กำลังดึงพิกัด GPS...");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>(
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" // Default Fuji test wallet
  );
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Acquire Geolocation
  useEffect(() => {
    if (!isOpen) return;

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          setGeoStatus(`พิกัดจริง: ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`);
        },
        (err) => {
          console.warn("Geolocation warning:", err.message);
          // If GPS fails or blocked in dev, offer venue proximity default
          if (venueLat && venueLng) {
            setUserLocation({ lat: Number(venueLat), lng: Number(venueLng) });
            setGeoStatus(`ใช้พิกัดจำลองหน้าร้าน: ${Number(venueLat).toFixed(5)}, ${Number(venueLng).toFixed(5)}`);
          } else {
            setGeoStatus("ไม่สามารถดึง GPS ได้ กรุณาใช้ปุ่มจำลองพิกัด");
          }
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else if (venueLat && venueLng) {
      setUserLocation({ lat: Number(venueLat), lng: Number(venueLng) });
      setGeoStatus(`ใช้พิกัดจำลอง: ${Number(venueLat).toFixed(5)}, ${Number(venueLng).toFixed(5)}`);
    }
  }, [isOpen, venueLat, venueLng]);

  // Start Camera QR Scanner
  const startCamera = async () => {
    try {
      setErrorMessage(null);
      setIsScanning(true);
      const scanner = new Html5Qrcode("tastechain-qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          await stopCamera();
          handleScannedData(decodedText);
        },
        (error) => {
          // ignore scan frame errors
        }
      );
    } catch (err: any) {
      console.error("Camera access failed:", err);
      setIsScanning(false);
      setErrorMessage(
        "ไม่สามารถเปิดกล้องได้ (เบราว์เซอร์อาจไม่อนุญาต หรือไม่มีกล้อง) กรุณากดปุ่ม 'จำลองสแกนหน้าร้าน' ด้านล่าง"
      );
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        // ignore
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleScannedData = async (rawCode?: string) => {
    let targetPlaceId = placeId;
    if (rawCode && rawCode.includes("placeId=")) {
      const match = rawCode.match(/placeId=([^&]+)/);
      if (match && match[1]) {
        targetPlaceId = decodeURIComponent(match[1]);
      }
    }

    await executeCheckin(targetPlaceId);
  };

  const executeCheckin = async (targetPlaceId: string, customLat?: number, customLng?: number) => {
    setLoading(true);
    setErrorMessage(null);

    const lat = customLat !== undefined ? customLat : userLocation?.lat ?? venueLat;
    const lng = customLng !== undefined ? customLng : userLocation?.lng ?? venueLng;

    if (lat === undefined || lng === undefined || lat === null || lng === null) {
      setLoading(false);
      setErrorMessage("กรุณาระบุหรือเปิดตำแหน่ง GPS ก่อนทำการเช็คอิน");
      return;
    }

    try {
      const res = await fetch("/api/checkin/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: targetPlaceId,
          customerAddress: walletAddress,
          latitude: Number(lat),
          longitude: Number(lng),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || data.error || "เกิดข้อผิดพลาดในการเช็คอิน");
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-base-100 border border-base-300 shadow-2xl rounded-2xl max-w-md w-full p-6 relative">
        {/* Close Button */}
        <button
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3 text-base-content/60 hover:text-base-content"
        >
          ✕
        </button>

        <div className="text-center mb-4">
          <span className="badge badge-warning badge-sm mb-1">PROOF-OF-VISIT ORACLE</span>
          <h3 className="text-xl font-bold text-base-content">
            สแกน QR เช็คอินหน้าร้าน
          </h3>
          <p className="text-xs text-base-content/70 mt-0.5">{venueName}</p>
        </div>

        {/* GPS Proximity Status */}
        <div className="bg-base-200 rounded-lg p-2.5 text-xs flex items-center justify-between mb-3 border border-base-300">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success animate-ping"></span>
            <span className="truncate max-w-[240px]">{geoStatus}</span>
          </span>
          <span className="badge badge-outline badge-xs">Geofence: &le;100m</span>
        </div>

        {/* Wallet Address Input for Testing */}
        <div className="form-control mb-3">
          <label className="label py-1">
            <span className="label-text text-xs font-semibold">User EVM Wallet Address:</span>
          </label>
          <input
            type="text"
            className="input input-sm input-bordered font-mono text-xs w-full"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="0x..."
          />
        </div>

        {/* QR Scanner Container */}
        <div className="relative bg-base-300 rounded-xl overflow-hidden min-h-[220px] flex flex-col items-center justify-center mb-4 border border-base-300">
          <div
            id="tastechain-qr-reader"
            className={`w-full ${isScanning ? "block" : "hidden"}`}
          />

          {!isScanning && (
            <div className="p-6 text-center space-y-3">
              <div className="text-4xl">📷</div>
              <p className="text-xs text-base-content/70">
                สแกนป้าย QR ณ เคาน์เตอร์แคชเชียร์เพื่อยืนยันพิกัดหน้าร้าน
              </p>
              <button
                onClick={startCamera}
                className="btn btn-sm btn-outline btn-warning gap-1"
                disabled={loading}
              >
                <span>เปิดกล้องสแกน QR</span>
              </button>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="alert alert-error text-xs py-2 px-3 mb-4 rounded-lg flex items-start gap-2">
            <svg className="w-4 h-4 shrink-0 fill-current mt-0.5" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          {/* Direct Instant Check-in Simulation */}
          <button
            onClick={() => executeCheckin(placeId)}
            disabled={loading}
            className="btn btn-primary w-full gap-2 shadow-md text-white font-bold"
          >
            {loading ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                กำลังตรวจสอบ GPS และออกเสียง AI...
              </>
            ) : (
              <>
                <span>⚡ เช็คอินด่วนหน้าร้าน (&le;100m)</span>
                <span className="badge badge-warning badge-sm text-black font-semibold">+3 แต้ม</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-center text-base-content/50">
            จำกัดสูงสุด 3 ครั้ง/ร้าน/วัน และไม่เกิน 10 ครั้ง/วันทั่วแพลตฟอร์ม
          </p>
        </div>
      </div>
    </div>
  );
}
