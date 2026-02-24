import newCornerLogo from './assets/crnr_inspyrenet.png';
import cnxfLogo from './assets/cnxf.png';
import { useState, useEffect, useRef } from "react";
import MeetDeveloper from "./MeetDeveloper";

// ══════════════════════════════════════════════════════════════════════════════
// ARCHITECTURE: University Gateway System
//
// Flow: Loading → Login/Skip → University Gateway → University Dashboard
//
// Data Model:
//   UNIVERSITY_DB: { [uniId]: { id, name, shortName, members, products, rides, clubs } }
//   currentUser:   { id, name, universityId | null }
//
// Rules:
//   • No dashboard loads until universityId is set on currentUser
//   • All module data is scoped to the selected university
//   • Gateway enforces selection before any module access
// ══════════════════════════════════════════════════════════════════════════════

const LOGO_SRC = cnxfLogo;
const NEW_LOGO_SRC = newCornerLogo;
// ─── SCREEN ENUM ─────────────────────────────────────────────────────────────
const S = {
  LOADING:      0,
  AUTH:         1,  // Login / Skip
  GATEWAY:      2,  // Choose University
  HOME:         3,  // University Dashboard
  MARKETPLACE:  4,
  PRODUCT:      5,
  SELL:         6,
  RIDESHARE:    7,
  OFFER_RIDE:   8,
  CLUBS:        9,
  CREATE_CLUB:  10,
};

