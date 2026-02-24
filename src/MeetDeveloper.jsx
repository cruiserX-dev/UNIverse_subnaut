import myPhoto from "./assets/developer-photo.jpg";
import { useState } from "react";


export default function MeetDeveloper() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(28,25,23,0.5)", backdropFilter: "blur(5px)"
        }} />
      )}

      {/* Card */}
      {open && (
        <div style={{
          position: "fixed", bottom: 90, right: 24, zIndex: 201,
          width: 300, background: "#FAF8F5", borderRadius: 24,
          border: "1px solid #EDE8DF",
          boxShadow: "0 28px 70px rgba(139,106,62,0.22)"
        }}>
          <div style={{ background: "linear-gradient(135deg,#8B6A3E,#C4A055)", padding: "0 0 0", textAlign: "center" }}>
            <div style={{ width: "100%", height: 450, overflow: "hidden", borderRadius: "10px 10px 0 0" }}>
              <img src={myPhoto} alt="Dev" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }} />
            </div>
          </div>
          <div style={{ padding: 20, textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#1C1917" }}>The Developer</div>
            <div style={{ fontSize: 12, color: "#000000", marginBottom: 12 }}>Connexus · Creator</div>
            <p style={{ fontSize: 13, color: "#4B4540", marginBottom: 16 }}>
              Hi, thanks for meeting me here. wanna work together? drop me a text. Have a good day 🙂~ Subodh Nautiyal
            </p>
            <a href="https://www.linkedin.com/in/krnlx/" target="_blank" rel="noopener noreferrer"
              style={{ display: "block", background: "linear-gradient(135deg,#8B6A3E,#C4A055)", color: "#fff", borderRadius: 12, padding: "12px", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
              Connect on LinkedIn
            </a>
          </div>
        </div>
      )}

      {/* Trigger Button */}
      <button onClick={() => setOpen(!open)} style={{
        position: "fixed", bottom: 28, right: 28, zIndex: 100,
        display: "flex", alignItems: "center", gap: 10,
        background: "linear-gradient(135deg,#8B6A3E,#C4A055)",
        border: "none", borderRadius: 99, padding: "10px 20px 10px 10px",
        cursor: "pointer", boxShadow: "0 4px 20px rgba(139,106,62,0.35)"
      }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,255,255,0.6)" }}>
          <img src={myPhoto} alt="Dev" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: "0.06em" }}>Meet the Developer</span>
      </button>
    </>
  );
}