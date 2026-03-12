import { useState, useEffect } from "react";

const TinyCat = ({ filled, animating }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" style={{
    width: 13, height: 13,
    opacity: filled ? 1 : 0.08,
    transform: animating ? "scale(2) translateY(-3px)" : "scale(1)",
    transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease",
    display: "block",
  }}>
    {/* Head */}
    <circle cx="100" cy="90" r="45" fill="#1C1917"/>
    {/* Ears */}
    <polygon points="70,50 85,20 100,50" fill="#1C1917"/>
    <polygon points="100,50 115,20 130,50" fill="#1C1917"/>
    {/* Inner ears */}
    <polygon points="78,48 87,30 96,48" fill="#f4a6a6"/>
    <polygon points="104,48 113,30 122,48" fill="#f4a6a6"/>
    {/* Eyes */}
    <circle cx="82" cy="88" r="10" fill="white"/>
    <circle cx="118" cy="88" r="10" fill="white"/>
    {/* Pupils */}
    <circle cx="84" cy="90" r="5" fill="#1C1917"/>
    <circle cx="120" cy="90" r="5" fill="#1C1917"/>
    {/* Eye shine */}
    <circle cx="86" cy="87" r="2" fill="white"/>
    <circle cx="122" cy="87" r="2" fill="white"/>
    {/* Body */}
    <path d="M80 130 Q100 110 120 130 L120 170 L80 170 Z" fill="#1C1917"/>
    {/* Tail */}
    <path d="M120 150 Q160 140 140 170" stroke="#1C1917" strokeWidth="6" fill="none"/>
    {/* Headband */}
    <path d="M60 70 Q100 20 140 70" stroke="#8fa3b8" strokeWidth="12" fill="none"/>
    {/* Headphones */}
    <rect x="52" y="70" width="16" height="30" rx="6" fill="#8fa3b8"/>
    <rect x="132" y="70" width="16" height="30" rx="6" fill="#8fa3b8"/>
  </svg>
);

export default function CatCounter({ memberCount = 1, maxCount = 100 }) {
  const [animatingId, setAnimatingId] = useState(null);
  const [prevCount, setPrevCount] = useState(0);

  useEffect(() => {
    if (memberCount > prevCount) {
      const newId = Math.min(memberCount, maxCount) - 1;
      setAnimatingId(newId);
      setTimeout(() => setAnimatingId(null), 400);
    }
    setPrevCount(memberCount);
  }, [memberCount]);

  const grid = Array.from({ length: maxCount }, (_, i) => i < Math.min(memberCount, maxCount));

  return (
    <div style={{
      background: "#a37eef33",
      borderRadius: 14,
      border: "1px solid #EDE8DF",
      padding: "10px 12px",
      width: 158,
      boxShadow: "0 2px 10px rgba(139,106,62,0.06)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 700, color: "#C4A882", letterSpacing: "0.15em", textTransform: "uppercase" }}>
          🐾
        </div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 11, fontWeight: 700, color: "#1C1917" }}>
          {Math.min(memberCount, maxCount)}<span style={{ color: "#C4B5A4", fontWeight: 400, fontSize: 9 }}>/100</span>
        </div>
      </div>

      {/* Cat grid 10x10 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 13px)", gap: 2 }}>
        {grid.map((filled, i) => (
          <TinyCat key={i} filled={filled} animating={animatingId === i} />
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: "#F5F0E8", borderRadius: 99, marginTop: 8, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${(Math.min(memberCount, maxCount) / maxCount) * 100}%`,
          background: "linear-gradient(90deg, #8B6A3E, #C4A055)",
          borderRadius: 99,
          transition: "width 0.6s ease"
        }} />
      </div>

      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 7, color: "#000000", textAlign: "center", marginTop: 6, letterSpacing: "0.05em" }}>
        first 100 Users Count
      </div>
    </div>
  );
}