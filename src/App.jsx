import newCornerLogo from './assets/crnr_inspyrenet.png';
import cnxfLogo from './assets/cnxf.png';
import { useState, useEffect, useRef } from "react";
import MeetDeveloper from "./MeetDeveloper";
import { createClient } from '@supabase/supabase-js';

// ══════════════════════════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ══════════════════════════════════════════════════════════════════════════════
const supabase = createClient(
  'https://ozwqowkjtxjcevqcolxq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96d3Fvd2tqdHhqY2V2cWNvbHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTIzMTYsImV4cCI6MjA4ODc4ODMxNn0.SuSoUtI-SCiA7r1jd-GbOrYkqk1vAN3I9AOO-NQpwLU'
);

// ══════════════════════════════════════════════════════════════════════════════
// ARCHITECTURE: University Gateway System
// Flow: Loading → Login/Skip → University Gateway → University Dashboard
// ══════════════════════════════════════════════════════════════════════════════

const LOGO_SRC = cnxfLogo;
const NEW_LOGO_SRC = newCornerLogo;

const S = {
  LOADING:     0,
  AUTH:        1,
  GATEWAY:     2,
  HOME:        3,
  MARKETPLACE: 4,
  PRODUCT:     5,
  SELL:        6,
  RIDESHARE:   7,
  OFFER_RIDE:  8,
  CLUBS:       9,
  CREATE_CLUB: 10,
  MY_HUB:      11, // ← NEW: user dashboard
};

const CAT_COLORS = { Books: "#6366F1", Notes: "#EF4444", Parts: "#F97316", Projects: "#22C55E", Gadgets: "#EC4899", Tools: "#10B981", Assignments: "#3B82F6" };
const CAT_EMOJIS = { Books: "📚", Notes: "📝", Parts: "🔧", Projects: "💻", Gadgets: "📱", Tools: "🛠️", Assignments: "📄" };
const RIDE_COLORS = ["#10B981","#6366F1","#EC4899","#F97316","#8B5CF6","#8B6A3E"];

