/* =====================================================================
   CodeCraft — UI icon pack (drop-in)
   Replaces emoji / keyboard glyphs in ALL DOM UI (buttons, chips, tabs,
   block palette, sheets) with inline SVG icons. World emojis reuse the
   CC_SPRITES art via CC_SPRITES.svg(). A MutationObserver keeps
   JS-generated UI (palette blocks, shop rows, quest lists) covered.
   ===================================================================== */(function(){
"use strict";
const CC='currentColor';
const W=(b)=>'<svg viewBox="0 0 24 24" fill="none">'+b+'</svg>';
const ST='stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" fill="none"';
const ICONS={/* ---- v3: the last of the UI emoji ---- */
"→":W('<path d="M4.5 12 H18 M13.2 7.2 L18 12 L13.2 16.8" '+ST+' stroke-width="2.4"/>'),
"🔧":W('<path d="M14.6 3.4 a4.6 4.6 0 0 0 -1.3 7.6 L5.6 18.7 a1.8 1.8 0 0 0 2.5 2.5 l7.7-7.7 a4.6 4.6 0 0 0 5.4-6.3 l-2.6 2.6 -2.4-.6 -.6-2.4 Z" fill="#b8bec9"/>'),
"🏦":W('<path d="M12 3.2 L21.4 8 H2.6 Z" fill="#cfd4e0"/><rect x="4.2" y="9.4" width="2.6" height="8" fill="#aab2c4"/><rect x="10.7" y="9.4" width="2.6" height="8" fill="#aab2c4"/><rect x="17.2" y="9.4" width="2.6" height="8" fill="#aab2c4"/><rect x="2.8" y="18" width="18.4" height="2.6" rx="1.3" fill="#cfd4e0"/>'),
"🚩":W('<path d="M6.4 3.4 V20.6" stroke="#9aa1b0" stroke-width="2.4" stroke-linecap="round"/><path d="M7.8 4.4 h10.4 l-2.6 3.8 2.6 3.8 H7.8 Z" fill="#ff5d73"/>'),
"✊":W('<rect x="5" y="7.6" width="14" height="11.6" rx="4.2" fill="#ffd6a8"/><path d="M8.4 11.6 h7.2 M8.4 15 h7.2" stroke="#e0a86f" stroke-width="1.7" stroke-linecap="round"/>'),
"💬":W('<path d="M4 6.6 a2.6 2.6 0 0 1 2.6-2.6 h10.8 A2.6 2.6 0 0 1 20 6.6 v6.8 a2.6 2.6 0 0 1 -2.6 2.6 H10 l-4.4 3.6 v-3.6 A2.6 2.6 0 0 1 4 13.4 Z" fill="#cfd9ea"/>'),
"📖":W('<path d="M12 6.4 C9.8 4.8 6.6 4.4 3.6 4.9 V18.6 c3-.5 6.2-.1 8.4 1.5 Z" fill="#f4e7d0"/><path d="M12 6.4 c2.2-1.6 5.4-2 8.4-1.5 V18.6 c-3-.5-6.2-.1-8.4 1.5 Z" fill="#ddcaa8"/>'),
"🔄":W('<path d="M5.2 11.4 a6.8 6.8 0 0 1 11.4-4.2 M18.8 12.6 a6.8 6.8 0 0 1 -11.4 4.2" '+ST+' stroke-width="2.3"/><path d="M16.2 3.6 V7.6 H12.2 M7.8 20.4 V16.4 H11.8" '+ST+' stroke-width="2.3"/>'),
"🧠":W('<path d="M11.2 4.2 a3.6 3.6 0 0 0 -3.4 4.2 a3.4 3.4 0 0 0 -.6 6.2 a3.4 3.4 0 0 0 4 4.4 Z" fill="#ff9bb0"/><path d="M12.8 4.2 a3.6 3.6 0 0 1 3.4 4.2 a3.4 3.4 0 0 1 .6 6.2 a3.4 3.4 0 0 1 -4 4.4 Z" fill="#f083a0"/>'),
"👋":W('<path d="M7.6 12.8 V6.6 a1.45 1.45 0 0 1 2.9 0 V5.4 a1.45 1.45 0 0 1 2.9 0 v1.4 a1.45 1.45 0 0 1 2.9 0 v6.6 a5.6 5.6 0 0 1 -5.6 5.6 c-2.4 0-3.8-1.3-5-3.3 l-2-3.4 a1.45 1.45 0 0 1 2.4-1.6 Z" fill="#ffd6a8"/>'),
"☁":W('<path d="M7.4 18 a4.2 4.2 0 0 1 -.4-8.4 a5.4 5.4 0 0 1 10.2-.4 a3.9 3.9 0 0 1 -.6 8.8 Z" fill="#cfd9ea"/>'),
"🚫":W('<circle cx="12" cy="12" r="8.6" fill="none" stroke="#ff5d73" stroke-width="2.6"/><path d="M6.4 17.6 L17.6 6.4" stroke="#ff5d73" stroke-width="2.6" stroke-linecap="round"/>'),
"📋":W('<rect x="5" y="4.6" width="14" height="16" rx="2.4" fill="#cfd4e0"/><rect x="8.6" y="2.8" width="6.8" height="3.6" rx="1.4" fill="#9aa1b0"/><path d="M8.6 11 h6.8 M8.6 14.6 h6.8" stroke="#8a91a4" stroke-width="1.8" stroke-linecap="round"/>'),
"📧":W('<rect x="3.2" y="5.6" width="17.6" height="12.8" rx="2.4" fill="#e8ecf5"/><path d="M4.4 7 L12 13 L19.6 7" fill="none" stroke="#8a91a4" stroke-width="1.9" stroke-linecap="round"/>'),
"🧪":W('<path d="M9.4 3.4 h5.2 v6.2 l3.4 7.4 a2.4 2.4 0 0 1 -2.2 3.4 H8.2 A2.4 2.4 0 0 1 6 17 l3.4-7.4 Z" fill="none" stroke="#cfd4e0" stroke-width="2"/><path d="M7.6 14.6 h8.8 l1.4 3.2 a1.6 1.6 0 0 1 -1.4 2.6 H7.6 A1.6 1.6 0 0 1 6.2 17.8 Z" fill="#54d66a"/>'),
"👇":W('<rect x="10.2" y="3.4" width="3.6" height="9" rx="1.8" fill="#ffd6a8"/><path d="M6.6 11.2 h10.8 v3.2 a5.4 5.4 0 0 1 -10.8 0 Z" fill="#ffd6a8"/>'),
"🤔":W('<circle cx="11.6" cy="10.8" r="7.4" fill="#ffd66b"/><circle cx="9.2" cy="9.4" r="1.15" fill="#241b45"/><circle cx="14.2" cy="9.4" r="1.15" fill="#241b45"/><path d="M9.8 14.2 h3.8" stroke="#241b45" stroke-width="1.8" stroke-linecap="round"/><circle cx="15.6" cy="19" r="2.6" fill="#ffd6a8"/>'),
"📌":W('<path d="M9 3.6 h6 l-.8 5.2 3.4 3.4 H6.4 l3.4-3.4 Z" fill="#ff5d73"/><path d="M12 12.2 V20.4" stroke="#9aa1b0" stroke-width="2.2" stroke-linecap="round"/>'),
"👣":W('<ellipse cx="8" cy="8.4" rx="3.1" ry="4.2" fill="#cfd4e0"/><ellipse cx="8" cy="13.6" rx="1.7" ry="1.4" fill="#cfd4e0"/><ellipse cx="16" cy="14.2" rx="3.1" ry="4.2" fill="#9aa1b0"/><ellipse cx="16" cy="19.4" rx="1.7" ry="1.4" fill="#9aa1b0"/>'),
"🔥":W('<path d="M12 2.8 c3.4 3.4 6.2 5.8 6.2 9.8 a6.2 6.2 0 0 1 -12.4 0 c0-2.4 1.4-4 2.8-5.6 .4 1.6 1.4 2.4 2.4 2.4 -1.4-2.6-.6-4.8 1-6.6 Z" fill="#ff8a3d"/><path d="M12 12 c1.6 1.7 2.6 2.7 2.6 4.3 a2.6 2.6 0 0 1 -5.2 0 c0-1.3 1-2.5 2.6-4.3 Z" fill="#ffd66b"/>'),
"😕":W('<circle cx="12" cy="12" r="8.4" fill="#ffd66b"/><circle cx="9.2" cy="10.4" r="1.2" fill="#241b45"/><circle cx="14.8" cy="10.4" r="1.2" fill="#241b45"/><path d="M9 15.8 c1.7-1.3 3.5-1.2 5.5 .3" fill="none" stroke="#241b45" stroke-width="1.8" stroke-linecap="round"/>'),
"❌":W('<path d="M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5" stroke="#ff5d73" stroke-width="3" stroke-linecap="round"/>'),
"🔐":W('<rect x="4.6" y="10.4" width="11.8" height="9.4" rx="2.6" fill="#ffb830"/><path d="M7.2 10.4 V8 a3.4 3.4 0 0 1 6.6 0 v2.4" stroke="#b8bec9" stroke-width="2.3" fill="none"/><circle cx="19" cy="7.2" r="2.5" fill="none" stroke="#ffd66b" stroke-width="2"/><path d="M19 9.7 V14.6" stroke="#ffd66b" stroke-width="2" stroke-linecap="round"/>'),
"🔓":W('<rect x="5.8" y="10.4" width="12.4" height="9.4" rx="2.6" fill="#54d66a"/><path d="M8.4 10.4 V8 a3.6 3.6 0 0 1 6.6-1.9" stroke="#b8bec9" stroke-width="2.4" fill="none"/>'),
"🧮":W('<rect x="4" y="4.4" width="16" height="15.2" rx="2.4" fill="none" stroke="#c98d4b" stroke-width="2.2"/><path d="M4 9.4 H20 M4 14.6 H20" stroke="#c98d4b" stroke-width="1.7"/><circle cx="8" cy="6.9" r="1.35" fill="#ff5d73"/><circle cx="13" cy="6.9" r="1.35" fill="#5ab8ff"/><circle cx="9.6" cy="12" r="1.35" fill="#ffd66b"/><circle cx="15" cy="12" r="1.35" fill="#54d66a"/><circle cx="7.4" cy="17.1" r="1.35" fill="#b184ff"/>'),
"📐":W('<path d="M4.6 4.4 L19.6 19.4 H4.6 Z" fill="#5ab8ff"/><path d="M7.2 16.6 h2.4 M7.2 13.4 h2.4" stroke="#eaf6ff" stroke-width="1.5" stroke-linecap="round"/>'),
"🟧":W('<rect x="4" y="4" width="16" height="16" rx="3.4" fill="#ff9d5a"/>'),
"🟫":W('<rect x="4" y="4" width="16" height="16" rx="3.4" fill="#a8642f"/>'),
"⬜":W('<rect x="4" y="4" width="16" height="16" rx="3.4" fill="#e2e6ef"/>'),
"🔵":W('<circle cx="12" cy="12" r="7.4" fill="#5ab8ff"/>'),
"🟣":W('<circle cx="12" cy="12" r="7.4" fill="#b184ff"/>'),
"🏮":W('<path d="M12 3.2 V5.2" stroke="#9aa1b0" stroke-width="2"/><ellipse cx="12" cy="12" rx="6.4" ry="6.9" fill="#ff5d73"/><path d="M6.2 8.6 h11.6 M6.2 15.4 h11.6" stroke="#e04a5f" stroke-width="1.6"/><path d="M12 18.9 v2.2" stroke="#ffd66b" stroke-width="2.2" stroke-linecap="round"/>'),
"🪧":W('<rect x="3.6" y="5" width="16.8" height="9.6" rx="2" fill="#c98d4b"/><path d="M12 14.6 V21" stroke="#9aa1b0" stroke-width="2.4" stroke-linecap="round"/><path d="M7 8.8 h10 M7 11.4 h6.4" stroke="#f4e7d0" stroke-width="1.7" stroke-linecap="round"/>'),
"🧶":W('<circle cx="12" cy="12" r="8" fill="#ff9bb0"/><path d="M6.4 8.2 c3.4 1 6.2 3.8 7.2 7.2 M9.2 5.2 c3.8 1.6 6.6 4.4 8 8" fill="none" stroke="#e0748f" stroke-width="1.7"/>'),
"💠":W('<path d="M12 3.4 L20.6 12 L12 20.6 L3.4 12 Z" fill="#5ab8ff"/><path d="M12 7.6 L16.4 12 L12 16.4 L7.6 12 Z" fill="#bfe6ff"/>'),
"🍽":W('<circle cx="13.6" cy="12" r="6.4" fill="#e8ecf5"/><circle cx="13.6" cy="12" r="3.4" fill="#cfd4e0"/><path d="M4.6 4.4 V11 a1.8 1.8 0 0 0 3.6 0 V4.4 M6.4 12.8 V19.6" stroke="#9aa1b0" stroke-width="2" stroke-linecap="round" fill="none"/>'),
"🛢":W('<ellipse cx="12" cy="4.8" rx="6" ry="1.7" fill="#7a8296"/><path d="M6 4.8 h12 V19.4 a1.6 1.6 0 0 1 -1.6 1.6 H7.6 A1.6 1.6 0 0 1 6 19.4 Z" fill="#5b6178"/><path d="M6 9.4 H18 M6 15.4 H18" stroke="#3f4557" stroke-width="1.8"/>'),
"📮":W('<rect x="5.4" y="7" width="13.2" height="12.6" rx="3" fill="#5ab8ff"/><path d="M8.6 7 V5.4 a3.4 3.4 0 0 1 6.8 0 V7" fill="none" stroke="#4aa3e8" stroke-width="2"/><rect x="8.6" y="11" width="6.8" height="1.9" rx=".95" fill="#f4f8ff"/>'),
"🗿":W('<path d="M7.4 5.4 a4.6 4.6 0 0 1 9.2 0 V13.8 a4.6 4.6 0 0 1 -9.2 0 Z" fill="#8a91a4"/><rect x="6.6" y="16.4" width="10.8" height="4.2" rx="1.4" fill="#6b7280"/><circle cx="9.9" cy="9" r="1.2" fill="#3f4557"/><circle cx="14.1" cy="9" r="1.2" fill="#3f4557"/>'),
"🌲":W('<path d="M12 3 L17.4 11 H6.6 Z" fill="#2f9e56"/><path d="M12 8 L18.6 17 H5.4 Z" fill="#37b061"/><rect x="10.6" y="16.6" width="2.8" height="4.4" rx="1" fill="#8a5a2a"/>'),
"🏭":W('<path d="M3.4 20.6 V10.4 l5 3 V10.4 l5 3 V7.4 l7.2 3.4 V20.6 Z" fill="#8a91a4"/><rect x="16.4" y="4" width="2.8" height="4.6" rx="1" fill="#6b7280"/>'),
"🛖":W('<path d="M12 4 L21 12.4 H3 Z" fill="#c98d4b"/><path d="M5.4 12.4 h13.2 V20.4 H5.4 Z" fill="#a8642f"/><rect x="10.4" y="15" width="3.2" height="5.4" rx="1" fill="#f4e7d0"/>'),
"🪟":W('<rect x="4.4" y="4.4" width="15.2" height="15.2" rx="2.2" fill="#5ab8ff" stroke="#c98d4b" stroke-width="2.4"/><path d="M12 4.4 V19.6 M4.4 12 H19.6" stroke="#c98d4b" stroke-width="2.2"/>'),
"⛱":W('<path d="M12 5.8 c4.6 0 8.4 3.1 8.4 5.6 H3.6 C3.6 8.9 7.4 5.8 12 5.8 Z" fill="#ff5d73"/><path d="M12 11.4 V20.4" stroke="#c98d4b" stroke-width="2.2" stroke-linecap="round"/>'),
"🌷":W('<path d="M12 12.4 c-3 0-4.4-2.4-4.4-5.2 1.6 1 2.8 1.4 4.4 1.4 s2.8-.4 4.4-1.4 c0 2.8-1.4 5.2-4.4 5.2 Z" fill="#ff6b9a"/><path d="M12 12.4 V20.6" stroke="#37b061" stroke-width="2.2" stroke-linecap="round"/><path d="M12 16.6 c-2.4 0-3.6-1.2-3.6-3 2 0 3.6 1.2 3.6 3 Z" fill="#37b061"/>'),
"🪴":W('<path d="M12 10.6 C12 6.6 14.6 4 18 4 c0 4-2.6 6.6-6 6.6 Z" fill="#37b061"/><path d="M12 10.6 C12 7.4 9.8 5 6.6 5 c0 3.2 2.2 5.6 5.4 5.6 Z" fill="#2f9e56"/><path d="M6.4 12.4 h11.2 l-1.4 7 a1.8 1.8 0 0 1 -1.8 1.4 h-4.8 a1.8 1.8 0 0 1 -1.8-1.4 Z" fill="#c96f45"/>'),
"⛲":W('<path d="M12 3.4 V8" stroke="#5ab8ff" stroke-width="2.2" stroke-linecap="round"/><path d="M8 8 c0 2.4 1.8 4 4 4 s4-1.6 4-4" fill="none" stroke="#5ab8ff" stroke-width="2"/><path d="M4.6 13.4 h14.8 l-1.4 6 a1.8 1.8 0 0 1 -1.8 1.4 H7.8 A1.8 1.8 0 0 1 6 19.4 Z" fill="#9aa1b0"/>'),
"🪑":W('<path d="M7.4 4.4 h9.2 v9.2 H7.4 Z" fill="#c98d4b"/><path d="M8 13.6 V20.6 M16 13.6 V20.6" stroke="#a8642f" stroke-width="2.2" stroke-linecap="round"/>'),
"🏬":W('<rect x="3.6" y="9" width="16.8" height="11.4" rx="1.8" fill="#7a8296"/><path d="M3.6 9 L6 4.6 h12 l2.4 4.4 Z" fill="#5ab8ff"/><rect x="9.4" y="13" width="5.2" height="7.4" rx="1" fill="#cfd4e0"/>'),
"📈":W('<path d="M4 17.6 L9.6 11.4 L13.4 14.6 L20 6.8" stroke="#54d66a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M15.4 6.4 H20.4 V11.2" stroke="#54d66a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'),
"📣":W('<path d="M4 10 h3.2 L15.4 5.2 v13.6 L7.2 14 H4 a1.6 1.6 0 0 1 -1.6-1.6 v-.8 A1.6 1.6 0 0 1 4 10 Z" fill="#ffd66b"/><path d="M18 8.6 a5 5 0 0 1 0 6.8" stroke="#ffb830" stroke-width="2.1" stroke-linecap="round" fill="none"/><path d="M7.6 14.6 l1.4 5 h3 l-1.4-5" fill="#e8b23e"/>'),
"🌙":W('<path d="M20 14.6 A8.6 8.6 0 0 1 9.4 4 a8.8 8.8 0 1 0 10.6 10.6 Z" fill="#cfd9ea"/>'),
"📻":W('<rect x="2.8" y="8.4" width="18.4" height="11.2" rx="2.4" fill="#8a91a4"/><path d="M8.6 8 L18.4 4.2" stroke="#9aa1b0" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="14" r="3" fill="#241b45"/><rect x="13.4" y="11.4" width="5.4" height="2" rx="1" fill="#cfd4e0"/><rect x="13.4" y="15.2" width="5.4" height="2" rx="1" fill="#cfd4e0"/>'),
// ---- 🧊 Tower Mode (js/game/tower3d.js) ----
"🪜":W('<path d="M7.4 3.4 V20.6 M16.6 3.4 V20.6" stroke="#c98d4b" stroke-width="2.4" stroke-linecap="round"/><path d="M7.4 7.6 H16.6 M7.4 12 H16.6 M7.4 16.4 H16.6" stroke="#e0a45f" stroke-width="2.1" stroke-linecap="round"/>'),
"🦘":W('<path d="M4 17.4 C6.6 8.6 17.4 8.6 20 17.4" stroke="#54d66a" stroke-width="2.4" stroke-linecap="round" fill="none"/><path d="M2.6 19.8 H8.4 M15.6 19.8 H21.4" stroke="#8a91a4" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="10.1" r="2.1" fill="#54d66a"/>'),
// three faces of one hue, so the cube reads on a light chip and on a dark sheet
// alike — fixed light-blue faces vanished on the light-blue Tower Mode chip
"🧊":W('<path d="M12 3.2 L20.2 7.6 L12 12 L3.8 7.6 Z" fill="'+CC+'" opacity=".95"/><path d="M3.8 7.6 L12 12 v8.8 L3.8 16.4 Z" fill="'+CC+'" opacity=".5"/><path d="M20.2 7.6 L12 12 v8.8 l8.2-4.4 Z" fill="'+CC+'" opacity=".72"/>'),
"⛰":W('<path d="M2.4 19.4 L9.2 7.2 L13.4 14.2 L15.6 10.8 L21.6 19.4 Z" fill="#8a91a4"/><path d="M9.2 7.2 L11.9 12 h-5.4 Z" fill="#eaf6ff"/>'),
"🛤":W('<path d="M3.6 20.2 L8.4 4.4 M20.4 20.2 L15.6 4.4" stroke="#8a91a4" stroke-width="2.3" stroke-linecap="round"/><path d="M5.6 16.6 H18.4 M7 11.8 H17 M8.3 7.2 H15.7" stroke="#c98d4b" stroke-width="2.1" stroke-linecap="round"/>'),
"🧱":W('<rect x="3.4" y="6.2" width="17.2" height="11.6" rx="1.8" fill="#c96f45"/><path d="M3.4 10.1 H20.6 M3.4 13.9 H20.6 M9.2 6.2 V10.1 M15 6.2 V10.1 M6.3 10.1 V13.9 M12 10.1 V13.9 M17.7 10.1 V13.9 M9.2 13.9 V17.8 M15 13.9 V17.8" stroke="#f0e2d2" stroke-width="1.5" stroke-linecap="round"/>'),
"🔑":W('<circle cx="8.2" cy="8.4" r="4.6" fill="none" stroke="#ffd66b" stroke-width="2.6"/><path d="M11.2 11.6 L19.6 20 M16.4 16.8 L18.8 14.4 M13.8 14.2 L16.2 11.8" stroke="#ffd66b" stroke-width="2.6" stroke-linecap="round"/>'),
"🚪":W('<rect x="5.2" y="2.9" width="13.6" height="18.2" rx="1.9" fill="#a8642f"/><rect x="7.4" y="5.1" width="9.2" height="13.8" rx="1.2" fill="#c07c3f"/><circle cx="14.9" cy="12" r="1.35" fill="#ffd66b"/>'),
"🌀":W('<path d="M12 3.2 a8.8 8.8 0 1 1 -8.8 8.8 a6.9 6.9 0 0 1 6.9-6.9 a5.2 5.2 0 0 1 5.2 5.2 a3.6 3.6 0 0 1 -3.6 3.6 a2.2 2.2 0 0 1 -2.2-2.2" fill="none" stroke="#5ab8ff" stroke-width="2.5" stroke-linecap="round"/>'),
"🔘":W('<circle cx="12" cy="12" r="9" fill="#5b6178"/><circle cx="12" cy="12" r="5.4" fill="#e8ecf5"/>'),
"➡️":W('<path d="M4 12 H18.4 M13.4 7 L18.6 12 L13.4 17" stroke="'+CC+'" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'),
"⬇️":W('<path d="M12 4.5 V18.5 M6.5 13 L12 18.5 L17.5 13" '+ST+' stroke-width="2.5"/>'),
"⬅️":W('<path d="M20 12 H5.6 M10.6 7 L5.4 12 L10.6 17" stroke="'+CC+'" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'),
"🧹":W('<path d="M17.6 3.6 L10.4 10.8" stroke="#c98d4b" stroke-width="2.6" stroke-linecap="round"/><path d="M11.6 8.6 L15.4 12.4 L9.2 20.4 L4 16.2 Z" fill="#ffd66b"/><path d="M7.4 12.5 L11.2 16.3" stroke="#c98d4b" stroke-width="1.7" stroke-linecap="round"/>'),
"⏭":W('<path d="M5.6 5.8 L14 12 L5.6 18.2 Z" fill="'+CC+'"/><rect x="15.8" y="5.8" width="2.6" height="12.4" rx="1.3" fill="'+CC+'"/>'),
"⏱":W('<circle cx="12" cy="13" r="7.5" '+ST+' stroke-width="2.2"/><path d="M12 9.5 V13 L14.8 15 M9.8 3.5 H14.2" '+ST+' stroke-width="2.2"/>'),
"🎬":W('<rect x="3.2" y="9" width="17.6" height="11.4" rx="2.2" fill="#cfd4e0"/><path d="M3.6 7.6 L20.2 4.2 L20.6 7.4 L4 10.8 Z" fill="#8a91a4"/><path d="M7.4 5.2 L9.2 8.6 M12 4.4 L13.8 7.8 M16.6 3.6 L18.4 7" stroke="#f4f6fb" stroke-width="1.7" stroke-linecap="round"/>'),
"➕":W('<path d="M12 5.4 V18.6 M5.4 12 H18.6" stroke="'+CC+'" stroke-width="2.9" stroke-linecap="round"/>'),
"＋":W('<path d="M12 5.4 V18.6 M5.4 12 H18.6" stroke="'+CC+'" stroke-width="2.9" stroke-linecap="round"/>'),
"−":W('<path d="M5.4 12 H18.6" stroke="'+CC+'" stroke-width="2.9" stroke-linecap="round"/>'),
"🌍":W('<circle cx="12" cy="12" r="8.8" fill="#3f9fe0"/><path d="M6.4 8.4 c1.9.5 2.4 1.8 3.9 1.8 c1.4 0 1.3 1.6 .3 2.3 c-1.1.8-.4 2.4 .8 2.4 c1.4 0 1.2 1.7 .4 2.9 M17.8 9.6 c-1.4.2-2.6 1-2.2 2.2 c.4 1.1 2 .7 2.9 1.6" fill="none" stroke="#54d66a" stroke-width="1.9" stroke-linecap="round"/>'),
"🎨":W('<path d="M12 3.4 a8.6 8.6 0 0 0 0 17.2 c1.5 0 1.9-1 1.4-1.9 c-.6-1.1 .2-2.2 1.5-2.2 h1.9 a3.8 3.8 0 0 0 3.8-3.8 A9.3 9.3 0 0 0 12 3.4 Z" fill="#e8ecf5"/><circle cx="8.1" cy="9.4" r="1.5" fill="#ff5d73"/><circle cx="12" cy="7.6" r="1.5" fill="#ffd66b"/><circle cx="15.9" cy="9.4" r="1.5" fill="#5ab8ff"/><circle cx="7.6" cy="14" r="1.5" fill="#54d66a"/>'),
"🛠️":W('<rect x="12.9" y="7.4" width="2.9" height="12.4" rx="1.45" transform="rotate(38 14.3 13.6)" fill="#c98d4b"/><rect x="3.4" y="4.4" width="6.4" height="4.6" rx="1.8" transform="rotate(42 6.6 6.7)" fill="#9aa1b0"/><rect x="4.6" y="14.4" width="10.8" height="2.8" rx="1.4" transform="rotate(-42 10 15.8)" fill="#c98d4b"/><path d="M20.6 4.2 a3.9 3.9 0 0 0 -5.2 5 l-1.1 1.3 2.2 2 1.3-1.2 a3.9 3.9 0 0 0 4.9-5.3 l-2.1 2.1 -2-.6 -.5-2 Z" fill="#b8bec9"/>'),
"🎓":W('<path d="M12 4.2 L22 8.6 L12 13 L2 8.6 Z" fill="#cfd4e0"/><path d="M6.4 10.6 V15.4 c0 1.9 2.5 3.2 5.6 3.2 s5.6-1.3 5.6-3.2 V10.6" fill="none" stroke="#aab2c4" stroke-width="2.2" stroke-linecap="round"/><path d="M21.2 9 V14.4" stroke="#ffd66b" stroke-width="2.1" stroke-linecap="round"/><circle cx="21.2" cy="15.4" r="1.5" fill="#ffd66b"/>'),
"🏆":W('<path d="M7.4 4.2 h9.2 v5.4 a4.6 4.6 0 0 1 -9.2 0 Z" fill="#ffd66b"/><path d="M7.4 5.6 H4.8 a3 3 0 0 0 3 4.4 M16.6 5.6 H19.2 a3 3 0 0 1 -3 4.4" fill="none" stroke="#ffd66b" stroke-width="1.9" stroke-linecap="round"/><path d="M12 14.2 V17 M8.4 20.2 h7.2" stroke="#e8b23e" stroke-width="2.4" stroke-linecap="round"/>'),
"🔌":W('<path d="M9 3.6 V8 M15 3.6 V8" stroke="#9aa1b0" stroke-width="2.4" stroke-linecap="round"/><path d="M6.4 8.4 h11.2 v3.4 a5.6 5.6 0 0 1 -11.2 0 Z" fill="#5ab8ff"/><path d="M12 17.6 V21" stroke="#9aa1b0" stroke-width="2.4" stroke-linecap="round"/>'),
"🟢":W('<circle cx="12" cy="12" r="7" fill="#54d66a"/>'),
"⏳":W('<path d="M7 3.6 h10 M7 20.4 h10" stroke="#c98d4b" stroke-width="2.3" stroke-linecap="round"/><path d="M8.4 4 h7.2 v2.6 L12 11 l-3.6 4.4 v2.6 h7.2 v-2.6 L12 11 8.4 6.6 Z" fill="#ffd66b" stroke="#e8b23e" stroke-width="1.2" stroke-linejoin="round"/>'),
"▶":W('<path d="M8.2 5.6 L18.4 12 L8.2 18.4 Z" fill="'+CC+'" stroke="'+CC+'" stroke-width="2" stroke-linejoin="round"/>'),
"⏹":W('<rect x="6.3" y="6.3" width="11.4" height="11.4" rx="2.6" fill="'+CC+'"/>'),
"✕":W('<path d="M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5" '+ST+' stroke-width="2.7"/>'),
"✖":W('<path d="M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5" '+ST+' stroke-width="2.7"/>'),
"↺":W('<path d="M6.2 9.2 A7.2 7.2 0 1 1 5.4 15" '+ST+' stroke-width="2.4"/><path d="M6.8 4.4 L6.2 9.6 L11.4 9" '+ST+' stroke-width="2.4"/>'),
"↻":W('<g transform="scale(-1,1) translate(-24,0)"><path d="M6.2 9.2 A7.2 7.2 0 1 1 5.4 15" '+ST+' stroke-width="2.4"/><path d="M6.8 4.4 L6.2 9.6 L11.4 9" '+ST+' stroke-width="2.4"/></g>'),
"↑":W('<path d="M12 19.5 V5.5 M6.5 11 L12 5.5 L17.5 11" '+ST+' stroke-width="2.5"/>'),
"↓":W('<path d="M12 4.5 V18.5 M6.5 13 L12 18.5 L17.5 13" '+ST+' stroke-width="2.5"/>'),
"⬆️":W('<path d="M12 19.5 V5.5 M6.5 11 L12 5.5 L17.5 11" '+ST+' stroke-width="2.5"/>'),
"↩️":W('<path d="M18.5 19 V12.5 A5.5 5.5 0 0 0 13 7 H5.5 M9.3 3 L5 7 L9.3 11" '+ST+' stroke-width="2.4"/>'),
"↪️":W('<g transform="scale(-1,1) translate(-24,0)"><path d="M18.5 19 V12.5 A5.5 5.5 0 0 0 13 7 H5.5 M9.3 3 L5 7 L9.3 11" '+ST+' stroke-width="2.4"/></g>'),
"⤵️":W('<path d="M4.5 6.5 H12.5 A5.5 5.5 0 0 1 18 12 V18.5 M14 15.5 L18 19.5 L22 15.5" '+ST+' stroke-width="2.4"/>'),
"⧉":W('<rect x="8.5" y="8.5" width="11" height="11" rx="2.2" '+ST+' stroke-width="2.2"/><path d="M15.5 4.8 H7 A2.2 2.2 0 0 0 4.8 7 V15.5" '+ST+' stroke-width="2.2"/>'),
"➤":W('<path d="M3.5 11.6 L20.5 4.2 L13.6 20.6 L11.1 13.6 Z" fill="'+CC+'"/>'),
"↔️":W('<path d="M4 12 H20 M7.5 8.5 L4 12 L7.5 15.5 M16.5 8.5 L20 12 L16.5 15.5" '+ST+' stroke-width="2.3"/>'),
"↕️":W('<path d="M12 4 V20 M8.5 7.5 L12 4 L15.5 7.5 M8.5 16.5 L12 20 L15.5 16.5" '+ST+' stroke-width="2.3"/>'),
"🔍":W('<circle cx="10.5" cy="10.5" r="5.8" '+ST+' stroke-width="2.3"/><path d="M15 15 L20 20" '+ST+' stroke-width="2.6"/>'),
"🗑":W('<path d="M4.7 7 H19.3 M9.5 7 V5.6 A1.6 1.6 0 0 1 11.1 4 H12.9 A1.6 1.6 0 0 1 14.5 5.6 V7 M6.6 7 L7.5 18.8 A2 2 0 0 0 9.5 20.6 H14.5 A2 2 0 0 0 16.5 18.8 L17.4 7 M10 10.5 V16.8 M14 10.5 V16.8" '+ST+' stroke-width="2.1"/>'),
"⏱️":W('<circle cx="12" cy="13" r="7.5" '+ST+' stroke-width="2.2"/><path d="M12 9.5 V13 L14.8 15 M9.8 3.5 H14.2" '+ST+' stroke-width="2.2"/>'),
"🔁":W('<path d="M6.8 8 H16 M12.8 4.5 L16.3 8 L12.8 11.5 M17.2 16 H8 M11.2 12.5 L7.7 16 L11.2 19.5" '+ST+' stroke-width="2.2"/>'),
"♾️":W('<path d="M12 12 c-2.2-3.4-7.2-3.2-7.2 0 s5 3.4 7.2 0 c2.2-3.4 7.2-3.2 7.2 0 s-5 3.4-7.2 0" '+ST+' stroke-width="2.4"/>'),
"❓":W('<path d="M8.5 9 a3.5 3.5 0 1 1 5.4 3 c-1.2.8-1.9 1.5-1.9 3" '+ST+' stroke-width="2.4"/><circle cx="12" cy="19" r="1.5" fill="'+CC+'"/>'),
"🧭":W('<circle cx="12" cy="12" r="8.6" '+ST+' stroke-width="2.2"/><path d="M15.4 8.6 L13.4 13.4 L8.6 15.4 L10.6 10.6 Z" fill="'+CC+'"/>'),
"⚙️":W('<circle cx="12" cy="12" r="4.4" '+ST+' stroke-width="2.2"/><path d="M12 2.8 v2.8 M12 18.4 v2.8 M2.8 12 h2.8 M18.4 12 h2.8 M5.5 5.5 l2 2 M16.5 16.5 l2 2 M18.5 5.5 l-2 2 M7.5 16.5 l-2 2" '+ST+' stroke-width="2.2"/>'),
"📜":W('<rect x="5.4" y="3.6" width="13.2" height="16.8" rx="2.6" fill="#f4e7d0"/><path d="M9 8.6 H15.2 M9 12 H15.2 M9 15.4 H12.6" stroke="#b98a4e" stroke-width="1.9" stroke-linecap="round"/>'),
"🛒":W('<path d="M3.6 4.8 H6.4 L9 15.4 H17.6 L20.4 7.6 H7.1" '+ST+' stroke-width="2.2"/><circle cx="10" cy="19.2" r="1.7" fill="'+CC+'"/><circle cx="16.6" cy="19.2" r="1.7" fill="'+CC+'"/>'),
"💡":W('<path d="M12 3.2 a5.6 5.6 0 0 1 3.1 10.3 c-.8.6-1.1 1.4-1.1 2.5 h-4 c0-1.1-.3-1.9-1.1-2.5 A5.6 5.6 0 0 1 12 3.2 Z" fill="#ffd66b"/><path d="M10 18.6 h4 M10.6 21 h2.8" stroke="#e8b23e" stroke-width="2" stroke-linecap="round"/>'),
"🎯":W('<circle cx="12" cy="12" r="8.6" fill="#ff5d73"/><circle cx="12" cy="12" r="5.4" fill="#fff"/><circle cx="12" cy="12" r="2.4" fill="#ff5d73"/>'),
"⭐":W('<path d="M12 3.2 L14.6 8.8 L20.8 9.5 L16.2 13.7 L17.5 19.8 L12 16.7 L6.5 19.8 L7.8 13.7 L3.2 9.5 L9.4 8.8 Z" fill="#ffd66b" stroke="#e8b23e" stroke-width="1.2" stroke-linejoin="round"/>'),
"🎒":W('<rect x="5.4" y="7.6" width="13.2" height="12.4" rx="4" fill="#ff5d73"/><path d="M8.6 7.6 a3.4 3.4 0 0 1 6.8 0" stroke="#e04a5f" stroke-width="2.4" fill="none"/><rect x="9" y="12.4" width="6" height="4.6" rx="1.6" fill="#ffd66b"/>'),
"⚡":W('<path d="M13.2 2.4 L5.4 13.4 H11 L9.6 21.6 L18.6 9.6 H12.4 Z" fill="#ffd66b" stroke="#e8b23e" stroke-width="1.1" stroke-linejoin="round"/>'),
"🧩":W('<path d="M5 9.2 A2.6 2.6 0 0 1 7.6 6.6 H9.5 a2.5 2.5 0 0 1 5 0 h1.9 A2.6 2.6 0 0 1 19 9.2 v1.9 a2.5 2.5 0 0 1 0 5 V18 a2.6 2.6 0 0 1 -2.6 2.6 H7.6 A2.6 2.6 0 0 1 5 18 Z" fill="#54d66a"/>'),
"🗺️":W('<rect x="4.4" y="4.4" width="15.2" height="15.2" rx="2.6" '+ST+' stroke-width="2.1"/><path d="M4.4 12 H19.6 M12 4.4 V19.6" '+ST+' stroke-width="2.1"/>'),
"🐍":W('<path d="M9 5.5 L4.5 12 L9 18.5 M15 5.5 L19.5 12 L15 18.5" '+ST+' stroke-width="2.4"/>'),
"🖌️":W('<path d="M13.8 4.2 l6 6 L12 18 l-6-6 Z" fill="#5ab8ff"/><path d="M5.6 12.4 l6 6 -1.4 1.4 c-2 2-6.6 2.2-6.6 2.2 s.2-4.6 2.2-6.6 Z" fill="#ffb830"/>'),
"🤖":W('<rect x="5.4" y="8" width="13.2" height="10.8" rx="3.2" fill="#5ab8ff"/><circle cx="9.4" cy="12.6" r="1.7" fill="#241b45"/><circle cx="14.6" cy="12.6" r="1.7" fill="#241b45"/><path d="M10 16 h4" stroke="#241b45" stroke-width="1.8" stroke-linecap="round"/><rect x="11" y="4.4" width="2" height="3.4" rx="1" fill="#5ab8ff"/><circle cx="12" cy="3.8" r="1.5" fill="#ff5d73"/>'),
"✏️":W('<path d="M4.4 19.6 v-4.2 L15.4 4.4 a1.9 1.9 0 0 1 2.7 0 l1.5 1.5 a1.9 1.9 0 0 1 0 2.7 L8.6 19.6 Z" '+ST+' stroke-width="2.2"/>'),
"🦉":W('<circle cx="12" cy="12.6" r="8.6" fill="#c98d4b"/><circle cx="8.9" cy="10.8" r="2.9" fill="#fff"/><circle cx="15.1" cy="10.8" r="2.9" fill="#fff"/><circle cx="8.9" cy="10.8" r="1.3" fill="#241b45"/><circle cx="15.1" cy="10.8" r="1.3" fill="#241b45"/><path d="M12 13 l-1.6 2.2 h3.2 Z" fill="#ffb830"/>'),
"🚚":W('<rect x="2.8" y="6.8" width="11.2" height="8.8" rx="1.6" fill="#5ab8ff"/><path d="M14 9.8 h4.2 L20.8 13 v2.6 H14 Z" fill="#4aa3e8"/><circle cx="7.4" cy="17.2" r="2.1" fill="#241b45"/><circle cx="16.6" cy="17.2" r="2.1" fill="#241b45"/>'),
"🎉":W('<path d="M4 20.4 L9 8.4 L15.6 15 Z" fill="#ff5d73"/><path d="M9 8.4 c2 0 5 1.6 6.6 6.6" fill="none" stroke="#ffd66b" stroke-width="1.6"/><circle cx="17.6" cy="6" r="1.5" fill="#ffd66b"/><circle cx="13" cy="4.4" r="1.2" fill="#5ab8ff"/><circle cx="20" cy="11" r="1.2" fill="#54d66a"/>'),
"🔊":W('<path d="M4 9.6 v4.8 h3.4 L12 18.8 V5.2 L7.4 9.6 Z" fill="'+CC+'"/><path d="M15 9.2 a4.4 4.4 0 0 1 0 5.6 M17.6 6.6 a8 8 0 0 1 0 10.8" '+ST+' stroke-width="2"/>'),
"🔇":W('<path d="M4 9.6 v4.8 h3.4 L12 18.8 V5.2 L7.4 9.6 Z" fill="'+CC+'"/><path d="M15.4 9.6 L20.2 14.4 M20.2 9.6 L15.4 14.4" '+ST+' stroke-width="2.2"/>'),
"💾":W('<path d="M4.8 6.4 a1.6 1.6 0 0 1 1.6-1.6 H16 l3.2 3.2 V17.6 a1.6 1.6 0 0 1 -1.6 1.6 H6.4 a1.6 1.6 0 0 1 -1.6-1.6 Z" fill="#5ab8ff"/><rect x="8" y="12.6" width="8" height="6.6" rx="1" fill="#fff"/><rect x="8.8" y="4.8" width="6" height="4" rx="1" fill="#fff"/>'),
"🏅":W('<path d="M9 2.8 h6 l-1.9 5 h-2.2 Z" fill="#ff5d73"/><circle cx="12" cy="14.2" r="6.2" fill="#ffd66b" stroke="#e8b23e" stroke-width="1.4"/><path d="M12 10.8 l1.1 2.1 2.3.3 -1.7 1.6 .4 2.3 -2.1-1.1 -2.1 1.1 .4-2.3 -1.7-1.6 2.3-.3 Z" fill="#e8b23e"/>'),
"✅":W('<circle cx="12" cy="12" r="9" fill="#54d66a"/><path d="M7.6 12.4 L10.8 15.6 L16.6 8.8" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'),
"🔒":W('<rect x="5.8" y="10.4" width="12.4" height="9.4" rx="2.6" fill="#ffb830"/><path d="M8.4 10.4 V8 a3.6 3.6 0 0 1 7.2 0 v2.4" stroke="#b8bec9" stroke-width="2.4" fill="none"/><circle cx="12" cy="14.6" r="1.5" fill="#8a5a1a"/>'),
"🔢":W('<text x="12" y="16" text-anchor="middle" font-size="10.5" font-weight="900" font-family="inherit" fill="'+CC+'">123</text>'),
"🔤":W('<text x="12" y="16" text-anchor="middle" font-size="10.5" font-weight="900" font-family="inherit" fill="'+CC+'">abc</text>'),
"✋":W('<path d="M8 13.5 V6.2 a1.4 1.4 0 0 1 2.8 0 V5.2 a1.4 1.4 0 0 1 2.8 0 v1.2 a1.4 1.4 0 0 1 2.8 0 v7.2 a5.6 5.6 0 0 1 -5.6 5.6 c-2.4 0-3.7-1.2-4.9-3.2 l-2.2-3.6 a1.45 1.45 0 0 1 2.4-1.6 Z" fill="#ffd6a8"/>'),
"🪓":W('<rect x="10.9" y="6" width="2.4" height="14.5" rx="1.2" transform="rotate(35 12 13)" fill="#c98d4b"/><path d="M6 4.2 c3.6-1.6 7.2.1 8.2 3.2 l-4.6 4 C7.4 9.8 6 7.4 6 4.2 Z" fill="#9aa1b0"/>'),
"⛏️":W('<rect x="10.8" y="5" width="2.4" height="15" rx="1.2" transform="rotate(45 12 12)" fill="#c98d4b"/><path d="M3.8 8.2 C8 4.4 14.4 3.8 19.6 7.6 c-4.2-1-8.4-.4-12 1.8 Z" fill="#9aa1b0"/>'),
"🪣":W('<path d="M6 7.6 h12 l-1.4 10.4 a2 2 0 0 1 -2 1.8 h-5.2 a2 2 0 0 1 -2-1.8 Z" fill="#5ab8ff"/><path d="M7.2 7.4 a4.8 4.8 0 0 1 9.6 0" stroke="#9aa1b0" stroke-width="2" fill="none"/>'),
"🔨":W('<rect x="10.7" y="9" width="2.6" height="11.4" rx="1.3" transform="rotate(-38 12 14)" fill="#c98d4b"/><rect x="4.8" y="4.2" width="11.4" height="5.6" rx="2.2" transform="rotate(18 10.5 7)" fill="#9aa1b0"/>'),
"🌊":W('<path d="M3 9.4 c2-2.2 4-2.2 6 0 s4 2.2 6 0 4-2.2 6 0 M3 15 c2-2.2 4-2.2 6 0 s4 2.2 6 0 4-2.2 6 0" stroke="#5ab8ff" stroke-width="2.2" stroke-linecap="round" fill="none"/>'),
"🚧":W('<rect x="3.6" y="8.2" width="16.8" height="6.2" rx="1.6" fill="#ffd66b"/><path d="M7.2 14.4 l3.6-6.2 M12.4 14.4 l3.6-6.2" stroke="#241b45" stroke-width="2.2"/><path d="M6.5 14.4 v4.8 M17.5 14.4 v4.8" stroke="#241b45" stroke-width="2"/>'),
// a rim as well as the hole, so a pit stays visible against the dark panels
"🕳️":W('<ellipse cx="12" cy="13" rx="8.4" ry="5" fill="#6b7a90"/><ellipse cx="12" cy="13.4" rx="6.8" ry="3.8" fill="#161d29"/>'),
"💰":W('<path d="M9.2 7.4 c-3 2-4.9 4.8-4.9 7.6 a5 5 0 0 0 5 5 h5.4 a5 5 0 0 0 5-5 c0-2.8-1.9-5.6-4.9-7.6 Z" fill="#ffb830"/><path d="M9.2 7.4 L7.6 4.6 h8.8 L14.8 7.4 Z" fill="#e8b23e"/><text x="12" y="17.2" font-size="8.5" font-weight="900" text-anchor="middle" font-family="inherit" fill="#8a5a1a">$</text>'),
"🏃":W('<circle cx="15" cy="4.8" r="2" fill="'+CC+'"/><path d="M8.6 21 l3.2-5 -2.6-3 3-4.2 3.4 2.6 3.4-1 M6 10.4 l3.6-2.8 2.6.2" '+ST+' stroke-width="2.2"/>'),
"🏗️":W('<rect x="4.4" y="6" width="15.2" height="12.4" rx="1.8" fill="#ff9d5a"/><path d="M4.4 10.2 h15.2 M4.4 14.2 h15.2 M9.5 6 v4.2 M14.5 10.2 v4 M9.5 14.2 v4.2" stroke="#e07840" stroke-width="1.7"/>'),
"⚠️":W('<path d="M12 3.6 L21.2 19.6 H2.8 Z" fill="#ffd66b" stroke="#e8b23e" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 9.4 v4.6" stroke="#241b45" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="16.8" r="1.3" fill="#241b45"/>'),
"🚀":W('<path d="M12 2.8 c3.2 2.2 4.6 6.2 3 11.2 l-3 2 -3-2 C7.4 9 8.8 5 12 2.8 Z" fill="#f6f3ff"/><circle cx="12" cy="9" r="1.9" fill="#5ab8ff"/><path d="M9 14.2 c-2 .6-3.1 2-3.6 4.6 2.6-.5 4.1-1.6 4.6-3.6 Z M15 14.2 c2 .6 3.1 2 3.6 4.6 -2.6-.5-4.1-1.6-4.6-3.6 Z" fill="#ff5d73"/><path d="M12 16.4 v3.6" stroke="#ffb830" stroke-width="2" stroke-linecap="round"/>')
};
/* longest keys first so variation-selector forms win */
function buildRX(){
  const keys=Object.keys(ICONS).concat(window.CC_SPRITES?CC_SPRITES.list():[]);
  const uniq=[...new Set(keys)].sort((a,b)=>b.length-a.length);
  return new RegExp('('+uniq.map(k=>k.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&')).join('|')+')','gu');
}
let RX=buildRX();
function svgFor(ch){
  if(ICONS[ch])return ICONS[ch];
  const base=ch.replace(/\uFE0F/g,'');
  if(ICONS[base])return ICONS[base];
  if(window.CC_SPRITES){const s=CC_SPRITES.svg(ch)||CC_SPRITES.svg(base)||CC_SPRITES.svg(ch+'\uFE0F');if(s)return s;}
  return null;
}
const SKIP={SCRIPT:1,STYLE:1,TEXTAREA:1,PRE:1,svg:1,SVG:1,CANVAS:1,INPUT:1};
function processText(tn){
  if(!tn.parentNode)return; // node was detached before this batched mutation ran
  const s=tn.nodeValue; if(!s)return;
  RX.lastIndex=0; if(!RX.test(s))return;
  const frag=document.createDocumentFragment();
  let last=0; RX.lastIndex=0; let m;
  while((m=RX.exec(s))){
    const svg=svgFor(m[1]);
    if(!svg)continue;
    if(m.index>last)frag.appendChild(document.createTextNode(s.slice(last,m.index)));
    const sp=document.createElement('span');sp.className='ui-emoji';sp.innerHTML=svg;
    frag.appendChild(sp);
    last=m.index+m[1].length;
  }
  if(last===0)return;
  if(last<s.length)frag.appendChild(document.createTextNode(s.slice(last)));
  tn.parentNode.replaceChild(frag,tn);
}
function walk(node){
  if(node.nodeType===3){processText(node);return;}
  if(node.nodeType!==1||SKIP[node.tagName])return;
  if(node.classList&&node.classList.contains('ui-emoji'))return;
  const kids=[...node.childNodes];
  for(const k of kids)walk(k);
}
const css=document.createElement('style');
css.textContent='.ui-emoji{display:inline-flex;width:1.18em;height:1.18em;vertical-align:-0.21em;flex:0 0 auto;}.ui-emoji svg{width:100%;height:100%;display:block;}';
document.head.appendChild(css);
function start(){
  RX=buildRX();
  walk(document.body);
  new MutationObserver(muts=>{
    for(const mu of muts){
      if(mu.type==='characterData'){processText(mu.target);continue;}
      for(const n of mu.addedNodes)walk(n);
    }
  }).observe(document.body,{childList:true,subtree:true,characterData:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
else start();
})();
