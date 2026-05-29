// ==UserScript==
// @name         Turf Matchmaking
// @version      1.0
// @description  Fast matchmaking optimized (Krunker Civilian model)
// @author       Vixino
// @match        *://krunker.io/*
// @match        *://*.krunker.io/*
// @updateURL    https://raw.githubusercontent.com/Vixcra/Krunxino/main/TurfMatchMaking.js
// @downloadURL  https://raw.githubusercontent.com/Vixcra/Krunxino/main/TurfMatchMaking.js
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    // Gamemodes list matching Krunker internal index IDs
    const GAMEMODES = [
        "Free for All", "Team Deathmatch", "Hardpoint", "Capture the Flag", "Parkour",
        "Hide & Seek", "Infected", "Race", "Last Man Standing", "Simon Says",
        "Gun Game", "Prop Hunt", "Boss Hunt", "Classic FFA", "Deposit",
        "Stalker", "King of the Hill", "One in the Chamber", "Trade", "Kill Confirmed",
        "Defuse", "Sharp Shooter", "Traitor", "Raid", "Blitz",
        "Domination", "Squad Deathmatch", "Kranked FFA", "Team Defender", "Deposit FFA",
        "Chaos Snipers", "Bighead FFA"
    ];

    // Regions list and display full names
    const REGIONS = ["SV", "TOK", "FRA", "MBI", "SYD", "SIN", "DAL", "BHN", "BRZ", "NY"];

    const REGION_NAMES = {
        SV: "Silicon Valley", TOK: "Tokyo", FRA: "Frankfurt", MBI: "Mumbai",
        SYD: "Sydney", SIN: "Singapore", DAL: "Dallas", BHN: "Bahrain",
        BRZ: "Brazil", NY: "New York"
    };

    // Region mapping dictionary from game-list prefixes to config codes
    const REGION_MAP = {
        "us-ca-sv": "SV", "us-ca": "SV", "us-ca-la": "SV", "us-ca-la-2": "SV",
        "jb-hnd": "TOK", "jp-tok": "TOK",
        "de-fra": "FRA",
        "as-mb": "MBI", "in-bom": "MBI",
        "au-syd": "SYD",
        "sgp": "SIN", "sgp-sin": "SIN",
        "us-tx": "DAL",
        "me-bhn": "BHN", "me-dub": "BHN",
        "brz": "BRZ", "br-gru": "BRZ",
        "us-nj": "NY"
    };

    // Maps list
    const MAPS = [
        "Burg", "Littletown", "Sandstorm", "Subzero", "Undergrowth", "Freight",
        "Lostworld", "Citadel", "Oasis", "Kanji", "Industry", "Lumber",
        "Evacuation", "Site", "SkyTemple", "Lagoon", "Tropicano", "Habitat",
        "Atomic", "Old_Burg", "Throwback", "Clockwork", "Bazaar", "Erupt",
        "HQ", "Lush", "Vivo", "Slide Moonlight", "Eterno Sim"
    ];

    const MAP_NAMES = {
        SkyTemple: "Sky Temple", Old_Burg: "Old Burg",
        "Slide Moonlight": "Slide Moonlight", "Eterno Sim": "Eterno Sim"
    };

    // Load and normalize legacy match settings dynamically
    const saved = JSON.parse(localStorage.getItem("lombre_match_settings") || "{}");
    const loadedRegions = (saved.regions || []).map(r => REGION_MAP[r.toLowerCase()] || r.toUpperCase());
    const loadedMaps = (saved.maps || []).map(m => {
        const cased = MAPS.find(x => x.toLowerCase() === m.toLowerCase());
        return cased || m;
    });
    const loadedModes = (saved.modes || []).map(m => {
        if (typeof m === 'number') return GAMEMODES[m] || m;
        const cased = GAMEMODES.find(x => x.toLowerCase() === m.toLowerCase());
        return cased || m;
    });

    const STATE = {
        tab: "match",
        maps: loadedMaps,
        modes: loadedModes,
        regions: loadedRegions,
        minPlayers: saved.minPlayers ?? 1,
        maxPlayers: saved.maxPlayers ?? 6,
        minTime: saved.minTime ?? 90, // seconds remaining
        keybind: saved.keybind || "KeyF6", // Matchmaker Hotkey
        cancelKeybind: saved.cancelKeybind || "Escape", // Matchmaker Cancel
        openServerBrowser: saved.openServerBrowser ?? true,
        sortByPlayers: saved.sortByPlayers ?? false,
        filterAutoJoin: saved.filterAutoJoin ?? false,
        filterAvoidCloseToFull: saved.filterAvoidCloseToFull ?? false,

        css: saved.css || "",
        script: saved.script || "",
        scriptError: false,

        binding: false,
        bindingCancel: false,
        visible: false,
        scrollPos: 0
    };

    // Fallback previously active tabs (like xhair, trade, raids) to match tab
    if (!["match", "css", "scripts"].includes(STATE.tab)) {
        STATE.tab = "match";
    }

    function saveState() {
        localStorage.setItem("lombre_match_settings", JSON.stringify(STATE));
    }

    // HTML escape function for safety
    function b(str) {
        if (typeof str !== 'string') return str;
        return str.replace(/[&<>"']/g, m => {
            switch (m) {
                case '&': return '&amp;';
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '"': return '&quot;';
                case "'": return '&#039;';
                default: return m;
            }
        });
    }

    // Apply custom styles
    function applyCSS(css) {
        let el = document.getElementById("lombre_custom_css");
        if (!el) { el = document.createElement("style"); el.id = "lombre_custom_css"; document.head.appendChild(el); }
        el.textContent = css;
    }

    // Apply custom user script
    function applyScript(code) {
        if (!code) return;
        try { new Function(code)(); STATE.scriptError = false; } catch (e) { STATE.scriptError = true; }
    }

    // Toggle settings panel UI visibility
    function toggleUI(force) {
        STATE.visible = force !== undefined ? force : !STATE.visible;
        ui.style.display = STATE.visible ? "block" : "none";
        if (STATE.visible) {
            render();
        }
    }

    // --- MATCHMAKER STYLING (Crimson Volcanic Theme) ---
    const matchmakerStyles = document.createElement("style");
    matchmakerStyles.id = "civilian_matchmaker_styles";
    matchmakerStyles.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Aldrich&display=swap');

        /* Global style injector matching Volcanic theme */
        #lombre_ui, #lombre_ui *, #matchmakerPopupContainer, #matchmakerPopupContainer * {
          font-family: 'Aldrich', 'GameFont', 'Segoe UI', sans-serif !important;
        }

        /* Scrollbar styles with flowing lava gradient */
        #lombre_ui ::-webkit-scrollbar-track {
          box-shadow: none !important;
          border-radius: 0 !important;
          background-color: #0d0908 !important;
        }
        #lombre_ui ::-webkit-scrollbar {
          width: 6px !important;
          background-color: #0d0908 !important;
        }
        #lombre_ui ::-webkit-scrollbar-thumb {
          border-radius: 0 !important;
          background: linear-gradient(to bottom, #d1001c, #ff3b00, #ff8c00) !important;
          box-shadow: inset 0 0 4px #0d0908;
        }

        /* Volcano Glow Keyframes for Pulsing Magma */
        @keyframes volcanicGlow {
          0% {
            box-shadow: 0 10px 45px rgba(0,0,0,0.95), 0 0 20px rgba(255, 59, 0, 0.35), inset 0 0 15px rgba(255, 59, 0, 0.05);
            border-color: #ff3b00;
          }
          50% {
            box-shadow: 0 10px 45px rgba(0,0,0,0.95), 0 0 35px rgba(255, 106, 0, 0.6), inset 0 0 25px rgba(255, 106, 0, 0.15);
            border-color: #ff7700;
          }
          100% {
            box-shadow: 0 10px 45px rgba(0,0,0,0.95), 0 0 20px rgba(255, 59, 0, 0.35), inset 0 0 15px rgba(255, 59, 0, 0.05);
            border-color: #ff3b00;
          }
        }

        /* Interactive elements - Glowing embers style */
        .tab-btn:hover {
          color: #fff !important;
          border-color: #ff3b00 !important;
          background: rgba(255, 59, 0, 0.15) !important;
          box-shadow: 0 0 10px rgba(255, 59, 0, 0.2);
        }
        .m-select:hover {
          color: #fff !important;
          border-color: #ff3b00 !important;
          background: rgba(255, 59, 0, 0.15) !important;
          transform: translateY(-1px);
          box-shadow: 0 0 10px rgba(255, 59, 0, 0.2);
        }
        #toggle_browser_cancel:hover, #toggle_filter_autojoin:hover, #toggle_filter_avoid_full:hover, #toggle_sort_priority:hover {
          border-color: #ff7700 !important;
          box-shadow: 0 0 10px rgba(255, 119, 0, 0.3);
        }
        #find_btn:hover, #load_css_btn:hover, #load_script_btn:hover {
          background: linear-gradient(135deg, #ff1e00 0%, #ff5d00 50%, #ff9d00 100%) !important;
          box-shadow: 0 0 25px rgba(255, 59, 0, 0.65) !important;
          transform: translateY(-2px);
        }
        #find_btn:active, #load_css_btn:active, #load_script_btn:active {
          transform: translateY(0) scale(0.98);
        }
        #kb_btn:hover, #cancel_kb_btn:hover {
          border-color: #ff3b00 !important;
          color: #fff !important;
          background: rgba(255, 59, 0, 0.1) !important;
        }
        #close_btn:hover {
          color: #ff3b00 !important;
          transform: scale(1.2);
          text-shadow: 0 0 8px rgba(255, 59, 0, 0.6);
        }

        @keyframes matchmakerPopupSlideDown {
          0% { transform: translate(-50%, -100%); opacity: 0; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
        .onGame #matchmakerPopupContainer:not(.searching) {
          opacity: 0 !important;
          display: none !important;
        }
        #matchmakerPopupContainer {
          position: fixed;
          top: 10em;
          left: 50%;
          transform: translate(-50%, 0);
          z-index: 200000000;
          box-sizing: border-box;
          width: 35em;
          aspect-ratio: 2.5/1;
          border-radius: 4px;
          overflow: hidden;
          pointer-events: all;
          background-color: rgba(18, 12, 10, 0.98);
          border: 2px solid #ff3b00;
          animation: matchmakerPopupSlideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards, volcanicGlow 5s infinite ease-in-out;
        }
        #matchmakerPopupTitle {
          font-size: 2.1em;
          color: white;
          padding: 0.4em 0.8em;
          background: rgba(0,0,0,0.5);
          margin-bottom: 0.3em;
          font-weight: bold;
          text-transform: uppercase;
          border-bottom: 1px solid rgba(255, 59, 0, 0.3);
          letter-spacing: 2px;
          text-shadow: 0 0 8px rgba(255, 59, 0, 0.5);
        }
        #matchmakerPopupDescription {
          background: rgba(0,0,0,0.3);
          color: #ffaa00;
          box-sizing: border-box;
          padding: 0.6em 1em;
          font-size: 1.35em;
          text-shadow: 0 0 5px rgba(255, 170, 0, 0.2);
        }
        #matchmakerPopupOptions {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          display: flex;
          background: rgba(0, 0, 0, 0.5);
          padding: 0.5em;
          box-sizing: border-box;
          gap: 0.5em;
          border-top: 1px solid rgba(255, 59, 0, 0.3);
        }
        .matchmakerPopupButton {
          text-align: center;
          border: 2px solid;
          box-sizing: border-box;
          color: white;
          border-radius: 4px;
          font-size: 1.35em;
          background-color: rgba(18, 12, 10, 0.8);
          padding: 0.4em 1.2em;
          transition: all 0.15s ease;
          flex-grow: 1;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        #matchmakerConfirmButton {
          border-color: #00c853;
          box-shadow: inset 0 -4px 0 #006020, 0 0 10px rgba(0, 200, 83, 0.2);
        }
        #matchmakerConfirmButton:hover {
          background-color: #00c853;
          box-shadow: inset 0 0 0 #00c853, 0 0 15px rgba(0, 200, 83, 0.5);
        }
        #matchmakerCancelButton {
          border-color: #ff3b00;
          box-shadow: inset 0 -4px 0 #800000, 0 0 10px rgba(255, 59, 0, 0.2);
        }
        #matchmakerCancelButton:hover {
          background: linear-gradient(135deg, #cc1111 0%, #ff3b00 100%) !important;
          box-shadow: inset 0 0 0 #ff3b00, 0 0 15px rgba(255, 59, 0, 0.5) !important;
        }
        .matchmakerPopupButton:hover {
          cursor: pointer;
          border-color: white !important;
          transform: translateY(-2px);
        }
        .matchmakerPopupButton:active {
          transform: translateY(0) scale(0.95);
        }

        /* ── Search phase ── */
        #matchmakerPopupContainer.searching {
          background-image: none !important;
          background: rgba(18, 12, 10, 0.99);
          width: 28em;
          aspect-ratio: auto;
          padding: 1.5em;
          border: 2px solid #ff3b00;
          animation: volcanicGlow 5s infinite ease-in-out;
        }
        #matchmakerPopupContainer.searching #matchmakerPopupTitle,
        #matchmakerPopupContainer.searching #matchmakerPopupDescription,
        #matchmakerPopupContainer.searching #matchmakerPopupOptions {
          display: none !important;
        }
        #matchmakerPopupContainer:not(.searching) #matchmakerSearchContainer {
          display: none !important;
        }
        #matchmakerSearchContainer {
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        #matchmakerSearchStatus {
          font-size: 1.7em;
          color: white;
          font-weight: bold;
          margin-bottom: 0.8em;
          text-align: center;
          letter-spacing: 3px;
          text-transform: uppercase;
          text-shadow: 0 0 8px rgba(255, 59, 0, 0.5);
        }
        #matchmakerSearchFeed {
          display: flex;
          flex-direction: column;
          gap: 0.5em;
          margin-bottom: 1.2em;
          min-height: 120px;
          max-height: 240px;
          overflow-y: auto;
          padding-right: 4px;
        }
        #matchmakerSearchCounter {
          font-size: 1.15em;
          color: #a8948d;
          text-align: center;
          margin-bottom: 1em;
          font-weight: bold;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        #matchmakerSearchCancel {
          text-align: center;
          border: 2px solid #ff3b00;
          box-shadow: inset 0 -4px 0 #800000, 0 0 10px rgba(255, 59, 0, 0.2);
          border-radius: 4px;
          padding: 0.6em;
          color: white;
          cursor: pointer;
          background: rgba(18, 12, 10, 0.7);
          transition: all 0.15s ease;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-size: 1.1em;
        }
        #matchmakerSearchCancel:hover {
          background: linear-gradient(135deg, #cc1111 0%, #ff3b00 100%) !important;
          box-shadow: inset 0 0 0 #ff3b00, 0 0 15px rgba(255, 59, 0, 0.5) !important;
          transform: translateY(-2px);
          border-color: white !important;
        }
        #matchmakerSearchCancel:active {
          transform: translateY(0) scale(0.98);
        }

        .mm-feed-entry {
          display: flex;
          justify-content: space-between;
          padding: 0.5em 0.8em;
          border-radius: 4px;
          background: rgba(0, 0, 0, 0.4);
          font-size: 1.25em;
          align-items: center;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .mm-feed-entry.mm-pass {
          border-left: 5px solid #00c853;
          color: #00c853;
          background: rgba(0, 200, 83, 0.08);
          text-shadow: 0 0 5px rgba(0, 200, 83, 0.3);
        }
        .mm-feed-entry.mm-fail {
          border-left: 5px solid #ff3b00;
          color: #ff3b00;
          background: rgba(255, 59, 0, 0.08);
          opacity: 0.7;
          text-shadow: 0 0 5px rgba(255, 59, 0, 0.3);
        }
        .mm-feed-region {
          font-weight: bold;
          text-transform: uppercase;
        }
        .mm-feed-map {
          flex-grow: 1;
          margin-left: 1em;
          text-align: left;
        }
        .mm-feed-players {
          font-weight: bold;
        }
    `;
    document.head.appendChild(matchmakerStyles);

    // --- MATCHMAKER HUDS ---
    let searchCanceled = false;
    let checkedFullRoom = false;
    let checkedMatchCancelled = false;

    const overlay = document.createElement("div");
    overlay.id = "matchmakerPopupContainer";

    const popupTitle = document.createElement("div");
    popupTitle.id = "matchmakerPopupTitle";
    overlay.appendChild(popupTitle);

    const popupDesc = document.createElement("div");
    popupDesc.id = "matchmakerPopupDescription";
    overlay.appendChild(popupDesc);

    const popupOptions = document.createElement("div");
    popupOptions.id = "matchmakerPopupOptions";

    const cancelButton = document.createElement("div");
    cancelButton.id = "matchmakerCancelButton";
    cancelButton.className = "matchmakerPopupButton";
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", () => {
        window.playSelect?.();
        closeMatchmakerHUD();
    });
    popupOptions.appendChild(cancelButton);
    overlay.appendChild(popupOptions);

    const searchContainer = document.createElement("div");
    searchContainer.id = "matchmakerSearchContainer";

    const searchStatus = document.createElement("div");
    searchStatus.id = "matchmakerSearchStatus";
    searchContainer.appendChild(searchStatus);

    const searchFeed = document.createElement("div");
    searchFeed.id = "matchmakerSearchFeed";
    searchContainer.appendChild(searchFeed);

    const searchCounter = document.createElement("div");
    searchCounter.id = "matchmakerSearchCounter";
    searchContainer.appendChild(searchCounter);

    const searchCancelBtn = document.createElement("div");
    searchCancelBtn.id = "matchmakerSearchCancel";
    searchCancelBtn.textContent = "Cancel";
    searchCancelBtn.addEventListener("click", () => cancelMatchmaking());
    searchContainer.appendChild(searchCancelBtn);

    overlay.appendChild(searchContainer);

    function closeMatchmakerHUD() {
        document.removeEventListener("keydown", handleHUDKeys, true);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        overlay.classList.remove("searching");
    }

    function handleHUDKeys(e) {
        if (document.pointerLockElement) return;

        // Escape or Custom cancel keybind triggers cancel
        const isCancelKey = e.code === STATE.cancelKeybind || e.key === "Escape";
        if (isCancelKey) {
            e.preventDefault();
            e.stopPropagation();
            cancelMatchmaking();
        }
    }

    function cancelMatchmaking() {
        searchCanceled = true;
        window.playSelect?.();
        closeMatchmakerHUD();

        // Open server browser if enabled
        if (STATE.openServerBrowser && typeof window.openServerWindow === "function") {
            window.openServerWindow(0);
        }
    }

    function showSearchHUD() {
        searchCanceled = false;
        overlay.classList.add("searching");
        searchStatus.textContent = "Connecting...";
        searchFeed.innerHTML = "";
        searchCounter.textContent = "";

        document.addEventListener("keydown", handleHUDKeys, true);
        const base = document.getElementById("uiBase");
        if (base) base.appendChild(overlay);
    }

    // --- BROWSER PING CALCULATOR ---
    async function measurePing(hostname) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 1500);
            const host = hostname.split(':')[0];
            
            // First fetch: TCP + TLS handshake
            await fetch(`https://${host}/`, { mode: 'no-cors', signal: controller.signal, cache: 'no-store' });
            
            // Second fetch: measure latency
            const start = performance.now();
            await fetch(`https://${host}/`, { mode: 'no-cors', signal: controller.signal, cache: 'no-store' });
            clearTimeout(timeout);
            
            return Math.round(performance.now() - start);
        } catch (err) {
            return 999;
        }
    }

    async function getRegionalPings() {
        const pings = {};
        try {
            const res = await fetch("https://matchmaker.krunker.io/ping-list?hostname=krunker.io");
            const data = await res.json();

            const promises = Object.entries(data).map(async ([key, host]) => {
                const shortCode = REGION_MAP[key] ?? key.toUpperCase();
                const latency = await measurePing(host);
                if (latency >= 0) {
                    pings[shortCode] = latency;
                }
            });
            await Promise.allSettled(promises);
        } catch (e) {
            console.error("Matchmaker ping failed:", e);
        }
        return pings;
    }

    // --- MAIN MATCHMAKING ROUTINE ---
    function renderFeedEntry(region, mapName, playersText, passes) {
        const entry = document.createElement("div");
        entry.className = `mm-feed-entry ${passes ? "mm-pass" : "mm-fail"}`;

        const rEl = document.createElement("span");
        rEl.className = "mm-feed-region";
        rEl.textContent = region;

        const mEl = document.createElement("span");
        mEl.className = "mm-feed-map";
        mEl.textContent = mapName;

        const pEl = document.createElement("span");
        pEl.className = "mm-feed-players";
        pEl.textContent = playersText;

        entry.appendChild(rEl);
        entry.appendChild(mEl);
        entry.appendChild(pEl);
        return entry;
    }

    // Renders interactive selection list items
    function renderInteractiveEntry(g, pings) {
        const entry = document.createElement("div");
        entry.className = "mm-feed-entry mm-pass";
        entry.style.cssText = "cursor:pointer; transition:all 0.15s; margin-bottom: 4px; background: rgba(0, 184, 0, 0.08); border-left: 5px solid #00b800;";

        const latency = pings[g.region] ? `${pings[g.region]}ms` : "?ms";
        const rEl = document.createElement("span");
        rEl.className = "mm-feed-region";
        rEl.textContent = `${g.region} (${latency})`;

        const mEl = document.createElement("span");
        mEl.className = "mm-feed-map";
        mEl.textContent = `${g.map} · ${g.gamemode}`;
        mEl.style.marginLeft = "1em";

        const pEl = document.createElement("span");
        pEl.className = "mm-feed-players";
        pEl.textContent = `${g.playerCount}/${g.playerLimit}`;

        entry.appendChild(rEl);
        entry.appendChild(mEl);
        entry.appendChild(pEl);

        entry.onmouseover = () => {
            entry.style.background = "rgba(0, 184, 0, 0.2)";
            entry.style.borderLeftWidth = "8px";
            entry.style.transform = "translateX(2px)";
            entry.style.borderColor = "white";
        };
        entry.onmouseout = () => {
            entry.style.background = "rgba(0, 184, 0, 0.08)";
            entry.style.borderLeftWidth = "5px";
            entry.style.transform = "none";
            entry.style.borderColor = "rgba(255,255,255,0.05)";
        };
        entry.onclick = () => {
            window.playSelect?.();
            sessionStorage.setItem("lombre_joined_via_mm", "true");
            closeMatchmakerHUD();
            window.location.assign(`https://krunker.io/?game=${g.gameID}`);
        };

        return entry;
    }

    // Sorting algorithm (ping-first or player count-first)
    function sortLobbies(lobbies, pings, sortByPlayers) {
        return lobbies.sort((a, b) => {
            if (sortByPlayers) {
                // Primary: highest player count
                if (a.playerCount !== b.playerCount) return b.playerCount - a.playerCount;
                // Secondary: lowest ping
                const pingA = pings[a.region] ?? 999;
                const pingB = pings[b.region] ?? 999;
                return pingA - pingB;
            } else {
                // Primary: lowest ping
                const pingA = pings[a.region] ?? 999;
                const pingB = pings[b.region] ?? 999;
                if (pingA !== pingB) return pingA - pingB;
                // Secondary: highest player count
                return b.playerCount - a.playerCount;
            }
        });
    }

    async function triggerMatchmaker() {
        checkedFullRoom = false;
        checkedMatchCancelled = false;
        showSearchHUD();

        let pings = {};

        try {
            // Step 1: Parallel fetch pings and games list
            const [pingData, gameData] = await Promise.all([
                getRegionalPings(),
                fetch(`https://matchmaker.krunker.io/game-list?hostname=${window.location.hostname}`).then(r => r.json())
            ]);
            pings = pingData;

            // Step 2: Instant in-memory filter
            const allMatching = [];
            for (const s of gameData.games) {
                const gameID = s[0];
                const region = gameID.split(":")[0];
                const playerCount = s[2];
                const playerLimit = s[3];
                const details = s[4] || {};
                const map = details.i || "";
                const gamemode = GAMEMODES[details.g] ?? "Unknown Gamemode";
                const remainingTime = s[5];

                let passesFilter = true;
                if (STATE.regions.length > 0 && !STATE.regions.includes(region)) passesFilter = false;
                if (STATE.modes.length > 0) {
                    const hasMode = STATE.modes.some(m => m.toLowerCase() === gamemode.toLowerCase());
                    if (!hasMode) passesFilter = false;
                }
                if (STATE.maps.length > 0) {
                    const hasMap = STATE.maps.some(m => m.toLowerCase() === map.toLowerCase() || m.replace('_', ' ').toLowerCase() === map.replace('_', ' ').toLowerCase());
                    if (!hasMap) passesFilter = false;
                }
                if (playerCount < STATE.minPlayers) passesFilter = false;
                if (playerCount > STATE.maxPlayers) passesFilter = false;
                if (remainingTime < STATE.minTime) passesFilter = false;
                if (playerCount >= playerLimit) passesFilter = false;
                if (playerCount <= 0) passesFilter = false;
                if (details.c !== 0) passesFilter = false;
                if (window.location.href.includes(gameID)) passesFilter = false;
                if (STATE.filterAvoidCloseToFull && (playerLimit - playerCount <= 1)) passesFilter = false;

                if (passesFilter) {
                    allMatching.push({
                        gameID, region, playerCount, playerLimit, map, gamemode, remainingTime
                    });
                }
            }

            // Sort by configured priority (ping vs players)
            sortLobbies(allMatching, pings, STATE.sortByPlayers);

            if (allMatching.length > 0) {
                searchStatus.textContent = "Scanning lobbies...";

                // Show a rapid scanning feed animation using non-matching lobbies
                const nonMatching = gameData.games
                    .filter(g => !allMatching.some(m => m.gameID === g[0]))
                    .slice(0, 8);

                for (const s of nonMatching) {
                    if (searchCanceled) return;
                    const gameID = s[0];
                    const region = gameID.split(":")[0];
                    const playerCount = s[2];
                    const playerLimit = s[3];
                    const details = s[4] || {};
                    const map = details.i || "";

                    const feedEntry = renderFeedEntry(region, map, `${playerCount}/${playerLimit}`, false);
                    searchFeed.appendChild(feedEntry);
                    if (searchFeed.children.length > 4) {
                        searchFeed.removeChild(searchFeed.firstChild);
                    }
                    searchCounter.textContent = `Scanning region: ${region}...`;
                    await new Promise(r => setTimeout(r, 40));
                }

                // Discover target matching lobbies (up to 5)
                const targetLobbies = allMatching.slice(0, 5);
                for (const lobby of targetLobbies) {
                    if (searchCanceled) return;

                    const feedEntry = renderFeedEntry(lobby.region, lobby.map, `${lobby.playerCount}/${lobby.playerLimit}`, true);
                    searchFeed.appendChild(feedEntry);
                    if (searchFeed.children.length > 4) {
                        searchFeed.removeChild(searchFeed.firstChild);
                    }
                    searchCounter.textContent = `Match found in ${lobby.region}!`;
                    await new Promise(r => setTimeout(r, 150));
                }

                if (searchCanceled) return;

                // Step 3: Result Phase
                if (allMatching.length === 1 || STATE.filterAutoJoin) {
                    // Exactly 1 lobby found or Auto-Join enabled -> Join directly after short visual confirmation
                    const selected = allMatching[0];
                    searchStatus.textContent = "Lobby Found!";
                    searchFeed.innerHTML = "";

                    const entry = renderFeedEntry(selected.region, selected.map, `${selected.playerCount}/${selected.playerLimit}`, true);
                    entry.style.cssText = "font-size: 1.1em; justify-content: center;";
                    searchFeed.appendChild(entry);

                    const regionFullName = REGION_NAMES[selected.region] ?? selected.region;
                    const latencyText = pings[selected.region] ? `${pings[selected.region]}ms` : "? ms";
                    searchCounter.textContent = `${selected.gamemode} · ${regionFullName} · ${latencyText}`;

                    await new Promise(r => setTimeout(r, 1200));
                    if (!searchCanceled) {
                        sessionStorage.setItem("lombre_joined_via_mm", "true");
                        closeMatchmakerHUD();
                        window.location.assign(`https://krunker.io/?game=${selected.gameID}`);
                    }
                } else {
                    // 2 or more lobbies found -> Present interactive selection menu!
                    searchStatus.textContent = "SELECT A LOBBY";
                    searchFeed.innerHTML = "";
                    searchFeed.style.maxHeight = "240px"; // expand to fit 5 items comfortably

                    for (const g of targetLobbies) {
                        const entry = renderInteractiveEntry(g, pings);
                        searchFeed.appendChild(entry);
                    }

                    searchCounter.textContent = `Found ${allMatching.length} optimal lobbies. Click one to join!`;
                }
            } else {
                // No lobbies found
                searchStatus.textContent = "No matching games found";
                await new Promise(r => setTimeout(r, 2000));
                closeMatchmakerHUD();

                if (STATE.openServerBrowser && typeof window.openServerWindow === "function") {
                    window.openServerWindow(0);
                }
            }
        } catch (err) {
            console.error("Matchmaker fetch error:", err);
            if (!searchCanceled) {
                searchStatus.textContent = "Failed to fetch lobbies";
                await new Promise(r => setTimeout(r, 2000));
                closeMatchmakerHUD();
            }
        }
    }

    // --- MAIN SETTINGS WINDOW ---
    const ui = document.createElement("div"); ui.id = "lombre_ui";
    ui.style.cssText = `position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background: #120c0a; border: 2px solid #ff3b00; padding: 25px; z-index: 100000000; color: #fff; display: none; width: 560px; border-radius: 4px; animation: volcanicGlow 5s infinite ease-in-out;`;

    const mBtn = document.createElement("div"); mBtn.id = "lombre_m_btn"; mBtn.className = "onMenu"; mBtn.textContent = "M";
    mBtn.style.cssText = `position:fixed; top:20px; right:20px; width:35px; height:35px; background: #120c0a; border: 2px solid #ff3b00; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 16px; cursor: pointer; border-radius: 4px; z-index: 10000000; transition: 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.5), 0 0 10px rgba(255,59,0,0.3); font-weight: bold;`;
    mBtn.onmouseover = () => { mBtn.style.background = "linear-gradient(135deg, #d1001c 0%, #ff7700 100%)"; mBtn.style.borderColor = "#ffffff"; mBtn.style.boxShadow = "0 4px 15px rgba(255,59,0,0.6)"; };
    mBtn.onmouseout = () => { mBtn.style.background = "#120c0a"; mBtn.style.borderColor = "#ff3b00"; mBtn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.5), 0 0 10px rgba(255,59,0,0.3)"; };
    mBtn.onclick = () => toggleUI();

    function render() {
        const contentArea = ui.querySelector('#scroll_area');
        if (contentArea) STATE.scrollPos = contentArea.scrollTop;
        let html = `
            <div id="close_btn" style="position:absolute; top:15px; right:20px; font-size:20px; color:#5c473f; cursor:pointer; font-weight:900; transition:0.2s;">X</div>
            <div style="font-size: 22px; font-weight: bold; text-align: center; margin-bottom: 20px; color: #fff; letter-spacing: 3px; text-transform: uppercase; text-shadow: 0 0 8px rgba(255, 59, 0, 0.45);">TURF MATCHMAKER</div>
            <div style="display:flex; gap:8px; margin-bottom:20px;">
                ${['match', 'css', 'scripts'].map(t => `<div class="tab-btn" data-t="${t}" style="flex:1; padding:12px; text-align:center; cursor:pointer; background:${STATE.tab === t ? 'linear-gradient(135deg, #d1001c 0%, #ff3b00 100%)' : '#0d0908'}; color:${STATE.tab === t ? '#fff' : '#88746d'}; border:1px solid ${STATE.tab === t ? '#ff3b00' : '#2e1d17'}; border-radius:4px; font-weight:bold; font-size:11px; transition:0.2s; letter-spacing:1px; text-transform:uppercase; box-shadow:${STATE.tab === t ? '0 2px 8px rgba(255, 59, 0, 0.35)' : 'none'};">${t.toUpperCase()}</div>`).join('')}
            </div>
            <div id="scroll_area" style="max-height:450px; overflow-y:auto; padding-right:8px;">
        `;

        if (STATE.tab === "match") {
            // Renders the settings UI items
            const drawGrid = (title, list, key, fullNamesMap, cols = 4) => {
                html += `<div style="font-size:11px; color:#c2ada3; margin:15px 0 8px; font-weight:bold; text-transform:uppercase; letter-spacing:1.5px; border-left:3px solid #ff3b00; padding-left:6px; text-shadow: 0 0 5px rgba(255,59,0,0.2);">${title}</div><div style="display:grid; grid-template-columns:repeat(${cols}, 1fr); gap:6px;">`;
                for (let i = 0; i < list.length; i++) {
                    const val = list[i];
                    const active = STATE[key].includes(val);
                    const displayName = fullNamesMap && fullNamesMap[val] ? fullNamesMap[val] : val;
                    html += `<div class="m-select" data-key="${key}" data-val="${val}" style="padding:10px 2px; cursor:pointer; background:${active ? 'linear-gradient(135deg, #d1001c 0%, #ff3b00 100%)' : '#0d0908'}; color:${active ? '#fff' : '#6e5c56'}; border: 1px solid ${active ? '#ff3b00' : '#231612'}; border-radius:4px; font-size:10px; font-weight:bold; text-align:center; transition:0.1s; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; box-shadow:${active ? '0 2px 6px rgba(255,59,0,0.25)' : 'none'};" title="${displayName}">${displayName}</div>`;
                }
                html += `</div>`;
            };

            html += `
                <div style="background:#0d0908; padding:15px; border-radius:4px; border:1px solid #231612; display: flex; flex-direction: column; gap: 8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:11px; font-weight:bold; color:#c2ada3; letter-spacing: 0.5px;">SERVER BROWSER ON CANCEL</span>
                        <button id="toggle_browser_cancel" style="padding:6px 12px; background:${STATE.openServerBrowser ? 'linear-gradient(135deg, #d1001c 0%, #ff3b00 100%)' : '#1c1513'}; color:${STATE.openServerBrowser ? '#fff' : '#7a6861'}; border:1px solid ${STATE.openServerBrowser ? '#ff3b00' : '#362a26'}; border-radius:4px; font-weight:bold; font-size:10px; cursor:pointer; text-transform:uppercase; letter-spacing:0.5px; transition:0.2s; box-shadow:${STATE.openServerBrowser ? '0 2px 6px rgba(255,59,0,0.25)' : 'none'};">${STATE.openServerBrowser ? 'ENABLED' : 'DISABLED'}</button>
                    </div>
                </div>

                <div style="font-size:11px; color:#c2ada3; margin:15px 0 8px; font-weight:bold; text-transform:uppercase; letter-spacing:1.5px; border-left:3px solid #ff3b00; padding-left:6px; text-shadow: 0 0 5px rgba(255,59,0,0.2);">FILTERS</div>
                <div style="background:#0d0908; padding:15px; border-radius:4px; border:1px solid #231612; display: flex; flex-direction: column; gap: 8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:11px; font-weight:bold; color:#c2ada3; letter-spacing: 0.5px;">AUTO-JOIN LOWEST PING</span>
                        <button id="toggle_filter_autojoin" style="padding:6px 12px; background:${STATE.filterAutoJoin ? 'linear-gradient(135deg, #d1001c 0%, #ff3b00 100%)' : '#1c1513'}; color:${STATE.filterAutoJoin ? '#fff' : '#7a6861'}; border:1px solid ${STATE.filterAutoJoin ? '#ff3b00' : '#362a26'}; border-radius:4px; font-weight:bold; font-size:10px; cursor:pointer; text-transform:uppercase; letter-spacing:0.5px; transition:0.2s; box-shadow:${STATE.filterAutoJoin ? '0 2px 6px rgba(255,59,0,0.25)' : 'none'};">${STATE.filterAutoJoin ? 'ON' : 'OFF'}</button>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:11px; font-weight:bold; color:#c2ada3; letter-spacing: 0.5px;">AVOID LOBBIES WITH 1 SLOT LEFT</span>
                        <button id="toggle_filter_avoid_full" style="padding:6px 12px; background:${STATE.filterAvoidCloseToFull ? 'linear-gradient(135deg, #d1001c 0%, #ff3b00 100%)' : '#1c1513'}; color:${STATE.filterAvoidCloseToFull ? '#fff' : '#7a6861'}; border:1px solid ${STATE.filterAvoidCloseToFull ? '#ff3b00' : '#362a26'}; border-radius:4px; font-weight:bold; font-size:10px; cursor:pointer; text-transform:uppercase; letter-spacing:0.5px; transition:0.2s; box-shadow:${STATE.filterAvoidCloseToFull ? '0 2px 6px rgba(255,59,0,0.25)' : 'none'};">${STATE.filterAvoidCloseToFull ? 'ON' : 'OFF'}</button>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:11px; font-weight:bold; color:#c2ada3; letter-spacing: 0.5px;">PRIORITIZE PLAYER COUNT</span>
                        <button id="toggle_sort_priority" style="padding:6px 12px; background:${STATE.sortByPlayers ? 'linear-gradient(135deg, #d1001c 0%, #ff3b00 100%)' : '#1c1513'}; color:${STATE.sortByPlayers ? '#fff' : '#7a6861'}; border:1px solid ${STATE.sortByPlayers ? '#ff3b00' : '#362a26'}; border-radius:4px; font-weight:bold; font-size:10px; cursor:pointer; text-transform:uppercase; letter-spacing:0.5px; transition:0.2s; box-shadow:${STATE.sortByPlayers ? '0 2px 6px rgba(255,59,0,0.25)' : 'none'};">${STATE.sortByPlayers ? 'ON' : 'OFF'}</button>
                    </div>
                </div>
            `;

            drawGrid("REGIONS (NONE = ALL)", REGIONS, "regions", REGION_NAMES, 5);
            drawGrid("GAMEMODES (NONE = ALL)", GAMEMODES, "modes", null, 3);
            drawGrid("MAPS (NONE = ALL)", MAPS, "maps", MAP_NAMES, 4);

            html += `
                <div style="background:#0d0908; padding:20px; border-radius:4px; margin-top:25px; border:1px solid #231612;">
                    <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:12px; font-weight:bold; color:#c2ada3; letter-spacing:0.5px;">
                        <span>MIN PLAYERS - <span id="l_minPlayers" style="color:#ff3b00; text-shadow:0 0 4px rgba(255,59,0,0.3);">${STATE.minPlayers}</span></span>
                        <span>MAX PLAYERS - <span id="l_maxPlayers" style="color:#ff3b00; text-shadow:0 0 4px rgba(255,59,0,0.3);">${STATE.maxPlayers}</span></span>
                        <span>MIN MATCH REMAINING - <span id="l_minTime" style="color:#ff3b00; text-shadow:0 0 4px rgba(255,59,0,0.3);">${STATE.minTime}</span>s</span>
                    </div>
                    <input type="range" class="s-input" data-k="minPlayers" min="0" max="7" value="${STATE.minPlayers}" style="width:100%; margin-bottom:12px; accent-color:#ff3b00; cursor:pointer;">
                    <input type="range" class="s-input" data-k="maxPlayers" min="0" max="7" value="${STATE.maxPlayers}" style="width:100%; margin-bottom:12px; accent-color:#ff3b00; cursor:pointer;">
                    <input type="range" class="s-input" data-k="minTime" min="0" max="480" step="10" value="${STATE.minTime}" style="width:100%; accent-color:#ff3b00; cursor:pointer;">
                </div>
                <button id="find_btn" style="width:100%; padding:18px; margin-top:20px; background:linear-gradient(135deg, #cc1111 0%, #ff3b00 50%, #ff7700 100%); color:#fff; border:none; border-radius:4px; font-weight:bold; font-size:17px; cursor:pointer; transition:0.2s; font-family:'Aldrich'; text-transform:uppercase; letter-spacing:2px; box-shadow: inset 0 -4px 0 #800000, 0 4px 15px rgba(255,59,0,0.35);">FIND GAME</button>
                
                <div style="display:flex; gap:10px; justify-content:center; margin-top:12px;">
                    <button id="kb_btn" style="padding:6px 15px; background:transparent; color:#7a6861; border:1px solid #231612; border-radius:4px; font-weight:bold; font-size:10px; cursor:pointer; transition:0.2s; font-family:'Aldrich';">SEARCH HOTKEY: ${STATE.keybind ? STATE.keybind.replace('Key', '').replace('Digit', '').toUpperCase() : 'NONE'}</button>
                    <button id="cancel_kb_btn" style="padding:6px 15px; background:transparent; color:#7a6861; border:1px solid #231612; border-radius:4px; font-weight:bold; font-size:10px; cursor:pointer; transition:0.2s; font-family:'Aldrich';">CANCEL HOTKEY: ${STATE.cancelKeybind ? STATE.cancelKeybind.replace('Key', '').replace('Digit', '').toUpperCase() : 'NONE'}</button>
                </div>
            `;
        } else if (STATE.tab === "css") {
            html += `<div style="text-align:center; padding:60px 0;"><button id="load_css_btn" style="padding:25px 50px; background:linear-gradient(135deg, #cc1111 0%, #ff3b00 50%, #ff7700 100%); color:#fff; border:none; border-radius:4px; font-weight:bold; font-size:20px; cursor:pointer; font-family:'Aldrich'; text-transform:uppercase; letter-spacing:1px; box-shadow: inset 0 -4px 0 #800000, 0 4px 15px rgba(255,59,0,0.35); transition:0.2s;">SELECT CSS FILE</button>${STATE.css ? `<div style="margin-top:20px;"><button id="clear_css_btn" style="background:transparent; color:#ff4444; border:none; cursor:pointer; font-size:11px; font-weight:bold; text-decoration:underline;">CLEAR SAVED CSS</button></div>` : ''}<div style="margin-top:40px; font-size:11px; color:#7a6861; text-transform:uppercase;">Status: ${STATE.css ? '<span style="color:#00c853;">Active</span>' : 'Not Loaded'}</div></div>`;
        } else if (STATE.tab === "scripts") {
            html += `<div style="text-align:center; padding:60px 0;"><button id="load_script_btn" style="padding:25px 50px; background:linear-gradient(135deg, #cc1111 0%, #ff3b00 50%, #ff7700 100%); color:#fff; border:none; border-radius:4px; font-weight:bold; font-size:20px; cursor:pointer; font-family:'Aldrich'; text-transform:uppercase; letter-spacing:1px; box-shadow: inset 0 -4px 0 #800000, 0 4px 15px rgba(255,59,0,0.35); transition:0.2s;">SELECT JS FILE</button><div style="margin-top:40px; font-size:11px; color:#7a6861; text-transform:uppercase;">Status: ${STATE.script ? '<span style="color:#00c853;">Active</span>' : 'Not Loaded'}</div></div>`;
        }

        html += `</div>`; ui.innerHTML = html;
        const nA = ui.querySelector('#scroll_area'); if (nA) nA.scrollTop = STATE.scrollPos;
        ui.querySelector("#close_btn").onclick = () => toggleUI(false);

        ui.querySelectorAll(".tab-btn").forEach(b => b.onclick = () => { STATE.tab = b.dataset.t; render(); });
        ui.querySelectorAll(".m-select").forEach(b => b.onclick = () => {
            let k = b.dataset.key, v = isNaN(b.dataset.val) ? b.dataset.val : parseInt(b.dataset.val);
            STATE[k] = STATE[k].includes(v) ? STATE[k].filter(x => x !== v) : [...STATE[k], v]; saveState(); render();
        });

        ui.querySelectorAll(".s-input").forEach(i => {
            i.oninput = (e) => {
                const val = parseInt(e.target.value);
                STATE[i.dataset.k] = val;
                const label = ui.querySelector(`#l_${i.dataset.k}`);
                if (label) label.textContent = val;
            };
            i.onchange = saveState;
        });

        // Event hooks
        if (ui.querySelector("#toggle_browser_cancel")) ui.querySelector("#toggle_browser_cancel").onclick = () => { STATE.openServerBrowser = !STATE.openServerBrowser; saveState(); render(); };
        if (ui.querySelector("#toggle_filter_autojoin")) ui.querySelector("#toggle_filter_autojoin").onclick = () => { STATE.filterAutoJoin = !STATE.filterAutoJoin; saveState(); render(); };
        if (ui.querySelector("#toggle_filter_avoid_full")) ui.querySelector("#toggle_filter_avoid_full").onclick = () => { STATE.filterAvoidCloseToFull = !STATE.filterAvoidCloseToFull; saveState(); render(); };
        if (ui.querySelector("#toggle_sort_priority")) ui.querySelector("#toggle_sort_priority").onclick = () => { STATE.sortByPlayers = !STATE.sortByPlayers; saveState(); render(); };

        if (ui.querySelector("#find_btn")) ui.querySelector("#find_btn").onclick = () => { toggleUI(false); triggerMatchmaker(); };
        if (ui.querySelector("#load_css_btn")) ui.querySelector("#load_css_btn").onclick = loadCSSFile;
        if (ui.querySelector("#load_script_btn")) ui.querySelector("#load_script_btn").onclick = loadScriptFile;
        if (ui.querySelector("#clear_css_btn")) ui.querySelector("#clear_css_btn").onclick = () => { STATE.css = ""; saveState(); applyCSS(""); render(); };

        // Keybind configuration setup
        if (ui.querySelector("#kb_btn")) ui.querySelector("#kb_btn").onclick = () => {
            STATE.binding = true;
            ui.querySelector("#kb_btn").textContent = "WAITING...";
        };
        if (ui.querySelector("#cancel_kb_btn")) ui.querySelector("#cancel_kb_btn").onclick = () => {
            STATE.bindingCancel = true;
            ui.querySelector("#cancel_kb_btn").textContent = "WAITING...";
        };
    }

    // Load custom resources
    function loadCSSFile() { const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".css"; inp.onchange = e => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = r => { STATE.css = r.target.result; saveState(); applyCSS(STATE.css); render(); }; reader.readAsText(file); }; inp.click(); }
    function loadScriptFile() { const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".js"; inp.onchange = e => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = r => { STATE.script = r.target.result; saveState(); applyScript(STATE.script); render(); }; reader.readAsText(file); }; inp.click(); }

    // Close on overlay mouse click
    window.addEventListener("mousedown", (e) => {
        if (STATE.visible && !ui.contains(e.target) && !mBtn.contains(e.target)) toggleUI(false);
    });

    // Keydown listeners for settings capture & triggers
    window.addEventListener("keydown", (e) => {
        // Capture Hotkeys in settings panel
        if (STATE.binding) {
            e.preventDefault();
            STATE.keybind = e.code;
            STATE.binding = false;
            saveState();
            render();
            return;
        }
        if (STATE.bindingCancel) {
            e.preventDefault();
            STATE.cancelKeybind = e.code;
            STATE.bindingCancel = false;
            saveState();
            render();
            return;
        }

        // F2 to toggle main Settings panel
        if (e.key === "F2") {
            e.preventDefault();
            toggleUI();
        }

        // Matchmaker Hotkey (F6 by default) triggers matchmaker
        if (STATE.keybind && e.code === STATE.keybind) {
            if (document.activeElement.tagName !== "INPUT" && STATE.matchmakerEnabled) {
                e.preventDefault();
                triggerMatchmaker();
            }
        }
    });

    let lastIsIngame = null;
    let _elsCache = {};
    const getEl = (id) => _elsCache[id] || (_elsCache[id] = document.getElementById(id));

    function showNotificationAndRelaunch(message) {
        // Show a nice temporary overlay in the center of the screen
        const notify = document.createElement("div");
        notify.style.cssText = "position:fixed; top:20%; left:50%; transform:translate(-50%,-50%); background:linear-gradient(135deg, rgba(209,0,28,0.95), rgba(255,59,0,0.95)); color:white; padding:15px 30px; border-radius:4px; font-family:'Aldrich',sans-serif; font-size:16px; font-weight:bold; z-index:999999999; border:2px solid #ff7700; box-shadow:0 0 25px rgba(255, 59, 0, 0.6), 0 10px 30px rgba(0,0,0,0.8); text-transform:uppercase; letter-spacing:1px;";
        notify.textContent = message;
        document.body.appendChild(notify);
        
        setTimeout(() => {
            if (notify.parentNode) notify.parentNode.removeChild(notify);
            triggerMatchmaker();
        }, 1500);
    }

    function checkGameEndOrErrorState() {
        const inst = getEl('instructions');
        if (inst && inst.offsetHeight > 0) {
            const text = inst.textContent.toLowerCase();
            
            // 1. Detection of "Game is full"
            if (!checkedFullRoom && (text.includes("full") || text.includes("game is full") || text.includes("room is full") || text.includes("server is full"))) {
                if (sessionStorage.getItem("lombre_joined_via_mm") === "true") {
                    checkedFullRoom = true;
                    sessionStorage.removeItem("lombre_joined_via_mm");
                    
                    showNotificationAndRelaunch("Lobby is full! Relaunching search...");
                }
            }
            
            // 2. Detection of "Not enough players" / "Match cancelled" (Ranked prep time end)
            if (!checkedMatchCancelled && (text.includes("not enough players") || text.includes("match cancelled") || text.includes("match canceled") || text.includes("prep time ended"))) {
                checkedMatchCancelled = true;
                sessionStorage.removeItem("lombre_joined_via_mm"); // clear flag
                
                showNotificationAndRelaunch("Match cancelled: Not enough players! Relaunching search...");
            }
        }
    }

    function checkIngameLoop() {
        const inst = getEl('instructions'), login = getEl('windowHolder'), mainUI = getEl('inGameUI');
        const isIngame = !!document.pointerLockElement || ((!inst || inst.offsetHeight === 0) && (!login || login.offsetHeight === 0) && (mainUI && mainUI.offsetHeight > 0));

        if (isIngame !== lastIsIngame) {
            if (mBtn) mBtn.style.display = isIngame ? "none" : "flex";
            lastIsIngame = isIngame;
            
            // If they successfully got in-game, we can clear the mm flag!
            if (isIngame) {
                sessionStorage.removeItem("lombre_joined_via_mm");
            }
        }
        checkGameEndOrErrorState();
        requestAnimationFrame(checkIngameLoop);
    }

    const SCRIPT_VERSION = "1.0";

    async function checkForUpdates() {
        try {
            const res = await fetch("https://raw.githubusercontent.com/Vixcra/Krunxino/main/TurfMatchMaking.js", { cache: "no-store" });
            if (!res.ok) return;
            const text = await res.text();
            
            // Extract the version from metadata in the remote script
            const match = text.match(/@version\s+(\d+\.\d+)/);
            if (!match) return;
            const remoteVersion = match[1];
            
            if (remoteVersion !== SCRIPT_VERSION) {
                showUpdatePopup(remoteVersion);
            }
        } catch (e) {
            console.error("Failed to check for Turf Matchmaking updates:", e);
        }
    }

    function showUpdatePopup(newVersion) {
        const popup = document.createElement("div");
        popup.id = "lombre_update_popup";
        popup.style.cssText = `position:fixed; top:25%; left:50%; transform:translate(-50%, -50%); background:#120c0a; border:2px solid #ff3b00; padding:25px; z-index:200000005; color:#fff; width:380px; border-radius:4px; text-align:center; font-family:'Aldrich',sans-serif !important; animation:volcanicGlow 5s infinite ease-in-out; box-shadow:0 10px 40px rgba(0,0,0,0.9);`;
        
        popup.innerHTML = `
            <div id="update_close_btn" style="position:absolute; top:12px; right:15px; font-size:18px; color:#5c473f; cursor:pointer; font-weight:900; transition:0.2s;">X</div>
            <div style="font-size: 16px; font-weight: bold; margin-bottom: 12px; letter-spacing: 1px; color:#ff9100; text-transform:uppercase; text-shadow:0 0 5px rgba(255,145,0,0.2);">UPDATE AVAILABLE</div>
            <div style="font-size: 14px; margin-bottom: 20px; color:#c2ada3; line-height: 1.4;">TurfMatchMaking new version <span style="color:#ff3b00; font-weight:bold;">v${newVersion}</span> is available!</div>
            <button id="update_download_btn" style="width:100%; padding:12px; background:linear-gradient(135deg, #cc1111 0%, #ff3b00 50%, #ff7700 100%); color:#fff; border:none; border-radius:4px; font-weight:bold; font-size:12px; cursor:pointer; transition:0.2s; font-family:'Aldrich'; text-transform:uppercase; letter-spacing:1px; box-shadow: inset 0 -3px 0 #800000, 0 4px 12px rgba(255,59,0,0.25);">DOWNLOAD</button>
        `;
        
        document.body.appendChild(popup);
        
        const closeBtn = popup.querySelector("#update_close_btn");
        closeBtn.onclick = () => popup.parentNode.removeChild(popup);
        closeBtn.onmouseover = () => { closeBtn.style.color = "#ff3b00"; closeBtn.style.transform = "scale(1.2)"; };
        closeBtn.onmouseout = () => { closeBtn.style.color = "#5c473f"; closeBtn.style.transform = "scale(1)"; };
        
        const dlBtn = popup.querySelector("#update_download_btn");
        dlBtn.onclick = () => {
            window.open("https://github.com/Vixcra/Krunxino", "_blank");
            popup.parentNode.removeChild(popup);
        };
        dlBtn.onmouseover = () => {
            dlBtn.style.background = "linear-gradient(135deg, #ff1e00 0%, #ff5d00 50%, #ff9d00 100%)";
            dlBtn.style.boxShadow = "0 0 15px rgba(255,59,0,0.5)";
            dlBtn.style.transform = "translateY(-1px)";
        };
        dlBtn.onmouseout = () => {
            dlBtn.style.background = "linear-gradient(135deg, #cc1111 0%, #ff3b00 50%, #ff7700 100%)";
            dlBtn.style.boxShadow = "inset 0 -3px 0 #800000, 0 4px 12px rgba(255,59,0,0.25)";
            dlBtn.style.transform = "translateY(0)";
        };
    }

    // Initialize scripts on start
    const init = () => {
        if (document.body) {
            document.body.appendChild(ui);
            document.body.appendChild(mBtn);
            if (STATE.css) applyCSS(STATE.css);
            if (STATE.script) applyScript(STATE.script);
            checkIngameLoop();
            checkForUpdates();
        } else {
            setTimeout(init, 500);
        }
    };
    init();
})();
