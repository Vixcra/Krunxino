// ==UserScript==
// @name         Turf Matchmaking
// @version      1.2
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
    const GAMEMODES = [
        "Free for All", "Team Deathmatch", "Hardpoint", "Capture the Flag", "Parkour",
        "Hide & Seek", "Infected", "Race", "Last Man Standing", "Simon Says",
        "Gun Game", "Prop Hunt", "Boss Hunt", "Classic FFA", "Deposit",
        "Stalker", "King of the Hill", "One in the Chamber", "Trade", "Kill Confirmed",
        "Defuse", "Sharp Shooter", "Traitor", "Raid", "Blitz",
        "Domination", "Squad Deathmatch", "Kranked FFA", "Team Defender", "Deposit FFA",
        "Chaos Snipers", "Bighead FFA"
    ];

    const REGIONS = ["SV", "TOK", "FRA", "MBI", "SYD", "SIN", "DAL", "BHN", "BRZ", "NY"];

    const REGION_NAMES = {
        SV: "Silicon Valley", TOK: "Tokyo", FRA: "Frankfurt", MBI: "Mumbai",
        SYD: "Sydney", SIN: "Singapore", DAL: "Dallas", BHN: "Bahrain",
        BRZ: "Brazil", NY: "New York"
    };

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
        minTime: saved.minTime ?? 90,
        maxPing: saved.maxPing ?? 120,
        maxServersShown: saved.maxServersShown ?? 10,
        keybind: saved.keybind || "KeyF6",
        cancelKeybind: saved.cancelKeybind || "Escape",
        openServerBrowser: saved.openServerBrowser ?? true,
        filterAutoJoin: saved.filterAutoJoin ?? false,
        filterAvoidCloseToFull: saved.filterAvoidCloseToFull ?? false,
        priorityMode: saved.priorityMode || "",
        gradColor1: saved.gradColor1 || "#cc1111",
        gradColor2: saved.gradColor2 || "#ff7700",
        gradientEnabled: saved.gradientEnabled ?? true,
        css: saved.css || "",
        script: saved.script || "",
        scriptError: false,
        binding: false,
        bindingCancel: false,
        visible: false,
        scrollPos: 0
    };

    const DEFAULT_GRAD = { c1: "#cc1111", c2: "#ff7700" };
    const GRAD_PRESETS = [
        ["#cc1111", "#ff7700"],
        ["#7a00ff", "#00d4ff"],
        ["#00c853", "#b2ff00"],
        ["#ff0080", "#ffb300"],
        ["#0066ff", "#00e5ff"],
        ["#ff1744", "#ff616f"],
        ["#111111", "#888888"],
        ["#00e0b0", "#ff00aa"]
    ];

    if (!["match", "css", "scripts", "settings"].includes(STATE.tab)) {
        STATE.tab = "match";
    }

    function saveState() {
        localStorage.setItem("lombre_match_settings", JSON.stringify(STATE));
    }

    function hexToRgb(hex) {
        hex = String(hex).replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const n = parseInt(hex, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }

    function rgbToHex(r, g, b) {
        return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
    }

    function mix(h1, h2, t) {
        const a = hexToRgb(h1), b = hexToRgb(h2);
        return rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
    }

    function shade(hex, p) {
        const { r, g, b } = hexToRgb(hex);
        const t = p < 0 ? 0 : 255, k = Math.abs(p) / 100;
        return rgbToHex(r + (t - r) * k, g + (t - g) * k, b + (t - b) * k);
    }

    function isValidHex(c) { return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(c).trim()); }
    function norm(c) { c = String(c).trim(); return c[0] === '#' ? c : '#' + c; }

    function applyTheme(c1, c2) {
        if (!isValidHex(c1) || !isValidHex(c2)) return false;
        c1 = norm(c1); c2 = norm(c2);
        STATE.gradColor1 = c1; STATE.gradColor2 = c2;

        const useGrad = STATE.gradientEnabled !== false;
        const mid = useGrad ? mix(c1, c2, 0.5) : c1;
        const accent = mid;
        const { r, g, b } = hexToRgb(accent);
        const root = document.documentElement.style;
        root.setProperty('--g1', c1);
        root.setProperty('--gm', mid);
        root.setProperty('--g2', useGrad ? c2 : c1);
        if (useGrad) {
            root.setProperty('--grad', `linear-gradient(135deg, ${c1} 0%, ${mid} 50%, ${c2} 100%)`);
            root.setProperty('--grad-bright', `linear-gradient(135deg, ${shade(c1, 18)} 0%, ${shade(mid, 18)} 50%, ${shade(c2, 18)} 100%)`);
            root.setProperty('--grad-v', `linear-gradient(to bottom, ${c1}, ${mid}, ${c2})`);
        } else {
            root.setProperty('--grad', c1);
            root.setProperty('--grad-bright', shade(c1, 18));
            root.setProperty('--grad-v', c1);
        }
        root.setProperty('--accent', accent);
        root.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
        root.setProperty('--accent-dark', shade(c1, -55));

        if (ui) ui.style.borderColor = accent;
        if (mBtn) mBtn.style.borderColor = accent;
        return true;
    }

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

    function applyCSS(css) {
        let el = document.getElementById("lombre_custom_css");
        if (!el) { el = document.createElement("style"); el.id = "lombre_custom_css"; document.head.appendChild(el); }
        el.textContent = css;
    }

    function applyScript(code) {
        if (!code) return;
        try { new Function(code)(); STATE.scriptError = false; } catch (e) { STATE.scriptError = true; }
    }

    function toggleUI(force) {
        STATE.visible = force !== undefined ? force : !STATE.visible;
        ui.style.display = STATE.visible ? "block" : "none";
        if (STATE.visible) {
            render();
        }
    }

    const matchmakerStyles = document.createElement("style");
    matchmakerStyles.id = "civilian_matchmaker_styles";
    matchmakerStyles.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Aldrich&display=swap');

        :root {
          --g1: #cc1111;
          --gm: #e6440b;
          --g2: #ff7700;
          --grad: linear-gradient(135deg, #cc1111 0%, #e6440b 50%, #ff7700 100%);
          --grad-bright: var(--grad-bright);
          --grad-v: linear-gradient(to bottom, #cc1111, #e6440b, #ff7700);
          --accent: #e6440b;
          --accent-rgb: 230, 68, 11;
          --accent-dark: #5c0808;
        }

        #lombre_ui, #lombre_ui *, #matchmakerPopupContainer, #matchmakerPopupContainer * {
          font-family: 'Aldrich', 'GameFont', 'Segoe UI', sans-serif !important;
        }

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
          background: var(--grad-v) !important;
          box-shadow: inset 0 0 4px #0d0908;
        }

        @keyframes volcanicGlow {
          0% {
            box-shadow: 0 10px 45px rgba(0,0,0,0.95), 0 0 20px rgba(var(--accent-rgb), 0.35), inset 0 0 15px rgba(var(--accent-rgb), 0.05);
            border-color: var(--accent);
          }
          50% {
            box-shadow: 0 10px 45px rgba(0,0,0,0.95), 0 0 35px rgba(var(--accent-rgb), 0.6), inset 0 0 25px rgba(var(--accent-rgb), 0.15);
            border-color: var(--g2);
          }
          100% {
            box-shadow: 0 10px 45px rgba(0,0,0,0.95), 0 0 20px rgba(var(--accent-rgb), 0.35), inset 0 0 15px rgba(var(--accent-rgb), 0.05);
            border-color: var(--accent);
          }
        }

        .tab-btn:hover {
          color: #fff !important;
          border-color: var(--accent) !important;
          background: rgba(var(--accent-rgb), 0.15) !important;
          box-shadow: 0 0 10px rgba(var(--accent-rgb), 0.2);
        }
        .m-select:hover {
          color: #fff !important;
          border-color: var(--accent) !important;
          background: rgba(var(--accent-rgb), 0.15) !important;
          transform: translateY(-1px);
          box-shadow: 0 0 10px rgba(var(--accent-rgb), 0.2);
        }
        #toggle_browser_cancel:hover, #toggle_filter_autojoin:hover, #toggle_filter_avoid_full:hover, #priority_mode_sel:hover {
          border-color: var(--g2) !important;
          box-shadow: 0 0 10px rgba(var(--accent-rgb), 0.3);
        }
        #find_btn:hover, #load_css_btn:hover, #load_script_btn:hover {
          background: var(--grad-bright) !important;
          box-shadow: 0 0 25px rgba(var(--accent-rgb), 0.65) !important;
          transform: translateY(-2px);
        }
        #find_btn:active, #load_css_btn:active, #load_script_btn:active {
          transform: translateY(0) scale(0.98);
        }
        #kb_btn:hover, #cancel_kb_btn:hover {
          border-color: var(--accent) !important;
          color: #fff !important;
          background: rgba(var(--accent-rgb), 0.1) !important;
        }
        #close_btn:hover {
          color: var(--accent) !important;
          transform: scale(1.2);
          text-shadow: 0 0 8px rgba(var(--accent-rgb), 0.6);
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
          border: 2px solid var(--accent);
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
          border-bottom: 1px solid rgba(var(--accent-rgb), 0.3);
          letter-spacing: 2px;
          text-shadow: 0 0 8px rgba(var(--accent-rgb), 0.5);
        }
        #matchmakerPopupDescription {
          background: rgba(0,0,0,0.3);
          color: var(--g2);
          box-sizing: border-box;
          padding: 0.6em 1em;
          font-size: 1.35em;
          text-shadow: 0 0 5px rgba(var(--accent-rgb), 0.2);
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
          border-top: 1px solid rgba(var(--accent-rgb), 0.3);
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
          border-color: var(--accent);
          box-shadow: inset 0 -4px 0 var(--accent-dark), 0 0 10px rgba(var(--accent-rgb), 0.2);
        }
        #matchmakerCancelButton:hover {
          background: var(--grad) !important;
          box-shadow: inset 0 0 0 var(--accent), 0 0 15px rgba(var(--accent-rgb), 0.5) !important;
        }
        .matchmakerPopupButton:hover {
          cursor: pointer;
          border-color: white !important;
          transform: translateY(-2px);
        }
        .matchmakerPopupButton:active {
          transform: translateY(0) scale(0.95);
        }

        #matchmakerPopupContainer.searching {
          background-image: none !important;
          background: rgba(18, 12, 10, 0.99);
          width: 24em;
          top: 25%;
          bottom: auto;
          transform: translate(-50%, -50%);
          aspect-ratio: auto;
          height: auto;
          padding: 1.1em 1.4em;
          border: 2px solid var(--accent);
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
          height: auto;
        }
        #matchmakerSearchStatus {
          font-size: 1.6em;
          color: white;
          font-weight: bold;
          margin-bottom: 0.7em;
          text-align: center;
          letter-spacing: 3px;
          text-transform: uppercase;
          text-shadow: 0 0 8px rgba(var(--accent-rgb), 0.5);
        }
        #matchmakerSearchFeed {
          display: flex;
          flex-direction: column;
          gap: 0.5em;
          margin-bottom: 0.8em;
          min-height: 0;
          max-height: 240px;
          overflow-y: auto;
          padding-right: 4px;
        }
        #matchmakerSearchFeed:empty { margin-bottom: 0; }
        #matchmakerSearchCounter:empty { margin-bottom: 0; }
        #matchmakerSearchCounter {
          font-size: 1.1em;
          color: #a8948d;
          text-align: center;
          margin-bottom: 0.8em;
          font-weight: bold;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        #matchmakerSearchCancel {
          text-align: center;
          border: 2px solid var(--accent);
          box-shadow: inset 0 -4px 0 var(--accent-dark), 0 0 10px rgba(var(--accent-rgb), 0.2);
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
          background: var(--grad) !important;
          box-shadow: inset 0 0 0 var(--accent), 0 0 15px rgba(var(--accent-rgb), 0.5) !important;
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
          border-left: 5px solid var(--accent);
          color: var(--accent);
          background: rgba(var(--accent-rgb), 0.08);
          opacity: 0.7;
          text-shadow: 0 0 5px rgba(var(--accent-rgb), 0.3);
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

    async function measurePing(hostname) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 1500);
            const host = hostname.split(':')[0];
            await fetch(`https://${host}/`, { mode: 'no-cors', signal: controller.signal, cache: 'no-store' });
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
                if (STATE.regions.length > 0 && !STATE.regions.includes(shortCode)) {
                    pings[shortCode] = 999;
                    return;
                }
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

    function sortLobbies(lobbies, pings, priorityMode) {
        return lobbies.sort((a, b) => {
            if (priorityMode) {
                const aPri = a.gamemode.toLowerCase() === priorityMode.toLowerCase() ? 0 : 1;
                const bPri = b.gamemode.toLowerCase() === priorityMode.toLowerCase() ? 0 : 1;
                if (aPri !== bPri) return aPri - bPri;
            }
            const pingA = pings[a.region] ?? 999;
            const pingB = pings[b.region] ?? 999;
            if (pingA !== pingB) return pingA - pingB;
            return b.playerCount - a.playerCount;
        });
    }

    async function triggerMatchmaker() {
        checkedFullRoom = false;
        checkedMatchCancelled = false;
        showSearchHUD();
        let pings = {};
        try {
            const [pingData, gameData] = await Promise.all([
                getRegionalPings(),
                fetch(`https://matchmaker.krunker.io/game-list?hostname=${window.location.hostname}`).then(r => r.json())
            ]);
            pings = pingData;

            const activeRegionsSet = STATE.regions.length > 0 ? new Set(STATE.regions) : null;
            const activeModesSet = STATE.modes.length > 0 ? new Set(STATE.modes.map(m => m.toLowerCase())) : null;
            const activeMapsSet = STATE.maps.length > 0 ? new Set(STATE.maps.map(m => m.toLowerCase().replace('_', ' '))) : null;

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
                if (activeRegionsSet && !activeRegionsSet.has(region)) passesFilter = false;
                if (activeModesSet && !activeModesSet.has(gamemode.toLowerCase())) passesFilter = false;
                if (activeMapsSet) {
                    const mapNormalized = map.toLowerCase().replace('_', ' ');
                    if (!activeMapsSet.has(mapNormalized)) passesFilter = false;
                }
                if (playerCount < STATE.minPlayers) passesFilter = false;
                if (playerCount > STATE.maxPlayers) passesFilter = false;
                if (remainingTime < STATE.minTime) passesFilter = false;
                if (playerCount >= playerLimit) passesFilter = false;
                if (playerCount <= 0) passesFilter = false;
                if (details.c !== 0) passesFilter = false;
                if (window.location.href.includes(gameID)) passesFilter = false;
                if (STATE.filterAvoidCloseToFull && (playerLimit - playerCount <= 1)) passesFilter = false;

                const pingValue = pings[region] ?? 999;
                if (pingValue > STATE.maxPing) passesFilter = false;

                if (passesFilter) {
                    allMatching.push({
                        gameID, region, playerCount, playerLimit, map, gamemode, remainingTime
                    });
                }
            }

            sortLobbies(allMatching, pings, STATE.priorityMode);

            if (allMatching.length > 0) {
                const targetLobbies = allMatching.slice(0, STATE.maxServersShown);

                if (!STATE.filterAutoJoin) {
                    searchStatus.textContent = "Scanning lobbies...";
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
                }

                if (searchCanceled) return;

                if (allMatching.length === 1 || STATE.filterAutoJoin) {
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
                    searchStatus.textContent = "SELECT A LOBBY";
                    searchFeed.innerHTML = "";
                    searchFeed.style.maxHeight = "240px";
                    for (const g of targetLobbies) {
                        const entry = renderInteractiveEntry(g, pings);
                        searchFeed.appendChild(entry);
                    }
                    searchCounter.textContent = `Found ${allMatching.length} optimal lobbies. Click one to join!`;
                }
            } else {
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

    const ui = document.createElement("div"); ui.id = "lombre_ui";
    ui.style.cssText = `position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background: #120c0a; border: 2px solid var(--accent); padding: 25px; z-index: 100000000; color: #fff; display: none; width: 560px; border-radius: 4px; animation: volcanicGlow 5s infinite ease-in-out;`;

    ui.onclick = (e) => {
        const target = e.target;
        if (target.id === "close_btn") { toggleUI(false); return; }

        const tabBtn = target.closest('.tab-btn');
        if (tabBtn) { STATE.tab = tabBtn.dataset.t; render(); return; }

        const mSelect = target.closest('.m-select');
        if (mSelect) {
            const k = mSelect.dataset.key;
            const v = isNaN(mSelect.dataset.val) ? mSelect.dataset.val : parseInt(mSelect.dataset.val);
            const exists = STATE[k].includes(v);
            if (exists) {
                STATE[k] = STATE[k].filter(x => x !== v);
                mSelect.style.background = '#0d0908';
                mSelect.style.color = '#6e5c56';
                mSelect.style.borderColor = '#231612';
                mSelect.style.boxShadow = 'none';
            } else {
                STATE[k] = [...STATE[k], v];
                mSelect.style.background = 'var(--grad)';
                mSelect.style.color = '#fff';
                mSelect.style.borderColor = 'var(--accent)';
                mSelect.style.boxShadow = '0 2px 6px rgba(var(--accent-rgb),0.25)';
            }
            saveState();
            return;
        }

        if (target.id === "toggle_browser_cancel") { STATE.openServerBrowser = !STATE.openServerBrowser; saveState(); render(); return; }
        if (target.id === "toggle_filter_autojoin") { STATE.filterAutoJoin = !STATE.filterAutoJoin; saveState(); render(); return; }
        if (target.id === "toggle_filter_avoid_full") { STATE.filterAvoidCloseToFull = !STATE.filterAvoidCloseToFull; saveState(); render(); return; }
        if (target.id === "find_btn") { toggleUI(false); triggerMatchmaker(); return; }
        if (target.id === "load_css_btn") { loadCSSFile(); return; }
        if (target.id === "load_script_btn") { loadScriptFile(); return; }
        if (target.id === "clear_css_btn") { STATE.css = ""; saveState(); applyCSS(""); render(); return; }
        if (target.id === "kb_btn") { STATE.binding = true; target.textContent = "WAITING..."; return; }
        if (target.id === "cancel_kb_btn") { STATE.bindingCancel = true; target.textContent = "WAITING..."; return; }
        if (target.id === "reset_grad_btn") { applyTheme(DEFAULT_GRAD.c1, DEFAULT_GRAD.c2); saveState(); render(); return; }
        if (target.id === "toggle_gradient") { STATE.gradientEnabled = !STATE.gradientEnabled; applyTheme(STATE.gradColor1, STATE.gradColor2); saveState(); render(); return; }

        const preset = target.closest('.grad-preset');
        if (preset) {
            const pr = GRAD_PRESETS[parseInt(preset.dataset.i)];
            applyTheme(pr[0], pr[1]);
            saveState();
            render();
            return;
        }
    };

    ui.oninput = (e) => {
        const target = e.target;
        const slider = target.closest('.s-input');
        if (slider) {
            const val = parseInt(target.value);
            STATE[slider.dataset.k] = val;
            const label = ui.querySelector(`#l_${slider.dataset.k}`);
            if (label) label.textContent = val;
            return;
        }

        const liveTheme = () => applyTheme(STATE.gradColor1, STATE.gradColor2);
        if (target.id === "grad1_picker") {
            STATE.gradColor1 = target.value;
            const hexInput = ui.querySelector("#grad1_hex");
            if (hexInput) hexInput.value = target.value.toUpperCase();
            liveTheme();
            return;
        }
        if (target.id === "grad2_picker") {
            STATE.gradColor2 = target.value;
            const hexInput = ui.querySelector("#grad2_hex");
            if (hexInput) hexInput.value = target.value.toUpperCase();
            liveTheme();
            return;
        }
        if (target.id === "grad1_hex") {
            if (isValidHex(target.value)) {
                STATE.gradColor1 = norm(target.value);
                const picker = ui.querySelector("#grad1_picker");
                if (picker) picker.value = STATE.gradColor1;
                liveTheme();
            }
            return;
        }
        if (target.id === "grad2_hex") {
            if (isValidHex(target.value)) {
                STATE.gradColor2 = norm(target.value);
                const picker = ui.querySelector("#grad2_picker");
                if (picker) picker.value = STATE.gradColor2;
                liveTheme();
            }
            return;
        }
    };

    ui.onchange = (e) => {
        const target = e.target;
        const slider = target.closest('.s-input');
        if (slider) {
            saveState();
            return;
        }
        if (target.id === "priority_mode_sel") {
            STATE.priorityMode = target.value;
            saveState();
            render();
            return;
        }
        if (target.id === "grad1_hex" || target.id === "grad2_hex" || target.id === "grad1_picker" || target.id === "grad2_picker") {
            saveState();
            render();
            return;
        }
    };

    const mBtn = document.createElement("div"); mBtn.id = "lombre_m_btn"; mBtn.className = "onMenu"; mBtn.textContent = "M";
    mBtn.style.cssText = `position:fixed; top:20px; right:20px; width:35px; height:35px; background: #120c0a; border: 2px solid var(--accent); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 16px; cursor: pointer; border-radius: 4px; z-index: 10000000; transition: 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.5), 0 0 10px rgba(var(--accent-rgb),0.3); font-weight: bold;`;
    mBtn.onmouseover = () => { mBtn.style.background = "var(--grad)"; mBtn.style.borderColor = "#ffffff"; mBtn.style.boxShadow = "0 4px 15px rgba(var(--accent-rgb),0.6)"; };
    mBtn.onmouseout = () => { mBtn.style.background = "#120c0a"; mBtn.style.borderColor = "var(--accent)"; mBtn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.5), 0 0 10px rgba(var(--accent-rgb),0.3)"; };
    mBtn.onclick = () => toggleUI();

    function render() {
        const contentArea = ui.querySelector('#scroll_area');
        if (contentArea) STATE.scrollPos = contentArea.scrollTop;
        let html = `
            <div id="close_btn" style="position:absolute; top:15px; right:20px; font-size:20px; color:#5c473f; cursor:pointer; font-weight:900; transition:0.2s;">X</div>
            <div style="font-size: 22px; font-weight: bold; text-align: center; margin-bottom: 20px; color: #fff; letter-spacing: 3px; text-transform: uppercase; text-shadow: 0 0 8px rgba(var(--accent-rgb), 0.45);">TURF MATCHMAKER</div>
            <div style="display:flex; gap:8px; margin-bottom:20px;">
                ${['match', 'css', 'scripts', 'settings'].map(t => `<div class="tab-btn" data-t="${t}" style="flex:1; padding:12px; text-align:center; cursor:pointer; background:${STATE.tab === t ? 'var(--grad)' : '#0d0908'}; color:${STATE.tab === t ? '#fff' : '#88746d'}; border:1px solid ${STATE.tab === t ? 'var(--accent)' : '#2e1d17'}; border-radius:4px; font-weight:bold; font-size:11px; transition:0.2s; letter-spacing:1px; text-transform:uppercase; box-shadow:${STATE.tab === t ? '0 2px 8px rgba(var(--accent-rgb), 0.35)' : 'none'};">${t.toUpperCase()}</div>`).join('')}
            </div>
            <div id="scroll_area" style="max-height:450px; overflow-y:auto; padding-right:8px;">
        `;

        if (STATE.tab === "match") {
            const drawGrid = (title, list, key, fullNamesMap, cols = 4) => {
                html += `<div style="font-size:11px; color:#c2ada3; margin:15px 0 8px; font-weight:bold; text-transform:uppercase; letter-spacing:1.5px; border-left:3px solid var(--accent); padding-left:6px; text-shadow: 0 0 5px rgba(var(--accent-rgb),0.2);">${title}</div><div style="display:grid; grid-template-columns:repeat(${cols}, 1fr); gap:6px;">`;
                for (let i = 0; i < list.length; i++) {
                    const val = list[i];
                    const active = STATE[key].includes(val);
                    const displayName = fullNamesMap && fullNamesMap[val] ? fullNamesMap[val] : val;
                    html += `<div class="m-select" data-key="${key}" data-val="${val}" style="padding:10px 2px; cursor:pointer; background:${active ? 'var(--grad)' : '#0d0908'}; color:${active ? '#fff' : '#6e5c56'}; border: 1px solid ${active ? 'var(--accent)' : '#231612'}; border-radius:4px; font-size:10px; font-weight:bold; text-align:center; transition:0.1s; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; box-shadow:${active ? '0 2px 6px rgba(var(--accent-rgb),0.25)' : 'none'};" title="${displayName}">${displayName}</div>`;
                }
                html += `</div>`;
            };
            html += `
                <div style="background:#0d0908; padding:15px; border-radius:4px; border:1px solid #231612; display: flex; flex-direction: column; gap: 8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:11px; font-weight:bold; color:#c2ada3; letter-spacing: 0.5px;">SERVER BROWSER ON CANCEL</span>
                        <button id="toggle_browser_cancel" style="padding:6px 12px; background:${STATE.openServerBrowser ? 'var(--grad)' : '#1c1513'}; color:${STATE.openServerBrowser ? '#fff' : '#7a6861'}; border:1px solid ${STATE.openServerBrowser ? 'var(--accent)' : '#362a26'}; border-radius:4px; font-weight:bold; font-size:10px; cursor:pointer; text-transform:uppercase; letter-spacing:0.5px; transition:0.2s; box-shadow:${STATE.openServerBrowser ? '0 2px 6px rgba(var(--accent-rgb),0.25)' : 'none'};">${STATE.openServerBrowser ? 'ENABLED' : 'DISABLED'}</button>
                    </div>
                </div>

                <div style="font-size:11px; color:#c2ada3; margin:15px 0 8px; font-weight:bold; text-transform:uppercase; letter-spacing:1.5px; border-left:3px solid var(--accent); padding-left:6px; text-shadow: 0 0 5px rgba(var(--accent-rgb),0.2);">FILTERS</div>
                <div style="background:#0d0908; padding:15px; border-radius:4px; border:1px solid #231612; display: flex; flex-direction: column; gap: 8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:11px; font-weight:bold; color:#c2ada3; letter-spacing: 0.5px;">AUTO-JOIN LOWEST PING</span>
                        <button id="toggle_filter_autojoin" style="padding:6px 12px; background:${STATE.filterAutoJoin ? 'var(--grad)' : '#1c1513'}; color:${STATE.filterAutoJoin ? '#fff' : '#7a6861'}; border:1px solid ${STATE.filterAutoJoin ? 'var(--accent)' : '#362a26'}; border-radius:4px; font-weight:bold; font-size:10px; cursor:pointer; text-transform:uppercase; letter-spacing:0.5px; transition:0.2s; box-shadow:${STATE.filterAutoJoin ? '0 2px 6px rgba(var(--accent-rgb),0.25)' : 'none'};">${STATE.filterAutoJoin ? 'ON' : 'OFF'}</button>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:11px; font-weight:bold; color:#c2ada3; letter-spacing: 0.5px;">AVOID LOBBIES WITH 1 SLOT LEFT</span>
                        <button id="toggle_filter_avoid_full" style="padding:6px 12px; background:${STATE.filterAvoidCloseToFull ? 'var(--grad)' : '#1c1513'}; color:${STATE.filterAvoidCloseToFull ? '#fff' : '#7a6861'}; border:1px solid ${STATE.filterAvoidCloseToFull ? 'var(--accent)' : '#362a26'}; border-radius:4px; font-weight:bold; font-size:10px; cursor:pointer; text-transform:uppercase; letter-spacing:0.5px; transition:0.2s; box-shadow:${STATE.filterAvoidCloseToFull ? '0 2px 6px rgba(var(--accent-rgb),0.25)' : 'none'};">${STATE.filterAvoidCloseToFull ? 'ON' : 'OFF'}</button>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:11px; font-weight:bold; color:#c2ada3; letter-spacing: 0.5px;">PRIORITIZE GAME TYPE</span>
                        <select id="priority_mode_sel" style="background:#1c1513; color:#fff; border:1px solid ${STATE.priorityMode ? 'var(--accent)' : '#362a26'}; border-radius:4px; font-size:10px; font-weight:bold; padding:6px 8px; cursor:pointer; outline:none; font-family:'Aldrich'; text-transform:uppercase; max-width:170px;">
                            <option value="" ${STATE.priorityMode === '' ? 'selected' : ''}>NONE</option>
                            ${GAMEMODES.map(m => `<option value="${b(m)}" ${STATE.priorityMode === m ? 'selected' : ''}>${b(m)}</option>`).join('')}
                        </select>
                    </div>
                </div>
            `;

            drawGrid("REGIONS (NONE = ALL)", REGIONS, "regions", REGION_NAMES, 5);
            drawGrid("GAMEMODES (NONE = ALL)", GAMEMODES, "modes", null, 3);
            drawGrid("MAPS (NONE = ALL)", MAPS, "maps", MAP_NAMES, 4);

            html += `
                <div style="background:#0d0908; padding:20px; border-radius:4px; margin-top:25px; border:1px solid #231612;">
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:bold; color:#c2ada3; letter-spacing:0.5px;">
                            <span>MIN PLAYERS - <span id="l_minPlayers" style="color:var(--accent); text-shadow:0 0 4px rgba(var(--accent-rgb),0.3);">${STATE.minPlayers}</span></span>
                        </div>
                        <input type="range" class="s-input" data-k="minPlayers" min="0" max="7" value="${STATE.minPlayers}" style="width:100%; accent-color:var(--accent); cursor:pointer; margin-bottom: 4px;">

                        <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:bold; color:#c2ada3; letter-spacing:0.5px;">
                            <span>MAX PLAYERS - <span id="l_maxPlayers" style="color:var(--accent); text-shadow:0 0 4px rgba(var(--accent-rgb),0.3);">${STATE.maxPlayers}</span></span>
                        </div>
                        <input type="range" class="s-input" data-k="maxPlayers" min="0" max="7" value="${STATE.maxPlayers}" style="width:100%; accent-color:var(--accent); cursor:pointer; margin-bottom: 4px;">

                        <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:bold; color:#c2ada3; letter-spacing:0.5px;">
                            <span>MIN MATCH REMAINING - <span id="l_minTime" style="color:var(--accent); text-shadow:0 0 4px rgba(var(--accent-rgb),0.3);">${STATE.minTime}</span>s</span>
                        </div>
                        <input type="range" class="s-input" data-k="minTime" min="0" max="480" step="10" value="${STATE.minTime}" style="width:100%; accent-color:var(--accent); cursor:pointer; margin-bottom: 4px;">

                        <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:bold; color:#c2ada3; letter-spacing:0.5px;">
                            <span>MAX SERVER PING - <span id="l_maxPing" style="color:var(--accent); text-shadow:0 0 4px rgba(var(--accent-rgb),0.3);">${STATE.maxPing}</span>ms</span>
                        </div>
                        <input type="range" class="s-input" data-k="maxPing" min="20" max="300" step="5" value="${STATE.maxPing}" style="width:100%; accent-color:var(--accent); cursor:pointer; margin-bottom: 4px;">

                        <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:bold; color:#c2ada3; letter-spacing:0.5px;">
                            <span>MAX SERVERS SHOWN - <span id="l_maxServersShown" style="color:var(--accent); text-shadow:0 0 4px rgba(var(--accent-rgb),0.3);">${STATE.maxServersShown}</span></span>
                        </div>
                        <input type="range" class="s-input" data-k="maxServersShown" min="2" max="20" step="1" value="${STATE.maxServersShown}" style="width:100%; accent-color:var(--accent); cursor:pointer;">
                    </div>
                </div>
                <button id="find_btn" style="width:100%; padding:18px; margin-top:20px; background:var(--grad); color:#fff; border:none; border-radius:4px; font-weight:bold; font-size:17px; cursor:pointer; transition:0.2s; font-family:'Aldrich'; text-transform:uppercase; letter-spacing:2px; box-shadow: inset 0 -4px 0 var(--accent-dark), 0 4px 15px rgba(var(--accent-rgb),0.35);">FIND GAME</button>
                
                <div style="display:flex; gap:10px; justify-content:center; margin-top:12px;">
                    <button id="kb_btn" style="padding:6px 15px; background:transparent; color:#7a6861; border:1px solid #231612; border-radius:4px; font-weight:bold; font-size:10px; cursor:pointer; transition:0.2s; font-family:'Aldrich';">SEARCH HOTKEY: ${STATE.keybind ? STATE.keybind.replace('Key', '').replace('Digit', '').toUpperCase() : 'NONE'}</button>
                    <button id="cancel_kb_btn" style="padding:6px 15px; background:transparent; color:#7a6861; border:1px solid #231612; border-radius:4px; font-weight:bold; font-size:10px; cursor:pointer; transition:0.2s; font-family:'Aldrich';">CANCEL HOTKEY: ${STATE.cancelKeybind ? STATE.cancelKeybind.replace('Key', '').replace('Digit', '').toUpperCase() : 'NONE'}</button>
                </div>
            `;
        } else if (STATE.tab === "css") {
            html += `<div style="text-align:center; padding:60px 0;"><button id="load_css_btn" style="padding:25px 50px; background:var(--grad); color:#fff; border:none; border-radius:4px; font-weight:bold; font-size:20px; cursor:pointer; font-family:'Aldrich'; text-transform:uppercase; letter-spacing:1px; box-shadow: inset 0 -4px 0 var(--accent-dark), 0 4px 15px rgba(var(--accent-rgb),0.35); transition:0.2s;">SELECT CSS FILE</button>${STATE.css ? `<div style="margin-top:20px;"><button id="clear_css_btn" style="background:transparent; color:#ff4444; border:none; cursor:pointer; font-size:11px; font-weight:bold; text-decoration:underline;">CLEAR SAVED CSS</button></div>` : ''}<div style="margin-top:40px; font-size:11px; color:#7a6861; text-transform:uppercase;">Status: ${STATE.css ? '<span style="color:#00c853;">Active</span>' : 'Not Loaded'}</div></div>`;
        } else if (STATE.tab === "scripts") {
            html += `<div style="text-align:center; padding:60px 0;"><button id="load_script_btn" style="padding:25px 50px; background:var(--grad); color:#fff; border:none; border-radius:4px; font-weight:bold; font-size:20px; cursor:pointer; font-family:'Aldrich'; text-transform:uppercase; letter-spacing:1px; box-shadow: inset 0 -4px 0 var(--accent-dark), 0 4px 15px rgba(var(--accent-rgb),0.35); transition:0.2s;">SELECT JS FILE</button><div style="margin-top:40px; font-size:11px; color:#7a6861; text-transform:uppercase;">Status: ${STATE.script ? '<span style="color:#00c853;">Active</span>' : 'Not Loaded'}</div></div>`;
        } else if (STATE.tab === "settings") {
            const c1 = STATE.gradColor1, c2 = STATE.gradColor2;
            const colorField = (id, label, val) => `
                <div style="flex:1;">
                    <div style="font-size:9px; color:#88746d; font-weight:bold; margin-bottom:4px; letter-spacing:0.5px;">${label}</div>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <input type="color" id="${id}_picker" value="${val}" style="width:42px; height:34px; background:none; border:1px solid #362a26; border-radius:4px; cursor:pointer; padding:2px;">
                        <input type="text" id="${id}_hex" value="${val}" maxlength="7" spellcheck="false" style="flex:1; min-width:0; box-sizing:border-box; background:#1c1513; color:#fff; border:1px solid #362a26; border-radius:4px; font-size:12px; padding:8px; font-family:'Aldrich'; letter-spacing:1px; text-transform:uppercase; outline:none;">
                    </div>
                </div>
            `;
            html += `
                <div style="font-size:11px; color:#c2ada3; margin:5px 0 10px; font-weight:bold; text-transform:uppercase; letter-spacing:1.5px; border-left:3px solid var(--accent); padding-left:6px; text-shadow: 0 0 5px rgba(var(--accent-rgb),0.2);">GUI GRADIENT</div>
                <div style="background:#0d0908; padding:18px; border-radius:4px; border:1px solid #231612; display:flex; flex-direction:column; gap:16px;">
                    <div style="height:34px; border-radius:4px; background:var(--grad); border:1px solid #362a26;"></div>
                    <div style="display:flex; gap:12px;">
                        ${colorField('grad1', 'COLOR 1 (START)', c1)}
                        ${colorField('grad2', 'COLOR 2 (END)', c2)}
                    </div>
                    <div style="font-size:9px; color:#5c473f; letter-spacing:0.5px;">Middle stop is auto-interpolated between the two colours.</div>
                    <div>
                        <div style="font-size:9px; color:#88746d; font-weight:bold; margin-bottom:8px; letter-spacing:0.5px;">PRESETS</div>
                        <div style="display:flex; gap:8px; flex-wrap:wrap;">
                            ${GRAD_PRESETS.map((p, idx) => `<div class="grad-preset" data-i="${idx}" title="${p[0]} → ${p[1]}" style="width:46px; height:28px; border-radius:4px; cursor:pointer; background:linear-gradient(135deg, ${p[0]} 0%, ${p[1]} 100%); border:2px solid ${p[0].toLowerCase() === c1.toLowerCase() && p[1].toLowerCase() === c2.toLowerCase() ? '#fff' : 'rgba(255,255,255,0.15)'}; transition:0.15s;"></div>`).join('')}
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; justify-content:space-between; border-top:1px solid #231612; padding-top:14px;">
                        <span style="font-size:10px; color:#5c473f;">Live preview applies instantly.</span>
                        <button id="reset_grad_btn" style="padding:8px 16px; background:transparent; color:#88746d; border:1px solid #362a26; border-radius:4px; font-weight:bold; font-size:10px; cursor:pointer; text-transform:uppercase; letter-spacing:0.5px; font-family:'Aldrich';">RESET TO DEFAULT</button>
                    </div>
                </div>

                <div style="font-size:11px; color:#c2ada3; margin:18px 0 10px; font-weight:bold; text-transform:uppercase; letter-spacing:1.5px; border-left:3px solid var(--accent); padding-left:6px; text-shadow: 0 0 5px rgba(var(--accent-rgb),0.2);">DISPLAY</div>
                <div style="background:#0d0908; padding:15px; border-radius:4px; border:1px solid #231612; display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:11px; font-weight:bold; color:#c2ada3; letter-spacing: 0.5px;">GRADIENT (OFF = COLOR 1 ONLY)</span>
                        <button id="toggle_gradient" style="padding:6px 12px; background:${STATE.gradientEnabled ? 'var(--grad)' : '#1c1513'}; color:${STATE.gradientEnabled ? '#fff' : '#7a6861'}; border:1px solid ${STATE.gradientEnabled ? 'var(--accent)' : '#362a26'}; border-radius:4px; font-weight:bold; font-size:10px; cursor:pointer; text-transform:uppercase; letter-spacing:0.5px; transition:0.2s; box-shadow:${STATE.gradientEnabled ? '0 2px 6px rgba(var(--accent-rgb),0.25)' : 'none'};">${STATE.gradientEnabled ? 'ON' : 'OFF'}</button>
                    </div>
                </div>
            `;
        }

        html += `</div>`; ui.innerHTML = html;
        const nA = ui.querySelector('#scroll_area'); if (nA) nA.scrollTop = STATE.scrollPos;
        ui.querySelector("#close_btn").onclick = () => toggleUI(false);
    }

    function loadCSSFile() { const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".css"; inp.onchange = e => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = r => { STATE.css = r.target.result; saveState(); applyCSS(STATE.css); render(); }; reader.readAsText(file); }; inp.click(); }
    function loadScriptFile() { const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".js"; inp.onchange = e => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = r => { STATE.script = r.target.result; saveState(); applyScript(STATE.script); render(); }; reader.readAsText(file); }; inp.click(); }

    window.addEventListener("mousedown", (e) => {
        if (STATE.visible && !ui.contains(e.target) && !mBtn.contains(e.target)) toggleUI(false);
    });

    window.addEventListener("keydown", (e) => {
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
        if (e.key === "F2") {
            e.preventDefault();
            toggleUI();
        }
        if (STATE.keybind && e.code === STATE.keybind) {
            if (document.activeElement.tagName !== "INPUT") {
                e.preventDefault();
                triggerMatchmaker();
            }
        }
    });

    let lastIsIngame = null;
    let _elsCache = {};
    const getEl = (id) => _elsCache[id] || (_elsCache[id] = document.getElementById(id));

    function showNotificationAndRelaunch(message) {
        const notify = document.createElement("div");
        notify.style.cssText = "position:fixed; top:20%; left:50%; transform:translate(-50%,-50%); background:var(--grad); color:white; padding:15px 30px; border-radius:4px; font-family:'Aldrich',sans-serif; font-size:16px; font-weight:bold; z-index:999999999; border:2px solid var(--g2); box-shadow:0 0 25px rgba(var(--accent-rgb), 0.6), 0 10px 30px rgba(0,0,0,0.8); text-transform:uppercase; letter-spacing:1px;";
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

            if (!checkedFullRoom && (text.includes("full") || text.includes("game is full") || text.includes("room is full") || text.includes("server is full"))) {
                if (sessionStorage.getItem("lombre_joined_via_mm") === "true") {
                    checkedFullRoom = true;
                    sessionStorage.removeItem("lombre_joined_via_mm");
                    showNotificationAndRelaunch("Lobby is full! Relaunching search...");
                }
            }

            if (!checkedMatchCancelled && (text.includes("not enough players") || text.includes("match cancelled") || text.includes("match canceled") || text.includes("prep time ended"))) {
                checkedMatchCancelled = true;
                sessionStorage.removeItem("lombre_joined_via_mm");
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
            if (isIngame) {
                sessionStorage.removeItem("lombre_joined_via_mm");
            }
        }
        checkGameEndOrErrorState();
        setTimeout(checkIngameLoop, 250);
    }

    const SCRIPT_VERSION = "1.2";

    async function checkForUpdates() {
        try {
            const res = await fetch("https://raw.githubusercontent.com/Vixcra/Krunxino/main/TurfMatchMaking.js", { cache: "no-store" });
            if (!res.ok) return;
            const text = await res.text();
            const match = text.match(/@version\s+(\d+\.\d+)/);
            if (!match) return;
            const remoteVersion = match[1];
            if (parseFloat(remoteVersion) > parseFloat(SCRIPT_VERSION)) {
                showUpdatePopup(remoteVersion);
            }
        } catch (e) {
            console.error("Failed to check for Turf Matchmaking updates:", e);
        }
    }

    function showUpdatePopup(newVersion) {
        const popup = document.createElement("div");
        popup.id = "lombre_update_popup";
        popup.style.cssText = `position:fixed; top:25%; left:50%; transform:translate(-50%, -50%); background:#120c0a; border:2px solid var(--accent); padding:25px; z-index:200000005; color:#fff; width:380px; border-radius:4px; text-align:center; font-family:'Aldrich',sans-serif !important; animation:volcanicGlow 5s infinite ease-in-out; box-shadow:0 10px 40px rgba(0,0,0,0.9);`;

        popup.innerHTML = `
            <div id="update_close_btn" style="position:absolute; top:12px; right:15px; font-size:18px; color:#5c473f; cursor:pointer; font-weight:900; transition:0.2s;">X</div>
            <div style="font-size: 16px; font-weight: bold; margin-bottom: 12px; letter-spacing: 1px; color:#ff9100; text-transform:uppercase; text-shadow:0 0 5px rgba(255,145,0,0.2);">UPDATE AVAILABLE</div>
            <div style="font-size: 14px; margin-bottom: 20px; color:#c2ada3; line-height: 1.4;">TurfMatchMaking new version <span style="color:var(--accent); font-weight:bold;">v${newVersion}</span> is available!</div>
            <button id="update_download_btn" style="width:100%; padding:12px; background:var(--grad); color:#fff; border:none; border-radius:4px; font-weight:bold; font-size:12px; cursor:pointer; transition:0.2s; font-family:'Aldrich'; text-transform:uppercase; letter-spacing:1px; box-shadow: inset 0 -3px 0 var(--accent-dark), 0 4px 12px rgba(var(--accent-rgb),0.25);">DOWNLOAD</button>
        `;

        document.body.appendChild(popup);

        const closeBtn = popup.querySelector("#update_close_btn");
        closeBtn.onclick = () => popup.parentNode.removeChild(popup);
        closeBtn.onmouseover = () => { closeBtn.style.color = "var(--accent)"; closeBtn.style.transform = "scale(1.2)"; };
        closeBtn.onmouseout = () => { closeBtn.style.color = "#5c473f"; closeBtn.style.transform = "scale(1)"; };

        const dlBtn = popup.querySelector("#update_download_btn");
        dlBtn.onclick = () => {
            window.open("https://github.com/Vixcra/Krunxino", "_blank");
            popup.parentNode.removeChild(popup);
        };
        dlBtn.onmouseover = () => {
            dlBtn.style.background = "var(--grad-bright)";
            dlBtn.style.boxShadow = "0 0 15px rgba(var(--accent-rgb),0.5)";
            dlBtn.style.transform = "translateY(-1px)";
        };
        dlBtn.onmouseout = () => {
            dlBtn.style.background = "var(--grad)";
            dlBtn.style.boxShadow = "inset 0 -3px 0 var(--accent-dark), 0 4px 12px rgba(var(--accent-rgb),0.25)";
            dlBtn.style.transform = "translateY(0)";
        };
    }

    const init = () => {
        if (document.body) {
            document.body.appendChild(ui);
            document.body.appendChild(mBtn);
            applyTheme(STATE.gradColor1, STATE.gradColor2);
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
