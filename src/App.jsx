import newCornerLogo from './assets/crnr_inspyrenet.png';
import cnxfLogo from './assets/cnxf.png';
import { useState, useEffect, useRef } from "react";
import MeetDeveloper from "./MeetDeveloper";
import { createClient } from '@supabase/supabase-js';
import CatCounter from "./CatCounter";

// ══════════════════════════════════════════════════════════════════════════════
// SUPABASE CLIENT shifted from sydney to mumbai
// ══════════════════════════════════════════════════════════════════════════════
const supabase = createClient(
  'https://krxdzlhkntraxqjjcpfb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGR6bGhrbnRyYXhxampjcGZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MDM5NzMsImV4cCI6MjA5MDA3OTk3M30.QR01tN5OL2ACxxeoRN18skzczMR4SkmzgAYvYCfA2vc'
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
  CLUB_DETAIL: 12,
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
  const [clubs, setClubs]           = useState([]);   // array from DB
  const [selectedClub, setSelectedClub] = useState(null);

  // ── Within-uni navigation ──────────────────────────────────────────────────
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [marketFilter, setMarketFilter]       = useState("All");
  const [clubFilter, setClubFilter]           = useState("All");
  const [joinedClubs, setJoinedClubs]         = useState({});
  const [confirmedRides, setConfirmedRides]   = useState({});
  const [joiningRide, setJoiningRide]         = useState(null); 

  const toast_ = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3200); };

  // ── Loading bar ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== S.LOADING) return;
    const DURATION = 5000;
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
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session?.user) {
        // Clear corrupt tokens automatically
        supabase.auth.signOut();
        setAuthLoading(false);
        return;
      }
      setAuthUser(session.user);
      loadProfile(session.user.id);
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
  // Realtime: passenger instant toast + fresh fetch on rider confirm/decline
  useEffect(() => {
    if (!authUser) return;
    const channel = supabase
      .channel(`ride-notif-${authUser.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'interests',
      }, async (payload) => {
        const rowId = payload.new?.id || payload.old?.id;
        if (!rowId) return;
        const { data: fr } = await supabase
          .from('interests').select('id,status,type,from_user_id').eq('id', rowId).single();
        if (!fr || fr.from_user_id !== authUser.id) return;
        if (fr.type !== 'ride') return;
        if (fr.status === 'connected') toast_(" 🎉 Seat confirmed! Check My Hub or connect on call.🤙");
        if (fr.status === 'declined')  toast_("❌ Rider declined your request. Try another ride!");
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [authUser]);

  const loadJoinedClubs = async (userId) => {
    const { data } = await supabase.from('club_members').select('club_id, name, department').eq('user_id', userId);
    if (data) {
      const map = {};
      data.forEach(m => { map[m.club_id] = { name: m.name, dept: m.department }; });
      setJoinedClubs(map);
    }
  };

  const loadProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setProfile(data);
      if (data.university_id) {
        await Promise.all([loadUniData(data.university_id), loadJoinedClubs(userId)]);
        setScreen(S.HOME);
      } else {
        setScreen(S.GATEWAY);
      }
    }
    setAuthLoading(false);
  };

  const loadUniData = async (uniId) => {
    const [{ data: ls }, { data: rs }, { data: cs }] = await Promise.all([
      supabase.from('listings').select('*').eq('uni_id', uniId).eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('rides').select('*').eq('uni_id', uniId).eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('clubs').select('*').eq('uni_id', uniId).order('created_at', { ascending: false }),
    ]);
    if (ls) setListings(ls);
    if (rs) setRides(rs);
    if (cs) setClubs(cs);
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
      toast_("✅ Account created! Welcome to Mewtual.");
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
    localStorage.clear();
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
      image_url: item.image_url || '',
      image_urls: item.image_urls || '[]',
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
      contact: ride.contact || '',
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
  const handleJoinRide = (ride) => {
    // Open meetup popup instead of directly joining
    setJoiningRide(ride);
  };

  const handleConfirmJoin = async (ride, location, time) => {
    if (!ride || ride.seats <= 0) return;
    setRides(rs => rs.map(r => r.id === ride.id ? { ...r, seats: r.seats - 1 } : r));
    setConfirmedRides(c => ({ ...c, [ride.id]: true }));
    setJoiningRide(null);
    if (authUser) {
      await supabase.from('rides').update({ seats: ride.seats - 1 }).eq('id', ride.id);
      await supabase.from('interests').insert({
        from_user_id: authUser.id,
        from_name: profile.name,
        ride_id: ride.id,
        type: 'ride',
        message: `Let's meet at ${location} at ${time}`,
        meeting_location: location,
        meeting_time: time,
        contact: '',
        status: 'pending',
      });
    }
    toast_("🎉 Seat reserved! Meetup request sent to driver.");
  };

  // ── Clubs (DB-backed) ────────────────────────────────────────────
  const handleJoinClub = async (club, memberName, memberDept) => {
    if (!authUser) { toast_("❌ Sign in to join clubs"); return; }
    const { error } = await supabase.from('club_members').insert({
      club_id: club.id,
      user_id: authUser.id,
      name: memberName,
      department: memberDept,
    });
    if (error) { toast_("❌ Already a member or error joining"); return; }
    await supabase.from('clubs').update({ member_count: club.member_count + 1 }).eq('id', club.id);
    const updatedClub = { ...club, member_count: club.member_count + 1 };
    setClubs(cs => cs.map(c => c.id === club.id ? updatedClub : c));
    setJoinedClubs(j => ({ ...j, [club.id]: { name: memberName, dept: memberDept } }));
    setSelectedClub(updatedClub);
    setScreen(S.CLUB_DETAIL);
    toast_("🏆 Joined " + club.name + "! Welcome to the club.");
  };

  const handleCreateClub = async (club) => {
    if (!authUser) { toast_("❌ Sign in to create clubs"); return; }
    const uniId = profile?.university_id;
    const ICONS = { Tech: "⚡", Sports: "⚽", Arts: "🎨", Leadership: "🏆", Social: "🌟", General: "⭐" };
    const COLORS = { Tech: "#6366F1", Sports: "#10B981", Arts: "#F59E0B", Leadership: "#8B6A3E", Social: "#EC4899", General: "#6366F1" };
    const { data, error } = await supabase.from('clubs').insert({
      uni_id: uniId,
      name: club.name,
      description: club.desc,
      category: club.category,
      contact: club.contact,
      icon: ICONS[club.category] || "⭐",
      color: COLORS[club.category] || "#6366F1",
      created_by: authUser.id,
      creator_name: profile.name,
      member_count: 1,
    }).select().single();
    if (error || !data) { toast_("❌ Could not create club"); return; }
    // Creator auto-joins
    await supabase.from('club_members').insert({ club_id: data.id, user_id: authUser.id, name: profile.name, department: club.dept || 'Creator' });
    setClubs(cs => [data, ...cs]);
    setJoinedClubs(j => ({ ...j, [data.id]: { name: profile.name, dept: club.dept || "Creator" } }));
    toast_("🎊 Club created!");
    setScreen(S.CLUBS);
  };

  const handleDeleteClub = async (clubId) => {
    setClubs(cs => cs.filter(c => c.id !== clubId));
    toast_("🗑️ Club deleted.");
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const uni = profile?.university_id ? uniDB[profile.university_id] : null;
  const currentUser = profile ? { id: profile.id, name: profile.name, dept: profile.dept || "", universityId: profile.university_id } : null;

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
            currentUser={currentUser}
          />}

