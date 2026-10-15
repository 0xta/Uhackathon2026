import { getBangkokPlaces, getBangkokStats, BANGKOK_FNB_TYPES } from "@/lib/services/places";
import { Search, Star, Trophy, Sparkles, MapPin, Volume2, Gift, UtensilsCrossed } from "lucide-react";
import Link from "next/link";

interface PageProps {
  searchParams: {
    q?: string;
    service_type?: string;
    min_rating?: string;
    has_bounty?: string;
    pioneer_open?: string;
    page?: string;
  };
}

export const revalidate = 60; // Cache for 60 seconds

export default async function HomePage({ searchParams }: PageProps) {
  const q = searchParams.q || undefined;
  const service_type = searchParams.service_type || undefined;
  const min_rating = searchParams.min_rating ? parseFloat(searchParams.min_rating) : undefined;
  const has_bounty = searchParams.has_bounty === "true";
  const pioneer_open = searchParams.pioneer_open === "true";
  const page = parseInt(searchParams.page || "1", 10);
  const limit = 24;
  const offset = (page - 1) * limit;

  const [placesData, stats] = await Promise.all([
    getBangkokPlaces({
      q,
      service_type,
      min_rating,
      has_bounty,
      pioneer_open,
      limit,
      offset,
    }),
    getBangkokStats(),
  ]);

  const totalPages = Math.ceil(placesData.total / limit);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#161B22] via-[#1A202C] to-[#0D0F12] border border-[#21262D] p-6 sm:p-10 shadow-2xl">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-avax-red/10 border border-avax-red/20 text-xs font-semibold text-avax-red">
            <Sparkles className="w-3.5 h-3.5" />
            Web3 Gastronomy Protocol บน Avalanche Fuji
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            กินจริง รีวิวจริง รับรางวัลจริง <br />
            <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-400 bg-clip-text text-transparent">
              36,000+ ร้านทั่วกรุงเทพฯ
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-400">
            สแกน QR หน้าร้านฟังเสียง AI จากเจ้าของร้านด้วย <strong>ElevenLabs</strong> • ตรวจสลิป PromptPay ไร้หน้าม้า • รับส่วนแบ่งกองกลาง <strong>10,000 $TASTE ทุกวัน</strong>
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-6 border-t border-[#30363D]/60">
          <div className="bg-[#0D0F12]/60 backdrop-blur rounded-2xl p-4 border border-[#21262D]">
            <div className="text-xs text-slate-400">ร้านอาหารใน กทม.</div>
            <div className="text-xl sm:text-2xl font-bold text-white mt-1">
              {stats.total_venues.toLocaleString()}
            </div>
            <div className="text-[10px] text-emerald-400 font-medium mt-0.5">OPERATIONAL 100%</div>
          </div>

          <div className="bg-[#0D0F12]/60 backdrop-blur rounded-2xl p-4 border border-[#21262D]">
            <div className="text-xs text-slate-400">กองกลางรายวัน</div>
            <div className="text-xl sm:text-2xl font-bold text-taste-gold mt-1">
              10,000 <span className="text-xs font-normal">$TASTE</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">แจกทุกวัน Pro-rata</div>
          </div>

          <div className="bg-[#0D0F12]/60 backdrop-blur rounded-2xl p-4 border border-[#21262D]">
            <div className="text-xs text-slate-400">สิทธิ์ Pioneer ที่เปิด</div>
            <div className="text-xl sm:text-2xl font-bold text-orange-400 mt-1">
              3 คนแรก/ร้าน
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">รับ Royalty 5% ตลอดชีพ</div>
          </div>

          <div className="bg-[#0D0F12]/60 backdrop-blur rounded-2xl p-4 border border-[#21262D]">
            <div className="text-xs text-slate-400">เทคโนโลยี AI</div>
            <div className="text-xl sm:text-2xl font-bold text-purple-400 mt-1">
              ElevenLabs + Vision
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">3 เสียง AI / ร้าน + OCR</div>
          </div>
        </div>
      </section>

      {/* Search & Filter Bar */}
      <section className="space-y-4">
        <form method="GET" action="/" className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="ค้นหาร้านอาหาร, คาเฟ่, บาร์, ย่าน (เช่น สยาม, บรรทัดทอง, อารีย์, ผัดไท)..."
              className="input w-full pl-12 bg-[#161B22] border-[#30363D] text-slate-100 placeholder:text-slate-500 focus:border-avax-red focus:outline-none"
            />
          </div>
          <button type="submit" className="btn bg-avax-red hover:bg-avax-dark text-white border-none px-6">
            ค้นหา
          </button>
        </form>

        {/* Quick Filter Badges */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs">
          <Link
            href="/"
            className={`px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap ${
              !service_type && !has_bounty && !pioneer_open && !min_rating
                ? "bg-avax-red text-white border-avax-red"
                : "bg-[#161B22] text-slate-300 border-[#30363D] hover:border-slate-500"
            }`}
          >
            ทั้งหมด ({placesData.total.toLocaleString()})
          </Link>

          <Link
            href="/?has_bounty=true"
            className={`px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 whitespace-nowrap ${
              has_bounty
                ? "bg-amber-500 text-black font-semibold border-amber-500"
                : "bg-[#161B22] text-amber-400 border-amber-500/30 hover:border-amber-500"
            }`}
          >
            ⚡ มี Bounty Active
          </Link>

          <Link
            href="/?pioneer_open=true"
            className={`px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 whitespace-nowrap ${
              pioneer_open
                ? "bg-orange-500 text-white font-semibold border-orange-500"
                : "bg-[#161B22] text-orange-400 border-orange-500/30 hover:border-orange-500"
            }`}
          >
            🏆 Pioneer ยังว่าง (&lt; 3 คน)
          </Link>

          <Link
            href="/?min_rating=4.5"
            className={`px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 whitespace-nowrap ${
              min_rating === 4.5
                ? "bg-emerald-500 text-black font-semibold border-emerald-500"
                : "bg-[#161B22] text-emerald-400 border-emerald-500/30 hover:border-emerald-500"
            }`}
          >
            ⭐ 4.5 ดาวขึ้นไป
          </Link>

          {/* Service Types */}
          {["cafe", "restaurant", "bar", "bakery", "noodle_shop", "thai_restaurant"].map((type) => (
            <Link
              key={type}
              href={`/?service_type=${type}`}
              className={`px-3 py-1.5 rounded-xl border capitalize whitespace-nowrap transition-all ${
                service_type === type
                  ? "bg-purple-600 text-white border-purple-600 font-medium"
                  : "bg-[#161B22] text-slate-400 border-[#30363D] hover:border-slate-500"
              }`}
            >
              {type.replace("_", " ")}
            </Link>
          ))}
        </div>
      </section>

      {/* Venues Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between text-sm text-slate-400">
          <div>
            ผลลัพธ์พบ <span className="text-white font-semibold">{placesData.total.toLocaleString()}</span> ร้านในกรุงเทพฯ
          </div>
          <div>หน้า {page} จาก {Math.max(1, totalPages)}</div>
        </div>

        {placesData.places.length === 0 ? (
          <div className="text-center py-16 bg-[#161B22] rounded-3xl border border-[#21262D] space-y-3">
            <UtensilsCrossed className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-lg font-semibold text-slate-300">ไม่พบร้านอาหารที่ตรงกับเงื่อนไข</h3>
            <p className="text-sm text-slate-500">ลองล้างตัวกรองหรือค้นหาด้วยชื่ออื่น</p>
            <Link href="/" className="btn btn-sm bg-avax-red text-white border-none mt-2">
              ล้างตัวกรอง
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {placesData.places.map((place) => (
              <div
                key={place.id}
                className="bg-[#161B22] border border-[#21262D] hover:border-avax-red/40 rounded-2xl p-5 flex flex-col justify-between transition-all hover:shadow-xl hover:shadow-black/40 group"
              >
                <div className="space-y-3">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#21262D] text-slate-300 border border-[#30363D] capitalize">
                      {place.service_type?.replace("_", " ") || "Restaurant"}
                    </span>

                    {/* Pioneer Badge */}
                    <div
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1 border ${
                        place.pioneer_count < 3
                          ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      <Trophy className="w-3 h-3" />
                      Pioneer: {place.pioneer_count}/3
                    </div>
                  </div>

                  {/* Name & Address */}
                  <div>
                    <h3 className="font-bold text-lg text-white group-hover:text-avax-red transition-colors line-clamp-1">
                      {place.name}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1 flex items-start gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <span>{place.address}</span>
                    </p>
                  </div>

                  {/* Rating & Reviews */}
                  <div className="flex items-center gap-3 text-xs pt-1">
                    <div className="flex items-center gap-1 text-amber-400 font-semibold">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      <span>{place.rating ? Number(place.rating).toFixed(1) : "—"}</span>
                    </div>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400">{place.total_reviews ? `${place.total_reviews} รีวิว` : "ยังไม่มีรีวิว"}</span>
                  </div>

                  {/* Bounty & Promo Perks */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {place.has_active_bounty && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
                        💰 Bounty {place.bounty_avax > 0 ? `${place.bounty_avax} AVAX` : `${place.bounty_taste} $TASTE`}
                      </span>
                    )}
                    {place.active_promotions > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium flex items-center gap-1">
                        <Gift className="w-3 h-3" />
                        {place.active_promotions} โปรโมชั่น
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-4 mt-4 border-t border-[#21262D] flex items-center justify-between gap-2">
                  <div className="text-[11px] text-purple-400 flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>เสียง AI ร้าน</span>
                  </div>

                  <Link
                    href={`/place/${place.place_id}`}
                    className="btn btn-xs bg-avax-red/20 hover:bg-avax-red text-avax-red hover:text-white border border-avax-red/40 px-3 transition-colors"
                  >
                    ดูรายละเอียด & รีวิว
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 pt-6">
            {page > 1 && (
              <Link
                href={`/?${new URLSearchParams({
                  ...(q ? { q } : {}),
                  ...(service_type ? { service_type } : {}),
                  ...(min_rating ? { min_rating: min_rating.toString() } : {}),
                  ...(has_bounty ? { has_bounty: "true" } : {}),
                  ...(pioneer_open ? { pioneer_open: "true" } : {}),
                  page: (page - 1).toString(),
                })}`}
                className="btn btn-sm btn-outline border-[#30363D] text-slate-300"
              >
                ย้อนกลับ
              </Link>
            )}

            <span className="text-xs text-slate-400 px-3">
              หน้า {page} / {totalPages}
            </span>

            {page < totalPages && (
              <Link
                href={`/?${new URLSearchParams({
                  ...(q ? { q } : {}),
                  ...(service_type ? { service_type } : {}),
                  ...(min_rating ? { min_rating: min_rating.toString() } : {}),
                  ...(has_bounty ? { has_bounty: "true" } : {}),
                  ...(pioneer_open ? { pioneer_open: "true" } : {}),
                  page: (page + 1).toString(),
                })}`}
                className="btn btn-sm btn-outline border-[#30363D] text-slate-300"
              >
                ถัดไป
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