// ─── SEEDED UNIVERSITY DATABASE ───────────────────────────────────────────────
// Each university is a fully isolated container with its own data
const SEED_UNIVERSITIES = {
  "vjti": {
    id: "vjti",
    name: "Veermata Jijabai Technological Institute",
    shortName: "VJTI Mumbai",
    city: "Mumbai",
    members: 1842,
    established: "1887",
    accent: "#6366F1",
    products: [
      { id: 101, title: "Data Structures & Algorithms", price: 350, category: "Books", seller: "Arjun Kapoor", dept: "Computer Science", badge: "📚", condition: "Good", desc: "Cormen CLRS 3rd edition. Minor highlights in first 3 chapters. Perfect for competitive programming prep.", listed: "3 days ago", img: "📚" },
      { id: 102, title: "DBMS Handwritten Notes", price: 80, category: "Notes", seller: "Priya Sharma", dept: "Information Technology", badge: "📝", condition: "New", desc: "Complete semester notes covering ER diagrams, normalization, SQL queries, and transaction management.", listed: "1 day ago", img: "📝" },
      { id: 103, title: "Arduino Uno Starter Kit", price: 600, category: "Parts", seller: "Dev Malhotra", dept: "Electronics Eng.", badge: "🔧", condition: "Used", desc: "Full kit with breadboard, jumper wires, LEDs, resistors, servo motor, and DHT11 sensor.", listed: "5 days ago", img: "🔧" },
      { id: 104, title: "Final Year ML Project", price: 1200, category: "Projects", seller: "Sneha Rao", dept: "Computer Science", badge: "💻", condition: "Original", desc: "Sentiment analysis on Twitter data using BERT. Includes full report, PPT, Python code, and dataset. Grade: A+", listed: "2 days ago", img: "💻" },
    ],
    rides: [
      { id: 201, driver: "Meera Joshi", avatar: "M", from: "Andheri West", to: "VJTI Matunga", date: "Tomorrow", time: "8:15 AM", seats: 2, cost: 60, color: "#10B981" },
      { id: 202, driver: "Rohan Desai", avatar: "R", from: "Thane East", to: "VJTI Matunga", date: "Tomorrow", time: "7:45 AM", seats: 3, cost: 80, color: "#6366F1" },
      { id: 203, driver: "Sameer Ahmed", avatar: "S", from: "Borivali West", to: "VJTI Matunga", date: "Tomorrow", time: "8:30 AM", seats: 2, cost: 90, color: "#EC4899" },
    ],
    clubs: [
      { id: 301, name: "Code Craft Club", category: "Tech", members: 234, icon: "⚡", desc: "Hackathons, DSA sprints & open source contributions. Weekly coding battles every Friday.", event: "Hackathon 2025", eventDate: "Feb 28", color: "#6366F1" },
      { id: 302, name: "Robotics Society", category: "Tech", members: 89, icon: "🤖", desc: "Build, break, rebuild. Annual robo-wars + IEEE workshops for circuit enthusiasts.", event: "Robo-Wars Prelims", eventDate: "Mar 5", color: "#EF4444" },
      { id: 303, name: "Basketball Team", category: "Sports", members: 45, icon: "🏀", desc: "Inter-college tournaments. Practices Mon/Wed/Fri 5–7 PM at the main court.", event: "Inter-College Match", eventDate: "Mar 2", color: "#F97316" },
    ],
  },
  "ict": {
    id: "ict",
    name: "Institute of Chemical Technology",
    shortName: "ICT Mumbai",
    city: "Mumbai",
    members: 934,
    established: "1933",
    accent: "#10B981",
    products: [
      { id: 201, title: "Organic Chemistry Textbook", price: 420, category: "Books", seller: "Nisha Pillai", dept: "Chemical Eng.", badge: "📚", condition: "Good", desc: "Morrison & Boyd Organic Chemistry. Annotated with key reactions. Used for 2 semesters.", listed: "2 days ago", img: "📚" },
      { id: 202, title: "Lab Safety Equipment Set", price: 350, category: "Tools", seller: "Vivek Shah", dept: "Chemical Eng.", badge: "🛠️", condition: "New", desc: "Full lab kit: goggles, gloves, apron, and face shield. Never used, bought extra.", listed: "Today", img: "🛠️" },
      { id: 203, title: "Process Control Notes", price: 120, category: "Notes", seller: "Anita Rao", dept: "Chemical Eng.", badge: "📝", condition: "New", desc: "Detailed notes on PID controllers, control loop theory, and plant simulation. 80 pages.", listed: "4 days ago", img: "📝" },
    ],
    rides: [
      { id: 301, driver: "Pooja Nair", avatar: "P", from: "Dadar TT", to: "ICT Mumbai", date: "Today", time: "9:00 AM", seats: 1, cost: 40, color: "#F59E0B" },
      { id: 302, driver: "Nisha Pillai", avatar: "N", from: "Kurla", to: "ICT Mumbai", date: "Today", time: "10:00 AM", seats: 4, cost: 35, color: "#14B8A6" },
    ],
    clubs: [
      { id: 401, name: "Photography Guild", category: "Arts", members: 112, icon: "📷", desc: "Weekly photo walks, darkroom sessions and annual campus exhibition.", event: "Campus Photo Walk", eventDate: "Feb 25", color: "#22C55E" },
      { id: 402, name: "Eco Warriors", category: "Social", members: 160, icon: "🌿", desc: "Campus sustainability drives, tree plantations and zero-waste campaigns.", event: "Tree Plantation Drive", eventDate: "Feb 22", color: "#10B981" },
      { id: 403, name: "Debate & MUN Society", category: "Leadership", members: 78, icon: "🎤", desc: "Public speaking, Model UN conferences, and workshops on rhetoric.", event: "MUN Conference", eventDate: "Mar 15", color: "#EC4899" },
    ],
  },
  "iitb": {
    id: "iitb",
    name: "Indian Institute of Technology Bombay",
    shortName: "IIT Bombay",
    city: "Mumbai",
    members: 4210,
    established: "1958",
    accent: "#8B6A3E",
    products: [
      { id: 301, title: "Advanced VLSI Design Book", price: 780, category: "Books", seller: "Kabir Singh", dept: "Electrical Eng.", badge: "📚", condition: "Like New", desc: "Weste & Harris CMOS VLSI Design. Perfect condition, minimal highlights.", listed: "1 day ago", img: "📚" },
      { id: 302, title: "Raspberry Pi 4 (4GB)", price: 2500, category: "Gadgets", seller: "Ishaan Verma", dept: "Electronics Eng.", badge: "🖥️", condition: "Used", desc: "RPi 4B 4GB RAM. Comes with 32GB SD card, power adapter, and HDMI cable.", listed: "2 days ago", img: "🖥️" },
      { id: 303, title: "Casio FX-991EX", price: 450, category: "Gadgets", seller: "Rahul Pandey", dept: "Mechanical Eng.", badge: "🖩", condition: "Like New", desc: "Advanced scientific calculator. Used for 1 semester only. All functions working perfectly.", listed: "Today", img: "🖩" },
    ],
    rides: [
      { id: 401, driver: "Kabir Singh", avatar: "K", from: "Powai", to: "IIT Gate", date: "Tomorrow", time: "7:30 AM", seats: 3, cost: 30, color: "#8B6A3E" },
      { id: 402, driver: "Priya Mehta", avatar: "P", from: "Bandra", to: "IIT Gate", date: "Tomorrow", time: "8:00 AM", seats: 2, cost: 55, color: "#6366F1" },
    ],
    clubs: [
      { id: 501, name: "E-Cell IIT Bombay", category: "Leadership", members: 320, icon: "🚀", desc: "Entrepreneurship cell. Startup weekends, investor connects, and startup bootcamps.", event: "Startup Weekend", eventDate: "Mar 10", color: "#F97316" },
      { id: 502, name: "Aeromodelling Club", category: "Tech", members: 95, icon: "✈️", desc: "Design and fly RC aircraft, drones, and UAVs. Annual inter-IIT competition.", event: "Drone Fest", eventDate: "Mar 8", color: "#6366F1" },
    ],
  },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const CAT_COLORS = { Books: "#6366F1", Notes: "#EF4444", Parts: "#F97316", Projects: "#22C55E", Gadgets: "#EC4899", Tools: "#10B981", Assignments: "#3B82F6" };
const CAT_EMOJIS = { Books: "📚", Notes: "📝", Parts: "🔧", Projects: "💻", Gadgets: "📱", Tools: "🛠️", Assignments: "📄" };

// ══════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState(S.LOADING);
  const [loadProgress, setLoadProgress] = useState(0);
  const [toast, setToast] = useState(null);

  // ── User session ──────────────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(null);
  // { id, name, universityId: string | null }

  // ── University database (mutable for create) ──────────────────────────────
  const [uniDB, setUniDB] = useState(SEED_UNIVERSITIES);

  // ── Within-uni navigation ─────────────────────────────────────────────────
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [marketFilter, setMarketFilter] = useState("All");
  const [clubFilter, setClubFilter] = useState("All");
  const [joinedClubs, setJoinedClubs] = useState({});  // { clubId: true }
  const [rideSeats, setRideSeats] = useState({});       // { rideId: adjustedSeats }
  const [confirmedRides, setConfirmedRides] = useState({});

  const toast_ = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3200); };

  // ── Loading ticker — ~5 seconds total ────────────────────────────────────
  // ── Loading: strictly 5 seconds from 0 → 100 ─────────────────────────────
  // Uses elapsed-time-based progress so speed is always predictable.
  // Easing: fast start (0–40%), gentle plateau (40–75%), slow finish (75–100%)
  // so every phase of the loading screen is fully readable.
  useEffect(() => {
    if (screen !== S.LOADING) return;
    const DURATION = 8000; // ms — total loading time
    const startTime = performance.now();

    const ease = (t) => {
      // t = 0..1 linear time → returns 0..1 eased progress
      if (t < 0.45) return t * 1.6;           // fast ramp 0–40%
      if (t < 0.72) return 0.72 + (t - 0.45) * 0.55; // slow plateau 40–75%
      return Math.min(1, 0.87 + (t - 0.72) * 1.1);   // gentle finish 75–100%
    };

    const iv = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / DURATION, 1);
      const p = Math.round(ease(t) * 100);
      setLoadProgress(p);
      if (p >= 100) clearInterval(iv);
    }, 40); // 40ms tick = smooth 25fps bar animation

    return () => clearInterval(iv);
  }, []);

  // ── Auth flow ──────────────────────────────────────────────────────────────
  const handleAuth = (name) => {
    const user = { id: "u_" + Date.now(), name: name || "Guest", universityId: null };
    setCurrentUser(user);
    setScreen(S.GATEWAY);  // Always go to gateway after auth
  };

  // ── University selection ───────────────────────────────────────────────────
  const handleSelectUniversity = (uniId) => {
    setCurrentUser(u => ({ ...u, universityId: uniId }));
    setScreen(S.HOME);
    toast_(`🎓 Welcome to ${uniDB[uniId].shortName}!`);
  };

  const handleCreateUniversity = (uniData) => {
    const id = uniData.name.toLowerCase().replace(/\s+/g, "_").slice(0, 20) + "_" + Date.now().toString().slice(-4);
    const newUni = {
      id, name: uniData.name, shortName: uniData.shortName || uniData.name,
      city: uniData.city || "India", members: 1, established: new Date().getFullYear().toString(),
      accent: "#8B6A3E", products: [], rides: [], clubs: [],
    };
    setUniDB(db => ({ ...db, [id]: newUni }));
    setCurrentUser(u => ({ ...u, universityId: id }));
    setScreen(S.HOME);
    toast_(`🏛️ ${newUni.shortName} created! You're the first member.`);
  };

  // ── Get current uni data ───────────────────────────────────────────────────
  const uni = currentUser?.universityId ? uniDB[currentUser.universityId] : null;

  // Helper: get products with any live additions
  const getUniData = (key) => uni ? (uniDB[uni.id]?.[key] || []) : [];

  // ── Module handlers (all scoped to current uni) ────────────────────────────
  const handleSellItem = (item) => {
    const newItem = { ...item, id: Date.now(), listed: "Just now", badge: CAT_EMOJIS[item.category] || "📦", img: CAT_EMOJIS[item.category] || "📦" };
    setUniDB(db => ({ ...db, [uni.id]: { ...db[uni.id], products: [newItem, ...db[uni.id].products] } }));
    toast_("✅ Listed in " + uni.shortName + "!");
    setScreen(S.MARKETPLACE);
  };

  const handleOfferRide = (ride) => {
    const newRide = { ...ride, id: Date.now(), avatar: ride.driver[0], color: "#8B5CF6" };
    setUniDB(db => ({ ...db, [uni.id]: { ...db[uni.id], rides: [newRide, ...db[uni.id].rides] } }));
    toast_("🚗 Ride posted for " + uni.shortName + " students!");
    setScreen(S.RIDESHARE);
  };

  const handleJoinRide = (id) => {
    setUniDB(db => ({
      ...db, [uni.id]: {
        ...db[uni.id],
        rides: db[uni.id].rides.map(r => r.id === id && r.seats > 0 ? { ...r, seats: r.seats - 1 } : r)
      }
    }));
    setConfirmedRides(c => ({ ...c, [id]: true }));
    toast_("🎉 Seat reserved!");
  };

  const handleJoinClub = (id) => {
    setUniDB(db => ({
      ...db, [uni.id]: {
        ...db[uni.id],
        clubs: db[uni.id].clubs.map(c => c.id === id ? { ...c, members: c.members + 1 } : c)
      }
    }));
    setJoinedClubs(j => ({ ...j, [id]: true }));
    toast_("🏆 Joined!");
  };

  const handleCreateClub = (club) => {
    const newClub = { ...club, id: Date.now(), members: 1, icon: "⭐", color: "#6366F1" };
    setUniDB(db => ({ ...db, [uni.id]: { ...db[uni.id], clubs: [newClub, ...db[uni.id].clubs] } }));
    toast_("🎊 Club created in " + uni.shortName + "!");
    setScreen(S.CLUBS);
  };

  const handleSwitchUni = () => {
    setCurrentUser(u => ({ ...u, universityId: null }));
    setScreen(S.GATEWAY);
  };

  return (
    <div style={outerStyle}>
    <div style={appStyle}>
      <BgPattern screen={screen} />
      <style>{globalCSS}</style>
      {toast && <Toast msg={toast} />}

      {screen === S.LOADING &&
        <LoadingScreen progress={Math.min(loadProgress, 100)} onDone={() => setScreen(S.AUTH)} />}

      {screen === S.AUTH &&
        <AuthScreen onAuth={handleAuth} />}

      {screen === S.GATEWAY &&
        <GatewayScreen
          uniDB={uniDB}
          currentUser={currentUser}
          onSelect={handleSelectUniversity}
          onCreate={handleCreateUniversity}
          onBack={() => setScreen(S.AUTH)}
        />}

      {screen === S.HOME && uni &&
        <HomeScreen uni={uni} user={currentUser} onNav={setScreen} onSwitchUni={handleSwitchUni} onBack={() => setScreen(S.GATEWAY)} />}

      {screen === S.MARKETPLACE && uni &&
        <MarketplaceScreen
          products={getUniData("products")} uni={uni}
          filter={marketFilter} setFilter={setMarketFilter}
          onBack={() => setScreen(S.HOME)}
          onView={p => { setSelectedProduct(p); setScreen(S.PRODUCT); }}
          onSell={() => setScreen(S.SELL)}
        />}

      {screen === S.PRODUCT && selectedProduct && uni &&
        <ProductDetailScreen product={selectedProduct} onBack={() => setScreen(S.MARKETPLACE)} />}

      {screen === S.SELL && uni &&
        <SellScreen onBack={() => setScreen(S.MARKETPLACE)} onSubmit={handleSellItem} />}

      {screen === S.RIDESHARE && uni &&
        <RideshareScreen
          rides={getUniData("rides")} uni={uni}
          confirmed={confirmedRides}
          onBack={() => setScreen(S.HOME)}
          onJoin={handleJoinRide}
          onOffer={() => setScreen(S.OFFER_RIDE)}
        />}

      {screen === S.OFFER_RIDE && uni &&
        <OfferRideScreen onBack={() => setScreen(S.RIDESHARE)} onSubmit={handleOfferRide} />}

      {screen === S.CLUBS && uni &&
        <ClubsScreen
          clubs={getUniData("clubs")} uni={uni}
          filter={clubFilter} setFilter={setClubFilter}
          joined={joinedClubs}
          onBack={() => setScreen(S.HOME)}
          onJoin={handleJoinClub}
          onCreate={() => setScreen(S.CREATE_CLUB)}
        />}

      {screen === S.CREATE_CLUB && uni &&
        <CreateClubScreen onBack={() => setScreen(S.CLUBS)} onSubmit={handleCreateClub} />}
    </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BACKGROUND PATTERN — dark on loading, warm white otherwise
// ══════════════════════════════════════════════════════════════════════════════
function BgPattern({ screen }) {
  if (screen === S.LOADING) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
      background: "#FAF8F5",
      backgroundImage: "radial-gradient(circle, #C8BCA8 1px, transparent 1px)",
      backgroundSize: "28px 28px",
    }} />
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════════════════════════
function Toast({ msg }) {
  return (
    <div className="toast-slide" style={{
      position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)",
      background: "#1C1917", color: "#FAF8F5", borderRadius: 12, padding: "11px 22px",
      fontSize: 12, fontWeight: 600, fontFamily: "'Montserrat', sans-serif",
      boxShadow: "0 12px 40px rgba(0,0,0,0.25)", zIndex: 9999, whiteSpace: "nowrap",
      letterSpacing: "0.02em",
    }}>{msg}</div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LOADING SCREEN — black bg, real logo, gold bar
// ══════════════════════════════════════════════════════════════════════════════
function LoadingScreen({ progress, onDone}) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 150);
    const t2 = setTimeout(() => setPhase(2), 800);
    const t3 = setTimeout(() => setPhase(3), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);
  useEffect(() => {
    if (progress >= 100) {
      setPhase(4);
      const t = setTimeout(() => onDone && onDone(), 900);
      return () => clearTimeout(t);
    }
  }, [progress]);

  const fade = (show, delay) => ({
    opacity: show ? 1 : 0,
    transform: show ? "translateY(0)" : "translateY(16px)",
    transition: `opacity 0.9s cubic-bezier(0.16,1,0.3,1) ${delay||0}ms, transform 0.9s cubic-bezier(0.16,1,0.3,1) ${delay||0}ms`,
  });

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100, background: "#0A0A0A",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "0 40px",
      opacity: phase === 4 ? 0 : 1, transition: "opacity 0.85s cubic-bezier(0.4,0,0.2,1)",
    }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 55% at 50% 48%, rgba(46,204,143,0.15) 0%, transparent 70%)", opacity: phase >= 1 ? 1 : 0, transition: "opacity 2s ease", pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
        <div style={{ ...fade(phase >= 1), marginBottom: 60 }}>
          <img src={LOGO_SRC} alt="UNIverse" style={{ width: 250, height: "auto", display: "block", filter: "drop-shadow(0 0 32px rgba(200,160,80,0.2)) brightness(1.5)" }} />
        <div style={{
  fontFamily: "'Cheque', serif",
  fontSize: 28,
  color: "#2ECC8F",
  letterSpacing: "0.15em",
  marginTop: 12,
  textAlign: "center"
}}>
  CONNEXUS