{/* Meetup Popup */}
{joiningRide && (
  <MeetupPopup
    ride={joiningRide}
    onCancel={() => setJoiningRide(null)}
    onConfirm={(location, time) => handleConfirmJoin(joiningRide, location, time)}
  />
)}

        {screen === S.OFFER_RIDE && uni &&
          <OfferRideScreen onBack={() => setScreen(S.RIDESHARE)} onSubmit={handleOfferRide} />}

        {screen === S.CLUBS && uni &&
          <ClubsScreen
            clubs={clubs} uni={uni}
            filter={clubFilter} setFilter={setClubFilter}
            joined={joinedClubs}
            authUser={authUser}
            onBack={() => setScreen(S.HOME)}
            onJoin={handleJoinClub}
            onCreate={() => setScreen(S.CREATE_CLUB)}
            onOpenClub={(club) => { setSelectedClub(club); setScreen(S.CLUB_DETAIL); }}
          />}

        {screen === S.CREATE_CLUB && uni &&
          <CreateClubScreen onBack={() => setScreen(S.CLUBS)} onSubmit={handleCreateClub} profile={profile} />}

        {screen === S.CLUB_DETAIL && selectedClub &&
          <ClubDetailScreen
            club={clubs.find(c => c.id === selectedClub.id) || selectedClub}
            authUser={authUser}
            profile={profile}
            joined={joinedClubs}
            onJoin={handleJoinClub}
            onDelete={handleDeleteClub}
            onBack={() => setScreen(S.CLUBS)}
          />}

        {screen === S.MY_HUB &&
          <MyHubScreen
            currentUser={currentUser}
            authUser={authUser}
            uni={uni}
            onUpdateProfile={({ name, dept }) => setProfile(p => ({ ...p, name, dept }))}
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
function MyHubScreen({ currentUser, authUser, uni, onBack, onLogout, onUpdateProfile, toast_ }) {
  const [tab, setTab] = useState("listings");
  const [myListings, setMyListings]         = useState([]);
  const [myRides, setMyRides]               = useState([]);
  const [interests, setInterests]           = useState([]);
  const [rideInterests, setRideInterests]   = useState([]);
  const [myRideRequests, setMyRideRequests] = useState([]); // rides I joined as passenger
  const [loading, setLoading]               = useState(true);
  const [expandedId, setExpandedId]         = useState(null);
  const [showProfile, setShowProfile]       = useState(false);
  const [editName, setEditName]             = useState(currentUser?.name || "");
  const [editDept, setEditDept]             = useState(currentUser?.dept || "");

  useEffect(() => {
    if (!authUser) { setLoading(false); return; }

    const loadAll = async () => {
      const [{ data: ls }, { data: rs }] = await Promise.all([
        supabase.from('listings').select('*').eq('user_id', authUser.id).eq('status', 'active').order('created_at', { ascending: false }),
        supabase.from('rides').select('*').eq('user_id', authUser.id).eq('status', 'active').order('created_at', { ascending: false }),
      ]);
      if (ls) setMyListings(ls);
      if (rs) setMyRides(rs);

      // Load interests for my listings (I am seller)
      if (ls && ls.length > 0) {
        const ids = ls.map(l => l.id);
        const { data: ints } = await supabase.from('interests').select('*').in('listing_id', ids).order('created_at', { ascending: false });
        if (ints) setInterests(ints);
      }
      // Load interests for my rides (I am rider/owner)
      if (rs && rs.length > 0) {
        const ids = rs.map(r => r.id);
        const { data: rints } = await supabase.from('interests').select('*').in('ride_id', ids).order('created_at', { ascending: false });
        if (rints) setRideInterests(rints);
      }
      // Load MY OWN ride join requests (I am passenger) -- to see confirm/decline
      const { data: myReqs } = await supabase
        .from('interests')
        .select('*, rides(from_location, to_location)')
        .eq('from_user_id', authUser.id)
        .eq('type', 'ride')
        .order('created_at', { ascending: false });
      if (myReqs) setMyRideRequests(myReqs);

      setLoading(false);
    };

    loadAll();

    // Realtime: MyHub UI update when rider confirms/declines
    const channel = supabase
      .channel(`myhub-${authUser.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'interests',
      }, async (payload) => {
        const rowId = payload.new?.id || payload.old?.id;
        if (!rowId) return;
        const { data: fr } = await supabase
          .from('interests').select('id,status,type,from_user_id').eq('id', rowId).single();
        if (!fr || fr.from_user_id !== authUser.id) return;
        if (fr.type !== 'ride') return;
        setMyRideRequests(prev =>
          prev.map(r => r.id === fr.id ? { ...r, status: fr.status } : r)
        );
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [authUser]);

  const markSeen = async (interestId) => {
    await supabase.from('interests').update({ status: 'seen' }).eq('id', interestId);
    setInterests(i => i.map(x => x.id === interestId ? { ...x, status: 'seen' } : x));
    setRideInterests(i => i.map(x => x.id === interestId ? { ...x, status: 'seen' } : x));
  };
  const confirmSeat = async (interestId) => {
    const { error } = await supabase.from('interests').update({ status: 'connected' }).eq('id', interestId);
    if (error) { console.error("confirmSeat error:", error.message); toast_("⚠️ Could not confirm - check console"); return; }
    setRideInterests(i => i.map(x => x.id === interestId ? { ...x, status: 'connected' } : x));
    toast_("✅ Seat confirmed!");
  };

  const declineSeat = async (interestId) => {
    const { error } = await supabase.from('interests').update({ status: 'declined' }).eq('id', interestId);
    if (error) { console.error("declineSeat error:", error.message); toast_("⚠️ Could not decline - check console"); return; }
    setRideInterests(i => i.map(x => x.id === interestId ? { ...x, status: 'declined' } : x));
    toast_("❌ Request declined.");
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
  ...rideInterests.map(i => ({ ...i, kind: 'ride_owner', itemTitle: myRides.find(r => r.id === i.ride_id) ? `${myRides.find(r => r.id === i.ride_id)?.from_location} → ${myRides.find(r => r.id === i.ride_id)?.to_location}` : 'Ride' })),
  ...myRideRequests.map(i => ({ ...i, kind: 'ride_passenger', itemTitle: i.rides ? `${i.rides.from_location} → ${i.rides.to_location}` : 'Ride' })),
].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

const unreadCount = allNotifs.filter(n => n.status === 'pending' || (n.kind === 'ride_passenger' && (n.status === 'connected' || n.status === 'declined'))).length;
  return (
    <Page style={{ display: "flex", flexDirection: "column" }}>
      {/* Profile edit sheet */}
      {showProfile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setShowProfile(false)}>
          <div onClick={e => e.stopPropagation()} className="anim-0" style={{ background: "#aaa9e2", borderRadius: "24px 24px 0 0", padding: "28px 24px 48px", width: "100%", maxWidth: 960 }}>
            <div style={{ width: 40, height: 4, background: "#EDE8DF", borderRadius: 99, margin: "0 auto 24px" }} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #ff24cc, #5e6bf0)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 30, fontFamily: "'Playfair Display', serif", marginBottom: 8 }}>
                {editName?.[0]?.toUpperCase() || currentUser?.name?.[0] || "S"}
              </div>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, color: "#1b1002", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}>{uni?.shortName}</div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, color: "#1e1303", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 6 }}>Display Name</div>
              <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Your name" style={{ ...inputStyle, marginBottom: 0 }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, color: "#1c1102", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 6 }}>Department</div>
              <input value={editDept} onChange={e => setEditDept(e.target.value)} placeholder="e.g. Computer Engineering" style={{ ...inputStyle, marginBottom: 0 }} />
            </div>
            <PrimaryBtn onClick={async () => {
              if (!editName.trim()) return;
              await supabase.from("profiles").update({ name: editName.trim(), dept: editDept.trim() }).eq("id", authUser.id);
              onUpdateProfile({ name: editName.trim(), dept: editDept.trim() });
              setShowProfile(false);
              toast_("Profile updated!");
            }} style={{ marginBottom: 12 }}>Save Changes</PrimaryBtn>
            <button onClick={onLogout} style={{ width: "100%", background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#EF4444", borderRadius: 14, padding: "13px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }}>Sign Out</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: "52px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={onBack} style={{ background: "#fff", border: "1px solid #EDE8DF", color: "#1C1917", borderRadius: 12, width: 38, height: 38, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 6px rgba(139,106,62,0.08)" }}>←</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, color: "#1C1917", fontSize: 18 }}>My Hub</div>
          {uni && <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, color: "#A8957A", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 2 }}>{uni.shortName}</div>}
        </div>
        <div style={{ width: 38 }} />
      </div>

      {/* User card — tap to edit profile */}
      <div onClick={() => setShowProfile(true)} style={{ margin: "20px 24px 0", background: "linear-gradient(135deg, #010101, #fffafd)", borderRadius: 20, padding: "20px 22px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg, #e1e7ec, #0e0112)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 22, fontFamily: "'Playfair Display', serif", flexShrink: 0 }}>
          {currentUser?.name?.[0] || "S"}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#FAF8F5" }}>{currentUser?.name}</div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#C4A055", fontWeight: 500, marginTop: 3 }}>
            {currentUser?.dept ? currentUser.dept : (authUser ? "Verified Student" : "Guest")}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          {unreadCount > 0 && (
            <div style={{ background: "#140404", color: "#fff", borderRadius: 99, padding: "3px 9px", fontSize: 10, fontWeight: 700, fontFamily: "'Montserrat', sans-serif" }}>{unreadCount} new</div>
          )}
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, color: "#000000", fontWeight: 600, letterSpacing: "0.08em" }}>Edit Profile</div>
        </div>
      </div>


      {/* Tabs */}
      <div style={{ padding: "20px 24px 0" }}>
        <div style={{ display: "flex", background: "#F5F0E8", borderRadius: 14, padding: 3, gap: 2 }}>
          {[
            { k: "listings", label: "📦 My Listings", count: myListings.length },
            { k: "rides",    label: "🚗 My Rides",    count: myRides.length },
            { k: "notifs",   label: "🔔 Alerts",      count: unreadCount },
          ].map(t => (
            <button key={t.k} onClick={() => { setTab(t.k); if (t.k === 'notifs' && authUser) { supabase.from('interests').select('*, rides(from_location, to_location)').eq('from_user_id', authUser.id).eq('type', 'ride').order('created_at', { ascending: false }).then(({ data }) => { if (data) setMyRideRequests(data); }); } }} style={{
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
              <EmptyState icon="📦" title="No listings yet" sub="Go to Martplace and list your first item!" />
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
  <InterestCard key={interest.id} interest={interest} onSeen={() => markSeen(interest.id)} onConfirm={confirmSeat} onDecline={declineSeat} />
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
            {allNotifs.map(n => {
              if (n.kind === 'ride_passenger') {
  const isConfirmed = n.status === 'connected';
  const isDeclined  = n.status === 'declined';
  const isPending   = n.status === 'pending';

  return (
    <div key={n.id} style={{
      background: isConfirmed ? "#F0FDF4" : isDeclined ? "#FFF1F2" : "#FFFBF0",
      borderRadius: 14,
      border: `1px solid ${isConfirmed ? "#86EFAC" : isDeclined ? "#FCA5A5" : "#F59E0B40"}`,
      padding: "14px 16px",
      display: "flex",
      gap: 12,
      alignItems: "flex-start"
    }}>
      <div style={{ fontSize: 22, flexShrink: 0 }}>🚗</div>

      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: "'Montserrat', sans-serif",
          fontSize: 12,
          fontWeight: 700,
          color: isConfirmed ? "#16A34A" : isDeclined ? "#EF4444" : "#92400E",
          marginBottom: 4
        }}>
          {isPending ? "⏳ Seat request pending..." :
           isConfirmed ? "🎉 Seat Confirmed!" :
           "❌ Seat Declined"}
        </div>

        <div style={{
          fontFamily: "'Montserrat', sans-serif",
          fontSize: 11,
          color: "#78716C"
        }}>
          {n.itemTitle}
        </div>

        {isDeclined && (
          <div style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: 10,
            color: "#EF4444",
            marginTop: 4
          }}>
            Try joining another ride.
          </div>
        )}
      </div>
    </div>
  );
}
            return (

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
            );
            })}
          </div>
        )}
      </div>
    </Page>
  );
}

// ── Interest Card (shown in My Hub when buyer expressed interest) ──────────────
function InterestCard({ interest, onSeen, onConfirm, onDecline }) {
  return (
    <div style={{ background: interest.status === 'pending' ? "#FFFBF0" : interest.status === 'connected' ? "#F0FDF4" : "#FAF8F5", borderRadius: 12, border: `1px solid ${interest.status === 'pending' ? "#F59E0B40" : interest.status === 'connected' ? "#86EFAC" : "#EDE8DF"}`, padding: "12px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #8B6A3E, #C4A055)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 11, fontFamily: "'Playfair Display', serif" }}>{interest.from_name[0]}</div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 600, color: "#1C1917" }}>{interest.from_name}</div>
        </div>
        {interest.status === 'pending' && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B" }} />}
        {interest.status === 'connected' && <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#16A34A", fontWeight: 600 }}>✅ Confirmed</div>}
        {interest.status === 'declined' && <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#EF4444", fontWeight: 600 }}>❌ Declined</div>}
      </div>

      {/* Message */}
      <div style={{ background: "#fff", borderRadius: 10, padding: "10px 12px", border: "1px solid #EDE8DF", fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#1C1917", marginBottom: 10 }}>
        📍 {interest.message}
      </div>

      {/* Confirm/Decline buttons based on current status */}
      {interest.ride_id && onConfirm && interest.status !== 'declined' && (
        <div style={{ display: "flex", gap: 8 }}>
          {interest.status === 'pending' && (
            <button onClick={() => onConfirm(interest.id)} style={{ flex: 1, background: "#1C1917", border: "none", color: "#FAF8F5", borderRadius: 10, padding: "9px 0", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }}>✅ Confirm Seat</button>
          )}
          <button onClick={() => onDecline(interest.id)} style={{ flex: interest.status === 'pending' ? 1 : 2, background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#EF4444", borderRadius: 10, padding: "9px 0", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }}>❌ Wanna Decline?</button>
        </div>
      )}
      {interest.ride_id && onConfirm && interest.status === 'declined' && (
        <button onClick={() => onConfirm(interest.id)} style={{ width: "100%", background: "#F0FDF4", border: "1px solid #86EFAC", color: "#16A34A", borderRadius: 10, padding: "9px 0", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }}>✅ Confirm instead</button>
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
    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    if (progress >= 100) {
      setPhase(3);
      const t = setTimeout(() => onDone && onDone(), 900);
      return () => clearTimeout(t);
    }
  }, [progress]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "#010101",
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: phase === 3 ? 0 : 1,
      transition: "opacity 0.9s cubic-bezier(0.4,0,0.2,1)",
    }}>
      <div style={{ textAlign: "center" }}>

        {/* Mew */}
        <span style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: "italic",
          fontSize: 52,
          color: "#FFFC00",
          display: "inline-block",
          opacity: phase >= 1 ? 1 : 0,
          transform: phase >= 1 ? "translateY(0)" : "translateY(40px)",
          transition: "opacity 0.8s cubic-bezier(0.16,1,0.3,1), transform 0.8s cubic-bezier(0.16,1,0.3,1)",
        }}>Mew</span>

        {/* tual */}
        <span style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: "italic",
          fontSize: 52,
          color: "#8c8472",
          display: "inline-block",
          opacity: phase >= 2 ? 1 : 0,
          transform: phase >= 2 ? "translateY(0)" : "translateY(40px)",
          transition: "opacity 0.8s cubic-bezier(0.16,1,0.3,1) 0.15s, transform 0.8s cubic-bezier(0.16,1,0.3,1) 0.15s",
        }}>tual</span>

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
        <img src={NEW_LOGO_SRC} alt="Mewtual" style={{ width: 220, height: "auto", display: "block", margin: "0 auto 20px", mixBlendMode: "multiply" }} />
        <div style={{ fontFamily: "'Cheque', serif", fontSize: 28, color: "#050505", letterSpacing: "0.15em", textAlign: "center" }}>Mewtual</div>
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
          <img src={NEW_LOGO_SRC} alt="Mewtual" style={{ width: 200, height: "auto", display: "block", margin: "0 auto 18px", mixBlendMode: "multiply" }} />
          <div style={{ fontFamily: "'Cheque', serif", fontSize: 28, color: "#000000", letterSpacing: "0.15em", textAlign: "center" }}>Mewtual</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 600, fontStyle: "italic", color: "#4A3728", lineHeight: 1.65, maxWidth: 260, margin: "8px auto" }}>
            From trading Notes to Sharing Rides
            <span style={{ display: "block", color: "#8B6A3E", fontStyle: "normal", fontWeight: 700 }}>And joining Clubs.</span>
          </div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#3a2b15", fontWeight: 400 }}>Students connected Mewtually.</div>
        </div>
        <div className="anim-1" style={{ borderTop: "1px solid #EDE8DF", paddingTop: 18 }}>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, color: "#8B6A3E", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 6 }}>Welcome, {currentUser?.name} 👋</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: "#1C1917", lineHeight: 1.2, letterSpacing: "-0.3px" }}>Choose Your University</div>
        </div>
      </div>

      <div className="anim-1" style={{ padding: "0 24px 20px" }}>
        <div style={{ display: "flex", background: "#F5F0E8", borderRadius: 14, padding: 3, gap: 2 }}>
          {[{ k: "find", label: "🔎 Find University" }, { k: "create", label: "➕ Create Your Uni Space" }].map(t => (
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
    { s: S.MARKETPLACE, icon: "🛍️", label: "Marcatplace",     sub: "Books, Gadgets & more",     accent: "#8B6A3E" },
    { s: S.RIDESHARE,   icon: "🚗", label: "Ride Pool",        sub: "Share rides to campus",      accent: "#10B981" },
    { s: S.CLUBS,       icon: "🏆", label: "Clubs & Societies", sub: "Sports, Tech & more",        accent: "#6366F1" },
  ];
  return (
    <Page style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "56px 24px 0" }}>
        <div className="anim-0">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <button onClick={onBack} style={{ background: "#fff", border: "1px solid #EDE8DF", color: "#1C1917", borderRadius: 12, width: 38, height: 38, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 6px rgba(139,106,62,0.08)", flexShrink: 0 }}>←</button>
            <img src={NEW_LOGO_SRC} alt="Mewtual" style={{ width: 90, height: "auto", objectFit: "contain" }} />
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
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 600, color: "#080500", letterSpacing: "0.18em",fontStyle: "italic",  marginBottom: 10 }}>Oh hi {user?.name} ╰(*°▽°*)╯</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 700, color: "#1C1917", lineHeight: 1.2,fontStyle: "italic", letterSpacing: "-0.3px" }}>What are you<br />exploring today?</div>
        </div>
      </div>

      <div style={{ padding: "24px 24px 8px" }} className="anim-1">
        <div style={{ background: "#fff", borderRadius: 16, display: "flex", alignItems: "center", padding: "14px 18px", boxShadow: "0 2px 12px rgba(139,106,62,0.07)", border: "1px solid #EDE8DF", gap: 12 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C4A882" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <span style={{ fontFamily: "'Montserrat', sans-serif", color: "#C4A882", fontSize: 14, fontWeight: 400 }}>Search in {uni.shortName}...</span>
        </div>
        <CatCounter memberCount={uni.members} maxCount={100} />
      </div>

      <div style={{ padding: "20px 24px 10px" }}>
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, color: "#C4A882", letterSpacing: "0.2em", textTransform: "uppercase" }}>Explore</div>
      </div>

      <div className="nav-cards-grid" style={{ flex: 1, padding: "0 24px" }}>
        {cards.map((c, i) => (
          <button key={c.s} onClick={() => onNav(c.s)} className={`card-lift anim-${i + 2} nav-card`}
            style={{ background: "#dee5ed", border: "1px solid #EDE8DF", borderRadius: 22, padding: "22px 22px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 18, width: "100%", boxShadow: "0 2px 16px rgba(139,106,62,0.06)", transition: "all 0.22s ease" }}>
            <div style={{ width: 54, height: 54, borderRadius: 16, background: `${c.accent}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, border: `1px solid ${c.accent}22` }}>{c.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 700, color: "#220101", marginBottom: 5 }}>{c.label}</div>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 400, color: "#14110b", lineHeight: 1.4 }}>{c.sub}</div>
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
      <Header onBack={onBack} title="Marcatplace" uni={uni} right={
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
{item.image_url
  ? <img src={item.image_url} alt={item.title} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 12, marginBottom: 12 }} />
  : <div style={{ width: "100%", aspectRatio: "1", background: `${CAT_COLORS[item.category] || "#8B6A3E"}10`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 12, border: `1px solid ${CAT_COLORS[item.category] || "#8B6A3E"}18` }}>{CAT_EMOJIS[item.category] || "📦"}</div>
}            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, color: CAT_COLORS[item.category] || "#8B6A3E", marginBottom: 4, letterSpacing: "0.1em", textTransform: "uppercase" }}>{item.category}</div>
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
// PHOTO VIEWER — Fullscreen with arrows
// ══════════════════════════════════════════════════════════════════════════════
function PhotoViewer({ photos, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex || 0);
  const prev = () => setIdx(i => (i - 1 + photos.length) % photos.length);
  const next = () => setIdx(i => (i + 1) % photos.length);

  // Close on background click
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Close button */}
      <button onClick={onClose} style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: "50%", width: 40, height: 40, fontSize: 20, cursor: "pointer", zIndex: 1 }}>×</button>

      {/* Counter */}
      {photos.length > 1 && (
        <div style={{ position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)", fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
          {idx + 1} / {photos.length}
        </div>
      )}

      {/* Image */}
      <img
        src={photos[idx]}
        alt={`photo ${idx + 1}`}
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: "92vw", maxHeight: "82vh", objectFit: "contain", borderRadius: 12 }}
      />

      {/* Arrows — only show if multiple photos */}
      {photos.length > 1 && (
        <>
          <button onClick={e => { e.stopPropagation(); prev(); }} style={{ position: "absolute", left: 16, background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: "50%", width: 44, height: 44, fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
          <button onClick={e => { e.stopPropagation(); next(); }} style={{ position: "absolute", right: 16, background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: "50%", width: 44, height: 44, fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
        </>
      )}

      {/* Dot indicators */}
      {photos.length > 1 && (
        <div style={{ position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
          {photos.map((_, i) => (
            <div key={i} onClick={e => { e.stopPropagation(); setIdx(i); }} style={{ width: i === idx ? 20 : 6, height: 6, borderRadius: 99, background: i === idx ? "#C4A055" : "rgba(255,255,255,0.3)", cursor: "pointer", transition: "all 0.2s" }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PRODUCT DETAIL — with real interest flow + photo gallery
// ══════════════════════════════════════════════════════════════════════════════
const BUYER_MSGS = [
  "Is this still available?",
  "I want to buy this. When can we meet?",
  "Can you do a lower price?",
  "Can I see it in person before buying?",
];
const SELLER_MSGS = [
  "Yes, still available! When do you want to meet?",
  "Price is fixed, no negotiation.",
  "You can check it at the library / canteen.",
  "Cash on delivery only. No online payment.",
];

function ProductDetailScreen({ product, currentUser, onBack, onInterest }) {
  const [step, setStep] = useState("msgs"); // msgs | custom | done
  const [selectedMsg, setSelectedMsg] = useState("");
  const [customMsg, setCustomMsg] = useState("");
  const [showSeller, setShowSeller] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState(0);

  // Parse photos — support both image_urls (JSON array) and single image_url
  const photos = (() => {
    try {
      const arr = JSON.parse(product.image_urls || "[]");
      if (arr.length > 0) return arr;
    } catch {}
    return product.image_url ? [product.image_url] : [];
  })();

  const [activePhoto, setActivePhoto] = useState(0);

  const handleSend = async (msg) => {
    if (!msg.trim()) return;
    await onInterest(msg.trim(), "");
    setStep("done");
  };

  return (
    <Page style={{ display: "flex", flexDirection: "column" }}>
      {viewerOpen && <PhotoViewer photos={photos} startIndex={viewerStart} onClose={() => setViewerOpen(false)} />}
      <Header onBack={onBack} title="Product Details" />
      <div style={{ flex: 1, overflow: "auto", scrollbarWidth: "none" }}>
        <div style={{ margin: "0 20px 18px", background: "#fff", borderRadius: 22, border: "1px solid #EDE8DF", overflow: "hidden", boxShadow: "0 2px 16px rgba(139,106,62,0.06)" }}>

          {/* Main photo */}
          <div
            onClick={() => { if (photos.length > 0) { setViewerStart(activePhoto); setViewerOpen(true); } }}
            style={{ height: 220, background: `${CAT_COLORS[product.category] || "#8B6A3E"}10`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 76, overflow: "hidden", cursor: photos.length > 0 ? "zoom-in" : "default", position: "relative" }}
          >
            {photos.length > 0
              ? <img src={photos[activePhoto]} alt={product.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : (CAT_EMOJIS[product.category] || "📦")
            }
            {photos.length > 0 && (
              <div style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(0,0,0,0.45)", borderRadius: 8, padding: "4px 10px", fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#fff" }}>
                🔍 Tap to zoom
              </div>
            )}
          </div>

          {/* Thumbnail strip — only if multiple photos */}
          {photos.length > 1 && (
            <div style={{ display: "flex", gap: 8, padding: "10px 14px", overflowX: "auto", scrollbarWidth: "none" }}>
              {photos.map((src, i) => (
                <div key={i} onClick={() => setActivePhoto(i)} style={{ width: 54, height: 54, borderRadius: 10, overflow: "hidden", flexShrink: 0, border: i === activePhoto ? "2px solid #8B6A3E" : "2px solid transparent", cursor: "pointer", opacity: i === activePhoto ? 1 : 0.6, transition: "all 0.2s" }}>
                  <img src={src} alt={`thumb ${i+1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ))}
            </div>
          )}

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

        {/* Message flow */}
        <div style={{ margin: "0 20px 32px" }}>

          {/* Quick messages */}
          {step === "msgs" && (
            <div className="anim-0" style={{ background: "#fff", borderRadius: 22, border: "1px solid #EDE8DF", padding: "22px 20px" }}>

              {/* Buyer messages */}
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, color: "#C4A882", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}>💬 Message Seller</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {BUYER_MSGS.map((msg, i) => (
                  <button key={i} onClick={() => handleSend(msg)} style={{ textAlign: "left", background: "#FAF8F5", border: "1px solid #EDE8DF", borderRadius: 12, padding: "12px 14px", fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#1C1917", cursor: "pointer", fontWeight: 400, transition: "all 0.15s" }}
                    onMouseEnter={e => e.target.style.background = "#F0EBE0"}
                    onMouseLeave={e => e.target.style.background = "#FAF8F5"}
                  >
                    {msg}
                  </button>
                ))}
              </div>

              {/* Divider */}
              <div style={{ borderTop: "1px solid #EDE8DF", marginBottom: 16 }} />

              {/* Seller responses — collapsible */}
              <button onClick={() => setShowSeller(s => !s)} style={{ width: "100%", textAlign: "left", background: "none", border: "none", fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, color: "#8B6A3E", letterSpacing: "0.2em", textTransform: "uppercase", cursor: "pointer", marginBottom: showSeller ? 12 : 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>🏷️ Common Seller Responses</span>
                <span style={{ fontSize: 14 }}>{showSeller ? "▲" : "▼"}</span>
              </button>
              {showSeller && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {SELLER_MSGS.map((msg, i) => (
                    <button key={i} onClick={() => handleSend(msg)} style={{ textAlign: "left", background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 12, padding: "12px 14px", fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#1C1917", cursor: "pointer", fontWeight: 400, transition: "all 0.15s" }}
                      onMouseEnter={e => e.target.style.background = "#DCFCE7"}
                      onMouseLeave={e => e.target.style.background = "#F0FDF4"}
                    >
                      {msg}
                    </button>
                  ))}
                </div>
              )}

              {/* Divider */}
              <div style={{ borderTop: "1px solid #EDE8DF", margin: "4px 0 16px" }} />

              {/* Custom message */}
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, color: "#C4A882", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 10 }}>✏️ Write your own</div>
              <textarea
                placeholder="Type a custom message..."
                value={customMsg}
                onChange={e => setCustomMsg(e.target.value)}
                style={{ ...inputStyle, height: 72, resize: "none", marginBottom: 12 }}
              />
              <PrimaryBtn onClick={() => handleSend(customMsg)} disabled={!customMsg.trim()} style={{ opacity: customMsg.trim() ? 1 : 0.38 }}>
                Send Message →
              </PrimaryBtn>
            </div>
          )}

          {/* Success */}
          {step === "done" && (
            <div className="anim-0" style={{ background: "#F0FDF4", borderRadius: 22, border: "1px solid #86EFAC", padding: "28px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#1C1917", marginBottom: 8 }}>Message sent!</div>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#16A34A" }}>Seller will see your message in their My Hub.</div>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SELL SCREEN — Multi photo (up to 4)
// ══════════════════════════════════════════════════════════════════════════════
function SellScreen({ onBack, onSubmit }) {
  const [form, setForm] = useState({ title: "", category: "Books", price: "", desc: "", seller: "", dept: "", condition: "Good" });
  const [imageFiles, setImageFiles] = useState([]); // array of File
  const [imagePreviews, setImagePreviews] = useState([]); // array of blob URLs
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.title && form.price && form.seller && form.dept && form.desc;
  const MAX_PHOTOS = 4;

  const handleImage = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const remaining = MAX_PHOTOS - imageFiles.length;
    const toAdd = files.slice(0, remaining);
    setImageFiles(prev => [...prev, ...toAdd]);
    setImagePreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))]);
    e.target.value = ""; // reset so same file can be re-selected
  };

  const removePhoto = (idx) => {
    setImageFiles(prev => prev.filter((_, i) => i !== idx));
    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!valid) return;
    setUploading(true);
    const urls = [];
    for (const file of imageFiles) {
      const ext = file.name.split('.').pop();
      const path = `listing-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('Listings').upload(path, file, { upsert: true });
      if (!error) {
        const { data: urlData } = supabase.storage.from('Listings').getPublicUrl(path);
        urls.push(urlData.publicUrl);
      }
    }
    setUploading(false);
    // Save first photo as image_url, all photos as image_urls array (JSON string)
    onSubmit({
      ...form,
      price: parseInt(form.price),
      image_url: urls[0] || "",
      image_urls: JSON.stringify(urls),
    });
  };

  return (
    <Page style={{ display: "flex", flexDirection: "column" }}>
      <Header onBack={onBack} title="List an Item" />
      <div style={{ flex: 1, overflow: "auto", padding: "0 20px 32px", scrollbarWidth: "none" }}>
        <SectionCard label="Item Details">
          <>
            {/* Multi Photo Upload */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {imagePreviews.map((src, idx) => (
                  <div key={idx} style={{ position: "relative", aspectRatio: "1", borderRadius: 12, overflow: "hidden", border: "1px solid #EDE8DF" }}>
                    <img src={src} alt={`photo ${idx+1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button onClick={() => removePhoto(idx)} style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>×</button>
                    {idx === 0 && <div style={{ position: "absolute", bottom: 4, left: 4, background: "#8B6A3E", borderRadius: 6, padding: "2px 6px", fontFamily: "'Montserrat', sans-serif", fontSize: 8, color: "#fff", fontWeight: 700 }}>COVER</div>}
                  </div>
                ))}
                {imagePreviews.length < MAX_PHOTOS && (
                  <div onClick={() => fileRef.current.click()} style={{ aspectRatio: "1", borderRadius: 12, border: "2px dashed #EDE8DF", background: "#FAF8F5", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <div style={{ fontSize: 22 }}>📷</div>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, color: "#A8957A", marginTop: 4 }}>
                      {imagePreviews.length === 0 ? "Add photo" : "+ Add"}
                    </div>
                  </div>
                )}
              </div>
              {imagePreviews.length > 0 && (
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#C4B5A4", marginTop: 6 }}>
                  {imagePreviews.length}/{MAX_PHOTOS} photos · First photo is cover · Tap × to remove
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleImage} style={{ display: "none" }} />

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
        <PrimaryBtn disabled={!valid || uploading} onClick={handleSubmit} style={{ opacity: valid && !uploading ? 1 : 0.38 }}>
          {uploading ? `Uploading ${imageFiles.length} photo${imageFiles.length > 1 ? "s" : ""}...` : "Publish Listing →"}
        </PrimaryBtn>
      </div>
    </Page>
  );
}
// ══════════════════════════════════════════════════════════════════════════════
// RIDESHARE
// ══════════════════════════════════════════════════════════════════════════════
function RideshareScreen({ rides, uni, confirmed, onBack, onJoin, onOffer, currentUser }) {
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
                  <button disabled={ride.seats === 0 || confirmed[ride.id]} onClick={() => onJoin(ride)} style={{ padding: "8px 16px", borderRadius: 10, border: confirmed[ride.id] ? `1px solid ${color}` : "none", cursor: ride.seats === 0 ? "not-allowed" : "pointer", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 11, letterSpacing: "0.04em", background: confirmed[ride.id] ? `${color}12` : ride.seats === 0 ? "#F5F0E8" : color, color: confirmed[ride.id] ? color : ride.seats === 0 ? "#C4B5A4" : "#fff", transition: "all 0.2s" }}>
                    {confirmed[ride.id] ? "✓ Reserved" : ride.seats === 0 ? "Full" : "Join Ride"}
                  </button>
                </div>
                {confirmed[ride.id] && ride.contact && (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 12, padding: "10px 14px" }}>
                    <span style={{ fontSize: 20 }}>📲</span>
                    <div>
                      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, color: "#16A34A", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>Driver Contact</div>
                      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 14, color: "#1C1917", fontWeight: 700, letterSpacing: "0.04em" }}>{ride.contact}</div>
                    </div>
                  </div>
                )}
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
  const [form, setForm] = useState({ driver: "", from: "", to: "", date: "", time: "", seats: "", cost: "", contact: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.driver && form.from && form.to && form.date && form.time && form.seats && form.cost && form.contact;
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
            <input placeholder="Your Name *" value={form.driver} onChange={e => set("driver", e.target.value)} style={inputStyle} />
            <input placeholder="Phone Number *" type="tel" value={form.contact} onChange={e => set("contact", e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#A8957A", marginTop: 6 }}>🔒Don't worry! Only shown to passengers who join your ride</div>
          </>
        </SectionCard>
        <PrimaryBtn disabled={!valid} onClick={() => valid && onSubmit({ ...form, seats: parseInt(form.seats), cost: parseInt(form.cost) })} style={{ opacity: valid ? 1 : 0.38 }}>Post My Ride 🚗</PrimaryBtn>
      </div>
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// CLUBS LIST
// ══════════════════════════════════════════════════════════════════════════════
function ClubsScreen({ clubs, uni, filter, setFilter, joined, authUser, onBack, onJoin, onCreate, onOpenClub }) {
  const cats = ["All", "Tech", "Sports", "Arts", "Leadership", "Social"];
  const filtered = filter === "All" ? clubs : clubs.filter(c => c.category === filter);
  return (
    <Page style={{ display: "flex", flexDirection: "column" }}>
      <Header onBack={onBack} title="Clubs & Societies" uni={uni} right={
        <button onClick={onCreate} style={{ background: "#6366F1", border: "none", color: "#fff", borderRadius: 10, padding: "8px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.04em" }}>+ Create</button>
      } />
      <div style={{ padding: "4px 20px 14px", overflowX: "auto", display: "flex", gap: 7, scrollbarWidth: "none" }}>
        {cats.map(c => (
          <button key={c} onClick={() => setFilter(c)} style={{ padding: "7px 15px", borderRadius: 99, border: filter === c ? "none" : "1px solid #c09b57", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 11, letterSpacing: "0.04em", background: filter === c ? "#1C1917" : "#fff", color: filter === c ? "#FAF8F5" : "#78716C", transition: "all 0.2s" }}>{c}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "0 20px 32px", display: "flex", flexDirection: "column", gap: 14, scrollbarWidth: "none" }}>
        {filtered.length === 0 && <EmptyState icon="🏆" title="No clubs yet" sub="Start the first club!" />}
        {filtered.map((club, i) => (
          <div key={club.id} className="card-lift fade-in-item" onClick={() => onOpenClub(club)} style={{ animationDelay: `${i * 0.05}s`, background: "#d9edff", borderRadius: 20, border: "1px solid #EDE8DF", overflow: "hidden", boxShadow: "0 2px 10px rgba(139,106,62,0.05)", cursor: "pointer" }}>
            <div style={{ height: 3, background: club.color }} />
            <div style={{ padding: "18px 18px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: `${club.color}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, border: `1px solid ${club.color}22` }}>{club.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "#000000" }}>{club.name}</div>
                      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: club.color, fontWeight: 600, marginTop: 2 }}>{club.category} · {club.member_count || 0} members</div>
                    </div>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: joined[club.id] ? club.color : "#C4B5A4", fontWeight: 600 }}>
                      {joined[club.id] ? "✓ Joined" : "Tap to view"}
                    </div>
                  </div>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#000000", lineHeight: 1.6, fontWeight: 400, marginTop: 6 }}>{club.description}</div>
                  {club.contact && (
                    <div style={{ marginTop: 8, fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#2600ff" }}>📲 {club.contact}</div>
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
// CLUB DETAIL — Feed + Members
// ══════════════════════════════════════════════════════════════════════════════
function ClubDetailScreen({ club, authUser, profile, joined, onJoin, onDelete, onBack }) {
  const [tab, setTab] = useState("feed");
  const [posts, setPosts] = useState([]);
  const [members, setMembers] = useState([]);
  const [postText, setPostText] = useState("");
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [expandedReplies, setExpandedReplies] = useState({});
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [joinName, setJoinName] = useState(profile?.name || "");
  const [joinDept, setJoinDept] = useState("");
  const isMember = !!joined[club.id];
  const isCreator = authUser?.id === club.created_by;

  const handleDelete = async () => {
    await supabase.from("clubs").delete().eq("id", club.id);
    onDelete(club.id);
    onBack();
  };

  useEffect(() => {
    const load = async () => {
      const [{ data: ps }, { data: ms }] = await Promise.all([
        supabase.from("club_posts").select("*, club_likes(user_id)").eq("club_id", club.id).order("created_at", { ascending: false }),
        supabase.from("club_members").select("*").eq("club_id", club.id).order("joined_at", { ascending: true }),
      ]);
      if (ps) setPosts(ps);
      if (ms) setMembers(ms);
      setLoading(false);
    };
    load();
  }, [club.id]);

  const handlePost = async () => {
    if (!postText.trim() || !isMember) return;
    const { data } = await supabase.from("club_posts").insert({
      club_id: club.id,
      user_id: authUser.id,
      author_name: joined[club.id]?.name || profile?.name,
      author_dept: joined[club.id]?.dept || "",
      content: postText.trim(),
    }).select("*, club_likes(user_id)").single();
    if (data) { setPosts(p => [data, ...p]); setPostText(""); }
  };

  const handleLike = async (post) => {
    if (!authUser) return;
    const alreadyLiked = post.club_likes?.some(l => l.user_id === authUser.id);
    if (alreadyLiked) {
      await supabase.from("club_likes").delete().eq("post_id", post.id).eq("user_id", authUser.id);
      setPosts(ps => ps.map(p => p.id === post.id ? { ...p, club_likes: p.club_likes.filter(l => l.user_id !== authUser.id) } : p));
    } else {
      await supabase.from("club_likes").insert({ post_id: post.id, user_id: authUser.id, club_id: club.id });
      setPosts(ps => ps.map(p => p.id === post.id ? { ...p, club_likes: [...(p.club_likes || []), { user_id: authUser.id }] } : p));
    }
  };

  const handleReply = async (postId) => {
    if (!replyText.trim() || !isMember) return;
    const { data } = await supabase.from("club_replies").insert({
      post_id: postId,
      club_id: club.id,
      user_id: authUser.id,
      author_name: joined[club.id]?.name || profile?.name,
      author_dept: joined[club.id]?.dept || "",
      content: replyText.trim(),
    }).select().single();
    if (data) {
      setPosts(ps => ps.map(p => p.id === postId ? { ...p, replies: [...(p.replies || []), data] } : p));
      setReplyText(""); setReplyingTo(null);
    }
  };

  const loadReplies = async (postId) => {
    if (expandedReplies[postId]) { setExpandedReplies(r => ({ ...r, [postId]: false })); return; }
    const { data } = await supabase.from("club_replies").select("*").eq("post_id", postId).order("created_at", { ascending: true });
    setPosts(ps => ps.map(p => p.id === postId ? { ...p, replies: data || [] } : p));
    setExpandedReplies(r => ({ ...r, [postId]: true }));
  };

  const handleJoinSubmit = () => {
    if (!joinName.trim() || !joinDept.trim()) return;
    onJoin(club, joinName, joinDept);
    setMembers(m => [...m, { id: Date.now(), name: joinName, department: joinDept }]);
    setShowJoinForm(false);
  };

  return (
    <Page style={{ display: "flex", flexDirection: "column" }}>
      <Header onBack={onBack} title={club.name} />
      <div style={{ flex: 1, overflow: "auto", scrollbarWidth: "none" }}>

        {/* Club header */}
        <div style={{ margin: "0 20px 16px", background: "linear-gradient(135deg, #1C1917, #3D2B1F)", borderRadius: 20, padding: "20px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -20, right: -20, fontSize: 80, opacity: 0.08 }}>{club.icon}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: `${club.color}25`, border: `2px solid ${club.color}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>{club.icon}</div>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: "#FAF8F5" }}>{club.name}</div>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: club.color, fontWeight: 600, marginTop: 2 }}>{club.category} · {club.member_count || 0} members</div>
            </div>
          </div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#C4B5A4", lineHeight: 1.6, marginBottom: 12 }}>{club.description}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#A8957A" }}>
              {club.contact && <span>📲 {club.contact}</span>}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {!isMember && (
                <button onClick={() => setShowJoinForm(true)} style={{ background: club.color, border: "none", color: "#fff", borderRadius: 10, padding: "8px 18px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }}>Join Club</button>
              )}
              {isMember && !isCreator && (
                <div style={{ background: `${club.color}20`, border: `1px solid ${club.color}50`, borderRadius: 10, padding: "6px 14px", fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 700, color: club.color }}>✓ Member</div>
              )}
              {isCreator && (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ background: `${club.color}20`, border: `1px solid ${club.color}50`, borderRadius: 10, padding: "6px 12px", fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 700, color: club.color }}>👑 Creator</div>
                  <button onClick={() => setConfirmDelete(true)} style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", borderRadius: 10, padding: "6px 10px", fontSize: 11, cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }}>🗑️</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Delete confirm */}
        {confirmDelete && (
          <div style={{ margin: "0 20px 16px", background: "#FEF2F2", borderRadius: 16, border: "1px solid #FCA5A5", padding: "16px" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: "#1C1917", marginBottom: 6 }}>Delete this club?</div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#78716C", marginBottom: 14 }}>This will permanently delete the club, all posts, likes, and replies. This cannot be undone.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, background: "#F5F0E8", border: "none", color: "#78716C", borderRadius: 10, padding: "10px 0", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }}>Cancel</button>
              <button onClick={handleDelete} style={{ flex: 1, background: "#EF4444", border: "none", color: "#fff", borderRadius: 10, padding: "10px 0", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }}>Yes, Delete</button>
            </div>
          </div>
        )}

        {/* Join form */}
        {showJoinForm && (
          <div style={{ margin: "0 20px 16px", background: "#fff", borderRadius: 16, border: "1px solid #EDE8DF", padding: "18px 16px" }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, color: "#C4A882", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 12 }}>Your Info</div>
            <input placeholder="Your Name *" value={joinName} onChange={e => setJoinName(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />
            <input placeholder="Your Department *" value={joinDept} onChange={e => setJoinDept(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowJoinForm(false)} style={{ flex: 1, background: "#F5F0E8", border: "none", color: "#78716C", borderRadius: 10, padding: "10px 0", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }}>Cancel</button>
              <button onClick={handleJoinSubmit} disabled={!joinName.trim() || !joinDept.trim()} style={{ flex: 2, background: "#1C1917", border: "none", color: "#FAF8F5", borderRadius: 10, padding: "10px 0", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", opacity: joinName.trim() && joinDept.trim() ? 1 : 0.38 }}>Join Club 🏆</button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ padding: "0 20px 14px" }}>
          <div style={{ display: "flex", background: "#F5F0E8", borderRadius: 14, padding: 3, gap: 2 }}>
            {[{ k: "feed", label: "📢 Feed" }, { k: "members", label: "👥 Members" }].map(t => (
              <button key={t.k} onClick={() => setTab(t.k)} style={{ flex: 1, padding: "9px 4px", border: "none", borderRadius: 11, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 11, background: tab === t.k ? "#1C1917" : "transparent", color: tab === t.k ? "#FAF8F5" : "#A8957A", transition: "all 0.25s" }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* FEED TAB */}
        {tab === "feed" && (
          <div style={{ padding: "0 20px 32px", display: "flex", flexDirection: "column", gap: 12 }}>
            {isMember ? (
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #EDE8DF", padding: "14px 16px" }}>
                <textarea
                  placeholder={`Share something with ${club.name}...`}
                  value={postText}
                  onChange={e => setPostText(e.target.value)}
                  style={{ ...inputStyle, height: 72, resize: "none", marginBottom: 10 }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={handlePost} disabled={!postText.trim()} style={{ background: "#1C1917", border: "none", color: "#FAF8F5", borderRadius: 10, padding: "8px 20px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", opacity: postText.trim() ? 1 : 0.38 }}>Post 📤</button>
                </div>
              </div>
            ) : (
              <div style={{ background: "#FAF8F5", borderRadius: 14, border: "1px dashed #EDE8DF", padding: "14px 16px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#A8957A" }}>Join the club to post and reply 🔒</div>
              </div>
            )}
            {loading && <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#C4B5A4" }}>Loading feed...</div>}
            {!loading && posts.length === 0 && <EmptyState icon="📢" title="No posts yet" sub="Be the first to post!" />}
            {posts.map(post => {
              const likeCount = post.club_likes?.length || 0;
              const liked = post.club_likes?.some(l => l.user_id === authUser?.id);
              return (
                <div key={post.id} style={{ background: "#1c1c1c", borderRadius: 16, border: "1px solid #EDE8DF", padding: "14px 16px" }}>
                  <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #747bff, #ffffff)", display: "flex", alignItems: "center", justifyContent: "center", color: "#000000", fontWeight: 700, fontSize: 13, fontFamily: "'Playfair Display', serif", flexShrink: 0 }}>{post.author_name?.[0] || "?"}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 700, color: "#edebe7" }}>{post.author_name}</div>
                      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#dce1db" }}>{post.author_dept}</div>
                    </div>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, color: "#edebe7" }}>{new Date(post.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
                  </div>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: "#f4f3f1", lineHeight: 1.65, marginBottom: 12 }}>{post.content}</div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <button onClick={() => isMember ? handleLike(post) : null} style={{ background: "none", border: "none", cursor: isMember ? "pointer" : "default", display: "flex", alignItems: "center", gap: 5, fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 600, color: liked ? "#EF4444" : "#8bd6fe", opacity: isMember ? 1 : 0.5 }} title={!isMember ? "Join to like" : ""}>
                      {liked ? "❤️" : "🤍"} {likeCount > 0 ? likeCount : ""}
                    </button>
                    <button onClick={() => loadReplies(post.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 600, color: "#8bd6fe" }}>
                      💬 {expandedReplies[post.id] ? "Hide replies" : (post.replies?.length > 0 ? `${post.replies.length} replies` : "View replies")}
                    </button>
                    {isMember ? (
                      <button onClick={() => { setReplyingTo(replyingTo === post.id ? null : post.id); setReplyText(""); }} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 600, color: "#8bd6fe", marginLeft: "auto" }}>
                        {replyingTo === post.id ? "Cancel" : "↩ Reply"}
                      </button>
                    ) : (
                      <div style={{ marginLeft: "auto", fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#C4B5A4" }}>Join to interact</div>
                    )}
                  </div>
                  {expandedReplies[post.id] && post.replies && (
                    <div style={{ marginTop: 12, borderTop: "1px solid #F5F0E8", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      {post.replies.length === 0 && <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#ffffff", textAlign: "center" }}>No replies yet</div>}
                      {post.replies.map(r => (
                        <div key={r.id} style={{ display: "flex", gap: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, #6a43ec, #ec7df4)", display: "flex", alignItems: "center", justifyContent: "center", color: "#020000", fontWeight: 700, fontSize: 10, flexShrink: 0 }}>{r.author_name?.[0] || "?"}</div>
                          <div style={{ flex: 1, background: "#fffff0", borderRadius: 10, padding: "8px 10px" }}>
                            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 700, color: "#000000", marginBottom: 2 }}>{r.author_name} <span style={{ color: "#000000", fontWeight: 400 }}>· {r.author_dept}</span></div>
                            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: "#1C1917" }}>{r.content}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {replyingTo === post.id && (
                    <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                      <input
                        placeholder="Write a reply..."
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                        onKeyDown={e => e.key === "Enter" && handleReply(post.id)}
                      />
                      <button onClick={() => handleReply(post.id)} disabled={!replyText.trim()} style={{ background: "#1C1917", border: "none", color: "#fff", borderRadius: 10, padding: "0 14px", fontSize: 16, cursor: "pointer", opacity: replyText.trim() ? 1 : 0.38 }}>↑</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* MEMBERS TAB */}
        {tab === "members" && (
          <div style={{ padding: "0 20px 32px", display: "flex", flexDirection: "column", gap: 10 }}>
            {members.length === 0 && <EmptyState icon="👥" title="No members yet" sub="Be the first to join!" />}
            {members.map((m, i) => (
              <div key={m.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #EDE8DF", padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, #69c0f2, #e14ceb)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "'Playfair Display', serif", flexShrink: 0 }}>{m.name?.[0] || "?"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 700, color: "#1C1917" }}>{m.name}</div>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#A8957A", marginTop: 1 }}>{m.department}</div>
                </div>
                {i === 0 && <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, color: "#8B6A3E", background: "#F5F0E8", borderRadius: 6, padding: "3px 8px" }}>FOUNDER</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CREATE CLUB
// ══════════════════════════════════════════════════════════════════════════════
function CreateClubScreen({ onBack, onSubmit, profile }) {
  const [form, setForm] = useState({ name: "", category: "Tech", desc: "", contact: "", dept: "" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.name && form.desc && form.dept;
  return (
    <Page style={{ display: "flex", flexDirection: "column" }}>
      <Header onBack={onBack} title="Create a Club" />
      <div style={{ flex: 1, overflow: "auto", padding: "0 20px 32px", scrollbarWidth: "none" }}>
        <SectionCard label="Club Info">
          <>
            <input placeholder="Club Name *" value={form.name} onChange={e => set("name", e.target.value)} style={inputStyle} />
            <select value={form.category} onChange={e => set("category", e.target.value)} style={selectStyle}>{["Tech","Sports","Arts","Leadership","Social","General"].map(c => <option key={c}>{c}</option>)}</select>
            <textarea placeholder="What is this club about? *" value={form.desc} onChange={e => set("desc", e.target.value)} style={{ ...inputStyle, height: 88, resize: "none" }} />
            <input placeholder="Contact number (optional)" type="tel" value={form.contact} onChange={e => set("contact", e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
          </>
        </SectionCard>
        <SectionCard label="Your Info (as founder)">
          <>
            <input placeholder="Your Department *" value={form.dept} onChange={e => set("dept", e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
          </>
        </SectionCard>
        <PrimaryBtn disabled={!valid} onClick={() => valid && onSubmit(form)} style={{ opacity: valid ? 1 : 0.38 }}>Launch Club 🚀</PrimaryBtn>
      </div>
    </Page>
  );
}

function MeetupPopup({ ride, onCancel, onConfirm }) {
  const [location, setLocation] = useState("");
  const [time, setTime] = useState("");
  const valid = location.trim() && time.trim();

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div className="anim-0" style={{ background: "#FAF8F5", borderRadius: "24px 24px 0 0", padding: "28px 24px 40px", width: "100%", maxWidth: 960, boxShadow: "0 -8px 40px rgba(0,0,0,0.15)" }}>
        {/* Handle bar */}
        <div style={{ width: 40, height: 4, background: "#EDE8DF", borderRadius: 99, margin: "0 auto 24px" }} />
        
        {/* Ride summary */}
        <div style={{ background: "#fff", borderRadius: 16, padding: "14px 16px", border: "1px solid #EDE8DF", marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 24 }}>🚗</div>
          <div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 600, color: "#1C1917" }}>{ride.from_location} → {ride.to_location}</div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, color: "#A8957A", marginTop: 2 }}>📅 {ride.ride_date} · 🕐 {ride.ride_time} · ₹{ride.cost}/seat</div>
          </div>
        </div>

        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, fontWeight: 700, color: "#C4A882", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 16 }}>Propose a meetup point</div>

        {/* Live preview */}
        <div style={{ background: "#F0FDF4", borderRadius: 14, padding: "14px 16px", border: "1px solid #86EFAC", marginBottom: 18, fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: "#1C1917", lineHeight: 2 }}>
          📍 Let's meet at{" "}
          <span style={{ color: "#8B6A3E", fontWeight: 700 }}>{location || "___________"}</span>
          {" "}at{" "}
          <span style={{ color: "#8B6A3E", fontWeight: 700 }}>{time || "___________"}</span>
        </div>

        <input
          placeholder="Meeting point (e.g. Main gate, Library...)"
          value={location}
          onChange={e => setLocation(e.target.value)}
          style={{ ...inputStyle, marginBottom: 10 }}
        />
        <input
          placeholder="Time (e.g. 3:00 PM, 15 mins before departure...)"
          value={time}
          onChange={e => setTime(e.target.value)}
          style={{ ...inputStyle, marginBottom: 20 }}
        />

        <PrimaryBtn onClick={() => valid && onConfirm(location, time)} disabled={!valid} style={{ opacity: valid ? 1 : 0.38 }}>
          Send Meetup Request 📍
        </PrimaryBtn>
        <button onClick={onCancel} style={{ width: "100%", marginTop: 12, background: "none", border: "none", color: "#A8957A", fontSize: 12, cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }}>Cancel</button>
      </div>
    </div>
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
          <img src={NEW_LOGO_SRC} alt="Mewtual" style={{ width: 80, height: "auto", display: "block", objectFit: "contain" }} />
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
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600;1,700&family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&display=swap');  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
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