// ══════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState(S.LOADING);
  const [loadProgress, setLoadProgress] = useState(0);
  const [toast, setToast] = useState(null);

  // ── Auth state ─────────────────────────────────────────────────────────────
  const [authUser, setAuthUser]     = useState(null); // Supabase auth user
  const [profile, setProfile]       = useState(null); // profiles table row
  const [authLoading, setAuthLoading] = useState(true);

  // ── University database ────────────────────────────────────────────────────
  const [uniDB, setUniDB] = useState({});

  // ── Marketplace / Rides / Clubs (live from DB) ─────────────────────────────
  const [listings, setListings]     = useState([]);
  const [rides, setRides]           = useState([]);
  const [clubs, setClubs]           = useState({});   // { uniId: [] } still local

  // ── Within-uni navigation ──────────────────────────────────────────────────
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [marketFilter, setMarketFilter]       = useState("All");
  const [clubFilter, setClubFilter]           = useState("All");
  const [joinedClubs, setJoinedClubs]         = useState({});
  const [confirmedRides, setConfirmedRides]   = useState({});

  const toast_ = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3200); };

  // ── Loading bar ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== S.LOADING) return;
    const DURATION = 8000;
    const startTime = performance.now();
    const ease = (t) => {
      if (t < 0.45) return t * 1.6;
      if (t < 0.72) return 0.72 + (t - 0.45) * 0.55;
      return Math.min(1, 0.87 + (t - 0.72) * 1.1);
    };
    const iv = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / DURATION, 1);
      const p = Math.round(ease(t) * 100);
      setLoadProgress(p);
      if (p >= 100) clearInterval(iv);
    }, 40);
    return () => clearInterval(iv);
  }, []);

  // ── Load universities from Supabase ────────────────────────────────────────
  useEffect(() => {
    supabase.from('universities').select('*').then(({ data }) => {
      if (data) {
        const db = {};
        data.forEach(u => {
          db[u.id] = {
            id: u.id, name: u.name, shortName: u.short_name,
            city: u.city, members: u.members,
            established: u.established, accent: u.accent,
            products: [], rides: [], clubs: [],
          };
        });
        setUniDB(db);
      }
    });
  }, []);

  // ── Listen for auth changes (persists session across refresh) ─────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAuthUser(session.user);
        loadProfile(session.user.id);
      } else {
        setAuthLoading(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAuthUser(session.user);
        loadProfile(session.user.id);
      } else {
        setAuthUser(null);
        setProfile(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setProfile(data);
      if (data.university_id) {
        await loadUniData(data.university_id);
      }
    }
    setAuthLoading(false);
  };

  const loadUniData = async (uniId) => {
    const [{ data: ls }, { data: rs }] = await Promise.all([
      supabase.from('listings').select('*').eq('uni_id', uniId).eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('rides').select('*').eq('uni_id', uniId).eq('status', 'active').order('created_at', { ascending: false }),
    ]);
    if (ls) setListings(ls);
    if (rs) setRides(rs);
  };

  // ── Auth handlers ──────────────────────────────────────────────────────────
  const handleSignUp = async (name, email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name } }
    });
    if (error) { toast_("❌ " + error.message); return; }
    if (data.user) {
      // Update name in profiles
      await supabase.from('profiles').update({ name }).eq('id', data.user.id);
      toast_("✅ Account created! Welcome to Connexus.");
    }
  };

  const handleLogin = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { toast_("❌ " + error.message); return; }
  };

  const handleGuest = () => {
    // Guest: fake local user, no Supabase
    setProfile({ id: 'guest', name: 'Guest', university_id: null });
    setScreen(S.GATEWAY);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setAuthUser(null);
    setListings([]);
    setRides([]);
    setScreen(S.AUTH);
  };

  // ── University selection ───────────────────────────────────────────────────
  const handleSelectUniversity = async (uniId) => {
    if (authUser && profile?.id !== 'guest') {
      await supabase.from('profiles').update({ university_id: uniId }).eq('id', authUser.id);
      // Bump member count
      await supabase.from('universities').update({ members: (uniDB[uniId]?.members || 0) + 1 }).eq('id', uniId);
    }
    setProfile(p => ({ ...p, university_id: uniId }));
    await loadUniData(uniId);
    setScreen(S.HOME);
    toast_(`🎓 Welcome to ${uniDB[uniId]?.shortName}!`);
  };

  const handleCreateUniversity = async (uniData) => {
    const id = uniData.name.toLowerCase().replace(/\s+/g, "_").slice(0, 20) + "_" + Date.now().toString().slice(-4);
    const newUni = {
      id, name: uniData.name,
      short_name: uniData.shortName || uniData.name,
      city: uniData.city || "India",
      established: new Date().getFullYear().toString(),
      accent: "#8B6A3E", members: 1,
    };
    if (authUser && profile?.id !== 'guest') {
      await supabase.from('universities').insert(newUni);
      await supabase.from('profiles').update({ university_id: id }).eq('id', authUser.id);
    }
    setUniDB(db => ({ ...db, [id]: { ...newUni, shortName: newUni.short_name, products: [], rides: [], clubs: [] } }));
    setProfile(p => ({ ...p, university_id: id }));
    setScreen(S.HOME);
    toast_(`🏛️ ${newUni.short_name} created!`);
  };

  const handleSwitchUni = () => {
    setProfile(p => ({ ...p, university_id: null }));
    setScreen(S.GATEWAY);
  };

  // ── Sell item ──────────────────────────────────────────────────────────────
  const handleSellItem = async (item) => {
    if (!profile?.university_id) return;
    const row = {
      user_id: authUser?.id || null,
      uni_id: profile.university_id,
      title: item.title,
      category: item.category,
      price: item.price,
      condition: item.condition,
      description: item.desc,
      seller_name: item.seller,
      dept: item.dept,
      status: 'active',
    };
    if (authUser && profile?.id !== 'guest') {
      const { data } = await supabase.from('listings').insert(row).select().single();
      if (data) setListings(ls => [data, ...ls]);
    } else {
      // Guest: local only
      setListings(ls => [{ ...row, id: Date.now(), created_at: new Date().toISOString() }, ...ls]);
    }
    toast_("✅ Listed in " + uni?.shortName + "!");
    setScreen(S.MARKETPLACE);
  };

  // ── Offer ride ─────────────────────────────────────────────────────────────
  const handleOfferRide = async (ride) => {
    if (!profile?.university_id) return;
    const row = {
      user_id: authUser?.id || null,
      uni_id: profile.university_id,
      driver: ride.driver,
      from_location: ride.from,
      to_location: ride.to,
      ride_date: ride.date,
      ride_time: ride.time,
      seats: parseInt(ride.seats),
      cost: parseInt(ride.cost),
      status: 'active',
    };
    if (authUser && profile?.id !== 'guest') {
      const { data } = await supabase.from('rides').insert(row).select().single();
      if (data) setRides(rs => [data, ...rs]);
    } else {
      setRides(rs => [{ ...row, id: Date.now(), created_at: new Date().toISOString() }, ...rs]);
    }
    toast_("🚗 Ride posted for " + uni?.shortName + " students!");
    setScreen(S.RIDESHARE);
  };

  // ── Join ride ──────────────────────────────────────────────────────────────
  const handleJoinRide = async (id) => {
    setRides(rs => rs.map(r => r.id === id && r.seats > 0 ? { ...r, seats: r.seats - 1 } : r));
    setConfirmedRides(c => ({ ...c, [id]: true }));
    if (authUser) {
      await supabase.from('rides').update({ seats: rides.find(r => r.id === id)?.seats - 1 }).eq('id', id);
    }
    toast_("🎉 Seat reserved!");
  };

  // ── Clubs (still local for now) ────────────────────────────────────────────
  const getLocalClubs = () => {
    const uniId = profile?.university_id;
    if (!uniId) return [];
    return clubs[uniId] || uniDB[uniId]?.clubs || LOCAL_CLUBS[uniId] || [];
  };

  const handleJoinClub = (id) => {
    setJoinedClubs(j => ({ ...j, [id]: true }));
    toast_("🏆 Joined!");
  };

  const handleCreateClub = (club) => {
    const uniId = profile?.university_id;
    const newClub = { ...club, id: Date.now(), members: 1, icon: "⭐", color: "#6366F1" };
    setClubs(c => ({ ...c, [uniId]: [newClub, ...(c[uniId] || getLocalClubs())] }));
    toast_("🎊 Club created in " + uni?.shortName + "!");
    setScreen(S.CLUBS);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const uni = profile?.university_id ? uniDB[profile.university_id] : null;
  const currentUser = profile ? { id: profile.id, name: profile.name, universityId: profile.university_id } : null;

  // ── Screen routing ─────────────────────────────────────────────────────────
  return (
    <div style={outerStyle}>
      <div style={appStyle}>
        <BgPattern screen={screen} />
        <style>{globalCSS}</style>
        {toast && <Toast msg={toast} />}

        {screen === S.LOADING &&
         <LoadingScreen progress={Math.min(loadProgress, 100)} onDone={() => {
  if (profile?.university_id) {
    setScreen(S.HOME);
  } else if (authUser) {
    setScreen(S.GATEWAY);
  } else {
    setScreen(S.AUTH);
  }
}} />}

        {screen === S.AUTH &&
          <AuthScreen
            onSignUp={handleSignUp}
            onLogin={handleLogin}
            onGuest={handleGuest}
          />}

        {screen === S.GATEWAY &&
          <GatewayScreen
            uniDB={uniDB}
            currentUser={currentUser}
            onSelect={handleSelectUniversity}
            onCreate={handleCreateUniversity}
            onBack={() => setScreen(S.AUTH)}
          />}

        {screen === S.HOME && uni &&
          <HomeScreen
            uni={uni} user={currentUser}
            onNav={setScreen} onSwitchUni={handleSwitchUni}
            onBack={() => setScreen(S.GATEWAY)}
            onHub={() => setScreen(S.MY_HUB)}
          />}

        {screen === S.MARKETPLACE && uni &&
          <MarketplaceScreen
            products={listings} uni={uni}
            filter={marketFilter} setFilter={setMarketFilter}
            onBack={() => setScreen(S.HOME)}
            onView={p => { setSelectedProduct(p); setScreen(S.PRODUCT); }}
            onSell={() => setScreen(S.SELL)}
          />}

        {screen === S.PRODUCT && selectedProduct && uni &&
          <ProductDetailScreen
            product={selectedProduct}
            currentUser={currentUser}
            onBack={() => setScreen(S.MARKETPLACE)}
            onInterest={async (msg, contact) => {
              if (!authUser) { toast_("⚠️ Sign in to express interest"); return; }
              await supabase.from('interests').insert({
                from_user_id: authUser.id,
                from_name: profile.name,
                listing_id: selectedProduct.id,
                type: 'marketplace',
                message: msg,
                contact,
              });
              toast_("✅ Interest sent to seller!");
            }}
          />}

        {screen === S.SELL && uni &&
          <SellScreen onBack={() => setScreen(S.MARKETPLACE)} onSubmit={handleSellItem} />}

        {screen === S.RIDESHARE && uni &&
          <RideshareScreen
            rides={rides} uni={uni}
            confirmed={confirmedRides}
            onBack={() => setScreen(S.HOME)}
            onJoin={handleJoinRide}
            onOffer={() => setScreen(S.OFFER_RIDE)}
          />}

        {screen === S.OFFER_RIDE && uni &&
          <OfferRideScreen onBack={() => setScreen(S.RIDESHARE)} onSubmit={handleOfferRide} />}

        {screen === S.CLUBS && uni &&
          <ClubsScreen
            clubs={getLocalClubs()} uni={uni}
            filter={clubFilter} setFilter={setClubFilter}
            joined={joinedClubs}
            onBack={() => setScreen(S.HOME)}
            onJoin={handleJoinClub}
            onCreate={() => setScreen(S.CREATE_CLUB)}
          />}

        {screen === S.CREATE_CLUB && uni &&
          <CreateClubScreen onBack={() => setScreen(S.CLUBS)} onSubmit={handleCreateClub} />}

        {screen === S.MY_HUB &&
          <MyHubScreen
            currentUser={currentUser}
            authUser={authUser}
            uni={uni}
            onBack={() => setScreen(S.HOME)}
            onLogout={handleLogout}
            toast_={toast_}
          />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LOCAL CLUBS SEED (clubs not in DB yet)
// ══════════════════════════════════════════════════════════════════════════════
const LOCAL_CLUBS = {
  vjti: [
    { id: 301, name: "Code Craft Club", category: "Tech", members: 234, icon: "⚡", desc: "Hackathons, DSA sprints & open source contributions.", event: "Hackathon 2025", eventDate: "Feb 28", color: "#6366F1" },
    { id: 302, name: "Robotics Society", category: "Tech", members: 89, icon: "🤖", desc: "Build, break, rebuild. Annual robo-wars + IEEE workshops.", event: "Robo-Wars Prelims", eventDate: "Mar 5", color: "#EF4444" },
    { id: 303, name: "Basketball Team", category: "Sports", members: 45, icon: "🏀", desc: "Inter-college tournaments. Practices Mon/Wed/Fri.", event: "Inter-College Match", eventDate: "Mar 2", color: "#F97316" },
  ],
  ict: [
    { id: 401, name: "Photography Guild", category: "Arts", members: 112, icon: "📷", desc: "Weekly photo walks, darkroom sessions.", event: "Campus Photo Walk", eventDate: "Feb 25", color: "#22C55E" },
    { id: 402, name: "Eco Warriors", category: "Social", members: 160, icon: "🌿", desc: "Campus sustainability drives.", event: "Tree Plantation Drive", eventDate: "Feb 22", color: "#10B981" },
  ],
  iitb: [
    { id: 501, name: "E-Cell IIT Bombay", category: "Leadership", members: 320, icon: "🚀", desc: "Startup weekends, investor connects.", event: "Startup Weekend", eventDate: "Mar 10", color: "#F97316" },
    { id: 502, name: "Aeromodelling Club", category: "Tech", members: 95, icon: "✈️", desc: "Design and fly RC aircraft and drones.", event: "Drone Fest", eventDate: "Mar 8", color: "#6366F1" },
  ],
};

// ══════════════════════════════════════════════════════════════════════════════
// MY HUB — User Dashboard
// ══════════════════════════════════════════════════════════════════════════════
function MyHubScreen({ currentUser, authUser, uni, onBack, onLogout, toast_ }) {
  const [tab, setTab] = useState("listings");
  const [myListings, setMyListings]   = useState([]);
  const [myRides, setMyRides]         = useState([]);
  const [interests, setInterests]     = useState([]);
  const [rideInterests, setRideInterests] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [expandedId, setExpandedId]   = useState(null);

  useEffect(() => {
    if (!authUser) { setLoading(false); return; }
    const load = async () => {
      const [{ data: ls }, { data: rs }] = await Promise.all([
        supabase.from('listings').select('*').eq('user_id', authUser.id).order('created_at', { ascending: false }),
        supabase.from('rides').select('*').eq('user_id', authUser.id).order('created_at', { ascending: false }),
      ]);
      if (ls) setMyListings(ls);
      if (rs) setMyRides(rs);

      // Load interests for my listings
      if (ls && ls.length > 0) {
        const ids = ls.map(l => l.id);
        const { data: ints } = await supabase.from('interests').select('*').in('listing_id', ids).order('created_at', { ascending: false });
        if (ints) setInterests(ints);
      }
      // Load interests for my rides
      if (rs && rs.length > 0) {
        const ids = rs.map(r => r.id);
        const { data: rints } = await supabase.from('interests').select('*').in('ride_id', ids).order('created_at', { ascending: false });
        if (rints) setRideInterests(rints);
      }
      setLoading(false);
    };
    load();
  }, [authUser]);

  const markSeen = async (interestId) => {
    await supabase.from('interests').update({ status: 'seen' }).eq('id', interestId);
    setInterests(i => i.map(x => x.id === interestId ? { ...x, status: 'seen' } : x));
    setRideInterests(i => i.map(x => x.id === interestId ? { ...x, status: 'seen' } : x));
  };

  const deleteListing = async (id) => {
    await supabase.from('listings').update({ status: 'sold' }).eq('id', id);
    setMyListings(ls => ls.filter(l => l.id !== id));
    toast_("✅ Marked as sold!");
  };

  const deleteRide = async (id) => {
    await supabase.from('rides').update({ status: 'completed' }).eq('id', id);
    setMyRides(rs => rs.filter(r => r.id !== id));
    toast_("✅ Ride marked complete!");
  };

  const allNotifs = [
    ...interests.map(i => ({ ...i, kind: 'listing', itemTitle: myListings.find(l => l.id === i.listing_id)?.title })),
    ...rideInterests.map(i => ({ ...i, kind: 'ride', itemTitle: myRides.find(r => r.id === i.ride_id) ? `${myRides.find(r => r.id === i.ride_id)?.from_location} → ${myRides.find(r => r.id === i.ride_id)?.to_location}` : 'Ride' })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const unreadCount = allNotifs.filter(n => n.status === 'pending').length;

  return (
    <Page style={{ display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "52px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={onBack} style={{ background: "#fff", border: "1px solid #EDE8DF", color: "#1C1917", borderRadius: 12, width: 38, height: 38, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 6px rgba(139,106,62,0.08)" }}>←</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, color: "#1C1917", fontSize: 18 }}>My Hub</div>
          {uni && <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, color: "#A8957A", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 2 }}>{uni.shortName}</div>}
        </div>
        <button onClick={onLogout} style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#EF4444", borderRadius: 10, padding: "6px 12px", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }}>Sign Out</button>
      </div>

      {/* User card */}
      <div style={{ margin: "20px 24px 0", background: "linear-gradient(135deg, #1C1917, #3D2B1F)", borderRadius: 20, padding: "20px 22px", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg, #8B6A3E, #C4A055)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 22, fontFamily: "'Playfair Display', serif", flexShrink: 0 }}>
          {currentUser?.name?.[0] || "S"}
        </div>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#FAF8F5" }}>{currentUser?.name}</div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#C4A055", fontWeight: 500, marginTop: 3 }}>
            {authUser ? "✓ Verified Student" : "Guest — sign in to save data"}
          </div>
        </div>
        {unreadCount > 0 && (
          <div style={{ marginLeft: "auto", background: "#EF4444", color: "#fff", borderRadius: 99, padding: "4px 10px", fontSize: 11, fontWeight: 700, fontFamily: "'Montserrat', sans-serif" }}>
            {unreadCount} new
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ padding: "20px 24px 0" }}>
        <div style={{ display: "flex", background: "#F5F0E8", borderRadius: 14, padding: 3, gap: 2 }}>
          {[
            { k: "listings", label: "📦 My Listings", count: myListings.length },
            { k: "rides",    label: "🚗 My Rides",    count: myRides.length },
            { k: "notifs",   label: "🔔 Alerts",      count: unreadCount },
          ].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              flex: 1, padding: "9px 4px", border: "none", borderRadius: 11, cursor: "pointer",
              fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 10, letterSpacing: "0.02em",
              background: tab === t.k ? "#1C1917" : "transparent",
              color: tab === t.k ? "#FAF8F5" : "#A8957A",
              transition: "all 0.25s ease",
              position: "relative",
            }}>
              {t.label}
              {t.count > 0 && tab !== t.k && (
                <span style={{ marginLeft: 4, background: t.k === "notifs" ? "#EF4444" : "#8B6A3E", color: "#fff", borderRadius: 99, padding: "1px 6px", fontSize: 9 }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px 24px 32px", scrollbarWidth: "none" }}>
        {loading && <div style={{ textAlign: "center", padding: "60px 0", fontFamily: "'Montserrat', sans-serif", color: "#C4B5A4", fontSize: 13 }}>Loading your data…</div>}

        {!loading && !authUser && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#1C1917", fontWeight: 700, marginBottom: 8 }}>Sign in to unlock My Hub</div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#A8957A" }}>Guests can browse — but sign in to track your listings, rides, and who's interested.</div>
          </div>
        )}

        {/* MY LISTINGS TAB */}
        {!loading && authUser && tab === "listings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {myListings.length === 0 && (
              <EmptyState icon="📦" title="No listings yet" sub="Go to Marketplace and list your first item!" />
            )}
            {myListings.map(item => {
              const itemInterests = interests.filter(i => i.listing_id === item.id);
              const isExpanded = expandedId === item.id;
              return (
                <div key={item.id} style={{ background: "#fff", borderRadius: 18, border: "1px solid #EDE8DF", overflow: "hidden", boxShadow: "0 2px 10px rgba(139,106,62,0.05)" }}>
                  <div style={{ height: 3, background: CAT_COLORS[item.category] || "#8B6A3E" }} />
                  <div style={{ padding: "16px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, color: CAT_COLORS[item.category] || "#8B6A3E", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{item.category}</div>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "#1C1917", marginBottom: 4 }}>{item.title}</div>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "#8B6A3E" }}>₹{item.price}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                        <button onClick={() => setExpandedId(isExpanded ? null : item.id)} style={{ background: itemInterests.length > 0 ? "#1C1917" : "#F5F0E8", border: "none", color: itemInterests.length > 0 ? "#FAF8F5" : "#A8957A", borderRadius: 10, padding: "6px 12px", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }}>
                          {itemInterests.length > 0 ? `👀 ${itemInterests.length} interested` : "No interest yet"}
                        </button>
                        <button onClick={() => deleteListing(item.id)} style={{ background: "#FEF2F2", border: "none", color: "#EF4444", borderRadius: 8, padding: "5px 10px", fontSize: 9, fontWeight: 600, cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }}>Mark Sold</button>
                      </div>
                    </div>
                    {isExpanded && itemInterests.length > 0 && (
                      <div style={{ marginTop: 14, borderTop: "1px solid #F5F0E8", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                        {itemInterests.map(interest => (
                          <InterestCard key={interest.id} interest={interest} onSeen={() => markSeen(interest.id)} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MY RIDES TAB */}
        {!loading && authUser && tab === "rides" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {myRides.length === 0 && (
              <EmptyState icon="🚗" title="No rides posted" sub="Go to Ride Pool and offer a ride!" />
            )}
            {myRides.map((ride, idx) => {
              const rInterests = rideInterests.filter(i => i.ride_id === ride.id);
              const isExpanded = expandedId === ride.id;
              const color = RIDE_COLORS[idx % RIDE_COLORS.length];
              return (
                <div key={ride.id} style={{ background: "#fff", borderRadius: 18, border: "1px solid #EDE8DF", overflow: "hidden", boxShadow: "0 2px 10px rgba(139,106,62,0.05)" }}>
                  <div style={{ height: 3, background: color }} />
                  <div style={{ padding: "16px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 600, color: "#1C1917", marginBottom: 4 }}>{ride.from_location} → {ride.to_location}</div>
                        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#A8957A" }}>📅 {ride.ride_date} · 🕐 {ride.ride_time} · 💺 {ride.seats} seats · <span style={{ color, fontWeight: 700 }}>₹{ride.cost}</span></div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                        <button onClick={() => setExpandedId(isExpanded ? null : ride.id)} style={{ background: rInterests.length > 0 ? "#1C1917" : "#F5F0E8", border: "none", color: rInterests.length > 0 ? "#FAF8F5" : "#A8957A", borderRadius: 10, padding: "6px 12px", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }}>
                          {rInterests.length > 0 ? `🙋 ${rInterests.length} requests` : "No requests yet"}
                        </button>
                        <button onClick={() => deleteRide(ride.id)} style={{ background: "#F0FFF4", border: "none", color: "#16A34A", borderRadius: 8, padding: "5px 10px", fontSize: 9, fontWeight: 600, cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }}>Mark Complete</button>
                      </div>
                    </div>
                    {isExpanded && rInterests.length > 0 && (
                      <div style={{ marginTop: 14, borderTop: "1px solid #F5F0E8", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                        {rInterests.map(interest => (
                          <InterestCard key={interest.id} interest={interest} onSeen={() => markSeen(interest.id)} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {!loading && authUser && tab === "notifs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {allNotifs.length === 0 && (
              <EmptyState icon="🔔" title="No notifications yet" sub="When someone is interested in your listing or ride, it'll show up here." />
            )}
            {allNotifs.map(n => (
              <div key={n.id} onClick={() => { markSeen(n.id); setTab(n.kind === 'listing' ? 'listings' : 'rides'); }} style={{ background: n.status === 'pending' ? "#FFFBF0" : "#fff", borderRadius: 14, border: `1px solid ${n.status === 'pending' ? "#F59E0B40" : "#EDE8DF"}`, padding: "14px 16px", cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ fontSize: 22, flexShrink: 0 }}>{n.kind === 'listing' ? "📦" : "🚗"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 600, color: "#1C1917", marginBottom: 3 }}>
                    <span style={{ color: "#8B6A3E" }}>{n.from_name}</span> {n.kind === 'listing' ? "is interested in your listing" : "wants to join your ride"}
                  </div>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#78716C", marginBottom: 4 }}>"{n.message}"</div>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#C4B5A4" }}>{n.itemTitle}</div>
                </div>
                {n.status === 'pending' && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B", flexShrink: 0, marginTop: 4 }} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}

// ── Interest Card (shown in My Hub when buyer expressed interest) ──────────────
function InterestCard({ interest, onSeen }) {
  return (
    <div onClick={onSeen} style={{ background: interest.status === 'pending' ? "#FFFBF0" : "#FAF8F5", borderRadius: 12, border: `1px solid ${interest.status === 'pending' ? "#F59E0B40" : "#EDE8DF"}`, padding: "12px 14px", cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #8B6A3E, #C4A055)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 11, fontFamily: "'Playfair Display', serif" }}>{interest.from_name[0]}</div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 600, color: "#1C1917" }}>{interest.from_name}</div>
        </div>
        {interest.status === 'pending' && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B" }} />}
      </div>
      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#4B4540", marginBottom: interest.contact ? 8 : 0, fontStyle: "italic" }}>"{interest.message}"</div>
      {interest.contact && (
        <div style={{ background: "#fff", borderRadius: 8, padding: "7px 10px", border: "1px solid #EDE8DF", fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#1C1917", fontWeight: 600 }}>📞 {interest.contact}</div>
      )}
    </div>
  );
}

function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 0" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: "#78716C", fontWeight: 600 }}>{title}</div>
      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#C4B5A4", marginTop: 6 }}>{sub}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BACKGROUND PATTERN
// ══════════════════════════════════════════════════════════════════════════════
function BgPattern({ screen }) {
  if (screen === S.LOADING) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: "#FAF8F5", backgroundImage: "radial-gradient(circle, #C8BCA8 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════════════════════════
function Toast({ msg }) {
  return (
    <div className="toast-slide" style={{ position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)", background: "#1C1917", color: "#FAF8F5", borderRadius: 12, padding: "11px 22px", fontSize: 12, fontWeight: 600, fontFamily: "'Montserrat', sans-serif", boxShadow: "0 12px 40px rgba(0,0,0,0.25)", zIndex: 9999, whiteSpace: "nowrap", letterSpacing: "0.02em" }}>{msg}</div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LOADING SCREEN
// ══════════════════════════════════════════════════════════════════════════════
function LoadingScreen({ progress, onDone }) {
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
    transition: `opacity 0.9s cubic-bezier(0.16,1,0.3,1) ${delay || 0}ms, transform 0.9s cubic-bezier(0.16,1,0.3,1) ${delay || 0}ms`,
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#0A0A0A", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 40px", opacity: phase === 4 ? 0 : 1, transition: "opacity 0.85s cubic-bezier(0.4,0,0.2,1)" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 55% at 50% 48%, rgba(46,204,143,0.15) 0%, transparent 70%)", opacity: phase >= 1 ? 1 : 0, transition: "opacity 2s ease", pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
        <div style={{ ...fade(phase >= 1), marginBottom: 60 }}>
          <img src={LOGO_SRC} alt="Connexus" style={{ width: 250, height: "auto", display: "block", filter: "drop-shadow(0 0 32px rgba(200,160,80,0.2)) brightness(1.5)" }} />
          <div style={{ fontFamily: "'Cheque', serif", fontSize: 28, color: "#2ECC8F", letterSpacing: "0.15em", marginTop: 12, textAlign: "center" }}>CONNEXUS</div>
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
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 600, fontStyle: "italic", color: "rgba(255,255,255,0.5)", lineHeight: 1.8, whiteSpace: "nowrap" }}>A Student to Student Network for Shared Services</div>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 36, display: "flex", alignItems: "center", gap: 10, opacity: phase >= 3 ? 1 : 0, transition: "opacity 0.5s ease 0.3s" }}>
        <div style={{ width: 20, height: 1, background: "rgba(196,160,85,0.5)" }} />
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 7, fontWeight: 600, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(46, 204, 143, 0.7)" }}>MARKETPLACE, RIDEPOOLING, COMMUNITY.</div>
        <div style={{ width: 20, height: 1, background: "rgba(196,160,85,0.5)" }} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTH SCREEN — now with real Supabase auth
// ══════════════════════════════════════════════════════════════════════════════
function AuthScreen({ onSignUp, onLogin, onGuest }) {
  const [tab, setTab] = useState("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!email || !password) return;
    setLoading(true);
    if (tab === "signup") {
      await onSignUp(name || "Student", email, password);
    } else {
      await onLogin(email, password);
    }
    setLoading(false);
  };

  return (
    <Page style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 28px" }}>
      <div className="anim-0" style={{ textAlign: "center", marginBottom: 36 }}>
        <img src={NEW_LOGO_SRC} alt="Connexus" style={{ width: 220, height: "auto", display: "block", margin: "0 auto 20px", mixBlendMode: "multiply" }} />
        <div style={{ fontFamily: "'Cheque', serif", fontSize: 28, color: "#050505", letterSpacing: "0.15em", textAlign: "center" }}>CONNEXUS</div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 600, fontStyle: "italic", color: "#4A3728", lineHeight: 1.65, maxWidth: 270, margin: "10px auto 0", letterSpacing: "0.01em" }}>
          From trading Notes to Sharing Rides<br />
          <span style={{ color: "#8B6A3E", fontStyle: "normal", fontWeight: 700 }}>And joining Clubs.</span>
          <span style={{ display: "block", marginTop: 4, fontStyle: "normal", fontWeight: 400, fontSize: 13, color: "#452c09", fontFamily: "'Montserrat', sans-serif" }}>Powered by Student Nexus</span>
        </div>
      </div>
      <div className="anim-1" style={{ background: "#fff", borderRadius: 24, padding: "28px 24px", boxShadow: "0 2px 20px rgba(139,106,62,0.08)", border: "1px solid #EDE8DF" }}>
        <div style={{ display: "flex", background: "#F5F0E8", borderRadius: 12, padding: 3, marginBottom: 24, gap: 2 }}>
          {["signup", "login"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 9, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 12, textTransform: "capitalize", letterSpacing: "0.04em", background: tab === t ? "#1C1917" : "transparent", color: tab === t ? "#FAF8F5" : "#A8957A", transition: "all 0.25s ease" }}>
              {t === "signup" ? "Sign Up" : "Log In"}
            </button>
          ))}
        </div>
        {tab === "signup" && (
          <input placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        )}
        <input placeholder="University Email" value={email} onChange={e => setEmail(e.target.value)} type="email" style={inputStyle} />
        <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
        <PrimaryBtn style={{ marginTop: 20 }} onClick={handle} disabled={loading || !email || !password}>
          {loading ? "Please wait…" : tab === "signup" ? "Create Account & Continue →" : "Log In →"}
        </PrimaryBtn>
      </div>
      <div className="anim-2" style={{ textAlign: "center", marginTop: 20 }}>
        <div style={{ fontFamily: "'Montserrat', sans-serif", color: "#C4B5A4", fontSize: 10, marginBottom: 12, letterSpacing: "0.1em" }}>— OR —</div>
        <OutlineBtn onClick={onGuest}>Explore as guest →</OutlineBtn>
      </div>
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GATEWAY SCREEN
// ══════════════════════════════════════════════════════════════════════════════
function GatewayScreen({ uniDB, currentUser, onSelect, onCreate, onBack }) {
  const [tab, setTab] = useState("find");
  const [search, setSearch] = useState("");
  const [createForm, setCreateForm] = useState({ name: "", shortName: "", city: "" });
  const [creating, setCreating] = useState(false);

  const unis = Object.values(uniDB);
  const filtered = search.trim()
    ? unis.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.shortName.toLowerCase().includes(search.toLowerCase()) || u.city.toLowerCase().includes(search.toLowerCase()))
    : unis;

  const setC = (k, v) => setCreateForm(f => ({ ...f, [k]: v }));
  const canCreate = createForm.name.trim().length > 3;

  const handleCreate = () => {
    setCreating(true);
    setTimeout(() => { onCreate(createForm); setCreating(false); }, 1200);
  };

  return (
    <Page style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "52px 24px 0", display: "flex", alignItems: "center" }}>
        <button onClick={onBack} style={{ background: "#fff", border: "1px solid #EDE8DF", color: "#1C1917", borderRadius: 12, width: 38, height: 38, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 6px rgba(139,106,62,0.08)", flexShrink: 0 }}>←</button>
      </div>
      <div style={{ padding: "16px 24px 20px" }}>
        <div className="anim-0" style={{ textAlign: "center", marginBottom: 20 }}>
          <img src={NEW_LOGO_SRC} alt="Connexus" style={{ width: 200, height: "auto", display: "block", margin: "0 auto 18px", mixBlendMode: "multiply" }} />
          <div style={{ fontFamily: "'Cheque', serif", fontSize: 28, color: "#000000", letterSpacing: "0.15em", textAlign: "center" }}>CONNEXUS</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 600, fontStyle: "italic", color: "#4A3728", lineHeight: 1.65, maxWidth: 260, margin: "8px auto" }}>
            From trading Notes to Sharing Rides
            <span style={{ display: "block", color: "#8B6A3E", fontStyle: "normal", fontWeight: 700 }}>And joining Clubs.</span>
          </div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#3a2b15", fontWeight: 400 }}>Powered by Student Nexus.</div>
        </div>
        <div className="anim-1" style={{ borderTop: "1px solid #EDE8DF", paddingTop: 18 }}>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, color: "#8B6A3E", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 6 }}>Welcome, {currentUser?.name} 👋</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: "#1C1917", lineHeight: 1.2, letterSpacing: "-0.3px" }}>Choose Your University</div>
        </div>
      </div>

      <div className="anim-1" style={{ padding: "0 24px 20px" }}>
        <div style={{ display: "flex", background: "#F5F0E8", borderRadius: 14, padding: 3, gap: 2 }}>
          {[{ k: "find", label: "🔎 Find University" }, { k: "create", label: "➕ Create / Request" }].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{ flex: 1, padding: "10px 8px", border: "none", borderRadius: 11, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 11, letterSpacing: "0.03em", background: tab === t.k ? "#1C1917" : "transparent", color: tab === t.k ? "#FAF8F5" : "#A8957A", transition: "all 0.25s ease" }}>{t.label}</button>
          ))}
        </div>
      </div>

      {tab === "find" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "0 24px 16px" }}>
            <div style={{ background: "#fff", borderRadius: 14, display: "flex", alignItems: "center", padding: "12px 16px", boxShadow: "0 2px 12px rgba(139,106,62,0.07)", border: "1px solid #EDE8DF", gap: 10 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C4A882" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input placeholder="Search by name or city..." value={search} onChange={e => setSearch(e.target.value)} style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, color: "#1C1917", fontFamily: "'Montserrat', sans-serif", flex: 1, fontWeight: 400 }} />
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
              <div key={uni.id} className="card-lift fade-in-item" style={{ animationDelay: `${i * 0.05}s`, background: "#fff", borderRadius: 20, border: "1px solid #EDE8DF", overflow: "hidden", boxShadow: "0 2px 10px rgba(139,106,62,0.05)" }}>
                <div style={{ height: 3, background: uni.accent }} />
                <div style={{ padding: "18px 18px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <div style={{ width: 50, height: 50, borderRadius: 14, background: `${uni.accent}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, border: `1px solid ${uni.accent}22` }}>🏛️</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "#1C1917", marginBottom: 2 }}>{uni.shortName}</div>
                      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#A8957A", fontWeight: 500, marginBottom: 6 }}>{uni.city} · Est. {uni.established}</div>
                      <div style={{ display: "flex", gap: 12 }}>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#78716C" }}>👥 {uni.members?.toLocaleString()} members</span>
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
          <PrimaryBtn disabled={!canCreate || creating} onClick={handleCreate} style={{ opacity: canCreate ? 1 : 0.38 }}>
            {creating ? "Creating your space…" : "Create University Space 🏛️"}
          </PrimaryBtn>
        </div>
      )}
      <MeetDeveloper />
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// HOME SCREEN
// ══════════════════════════════════════════════════════════════════════════════
function HomeScreen({ uni, user, onNav, onSwitchUni, onBack, onHub }) {
  const cards = [
    { s: S.MARKETPLACE, icon: "🛍️", label: "Marketplace",     sub: "Books, Gadgets & more",     accent: "#8B6A3E" },
    { s: S.RIDESHARE,   icon: "🚗", label: "Ride Pool",        sub: "Share rides to campus",      accent: "#10B981" },
    { s: S.CLUBS,       icon: "🏆", label: "Clubs & Societies", sub: "Sports, Tech & more",        accent: "#6366F1" },
  ];
  return (
    <Page style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "56px 24px 0" }}>
        <div className="anim-0">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <button onClick={onBack} style={{ background: "#fff", border: "1px solid #EDE8DF", color: "#1C1917", borderRadius: 12, width: 38, height: 38, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 6px rgba(139,106,62,0.08)", flexShrink: 0 }}>←</button>
            <img src={NEW_LOGO_SRC} alt="Connexus" style={{ width: 90, height: "auto", objectFit: "contain" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${uni.accent}15`, border: `1px solid ${uni.accent}30`, borderRadius: 99, padding: "6px 14px 6px 8px" }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: uni.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>🏛️</div>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 700, color: uni.accent, letterSpacing: "0.06em" }}>{uni.shortName}</span>
              <button onClick={onSwitchUni} style={{ background: "none", border: "none", cursor: "pointer", color: `${uni.accent}88`, fontSize: 14, lineHeight: 1, padding: "0 0 0 4px" }} title="Switch university">⇄</button>
            </div>
            {/* My Hub button */}
            <button onClick={onHub} style={{ background: "#1C1917", border: "none", color: "#FAF8F5", borderRadius: 12, padding: "8px 16px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 6 }}>
              👤 My Hub
            </button>
          </div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, color: "#8B6A3E", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 10 }}>Good Morning, {user?.name} 👋</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 700, color: "#1C1917", lineHeight: 1.2, letterSpacing: "-0.3px" }}>What are you<br />exploring today?</div>
        </div>
      </div>

      <div style={{ padding: "24px 24px 8px" }} className="anim-1">
        <div style={{ background: "#fff", borderRadius: 16, display: "flex", alignItems: "center", padding: "14px 18px", boxShadow: "0 2px 12px rgba(139,106,62,0.07)", border: "1px solid #EDE8DF", gap: 12 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C4A882" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <span style={{ fontFamily: "'Montserrat', sans-serif", color: "#C4A882", fontSize: 14, fontWeight: 400 }}>Search in {uni.shortName}...</span>
        </div>
      </div>

      <div style={{ padding: "20px 24px 10px" }}>
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, color: "#C4A882", letterSpacing: "0.2em", textTransform: "uppercase" }}>Explore</div>
      </div>

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

      <div style={{ padding: "24px 24px 36px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#C4B5A4", letterSpacing: "0.08em" }}>{uni.members?.toLocaleString()} students</div>
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
            <div style={{ width: "100%", aspectRatio: "1", background: `${CAT_COLORS[item.category] || "#8B6A3E"}10`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 12, border: `1px solid ${CAT_COLORS[item.category] || "#8B6A3E"}18` }}>{CAT_EMOJIS[item.category] || "📦"}</div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, color: CAT_COLORS[item.category] || "#8B6A3E", marginBottom: 4, letterSpacing: "0.1em", textTransform: "uppercase" }}>{item.category}</div>
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
// PRODUCT DETAIL — with real interest flow
// ══════════════════════════════════════════════════════════════════════════════
function ProductDetailScreen({ product, currentUser, onBack, onInterest }) {
  const [step, setStep] = useState("prompts"); // prompts | contact | done
  const [selectedMsg, setSelectedMsg] = useState("");
  const [contact, setContact] = useState("");

  const prompts = ["Is this still available?", "Can we meet on campus?", "What's your best price?", "I want to buy this"];

  const handleSend = async () => {
    await onInterest(selectedMsg, contact);
    setStep("done");
  };

  return (
    <Page style={{ display: "flex", flexDirection: "column" }}>
      <Header onBack={onBack} title="Product Details" />
      <div style={{ flex: 1, overflow: "auto", scrollbarWidth: "none" }}>
        <div style={{ margin: "0 20px 18px", background: "#fff", borderRadius: 22, border: "1px solid #EDE8DF", overflow: "hidden", boxShadow: "0 2px 16px rgba(139,106,62,0.06)" }}>
          <div style={{ height: 190, background: `${CAT_COLORS[product.category] || "#8B6A3E"}10`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 76 }}>{CAT_EMOJIS[product.category] || "📦"}</div>
          <div style={{ padding: "20px 20px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, background: `${CAT_COLORS[product.category]}18`, color: CAT_COLORS[product.category], padding: "4px 10px", borderRadius: 99, letterSpacing: "0.08em", textTransform: "uppercase" }}>{product.category}</span>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#C4B5A4" }}>{product.condition}</div>
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#1C1917", marginBottom: 6, lineHeight: 1.3 }}>{product.title}</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: "#8B6A3E", marginBottom: 16 }}>₹{product.price}</div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: "#78716C", lineHeight: 1.7, fontWeight: 400, marginBottom: 18 }}>{product.description || product.desc}</div>
            <div style={{ background: "#FAF8F5", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, border: "1px solid #EDE8DF" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #8B6A3E, #C4A882)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16, fontFamily: "'Playfair Display', serif", flexShrink: 0 }}>{product.seller_name?.[0] || product.seller?.[0] || "S"}</div>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 600, color: "#1C1917" }}>{product.seller_name || product.seller}</div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#A8957A", fontWeight: 400, marginTop: 2 }}>{product.dept}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Interest flow */}
        <div style={{ margin: "0 20px 32px" }}>
          {step === "prompts" && (
            <>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, color: "#C4B5A4", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}>Express interest</div>
              {prompts.map((btn, i) => (
                <button key={btn} onClick={() => { setSelectedMsg(btn); setStep("contact"); }} className="card-lift"
                  style={{ width: "100%", background: i === 0 ? "#1C1917" : "#fff", border: i === 0 ? "none" : "1px solid #EDE8DF", color: i === 0 ? "#FAF8F5" : "#1C1917", borderRadius: 16, padding: "14px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", textAlign: "left", letterSpacing: "0.01em", marginBottom: 10 }}>{btn}</button>
              ))}
            </>
          )}
          {step === "contact" && (
            <div className="anim-0" style={{ background: "#fff", borderRadius: 22, border: "1px solid #EDE8DF", padding: "22px 20px" }}>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, color: "#C4A882", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}>Your message</div>
              <div style={{ background: "#FAF8F5", borderRadius: 12, padding: "12px 14px", fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: "#1C1917", marginBottom: 16, border: "1px solid #EDE8DF" }}>"{selectedMsg}"</div>
              <input placeholder="Your WhatsApp / contact (optional)" value={contact} onChange={e => setContact(e.target.value)} style={{ ...inputStyle, marginBottom: 16 }} />
              <PrimaryBtn onClick={handleSend}>Send to Seller →</PrimaryBtn>
              <button onClick={() => setStep("prompts")} style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: "#A8957A", fontSize: 12, cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }}>← Change message</button>
            </div>
          )}
          {step === "done" && (
            <div className="anim-0" style={{ background: "#F0FDF4", borderRadius: 22, border: "1px solid #86EFAC", padding: "28px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#1C1917", marginBottom: 8 }}>Interest sent!</div>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#16A34A" }}>The seller will see your message in their My Hub dashboard.</div>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SELL SCREEN
// ══════════════════════════════════════════════════════════════════════════════
function SellScreen({ onBack, onSubmit }) {
  const [form, setForm] = useState({ title: "", category: "Books", price: "", desc: "", seller: "", dept: "", condition: "Good" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.title && form.price && form.seller && form.dept && form.desc;
  return (
    <Page style={{ display: "flex", flexDirection: "column" }}>
      <Header onBack={onBack} title="List an Item" />
      <div style={{ flex: 1, overflow: "auto", padding: "0 20px 32px", scrollbarWidth: "none" }}>
        <SectionCard label="Item Details">
          <>
            <input placeholder="Product Title *" value={form.title} onChange={e => set("title", e.target.value)} style={inputStyle} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <select value={form.category} onChange={e => set("category", e.target.value)} style={selectStyle}>{["Books","Notes","Gadgets","Parts","Projects","Tools","Assignments"].map(c => <option key={c}>{c}</option>)}</select>
              <select value={form.condition} onChange={e => set("condition", e.target.value)} style={selectStyle}>{["New","Like New","Good","Used","For Parts"].map(c => <option key={c}>{c}</option>)}</select>
            </div>
            <input placeholder="Price (₹) *" type="number" value={form.price} onChange={e => set("price", e.target.value)} style={inputStyle} />
            <textarea placeholder="Description *" value={form.desc} onChange={e => set("desc", e.target.value)} style={{ ...inputStyle, height: 88, resize: "none" }} />
          </>
        </SectionCard>
        <SectionCard label="Seller Info">
          <>
            <input placeholder="Your Name *" value={form.seller} onChange={e => set("seller", e.target.value)} style={inputStyle} />
            <input placeholder="Your Department *" value={form.dept} onChange={e => set("dept", e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
          </>
        </SectionCard>
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
        {rides.map((ride, i) => {
          const color = RIDE_COLORS[i % RIDE_COLORS.length];
          return (
            <div key={ride.id} className="card-lift fade-in-item" style={{ animationDelay: `${i * 0.06}s`, background: "#fff", borderRadius: 20, border: "1px solid #EDE8DF", overflow: "hidden", boxShadow: "0 2px 10px rgba(139,106,62,0.05)" }}>
              <div style={{ height: 3, background: color }} />
              <div style={{ padding: "18px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${color}18`, border: `2px solid ${color}35`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color, fontSize: 17, fontFamily: "'Playfair Display', serif", flexShrink: 0 }}>{ride.driver[0]}</div>
                  <div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 600, color: "#1C1917" }}>{ride.driver}</div>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#A8A29E", fontWeight: 400, marginTop: 2 }}>Verified Student</div>
                  </div>
                  <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color }}>₹{ride.cost}</div>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, color: "#C4B5A4", fontWeight: 400 }}>per seat</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {[{ label: "FROM", val: ride.from_location || ride.from }, { label: "TO", val: ride.to_location || ride.to }].map((x, j) => (
                    <div key={j} style={{ flex: 1, background: "#FAF8F5", borderRadius: 12, padding: "10px 12px", border: "1px solid #EDE8DF" }}>
                      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 8, color: "#C4B5A4", fontWeight: 700, letterSpacing: "0.15em", marginBottom: 4 }}>{x.label}</div>
                      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#1C1917", fontWeight: 600 }}>{x.val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 14 }}>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#78716C" }}>📅 {ride.ride_date || ride.date}</span>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#78716C" }}>🕐 {ride.ride_time || ride.time}</span>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: ride.seats === 0 ? "#EF4444" : "#10B981", fontWeight: 600 }}>💺 {ride.seats} left</span>
                  </div>
                  <button disabled={ride.seats === 0 || confirmed[ride.id]} onClick={() => onJoin(ride.id)} style={{ padding: "8px 16px", borderRadius: 10, border: confirmed[ride.id] ? `1px solid ${color}` : "none", cursor: ride.seats === 0 ? "not-allowed" : "pointer", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 11, letterSpacing: "0.04em", background: confirmed[ride.id] ? `${color}12` : ride.seats === 0 ? "#F5F0E8" : color, color: confirmed[ride.id] ? color : ride.seats === 0 ? "#C4B5A4" : "#fff", transition: "all 0.2s" }}>
                    {confirmed[ride.id] ? "✓ Reserved" : ride.seats === 0 ? "Full" : "Join Ride"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
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
        <SectionCard label="Route Details">
          <>
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
          </>
        </SectionCard>
        <SectionCard label="Driver Info">
          <>
            <input placeholder="Your Name *" value={form.driver} onChange={e => set("driver", e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
          </>
        </SectionCard>
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
        {filtered.length === 0 && <EmptyState icon="🏆" title="No clubs yet" sub="Start the first club!" />}
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
        <SectionCard label="Club Info">
          <>
            <input placeholder="Club Name *" value={form.name} onChange={e => set("name", e.target.value)} style={inputStyle} />
            <select value={form.category} onChange={e => set("category", e.target.value)} style={selectStyle}>{["Tech","Sports","Arts","Leadership","Social"].map(c => <option key={c}>{c}</option>)}</select>
            <textarea placeholder="Club Description *" value={form.desc} onChange={e => set("desc", e.target.value)} style={{ ...inputStyle, height: 88, resize: "none" }} />
          </>
        </SectionCard>
        <SectionCard label="First Event">
          <>
            <input placeholder="Event Title *" value={form.event} onChange={e => set("event", e.target.value)} style={inputStyle} />
            <input placeholder="Event Date *" type="date" value={form.eventDate} onChange={e => set("eventDate", e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
          </>
        </SectionCard>
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
          <img src={NEW_LOGO_SRC} alt="Connexus" style={{ width: 80, height: "auto", display: "block", objectFit: "contain" }} />
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

  input:focus, textarea:focus, select:focus { border-color: #C4A882 !important; background: #fff !important; outline: none; }
  input::placeholder, textarea::placeholder { color: #C4A882; font-weight: 400; }
  ::-webkit-scrollbar { display: none; }
  button { outline: none; -webkit-tap-highlight-color: transparent; }

  @media (min-width: 600px) {
    .product-grid   { grid-template-columns: repeat(3, 1fr) !important; }
    .uni-cards-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .clubs-grid     { grid-template-columns: repeat(2, 1fr) !important; }
    .rides-grid     { grid-template-columns: repeat(2, 1fr) !important; }
    .nav-cards-grid { display: grid !important; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    .nav-card       { flex-direction: column !important; align-items: flex-start !important; gap: 14px !important; padding: 24px 20px !important; }
  }
  @media (min-width: 800px) {
    .product-grid   { grid-template-columns: repeat(4, 1fr) !important; gap: 16px !important; }
    .uni-cards-grid { grid-template-columns: repeat(3, 1fr) !important; }
  }
`;