</div>
        </div>
        <div style={{ ...fade(phase >= 2, 60), width: "100%", maxWidth: 250 }}>
          <div style={{ height: 1.5, background: "rgba(255,255,255,0.08)", borderRadius: 99, position: "relative", overflow: "visible" }}>
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${progress}%`, background: "linear-gradient(90deg, #7A5A2E, #C4A055, #E8C87A, #C4A055, #7A5A2E)", backgroundSize: "200% 100%", borderRadius: 99, transition: "width 0.2s cubic-bezier(0.25,0.46,0.45,0.94)", animation: progress < 100 ? "goldShimmer 2.2s linear infinite" : "none" }} />
            <div style={{ position: "absolute", top: "50%", left: `calc(${progress}% - 3px)`, transform: "translateY(-50%)", width: 6, height: 6, borderRadius: "50%", background: "#E8C87A", boxShadow: "0 0 10px 3px rgba(232,200,122,0.5)", transition: "left 0.2s cubic-bezier(0.25,0.46,0.45,0.94)", opacity: progress > 1 && progress < 100 ? 1 : 0 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 500, color: "rgba(255,255,255,0.25)", letterSpacing: "0.22em", textTransform: "uppercase" }}>Loading</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 600, color: "#C4A055" }}>{Math.round(progress)}%</div>
          </div>
        </div>
        <div style={{ ...fade(phase >= 3, 100), marginTop: 52, textAlign: "center", maxWidth: 300 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, justifyContent: "center" }}>
            <div style={{ height: 1, width: 28, background: "linear-gradient(90deg, transparent, rgba(196,160,85,0.5))" }} />
            <div style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(196,160,85,0.5)" }} />
            <div style={{ height: 1, width: 28, background: "linear-gradient(90deg, rgba(196,160,85,0.5), transparent)" }} />
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 600, fontStyle: "italic", color: "rgba(255,255,255,0.5)", lineHeight: 1.8,whiteSpace: "nowrap" }}>
            A Student to Student Network for Shared Services
            <span style={{ display: "block", marginTop: 3, color: "#C4A055", fontStyle: "normal" }}></span>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 36, display: "flex", alignItems: "center", gap: 10, opacity: phase >= 3 ? 1 : 0, transition: "opacity 0.5s ease 0.3s" }}>
        <div style={{ width: 20, height: 1, background: "rgba(196,160,85,0.5)" }} />
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(46, 204, 143, 0.7)" }}> MARKETPLACE, RIDEPOOLING, COMMUNITY.</div>
        <div style={{ width: 20, height: 1, background: "rgba(196,160,85,0.5)" }} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTH SCREEN — Login / Skip
// ══════════════════════════════════════════════════════════════════════════════
function AuthScreen({ onAuth }) {
  const [tab, setTab] = useState("signup");
  const [name, setName] = useState("");
  return (
    <Page style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 28px" }}>
      <div className="anim-0" style={{ textAlign: "center", marginBottom: 36 }}>
        <img
          src={NEW_LOGO_SRC} alt="UNIverse"
          style={{ width: 220, height: "auto", display: "block", margin: "0 auto 20px", mixBlendMode: "multiply" }}
        />
        <div style={{
  fontFamily: "'Cheque', serif",
  fontSize: 28,
  color: "#050505",
  letterSpacing: "0.15em",
  marginTop: 12,
  textAlign: "center"
}}>
  CONNEXUS
</div>
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 17, fontWeight: 600, fontStyle: "italic",
          color: "#4A3728", lineHeight: 1.65, maxWidth: 270, margin: "0 auto",
          letterSpacing: "0.01em",
        }}>
          From trading Notes to Sharing Rides<br />
          <span style={{ color: "#8B6A3E", fontStyle: "normal", fontWeight: 700 }}>
            And joining Clubs.
          </span>
          <span style={{ display: "block", marginTop: 4, fontStyle: "normal", fontWeight: 400, fontSize: 13, color: "#452c09", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.01em" }}>
            Powered by Student Nexus
          </span>
        </div>
      </div>
      <div className="anim-1" style={{ background: "#fff", borderRadius: 24, padding: "28px 24px", boxShadow: "0 2px 20px rgba(139,106,62,0.08)", border: "1px solid #EDE8DF" }}>
        <div style={{ display: "flex", background: "#F5F0E8", borderRadius: 12, padding: 3, marginBottom: 24, gap: 2 }}>
          {["signup","login"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 9, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 12, textTransform: "capitalize", letterSpacing: "0.04em", background: tab === t ? "#1C1917" : "transparent", color: tab === t ? "#FAF8F5" : "#A8957A", transition: "all 0.25s ease" }}>
              {t === "signup" ? "Sign Up" : "Log In"}
            </button>
          ))}
        </div>
        {tab === "signup" && (
          <input placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        )}
        <input placeholder="University Email" style={inputStyle} />
        <input placeholder="Password" type="password" style={{ ...inputStyle, marginBottom: 0 }} />
        <PrimaryBtn style={{ marginTop: 20 }} onClick={() => onAuth(name || "Student")}>
          {tab === "signup" ? "Create Account & Continue" : "Log In"} →
        </PrimaryBtn>
      </div>
      <div className="anim-2" style={{ textAlign: "center", marginTop: 20 }}>
        <div style={{ fontFamily: "'Montserrat', sans-serif", color: "#C4B5A4", fontSize: 10, marginBottom: 12, letterSpacing: "0.1em" }}>— OR —</div>
        <OutlineBtn onClick={() => onAuth("Guest")}>Explore as guest →</OutlineBtn>
      </div>
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// UNIVERSITY GATEWAY — Choose / Create University
// ══════════════════════════════════════════════════════════════════════════════
function GatewayScreen({ uniDB, currentUser, onSelect, onCreate, onBack }) {
  const [tab, setTab] = useState("find");
  const [search, setSearch] = useState("");
  const [createForm, setCreateForm] = useState({ name: "", shortName: "", city: "" });
  const [creating, setCreating] = useState(false);

  const unis = Object.values(uniDB);
  const filtered = search.trim()
    ? unis.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.shortName.toLowerCase().includes(search.toLowerCase()) ||
        u.city.toLowerCase().includes(search.toLowerCase())
      )
    : unis;

  const setC = (k, v) => setCreateForm(f => ({ ...f, [k]: v }));
  const canCreate = createForm.name.trim().length > 3;

  const handleCreate = () => {
    setCreating(true);
    setTimeout(() => {
      onCreate(createForm);
      setCreating(false);
    }, 1200);
  };

  return (
    <Page style={{ display: "flex", flexDirection: "column" }}>
      {/* Back button row */}
      <div style={{ padding: "52px 24px 0", display: "flex", alignItems: "center" }}>
        <button onClick={onBack} style={{
          background: "#fff", border: "1px solid #EDE8DF", color: "#1C1917",
          borderRadius: 12, width: 38, height: 38, cursor: "pointer",
          fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 1px 6px rgba(139,106,62,0.08)", flexShrink: 0,
        }}>←</button>
      </div>
      {/* Header — logo + tagline */}
      <div style={{ padding: "16px 24px 20px" }}>
        <div className="anim-0" style={{ textAlign: "center", marginBottom: 20 }}>
          <img
            src={NEW_LOGO_SRC} alt="UNIverse"
            style={{ width: 200, height: "auto", display: "block", margin: "0 auto 18px", mixBlendMode: "multiply" }}
          />
          <div style={{
  fontFamily: "'Cheque', serif",
  fontSize: 28,
  color: "#000000",
  letterSpacing: "0.15em",
  marginTop: 12,
  textAlign: "center"
}}>
  CONNEXUS
</div>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 16, fontWeight: 600, fontStyle: "italic",
            color: "#4A3728", lineHeight: 1.65, maxWidth: 260, margin: "0 auto 8px",
          }}>
            From trading Notes to Sharing Rides
            <span style={{ display: "block", color: "#8B6A3E", fontStyle: "normal", fontWeight: 700 }}>And joining Clubs.</span>
          </div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#3a2b15", fontWeight: 400, letterSpacing: "0.01em" }}>
            Powered by Student Nexus.
          </div>
        </div>
        <div className="anim-1" style={{ borderTop: "1px solid #EDE8DF", paddingTop: 18 }}>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, color: "#8B6A3E", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 6 }}>
            Welcome, {currentUser?.name} 👋
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: "#1C1917", lineHeight: 1.2, letterSpacing: "-0.3px" }}>
            Choose Your University
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="anim-1" style={{ padding: "0 24px 20px" }}>
        <div style={{ display: "flex", background: "#F5F0E8", borderRadius: 14, padding: 3, gap: 2 }}>
          {[{ k: "find", label: "🔎 Find University" }, { k: "create", label: "➕ Create / Request" }].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              flex: 1, padding: "10px 8px", border: "none", borderRadius: 11, cursor: "pointer",
              fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 11, letterSpacing: "0.03em",
              background: tab === t.k ? "#1C1917" : "transparent",
              color: tab === t.k ? "#FAF8F5" : "#A8957A",
              transition: "all 0.25s ease",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* FIND TAB */}
      {tab === "find" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "0 24px 16px" }}>
            <div style={{ background: "#fff", borderRadius: 14, display: "flex", alignItems: "center", padding: "12px 16px", boxShadow: "0 2px 12px rgba(139,106,62,0.07)", border: "1px solid #EDE8DF", gap: 10 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C4A882" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input
                placeholder="Search by name or city..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, color: "#1C1917", fontFamily: "'Montserrat', sans-serif", flex: 1, fontWeight: 400 }}
              />
              {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#C4A882", fontSize: 16 }}>×</button>}
            </div>
          </div>

          <div className="uni-cards-grid" style={{ flex: 1, overflow: "auto", padding: "0 24px 32px", scrollbarWidth: "none", display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🏛️</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: "#78716C", fontWeight: 600 }}>No universities found</div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#C4B5A4", marginTop: 6 }}>Try creating a new one →</div>
              </div>
            )}
            {filtered.map((uni, i) => (
              <div key={uni.id} className={`card-lift fade-in-item`} style={{ animationDelay: `${i * 0.05}s`, background: "#fff", borderRadius: 20, border: "1px solid #EDE8DF", overflow: "hidden", boxShadow: "0 2px 10px rgba(139,106,62,0.05)" }}>
                <div style={{ height: 3, background: uni.accent }} />
                <div style={{ padding: "18px 18px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <div style={{ width: 50, height: 50, borderRadius: 14, background: `${uni.accent}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, border: `1px solid ${uni.accent}22` }}>🏛️</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "#1C1917", marginBottom: 2 }}>{uni.shortName}</div>
                      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#A8957A", fontWeight: 500, marginBottom: 6 }}>{uni.city} · Est. {uni.established}</div>
                      <div style={{ display: "flex", gap: 12 }}>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#78716C" }}>👥 {uni.members.toLocaleString()} members</span>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#78716C" }}>📦 {uni.products.length} listings</span>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#78716C" }}>🏆 {uni.clubs.length} clubs</span>
                      </div>
                    </div>
                    <button onClick={() => onSelect(uni.id)} style={{ background: uni.accent, border: "none", color: "#fff", borderRadius: 10, padding: "8px 16px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", flexShrink: 0, letterSpacing: "0.04em" }}>Join</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE TAB */}
      {tab === "create" && (
        <div style={{ flex: 1, overflow: "auto", padding: "0 24px 32px", scrollbarWidth: "none" }}>
          <div className="anim-0" style={{ background: "#fff", borderRadius: 22, border: "1px solid #EDE8DF", padding: "22px 20px", marginBottom: 16, boxShadow: "0 2px 12px rgba(139,106,62,0.05)" }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, color: "#C4A882", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 16 }}>University Details</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input placeholder="University Full Name *" value={createForm.name} onChange={e => setC("name", e.target.value)} style={inputStyle} />
              <input placeholder="Short Name / Abbreviation" value={createForm.shortName} onChange={e => setC("shortName", e.target.value)} style={inputStyle} />
              <input placeholder="City" value={createForm.city} onChange={e => setC("city", e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
            </div>
          </div>

          <div className="anim-1" style={{ background: "#FAF8F5", borderRadius: 16, border: "1px solid #EDE8DF", padding: "16px 18px", marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ fontSize: 18 }}>🔒</div>
              <div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 600, color: "#1C1917", marginBottom: 3 }}>Isolated Space</div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#A8957A", fontWeight: 400, lineHeight: 1.55 }}>Your university gets its own private marketplace, ride pool, and clubs. No data is shared with other universities.</div>
              </div>
            </div>
          </div>

          <PrimaryBtn
            disabled={!canCreate || creating}
            onClick={handleCreate}
            style={{ opacity: canCreate ? 1 : 0.38 }}
          >
            {creating ? "Creating your space…" : "Create University Space 🏛️"}
          </PrimaryBtn>
        </div>
      )}
      <MeetDeveloper />
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HOME — University Dashboard
// ══════════════════════════════════════════════════════════════════════════════
function HomeScreen({ uni, user, onNav, onSwitchUni, onBack }) {
  const cards = [
    { s: S.MARKETPLACE, icon: "🛍️", label: "Marketplace",    sub: `${uni.products.length} listings · Books, Gadgets & more`, accent: "#8B6A3E" },
    { s: S.RIDESHARE,   icon: "🚗", label: "Ride Pool",       sub: `${uni.rides.length} active rides nearby`,                  accent: "#10B981" },
    { s: S.CLUBS,       icon: "🏆", label: "Clubs & Societies",sub: `${uni.clubs.length} clubs · Sports, Tech & more`,          accent: "#6366F1" },
  ];
  return (
    <Page style={{ display: "flex", flexDirection: "column" }}>
      {/* University badge */}
      <div style={{ padding: "56px 24px 0" }}>
        <div className="anim-0">
          {/* Top bar: back button + logo */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <button onClick={onBack} style={{
              background: "#fff", border: "1px solid #EDE8DF", color: "#1C1917",
              borderRadius: 12, width: 38, height: 38, cursor: "pointer",
              fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 1px 6px rgba(139,106,62,0.08)", flexShrink: 0,
            }}>←</button>
            <img src={NEW_LOGO_SRC} alt="UNIverse" style={{ width: 90, height: "auto", objectFit: "contain" }} />
          </div>
          {/* Uni pill */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${uni.accent}15`, border: `1px solid ${uni.accent}30`, borderRadius: 99, padding: "6px 14px 6px 8px", marginBottom: 18 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: uni.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>🏛️</div>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 700, color: uni.accent, letterSpacing: "0.06em" }}>{uni.shortName}</span>
            <button onClick={onSwitchUni} style={{ background: "none", border: "none", cursor: "pointer", color: `${uni.accent}88`, fontSize: 14, lineHeight: 1, padding: "0 0 0 4px" }} title="Switch university">⇄</button>
          </div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, color: "#8B6A3E", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 10 }}>
            Good Morning, {user?.name} 👋
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 700, color: "#1C1917", lineHeight: 1.2, letterSpacing: "-0.3px" }}>
            What are you<br />exploring today?
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: "24px 24px 8px" }} className="anim-1">
        <div style={{ background: "#fff", borderRadius: 16, display: "flex", alignItems: "center", padding: "14px 18px", boxShadow: "0 2px 12px rgba(139,106,62,0.07)", border: "1px solid #EDE8DF", gap: 12 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C4A882" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <span style={{ fontFamily: "'Montserrat', sans-serif", color: "#C4A882", fontSize: 14, fontWeight: 400 }}>Search in {uni.shortName}...</span>
        </div>
      </div>

      {/* Section label */}
      <div style={{ padding: "20px 24px 10px" }}>
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, color: "#C4A882", letterSpacing: "0.2em", textTransform: "uppercase" }}>Explore</div>
      </div>

      {/* Nav cards — single col mobile, 3-col desktop */}
      <div className="nav-cards-grid" style={{ flex: 1, padding: "0 24px" }}>
        {cards.map((c, i) => (
          <button key={c.s} onClick={() => onNav(c.s)} className={`card-lift anim-${i + 2} nav-card`}
            style={{ background: "#fff", border: "1px solid #EDE8DF", borderRadius: 22, padding: "22px 22px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 18, width: "100%", boxShadow: "0 2px 16px rgba(139,106,62,0.06)", transition: "all 0.22s ease" }}>
            <div style={{ width: 54, height: 54, borderRadius: 16, background: `${c.accent}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, border: `1px solid ${c.accent}22` }}>{c.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 700, color: "#1C1917", marginBottom: 5 }}>{c.label}</div>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 400, color: "#A8957A", lineHeight: 1.4 }}>{c.sub}</div>
            </div>
            <div style={{ color: c.accent, fontSize: 20, fontWeight: 300, opacity: 0.7 }}>›</div>
          </button>
        ))}
      </div>

      {/* Stats footer */}
      <div style={{ padding: "24px 24px 36px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#C4B5A4", letterSpacing: "0.08em" }}>{uni.members.toLocaleString()} students</div>
        <div style={{ width: 3, height: 3, borderRadius: "50%", background: "#E8DED4" }} />
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#C4B5A4", letterSpacing: "0.08em" }}>Est. {uni.established}</div>
      </div>
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MARKETPLACE
// ══════════════════════════════════════════════════════════════════════════════
function MarketplaceScreen({ products, uni, filter, setFilter, onBack, onView, onSell }) {
  const cats = ["All", "Books", "Notes", "Gadgets", "Parts", "Projects", "Tools", "Assignments"];
  const filtered = filter === "All" ? products : products.filter(p => p.category === filter);
  return (
    <Page style={{ display: "flex", flexDirection: "column" }}>
      <Header onBack={onBack} title="Marketplace" uni={uni} right={
        <button onClick={onSell} style={{ background: "#8B6A3E", border: "none", color: "#FAF8F5", borderRadius: 10, padding: "8px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.04em" }}>+ List</button>
      } />
      <div style={{ padding: "0 20px 10px", overflowX: "auto", display: "flex", gap: 7, scrollbarWidth: "none" }}>
        {cats.map(c => (
          <button key={c} onClick={() => setFilter(c)} style={{ padding: "7px 15px", borderRadius: 99, border: filter === c ? "none" : "1px solid #EDE8DF", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 11, letterSpacing: "0.04em", background: filter === c ? "#1C1917" : "#fff", color: filter === c ? "#FAF8F5" : "#78716C", transition: "all 0.2s ease" }}>{c}</button>
        ))}
      </div>
      <div className="product-grid" style={{ flex: 1, overflow: "auto", padding: "0 20px 32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignContent: "start", scrollbarWidth: "none" }}>
        {filtered.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: "#78716C", fontWeight: 600 }}>No listings yet</div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#C4B5A4", marginTop: 6 }}>Be the first to list something!</div>
          </div>
        )}
        {filtered.map((item, i) => (
          <div key={item.id} className="card-lift fade-in-item" style={{ animationDelay: `${i * 0.05}s`, background: "#fff", borderRadius: 18, padding: 16, border: "1px solid #EDE8DF", cursor: "pointer", boxShadow: "0 2px 10px rgba(139,106,62,0.05)" }} onClick={() => onView(item)}>
            <div style={{ width: "100%", aspectRatio: "1", background: `${CAT_COLORS[item.category]||"#8B6A3E"}10`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 12, border: `1px solid ${CAT_COLORS[item.category]||"#8B6A3E"}18` }}>{item.badge}</div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, color: CAT_COLORS[item.category]||"#8B6A3E", marginBottom: 4, letterSpacing: "0.1em", textTransform: "uppercase" }}>{item.category}</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 600, color: "#1C1917", marginBottom: 4, lineHeight: 1.35 }}>{item.title}</div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#C4B5A4", marginBottom: 12, fontWeight: 400 }}>{item.condition}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "#1C1917" }}>₹{item.price}</div>
              <button onClick={e => { e.stopPropagation(); onView(item); }} style={{ background: "#1C1917", border: "none", color: "#FAF8F5", borderRadius: 8, padding: "5px 11px", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.04em" }}>View</button>
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PRODUCT DETAIL
// ══════════════════════════════════════════════════════════════════════════════
function ProductDetailScreen({ product, onBack }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef(null);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = (text) => {
    setMessages(m => [...m, { id: Date.now(), from: "me", text }]);
    setChatLoading(true);
    const replies = { "I want to buy this": "Hi! Yes, it's still available. When are you free to meet on campus?", "Can we negotiate?": "Sure! What price did you have in mind? Open to quick pickup.", "Let's connect": "Hey! I'm usually in the CS lab after 3 PM. Ping me here!" };
    setTimeout(() => {
      setMessages(m => [...m, { id: Date.now() + 1, from: "seller", text: replies[text] || "Hi! Thanks for reaching out. Let's connect soon." }]);
      setChatLoading(false);
    }, 900);
  };

  return (
    <Page style={{ display: "flex", flexDirection: "column" }}>
      <Header onBack={onBack} title="Product Details" />
      <div style={{ flex: 1, overflow: "auto", scrollbarWidth: "none" }}>
        <div style={{ margin: "0 20px 18px", background: "#fff", borderRadius: 22, border: "1px solid #EDE8DF", overflow: "hidden", boxShadow: "0 2px 16px rgba(139,106,62,0.06)" }}>
          <div style={{ height: 190, background: `${CAT_COLORS[product.category]||"#8B6A3E"}10`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 76 }}>{product.img}</div>
          <div style={{ padding: "20px 20px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, background: `${CAT_COLORS[product.category]}18`, color: CAT_COLORS[product.category], padding: "4px 10px", borderRadius: 99, letterSpacing: "0.08em", textTransform: "uppercase" }}>{product.category}</span>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, background: "#F0FDF4", color: "#16A34A", padding: "4px 10px", borderRadius: 99 }}>✓ Verified</span>
              </div>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#C4B5A4" }}>{product.listed}</div>
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#1C1917", marginBottom: 6, lineHeight: 1.3 }}>{product.title}</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: "#8B6A3E", marginBottom: 16 }}>₹{product.price}</div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: "#78716C", lineHeight: 1.7, fontWeight: 400, marginBottom: 18 }}>{product.desc}</div>
            <div style={{ background: "#FAF8F5", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, border: "1px solid #EDE8DF" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #8B6A3E, #C4A882)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16, fontFamily: "'Playfair Display', serif", flexShrink: 0 }}>{product.seller[0]}</div>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 600, color: "#1C1917" }}>{product.seller}</div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#A8957A", fontWeight: 400, marginTop: 2 }}>{product.dept} · {product.condition}</div>
              </div>
            </div>
          </div>
        </div>
        {!chatOpen && (
          <div style={{ margin: "0 20px 18px" }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, color: "#C4B5A4", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}>Start a conversation</div>
            {["I want to buy this", "Can we negotiate?", "Let's connect"].map((btn, i) => (
              <button key={btn} onClick={() => { setChatOpen(true); setTimeout(() => sendMessage(btn), 80); }} className="card-lift"
                style={{ width: "100%", background: i === 0 ? "#1C1917" : "#fff", border: i === 0 ? "none" : "1px solid #EDE8DF", color: i === 0 ? "#FAF8F5" : "#1C1917", borderRadius: 16, padding: "14px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", textAlign: "left", letterSpacing: "0.01em", marginBottom: 10 }}>{btn}</button>
            ))}
          </div>
        )}
        {chatOpen && (
          <div className="anim-0" style={{ margin: "0 20px 32px", background: "#fff", borderRadius: 22, border: "1px solid #EDE8DF", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #F5F0E8", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #8B6A3E, #C4A882)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13 }}>{product.seller[0]}</div>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 600, color: "#1C1917" }}>{product.seller}</div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, color: "#22C55E", fontWeight: 600 }}>● Online now</div>
              </div>
              <button onClick={() => { setChatOpen(false); setMessages([]); }} style={{ marginLeft: "auto", background: "none", border: "none", color: "#C4B5A4", cursor: "pointer", fontSize: 20 }}>×</button>
            </div>
            <div style={{ height: 230, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10, scrollbarWidth: "none" }}>
              {messages.map(msg => (
                <div key={msg.id} style={{ display: "flex", justifyContent: msg.from === "me" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "78%", background: msg.from === "me" ? "#1C1917" : "#F5F0E8", color: msg.from === "me" ? "#FAF8F5" : "#1C1917", borderRadius: msg.from === "me" ? "16px 16px 3px 16px" : "16px 16px 16px 3px", padding: "10px 14px", fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 400, lineHeight: 1.55 }}>{msg.text}</div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ background: "#F5F0E8", borderRadius: "16px 16px 16px 3px", padding: "12px 16px", display: "flex", gap: 5, alignItems: "center" }}>
                    {[0,1,2].map(i => <div key={i} className={`dot-bounce delay-${i}`} style={{ width: 5, height: 5, borderRadius: "50%", background: "#C4A882" }} />)}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SELL SCREEN
// ══════════════════════════════════════════════════════════════════════════════
function SellScreen({ onBack, onSubmit }) {
  const [form, setForm] = useState({ title: "", category: "Books", price: "", desc: "", seller: "", dept: "", condition: "Good" });
  const [preview, setPreview] = useState(null);
  const fileRef = useRef();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.title && form.price && form.seller && form.dept && form.desc;
  return (
    <Page style={{ display: "flex", flexDirection: "column" }}>
      <Header onBack={onBack} title="List an Item" />
      <div style={{ flex: 1, overflow: "auto", padding: "0 20px 32px", scrollbarWidth: "none" }}>
        <div className="anim-0" onClick={() => fileRef.current.click()} style={{ background: "#fff", borderRadius: 22, border: "1.5px dashed #D4C9B8", overflow: "hidden", marginBottom: 16, cursor: "pointer" }}>
          <div style={{ height: 140, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {preview ? <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#C4A882", fontWeight: 500 }}>Tap to upload a photo</div>
            </>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={e => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onload = ev => setPreview(ev.target.result); r.readAsDataURL(f); } }} style={{ display: "none" }} />
        </div>
        <SectionCard label="Item Details"><>
          <input placeholder="Product Title *" value={form.title} onChange={e => set("title", e.target.value)} style={inputStyle} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <select value={form.category} onChange={e => set("category", e.target.value)} style={selectStyle}>{["Books","Notes","Gadgets","Parts","Projects","Tools","Assignments"].map(c => <option key={c}>{c}</option>)}</select>
            <select value={form.condition} onChange={e => set("condition", e.target.value)} style={selectStyle}>{["New","Like New","Good","Used","For Parts"].map(c => <option key={c}>{c}</option>)}</select>
          </div>
          <input placeholder="Price (₹) *" type="number" value={form.price} onChange={e => set("price", e.target.value)} style={inputStyle} />
          <textarea placeholder="Description *" value={form.desc} onChange={e => set("desc", e.target.value)} style={{ ...inputStyle, height: 88, resize: "none" }} />
        </></SectionCard>
        <SectionCard label="Seller Info"><>
          <input placeholder="Your Name *" value={form.seller} onChange={e => set("seller", e.target.value)} style={inputStyle} />
          <input placeholder="Your Department *" value={form.dept} onChange={e => set("dept", e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
        </></SectionCard>
        <PrimaryBtn disabled={!valid} onClick={() => valid && onSubmit({ ...form, price: parseInt(form.price) })} style={{ opacity: valid ? 1 : 0.38 }}>Publish Listing →</PrimaryBtn>
      </div>
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// RIDESHARE
// ══════════════════════════════════════════════════════════════════════════════
function RideshareScreen({ rides, uni, confirmed, onBack, onJoin, onOffer }) {
  return (
    <Page style={{ display: "flex", flexDirection: "column" }}>
      <Header onBack={onBack} title="Ride Pool" uni={uni} right={
        <button onClick={onOffer} style={{ background: "#10B981", border: "none", color: "#fff", borderRadius: 10, padding: "8px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.04em" }}>+ Offer</button>
      } />
      <div className="rides-grid" style={{ flex: 1, overflow: "auto", padding: "4px 20px 32px", display: "grid", gridTemplateColumns: "1fr", gap: 14, scrollbarWidth: "none" }}>
        {rides.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚗</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: "#78716C", fontWeight: 600 }}>No rides yet</div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#C4B5A4", marginTop: 6 }}>Offer the first ride!</div>
          </div>
        )}
        {rides.map((ride, i) => (
          <div key={ride.id} className="card-lift fade-in-item" style={{ animationDelay: `${i * 0.06}s`, background: "#fff", borderRadius: 20, border: "1px solid #EDE8DF", overflow: "hidden", boxShadow: "0 2px 10px rgba(139,106,62,0.05)" }}>
            <div style={{ height: 3, background: ride.color }} />
            <div style={{ padding: "18px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${ride.color}18`, border: `2px solid ${ride.color}35`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: ride.color, fontSize: 17, fontFamily: "'Playfair Display', serif", flexShrink: 0 }}>{ride.avatar}</div>
                <div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 600, color: "#1C1917" }}>{ride.driver}</div>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#A8A29E", fontWeight: 400, marginTop: 2 }}>⭐ 4.8 · Verified Student</div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: ride.color }}>₹{ride.cost}</div>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, color: "#C4B5A4", fontWeight: 400 }}>per seat</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {[{ label: "FROM", val: ride.from }, { label: "TO", val: ride.to }].map((x, j) => (
                  <div key={j} style={{ flex: 1, background: "#FAF8F5", borderRadius: 12, padding: "10px 12px", border: "1px solid #EDE8DF" }}>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8, color: "#C4B5A4", fontWeight: 700, letterSpacing: "0.15em", marginBottom: 4 }}>{x.label}</div>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#1C1917", fontWeight: 600 }}>{x.val}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 14 }}>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#78716C" }}>📅 {ride.date}</span>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#78716C" }}>🕐 {ride.time}</span>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: ride.seats === 0 ? "#EF4444" : "#10B981", fontWeight: 600 }}>💺 {ride.seats} left</span>
                </div>
                <button disabled={ride.seats === 0 || confirmed[ride.id]} onClick={() => onJoin(ride.id)} style={{ padding: "8px 16px", borderRadius: 10, border: confirmed[ride.id] ? `1px solid ${ride.color}` : "none", cursor: ride.seats === 0 ? "not-allowed" : "pointer", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 11, letterSpacing: "0.04em", background: confirmed[ride.id] ? `${ride.color}12` : ride.seats === 0 ? "#F5F0E8" : ride.color, color: confirmed[ride.id] ? ride.color : ride.seats === 0 ? "#C4B5A4" : "#fff", transition: "all 0.2s" }}>
                  {confirmed[ride.id] ? "✓ Reserved" : ride.seats === 0 ? "Full" : "Join Ride"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// OFFER RIDE
// ══════════════════════════════════════════════════════════════════════════════
function OfferRideScreen({ onBack, onSubmit }) {
  const [form, setForm] = useState({ driver: "", from: "", to: "", date: "", time: "", seats: "", cost: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = Object.values(form).every(v => String(v).trim());
  return (
    <Page style={{ display: "flex", flexDirection: "column" }}>
      <Header onBack={onBack} title="Offer a Ride" />
      <div style={{ flex: 1, overflow: "auto", padding: "0 20px 32px", scrollbarWidth: "none" }}>
        <SectionCard label="Route Details"><>
          <input placeholder="Pickup Location *" value={form.from} onChange={e => set("from", e.target.value)} style={inputStyle} />
          <input placeholder="Drop Location *" value={form.to} onChange={e => set("to", e.target.value)} style={inputStyle} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input placeholder="Date" type="date" value={form.date} onChange={e => set("date", e.target.value)} style={inputStyle} />
            <input placeholder="Time" type="time" value={form.time} onChange={e => set("time", e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input placeholder="Seats *" type="number" value={form.seats} onChange={e => set("seats", e.target.value)} style={inputStyle} />
            <input placeholder="₹ / Seat *" type="number" value={form.cost} onChange={e => set("cost", e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
          </div>
        </></SectionCard>
        <SectionCard label="Driver Info"><>
          <input placeholder="Your Name *" value={form.driver} onChange={e => set("driver", e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
        </></SectionCard>
        <PrimaryBtn disabled={!valid} onClick={() => valid && onSubmit({ ...form, seats: parseInt(form.seats), cost: parseInt(form.cost) })} style={{ opacity: valid ? 1 : 0.38 }}>Post My Ride 🚗</PrimaryBtn>
      </div>
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CLUBS
// ══════════════════════════════════════════════════════════════════════════════
function ClubsScreen({ clubs, uni, filter, setFilter, joined, onBack, onJoin, onCreate }) {
  const cats = ["All", "Tech", "Sports", "Arts", "Leadership", "Social"];
  const filtered = filter === "All" ? clubs : clubs.filter(c => c.category === filter);
  return (
    <Page style={{ display: "flex", flexDirection: "column" }}>
      <Header onBack={onBack} title="Clubs & Societies" uni={uni} right={
        <button onClick={onCreate} style={{ background: "#6366F1", border: "none", color: "#fff", borderRadius: 10, padding: "8px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.04em" }}>+ Create</button>
      } />
      <div style={{ padding: "4px 20px 14px", overflowX: "auto", display: "flex", gap: 7, scrollbarWidth: "none" }}>
        {cats.map(c => (
          <button key={c} onClick={() => setFilter(c)} style={{ padding: "7px 15px", borderRadius: 99, border: filter === c ? "none" : "1px solid #EDE8DF", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 11, letterSpacing: "0.04em", background: filter === c ? "#1C1917" : "#fff", color: filter === c ? "#FAF8F5" : "#78716C", transition: "all 0.2s" }}>{c}</button>
        ))}
      </div>
      <div className="clubs-grid" style={{ flex: 1, overflow: "auto", padding: "0 20px 32px", display: "grid", gridTemplateColumns: "1fr", gap: 14, scrollbarWidth: "none" }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: "#78716C", fontWeight: 600 }}>No clubs yet</div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#C4B5A4", marginTop: 6 }}>Start the first club!</div>
          </div>
        )}
        {filtered.map((club, i) => (
          <div key={club.id} className="card-lift fade-in-item" style={{ animationDelay: `${i * 0.05}s`, background: "#fff", borderRadius: 20, border: "1px solid #EDE8DF", overflow: "hidden", boxShadow: "0 2px 10px rgba(139,106,62,0.05)" }}>
            <div style={{ height: 3, background: club.color }} />
            <div style={{ padding: "18px 18px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: `${club.color}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, border: `1px solid ${club.color}22` }}>{club.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "#1C1917" }}>{club.name}</div>
                      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: club.color, fontWeight: 600, marginTop: 2 }}>{club.category} · {club.members} members</div>
                    </div>
                    <button disabled={joined[club.id]} onClick={() => !joined[club.id] && onJoin(club.id)} style={{ padding: "7px 16px", borderRadius: 10, border: joined[club.id] ? `1px solid ${club.color}` : "none", cursor: joined[club.id] ? "default" : "pointer", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 11, flexShrink: 0, background: joined[club.id] ? `${club.color}12` : club.color, color: joined[club.id] ? club.color : "#fff", transition: "all 0.2s" }}>
                      {joined[club.id] ? "✓ Joined" : "Join"}
                    </button>
                  </div>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#78716C", lineHeight: 1.6, fontWeight: 400, marginTop: 8 }}>{club.desc}</div>
                  {club.event && (
                    <div style={{ marginTop: 12, background: "#FAF8F5", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, border: "1px solid #EDE8DF" }}>
                      <span style={{ fontSize: 12 }}>📅</span>
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#78716C" }}>Next: <span style={{ color: "#1C1917", fontWeight: 600 }}>{club.event}</span> · {club.eventDate}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CREATE CLUB
// ══════════════════════════════════════════════════════════════════════════════
function CreateClubScreen({ onBack, onSubmit }) {
  const [form, setForm] = useState({ name: "", category: "Tech", desc: "", event: "", eventDate: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.name && form.desc && form.event && form.eventDate;
  return (
    <Page style={{ display: "flex", flexDirection: "column" }}>
      <Header onBack={onBack} title="Create a Club" />
      <div style={{ flex: 1, overflow: "auto", padding: "0 20px 32px", scrollbarWidth: "none" }}>
        <SectionCard label="Club Info"><>
          <input placeholder="Club Name *" value={form.name} onChange={e => set("name", e.target.value)} style={inputStyle} />
          <select value={form.category} onChange={e => set("category", e.target.value)} style={selectStyle}>{["Tech","Sports","Arts","Leadership","Social"].map(c => <option key={c}>{c}</option>)}</select>
          <textarea placeholder="Club Description *" value={form.desc} onChange={e => set("desc", e.target.value)} style={{ ...inputStyle, height: 88, resize: "none" }} />
        </></SectionCard>
        <SectionCard label="First Event"><>
          <input placeholder="Event Title *" value={form.event} onChange={e => set("event", e.target.value)} style={inputStyle} />
          <input placeholder="Event Date *" type="date" value={form.eventDate} onChange={e => set("eventDate", e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
        </></SectionCard>
        <PrimaryBtn disabled={!valid} onClick={() => valid && onSubmit(form)} style={{ opacity: valid ? 1 : 0.38 }}>Launch Club 🚀</PrimaryBtn>
      </div>
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════
function Page({ children, style }) {
  return <div className="page-enter" style={{ ...pageStyle, ...style }}>{children}</div>;
}

function Header({ onBack, title, uni, right }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "50px 20px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={onBack} style={{ background: "#fff", border: "1px solid #EDE8DF", color: "#1C1917", borderRadius: 12, width: 38, height: 38, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 6px rgba(139,106,62,0.08)", flexShrink: 0 }}>←</button>
        <div style={{ flex: 1, textAlign: "center", padding: "0 8px" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, color: "#1C1917", fontSize: 18 }}>{title}</div>
          {uni && <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, color: "#A8957A", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 2 }}>{uni.shortName}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {right && <div>{right}</div>}
          <img
            src={NEW_LOGO_SRC} alt="UNIverse"
            style={{ width: 80, height: "auto", display: "block", objectFit: "contain" }}
          />
        </div>
      </div>
    </div>
  );
}

function SectionCard({ children, label }) {
  return (
    <div style={{ background: "#fff", borderRadius: 22, border: "1px solid #EDE8DF", padding: "20px 18px", marginBottom: 14, boxShadow: "0 1px 8px rgba(139,106,62,0.04)" }}>
      {label && <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, color: "#C4A882", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 16 }}>{label}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled, style: s }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width: "100%", padding: "15px", background: "#1C1917", border: "none", borderRadius: 16, color: "#FAF8F5", fontSize: 13, fontWeight: 600, fontFamily: "'Montserrat', sans-serif", cursor: disabled ? "not-allowed" : "pointer", letterSpacing: "0.06em", transition: "opacity 0.2s", ...s }}>{children}</button>
  );
}

function OutlineBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{ width: "100%", padding: "14px", background: "transparent", border: "1px solid #EDE8DF", borderRadius: 16, color: "#78716C", fontSize: 12, fontWeight: 500, fontFamily: "'Montserrat', sans-serif", cursor: "pointer", letterSpacing: "0.04em" }}>{children}</button>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const pageStyle = { width: "100%", minHeight: "100vh", position: "relative", zIndex: 1 };

// outerStyle: full-viewport flex shell that horizontally centres the app column
const outerStyle = {
  width: "100vw", minHeight: "100vh",
  display: "flex", justifyContent: "center", alignItems: "flex-start",
  background: "#FAF8F5",
};

const appStyle = {
  width: "100%", maxWidth: 960, minHeight: "100vh",
  fontFamily: "'Montserrat', sans-serif",
  position: "relative", overflow: "hidden",
  boxShadow: "0 0 80px rgba(139,106,62,0.07)",
};

const inputStyle = { width: "100%", background: "#F5F0E8", border: "1px solid #EDE8DF", borderRadius: 13, padding: "13px 15px", color: "#1C1917", fontSize: 13, fontFamily: "'Montserrat', sans-serif", fontWeight: 400, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s, background 0.2s" };

const selectStyle = { ...inputStyle, cursor: "pointer", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 12 12'%3E%3Cpath fill='%23A8957A' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 13px center", backgroundSize: "11px" };

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600;1,700&family=Montserrat:wght@300;400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; min-height: 100vh; background: #FAF8F5; font-family: 'Montserrat', sans-serif; -webkit-font-smoothing: antialiased; }
  #root { width: 100%; min-height: 100vh; }

  /* Wider inner padding on large screens */
  @media (min-width: 600px) {
    .page-content-wide { padding-left: 32px !important; padding-right: 32px !important; }
  }
  @media (min-width: 800px) {
    .page-content-wide { padding-left: 40px !important; padding-right: 40px !important; }
  }

  @keyframes goldShimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
  @keyframes pageSlide { from { opacity: 0; transform: translateX(18px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes toastSlide { from { opacity: 0; transform: translateX(-50%) translateY(-12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
  @keyframes dotBounce { 0%,80%,100% { transform: translateY(0); opacity: 0.4; } 40% { transform: translateY(-5px); opacity: 1; } }

  .page-enter { animation: pageSlide 0.32s cubic-bezier(0.25,0.46,0.45,0.94) both; }
  .anim-0 { animation: fadeUp 0.5s 0.0s cubic-bezier(0.16,1,0.3,1) both; }
  .anim-1 { animation: fadeUp 0.5s 0.08s cubic-bezier(0.16,1,0.3,1) both; }
  .anim-2 { animation: fadeUp 0.5s 0.16s cubic-bezier(0.16,1,0.3,1) both; }
  .anim-3 { animation: fadeUp 0.5s 0.24s cubic-bezier(0.16,1,0.3,1) both; }
  .fade-in-item { animation: fadeUp 0.45s ease both; }
  .toast-slide { animation: toastSlide 0.3s cubic-bezier(0.16,1,0.3,1) both; }

  .card-lift { transition: transform 0.2s ease, box-shadow 0.2s ease; }
  .card-lift:hover { transform: translateY(-3px); box-shadow: 0 10px 30px rgba(139,106,62,0.12) !important; }
  .card-lift:active { transform: scale(0.98); }

  .dot-bounce { animation: dotBounce 1.3s ease-in-out infinite; }
  .delay-0 { animation-delay: 0s; }
  .delay-1 { animation-delay: 0.15s; }
  .delay-2 { animation-delay: 0.3s; }

  input:focus, textarea:focus, select:focus { border-color: #C4A882 !important; background: #fff !important; outline: none; }
  input::placeholder, textarea::placeholder { color: #C4A882; font-weight: 400; }
  ::-webkit-scrollbar { display: none; }
  button { outline: none; -webkit-tap-highlight-color: transparent; }

  /* ── Responsive layout breakpoints ───────────────────────────────────── */

  /* Tablet: 600px+ */
  @media (min-width: 600px) {
    .product-grid   { grid-template-columns: repeat(3, 1fr) !important; }
    .uni-cards-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .clubs-grid     { grid-template-columns: repeat(2, 1fr) !important; }
    .rides-grid     { grid-template-columns: repeat(2, 1fr) !important; }
    .nav-cards-grid { display: grid !important; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    .nav-card       { flex-direction: column !important; align-items: flex-start !important; gap: 14px !important; padding: 24px 20px !important; }
  }

  /* Desktop: 800px+ */
  @media (min-width: 800px) {
    .product-grid   { grid-template-columns: repeat(4, 1fr) !important; gap: 16px !important; }
    .uni-cards-grid { grid-template-columns: repeat(3, 1fr) !important; }
    .clubs-grid     { grid-template-columns: repeat(2, 1fr) !important; }
    .rides-grid     { grid-template-columns: repeat(2, 1fr) !important; }
  }
`;
