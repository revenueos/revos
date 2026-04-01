import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SUPABASE_URL, SUPABASE_KEY, ELEKTRA_WORKER_URL } from './config';
import { THEMES, applyTheme } from './data/themes';
import { USERS, MS, MF, DEFC, DEFM, RI, ROLES, COLORS, PERMS, DEF_PERMS } from './data/constants';
import { fmt, fmtK } from './utils/format';
import { getSupabase, resetSupabaseClient } from './utils/supabase';

import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Acente from './components/Acente';
import HedefEditor from './components/HedefEditor';
import Projeksiyon from './components/Projeksiyon';
import Analiz from './components/Analiz';
import Satis from './components/Satis';
import Operasyonel from './components/Operasyonel';
import Bildirim from './components/Bildirim';
import Raporlama from './components/Raporlama';
import ZekaMerkezi from './components/ZekaMerkezi';
import AIAsistan from './components/AIAsistan';
import KullaniciYonetimi from './components/KullaniciYonetimi';

// ── İNLİNE STİLLER (index.css'e taşınabilir) ──
const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0a0f1a; --bg2: #111827; --bg3: #1a2236; --surface: #162032;
    --border: rgba(255,255,255,0.06); --border2: rgba(255,255,255,0.12);
    --gold: #f5a623; --gold2: #fbbf24; --gold-dim: rgba(245,166,35,0.12);
    --teal: #10d9a0; --teal-dim: rgba(16,217,160,0.1);
    --blue: #60a5fa; --blue-dim: rgba(96,165,250,0.1);
    --red: #f87171; --red-dim: rgba(248,113,113,0.1);
    --purple: #a78bfa; --rose: #f72585; --rose-dim: rgba(247,37,133,0.1);
    --text: #f1f5f9; --text2: #94a3b8; --text3: #475569;
    --ff: 'DM Sans', sans-serif; --mono: 'DM Mono', monospace;
    --sidebar-w: 220px; --header-h: 56px;
    --radius: 12px; --radius-sm: 8px;
    --shadow: 0 4px 20px rgba(0,0,0,0.35); --shadow-lg: 0 8px 40px rgba(0,0,0,0.5);
  }

  body { font-family: var(--ff); background: var(--bg); color: var(--text); min-height: 100vh; font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased; }
  button { font-family: var(--ff); cursor: pointer; outline: none; }
  input, select, textarea { font-family: var(--ff); }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }

  .app-shell { display: flex; min-height: 100vh; }

  /* SIDEBAR */
  .sidebar {
    width: var(--sidebar-w); min-width: var(--sidebar-w);
    background: var(--bg2); border-right: 1px solid var(--border);
    display: flex; flex-direction: column;
    position: fixed; top: 0; left: 0; height: 100vh;
    z-index: 100; transition: transform .25s ease;
    overflow-y: auto;
  }
  .main-area { margin-left: var(--sidebar-w); flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
  .topbar {
    height: var(--header-h); background: var(--bg2); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; padding: 0 24px; gap: 12px;
    position: sticky; top: 0; z-index: 50;
  }
  .page-content { padding: 24px; flex: 1; }

  .sidebar-logo { padding: 18px 16px 14px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; }
  .sidebar-logo .wordmark { font-size: 18px; font-weight: 700; letter-spacing: -.3px; }
  .sidebar-logo .wordmark em { color: var(--gold); font-style: normal; }
  .sidebar-logo .v-badge { font-size: 9px; font-family: var(--mono); color: var(--text3); background: var(--bg3); border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px; margin-left: auto; }

  .nav-section { padding: 12px 8px 2px; }
  .nav-section-label { font-size: 10px; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: .08em; padding: 0 8px; margin-bottom: 4px; }
  .nav-item {
    display: flex; align-items: center; gap: 9px;
    padding: 7px 10px; border-radius: var(--radius-sm);
    color: var(--text2); font-size: 13px; font-weight: 500;
    cursor: pointer; transition: all .15s; border: 1px solid transparent;
    margin-bottom: 1px; background: none;
  }
  .nav-item:hover { background: rgba(255,255,255,0.04); color: var(--text); }
  .nav-item.active { background: var(--gold-dim); border-color: rgba(245,166,35,0.2); color: var(--gold); }
  .nav-item .nav-icon { font-size: 14px; width: 18px; text-align: center; flex-shrink: 0; }
  .nav-badge { margin-left: auto; background: #ef4444; color: #fff; border-radius: 10px; padding: 1px 6px; font-size: 10px; font-weight: 700; }
  .nav-item.locked { opacity: .4; cursor: not-allowed; }

  .sidebar-footer { margin-top: auto; padding: 10px; border-top: 1px solid var(--border); }
  .user-card { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: var(--radius-sm); background: var(--bg3); }
  .user-avatar { width: 30px; height: 30px; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
  .user-info .uname { font-size: 12px; font-weight: 600; }
  .user-info .urole { font-size: 10px; color: var(--text3); font-family: var(--mono); }

  /* TOPBAR */
  .page-title { font-size: 14px; font-weight: 600; color: var(--text); }
  .topbar-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
  .topbar-pill {
    display: flex; align-items: center; gap: 5px;
    background: var(--bg3); border: 1px solid var(--border);
    border-radius: 20px; padding: 4px 10px; font-size: 11px;
    color: var(--text2); font-family: var(--mono); cursor: pointer; transition: all .15s;
  }
  .topbar-pill:hover { border-color: var(--border2); color: var(--text); }
  .live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--teal); animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:.4;} }

  /* CARDS */
  .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 20px; }
  .kpi-card {
    background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 18px 20px; position: relative; overflow: hidden; transition: border-color .15s;
  }
  .kpi-card:hover { border-color: var(--border2); }
  .kpi-card::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background: var(--kc, var(--gold)); }
  .kpi-label { font-size: 11px; color: var(--text3); font-weight: 500; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 10px; }
  .kpi-value { font-size: 24px; font-weight: 700; color: var(--kc, var(--text)); line-height: 1; margin-bottom: 6px; }
  .kpi-delta { font-size: 11px; color: var(--text3); }
  .kpi-delta.up { color: var(--teal); }
  .kpi-delta.dn { color: var(--red); }

  .panel { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; margin-bottom: 16px; }
  .panel-title { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .ptag { font-size: 10px; font-weight: 500; background: var(--bg3); border: 1px solid var(--border); border-radius: 4px; padding: 1px 7px; color: var(--text3); font-family: var(--mono); }

  /* GRIDS */
  .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .g3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
  .g65 { display: grid; grid-template-columns: 1fr 340px; gap: 16px; }

  /* TABLES */
  .tbl { width:100%; border-collapse:collapse; font-size:12px; }
  .tbl th { text-align:left; padding:8px 12px; font-size:10px; font-weight:600; color:var(--text3); text-transform:uppercase; letter-spacing:.06em; border-bottom:1px solid var(--border); white-space:nowrap; }
  .tbl td { padding:10px 12px; border-bottom:1px solid rgba(255,255,255,0.04); color:var(--text2); vertical-align:middle; }
  .tbl tbody tr:hover td { background:rgba(255,255,255,0.02); color:var(--text); }
  .tbl tbody tr:last-child td { border-bottom:none; }
  .tbl .num { font-family:var(--mono); font-size:11px; }
  .tbl .name { font-weight:600; color:var(--text); }

  /* BUTTONS */
  .btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 7px 14px; border-radius: var(--radius-sm);
    font-size: 12px; font-weight: 500;
    border: 1px solid var(--border);
    background: var(--bg3); color: var(--text2);
    transition: all .15s; cursor: pointer; white-space: nowrap;
  }
  .btn:hover { border-color: var(--border2); color: var(--text); }
  .btn:disabled { opacity: .4; cursor: not-allowed; }
  .btn-primary { background: var(--gold); color: #000; border-color: var(--gold); font-weight: 600; }
  .btn-primary:hover { background: var(--gold2); border-color: var(--gold2); color: #000; }
  .btn-ghost { background: transparent; border-color: transparent; }
  .btn-ghost:hover { background: rgba(255,255,255,0.05); border-color: transparent; }
  .btn-danger { background: var(--red-dim); border-color: rgba(248,113,113,.25); color: var(--red); }
  .btn-sm { padding: 4px 10px; font-size: 11px; }
  .btn-full { width: 100%; justify-content: center; }

  /* FORMS */
  .field { margin-bottom: 12px; }
  .field label { display: block; font-size: 11px; font-weight: 500; color: var(--text3); margin-bottom: 5px; text-transform: uppercase; letter-spacing: .05em; }
  .inp { width:100%; padding:8px 11px; background:var(--bg3); border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--text); font-size:13px; font-family:var(--ff); transition:border-color .15s; }
  .inp:focus { outline:none; border-color:var(--gold); }
  .inp::placeholder { color:var(--text3); }
  select.inp { cursor:pointer; }

  /* SLIDER */
  .slider { -webkit-appearance:none; appearance:none; width:100%; height:3px; border-radius:2px; background:var(--border2); outline:none; cursor:pointer; }
  .slider::-webkit-slider-thumb { -webkit-appearance:none; width:14px; height:14px; border-radius:50%; background:var(--gold); cursor:pointer; border:2px solid var(--bg); box-shadow:0 0 0 2px var(--gold); }

  /* BADGES */
  .badge { display:inline-block; padding:2px 8px; border-radius:20px; font-size:10px; font-weight:600; font-family:var(--mono); }
  .badge-green { background:var(--teal-dim); color:var(--teal); border:1px solid rgba(16,217,160,.2); }
  .badge-yellow { background:var(--gold-dim); color:var(--gold); border:1px solid rgba(245,166,35,.2); }
  .badge-red { background:var(--red-dim); color:var(--red); border:1px solid rgba(248,113,113,.2); }
  .badge-blue { background:var(--blue-dim); color:var(--blue); border:1px solid rgba(96,165,250,.2); }
  .badge-purple { background:rgba(167,139,250,.1); color:var(--purple); border:1px solid rgba(167,139,250,.2); }

  /* PROGRESS */
  .progress-bar { height:4px; background:var(--border2); border-radius:2px; overflow:hidden; }
  .progress-fill { height:100%; border-radius:2px; transition:width .5s ease; }

  /* MONTH GRID */
  .mgrid { display:grid; grid-template-columns:repeat(12,1fr); gap:6px; }
  .mcell { background:var(--bg3); border:1px solid var(--border); border-radius:var(--radius-sm); padding:10px 8px; text-align:center; transition:border-color .15s; }
  .mcell.real { border-color:rgba(96,165,250,.2); }
  .mcell.sim { border-color:rgba(16,217,160,.15); }
  .mcell:hover { border-color:var(--border2); }

  /* MODAL */
  .overlay { position:fixed; inset:0; background:rgba(0,0,0,.65); display:flex; align-items:center; justify-content:center; z-index:1000; backdrop-filter:blur(4px); }
  .modal { background:var(--bg2); border:1px solid var(--border2); border-radius:16px; padding:24px; position:relative; max-height:90vh; overflow-y:auto; box-shadow:var(--shadow-lg); }
  .modal-title { font-size:16px; font-weight:700; margin-bottom:4px; }
  .modal-sub { font-size:12px; color:var(--text3); margin-bottom:20px; }

  /* NOTIFS */
  .notif { padding:10px 14px; border-radius:var(--radius-sm); font-size:12px; margin-bottom:10px; }
  .notif-info { background:var(--blue-dim); border:1px solid rgba(96,165,250,.2); color:var(--blue); }
  .notif-warn { background:var(--gold-dim); border:1px solid rgba(245,166,35,.2); color:var(--gold); }
  .notif-error { background:var(--red-dim); border:1px solid rgba(248,113,113,.2); color:var(--red); }
  .notif-success { background:var(--teal-dim); border:1px solid rgba(16,217,160,.2); color:var(--teal); }

  /* TAB BAR */
  .tab-bar { display:flex; gap:4px; padding:4px; background:var(--bg3); border-radius:var(--radius-sm); border:1px solid var(--border); margin-bottom:16px; flex-wrap:wrap; }
  .tab-btn { padding:6px 14px; border-radius:6px; font-size:12px; font-weight:500; color:var(--text3); cursor:pointer; transition:all .15s; border:1px solid transparent; background:transparent; }
  .tab-btn:hover { color:var(--text); }
  .tab-btn.active { background:var(--bg2); color:var(--text); box-shadow:0 1px 4px rgba(0,0,0,.3); border-color:var(--border); }

  /* INSIGHT */
  .insight-card { background:var(--bg3); border:1px solid var(--border); border-left:3px solid var(--ic,var(--gold)); border-radius:var(--radius-sm); padding:12px 14px; margin-bottom:8px; }
  .insight-title { font-size:12px; font-weight:600; color:var(--ic,var(--gold)); margin-bottom:4px; }
  .insight-body { font-size:11px; color:var(--text2); line-height:1.6; }

  /* LOGIN */
  .login-page { min-height:100vh; display:flex; align-items:center; justify-content:center; background:var(--bg); padding:20px; }
  .login-card { width:100%; max-width:400px; background:var(--bg2); border:1px solid var(--border2); border-radius:20px; padding:36px; box-shadow:var(--shadow-lg); }
  .login-logo { text-align:center; margin-bottom:28px; }
  .login-logo .wordmark { font-size:28px; font-weight:800; letter-spacing:-.5px; }
  .login-logo .wordmark em { color:var(--gold); font-style:normal; }
  .login-logo .sub { font-size:12px; color:var(--text3); margin-top:4px; }
  .login-divider { height:1px; background:var(--border); margin:20px 0; }
  .login-footer { text-align:center; margin-top:16px; font-size:10px; color:var(--text3); font-family:var(--mono); }
  .demo-row { display:flex; align-items:center; justify-content:space-between; padding:7px 10px; background:var(--bg3); border:1px solid var(--border); border-radius:var(--radius-sm); margin-bottom:4px; }
  .demo-row .di { font-size:12px; font-weight:600; }
  .demo-row .dc { font-size:10px; color:var(--text3); font-family:var(--mono); margin-top:1px; }

  /* MISC */
  .divider { border:none; border-top:1px solid var(--border); margin:16px 0; }
  .mono { font-family:var(--mono); font-size:11px; }

  /* CHAT */
  .chat-msg-ai { background:var(--bg3); border:1px solid var(--border); border-radius:12px 12px 12px 3px; padding:12px 14px; font-size:13px; line-height:1.7; }
  .chat-msg-user { background:var(--gold-dim); border:1px solid rgba(245,166,35,.2); border-radius:12px 12px 3px 12px; padding:12px 14px; font-size:13px; text-align:right; }

  /* MOBILE */
  @media(max-width:768px){
    .sidebar { transform:translateX(-100%); width:260px; position:fixed; height:100vh; z-index:200; }
    .sidebar.open { transform:translateX(0); box-shadow:var(--shadow-lg); }
    .main-area { margin-left:0; }
    .kpi-grid { grid-template-columns:repeat(2,1fr); }
    .g65, .g2, .g3 { grid-template-columns:1fr; }
    .mgrid { grid-template-columns:repeat(6,1fr); }
    .topbar { padding:0 12px; }
    .page-content, .main { padding:14px 12px !important; }
    .menu-toggle { display:flex !important; }
    .kgrid { grid-template-columns:repeat(2,1fr) !important; gap:8px !important; }
    .panel { padding:14px !important; }
    table.tbl { display:block; overflow-x:auto; -webkit-overflow-scrolling:touch; }
    .aigrid { grid-template-columns:1fr !important; }
    .overlay { align-items:flex-end; padding:0; }
    .modal { width:100% !important; max-width:100% !important; max-height:88vh; border-radius:20px 20px 0 0 !important; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:24px 16px 32px; }
    .savebar { width:calc(100% - 24px) !important; bottom:16px !important; }
  }
  @media(max-width:480px){
    .kcard { padding:12px 10px !important; }
    .kval { font-size:16px !important; }
    .mgrid { grid-template-columns:repeat(4,1fr) !important; }
    .tbl td { font-size:11px !important; padding:8px 6px !important; }
    .tbl th { font-size:9px !important; padding:6px !important; }
    .inp { font-size:16px !important; } /* iOS zoom önle */
  }
  @media(hover:none) and (pointer:coarse){
    .btn, .tab, .nav-item { min-height:44px; }
    .slider::-webkit-slider-thumb { width:22px !important; height:22px !important; }
  }
  .menu-toggle { display:none; align-items:center; justify-content:center; width:36px; height:36px; border-radius:var(--radius-sm); background:var(--bg3); border:1px solid var(--border); cursor:pointer; flex-shrink:0; font-size:18px; color:var(--text); }
  .sidebar-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:199; backdrop-filter:blur(4px); }
  @media(max-width:768px){ .sidebar-overlay.open { display:block !important; } }

  /* LIGHT THEME */
  .light-theme { --bg:#f1f5f9; --bg2:#ffffff; --bg3:#f8fafc; --border:rgba(0,0,0,.08); --border2:rgba(0,0,0,.15); --text:#0f172a; --text2:#334155; --text3:#94a3b8; }
  .light-theme .sidebar, .light-theme .topbar, .light-theme .panel, .light-theme .kpi-card { box-shadow:0 1px 3px rgba(0,0,0,.08); }

  /* Eski class uyumluluk katmanı */
  .btn.bp, .btn.btn-primary { background:var(--gold); color:#000; border-color:var(--gold); font-weight:600; }
  .btn.bp:hover, .btn.btn-primary:hover { background:var(--gold2); }
  .btn.bg { background:var(--bg3); color:var(--text2); border-color:var(--border); }
  .btn.bfull, .btn-full { width:100%; justify-content:center; }
  .ptitle, .panel-title { font-size:13px; font-weight:600; color:var(--text); margin-bottom:16px; display:flex; align-items:center; gap:8px; }
  .notif.ny, .notif-warn { background:var(--gold-dim); border:1px solid rgba(245,166,35,.2); color:var(--gold); }
  .notif.nb, .notif-info { background:var(--blue-dim); border:1px solid rgba(96,165,250,.2); color:var(--blue); }
  .notif.ng, .notif-success { background:var(--teal-dim); border:1px solid rgba(16,217,160,.2); color:var(--teal); }
  .kgrid, .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:20px; }
  .kcard, .kpi-card { background:var(--bg2); border:1px solid var(--border); border-radius:var(--radius); padding:18px 20px; position:relative; overflow:hidden; }
  .kcard::before, .kpi-card::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:var(--kc,var(--gold)); }
  .klbl, .kpi-label { font-size:11px; color:var(--text3); font-weight:500; text-transform:uppercase; letter-spacing:.06em; margin-bottom:10px; }
  .kval, .kpi-value { font-size:24px; font-weight:700; color:var(--kc,var(--text)); line-height:1; margin-bottom:6px; }
  .kdelta, .kpi-delta { font-size:11px; color:var(--text3); }
  .mg, .field { margin-bottom:12px; }
  .lbl { display:block; font-size:11px; font-weight:500; color:var(--text3); margin-bottom:5px; text-transform:uppercase; letter-spacing:.05em; }
  .badge.by2, .badge-yellow { background:var(--gold-dim); color:var(--gold); border:1px solid rgba(245,166,35,.2); }
  .badge.bg2, .badge-green { background:var(--teal-dim); color:var(--teal); border:1px solid rgba(16,217,160,.2); }
  .badge.br2, .badge-red { background:var(--red-dim); color:var(--red); border:1px solid rgba(248,113,113,.2); }
  .aicard { background:var(--bg3); border:1px solid var(--border); border-left:3px solid var(--ac,var(--gold)); border-radius:var(--radius-sm); padding:12px 14px; margin-bottom:8px; }
  .aicard .t { font-size:12px; font-weight:600; color:var(--ac,var(--gold)); margin-bottom:4px; }
  .aicard .x { font-size:11px; color:var(--text2); line-height:1.6; }
  .aip { background:var(--bg2); border:1px solid var(--border); border-radius:var(--radius); padding:16px; margin-bottom:16px; }
  .aigrid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; }
  .slider { -webkit-appearance:none; appearance:none; width:100%; height:3px; border-radius:2px; background:var(--border2); outline:none; cursor:pointer; }
  .slider::-webkit-slider-thumb { -webkit-appearance:none; width:14px; height:14px; border-radius:50%; background:var(--gold); cursor:pointer; border:2px solid var(--bg); box-shadow:0 0 0 2px var(--gold); }
  .mcell { background:var(--bg3); border:1px solid var(--border); border-radius:var(--radius-sm); padding:10px 8px; text-align:center; }
  .mcell.real { border-color:rgba(96,165,250,.2); }
  .mcell.sim { border-color:rgba(16,217,160,.15); }
  .notif { padding:10px 14px; border-radius:var(--radius-sm); font-size:12px; margin-bottom:10px; }
  .panel { background:var(--bg2); border:1px solid var(--border); border-radius:var(--radius); padding:20px; margin-bottom:16px; }
  .tbl { width:100%; border-collapse:collapse; font-size:12px; }
  .tbl th { text-align:left; padding:8px 12px; font-size:10px; font-weight:600; color:var(--text3); text-transform:uppercase; letter-spacing:.06em; border-bottom:1px solid var(--border); white-space:nowrap; }
  .tbl td { padding:10px 12px; border-bottom:1px solid rgba(255,255,255,0.04); color:var(--text2); vertical-align:middle; }
  .tbl tbody tr:hover td { background:rgba(255,255,255,0.02); }
  .tbl tbody tr:last-child td { border-bottom:none; }
  .inp { width:100%; padding:8px 11px; background:var(--bg3); border:1px solid var(--border); border-radius:var(--radius-sm); color:var(--text); font-size:13px; font-family:var(--ff); transition:border-color .15s; }
  .inp:focus { outline:none; border-color:var(--gold); }
  .inp::placeholder { color:var(--text3); }
  .overlay { position:fixed; inset:0; background:rgba(0,0,0,.65); display:flex; align-items:center; justify-content:center; z-index:1000; backdrop-filter:blur(4px); }
  .modal { background:var(--bg2); border:1px solid var(--border2); border-radius:16px; padding:24px; position:relative; max-height:90vh; overflow-y:auto; box-shadow:var(--shadow-lg); }
  .g65 { display:grid; grid-template-columns:1fr 340px; gap:16px; }
  .g2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .g3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; }
  .mgrid { display:grid; grid-template-columns:repeat(12,1fr); gap:6px; }
  .sdiv { height:1px; background:var(--border); margin:18px 0; }
  .chat-msg-ai { background:var(--bg3); border:1px solid var(--border); border-radius:14px 14px 14px 4px; padding:12px 14px; }
  .chat-msg-user { background:rgba(245,166,35,0.1); border:1px solid rgba(245,166,35,0.2); border-radius:14px 14px 4px 14px; padding:12px 14px; }
  @media(max-width:768px){
    .kgrid, .kpi-grid { grid-template-columns:repeat(2,1fr); }
    .g65, .g2, .g3 { grid-template-columns:1fr; }
    .mgrid { grid-template-columns:repeat(6,1fr); }
    .aigrid { grid-template-columns:1fr; }
  }
`;

function App() {
  const [user, setUser] = useState(() => { try { const u = localStorage.getItem('rv_user'); return u ? JSON.parse(u) : null; } catch { return null; } });
  const [tab, setTab] = useState('dash');
  const [theme, setTheme] = useState(() => localStorage.getItem('rv_theme') || 'Koyu Okyanus');
  const [themeModal, setThemeModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);

  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => {
    // Inject global styles
    const id = 'ros-global-style';
    if (!document.getElementById(id)) {
      const el = document.createElement('style');
      el.id = id;
      el.textContent = GLOBAL_STYLE;
      document.head.appendChild(el);
    }
  }, []);
  useEffect(() => {
    const close = () => setSidebarOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const [simOcc, setSimOcc] = useState(85);
  const [simAdr, setSimAdr] = useState(225);
  const [monthly, setMonthly] = useState(DEFM);
  const [ac, setAc] = useState(DEFC);
  const [sbCfg, setSbCfg] = useState({ url: (SUPABASE_URL && SUPABASE_URL.trim()) || localStorage.getItem('sb_url') || '', key: (SUPABASE_KEY && SUPABASE_KEY.trim()) || localStorage.getItem('sb_key') || '' });
  const [sbReady, setSbReady] = useState(!!((SUPABASE_URL && SUPABASE_URL.trim()) || localStorage.getItem('sb_url')) && !!((SUPABASE_KEY && SUPABASE_KEY.trim()) || localStorage.getItem('sb_key')));
  const [sbStatus, setSbStatus] = useState('idle');
  const [sbModal, setSbModal] = useState(false);
  const [groqKey, setGroqKey] = useState('');
  const [groqSaved, setGroqSaved] = useState(false);
  const [groqKeyInput, setGroqKeyInput] = useState('');
  const [dbSync, setDbSync] = useState(false);

  // Elektra PMS
  const [elektraToken, setElektraToken] = useState(() => localStorage.getItem('rv_elektra_token') || '');
  const [elektraHotelId, setElektraHotelId] = useState(() => localStorage.getItem('rv_elektra_hotel') || '');
  // Elektra Worker URL — ayarlara girilmişse onu kullan, yoksa varsayılan
  const getElektraWorkerUrl = () => localStorage.getItem('rv_elektra_worker') || ELEKTRA_WORKER_URL || '';

  const [elektraReady, setElektraReady] = useState(() => true); // Worker her zaman hazır
  const [elektraInput, setElektraInput] = useState('');
  const [elektraHotelInput, setElektraHotelInput] = useState('');
  const [elektraStatus, setElektraStatus] = useState('idle'); // idle | testing | ok | error
  const [elektraSyncing, setElektraSyncing] = useState(false);
  const [elektraLastSync, setElektraLastSync] = useState(() => localStorage.getItem('rv_elektra_last_sync') || '');
  const [elektraMonthsCache, setElektraMonthsCache] = useState({}); // {year: months[]} — sync sonrası güncellenir
  const [users, setUsers] = useState(() => { try { const s = localStorage.getItem('rv_users'); if (s) { const p = JSON.parse(s); if (p && p.length > 0) return p; } } catch (e) {} return USERS; });

  // ── DB FONKSİYONLARI ── (değişmedi)
  const loadFromDB = async () => {
    const sb = getSupabase(); if (!sb) return;
    setDbSync(true);
    try {
      const [{ data: mData }, { data: aData }] = await Promise.all([
        sb.from('monthly_targets').select('*').order('month_index'),
        sb.from('agencies').select('*,agency_monthly(month_index,target)')
      ]);
      if (mData && mData.length > 0) setMonthly(mData.map(r => ({ m: MS[r.month_index], g: r.actual || null, h: r.target, o: r.occ_target || null, a: r.adr_target || null })));
      if (aData && aData.length > 0) setAc(aData.map(r => ({ id: r.id, ad: r.name, tip: r.type, kom: r.commission, hedef: r.annual_target, ciro: r.actual_revenue || 0, ind: r.discount || 0, pp: r.pp_eur || null, adr: r.adr_eur || null, elektraId: r.elektra_id || null, ay: Array(12).fill(0).map((_, i) => { const m = r.agency_monthly?.find(x => x.month_index === i); return m ? m.target : Math.round(r.annual_target / 12); }) })));
    } catch (e) { console.error('DB load error:', e); }
    setDbSync(false);
  };

  const loadSettings = async () => {
    const sb = getSupabase(); if (!sb) return;
    try {
      const { data } = await sb.from('app_settings').select('key,value');
      if (data) {
        const gk = data.find(r => r.key === 'groq_api_key'); if (gk) { setGroqKey(gk.value); setGroqSaved(true); }
        const occ = data.find(r => r.key === 'sim_occ'); if (occ) setSimOcc(+occ.value);
        const adr = data.find(r => r.key === 'sim_adr'); if (adr) setSimAdr(+adr.value);
        // Elektra ayarları
        const et = data.find(r => r.key === 'elektra_token');
        const ew = data.find(r => r.key === 'elektra_worker');
        const eh = data.find(r => r.key === 'elektra_hotel');
        if (et) {
          localStorage.setItem('rv_elektra_token', et.value);
          setElektraToken(et.value);
        }
        if (ew) {
          localStorage.setItem('rv_elektra_worker', ew.value);
        }
        if (eh) {
          localStorage.setItem('rv_elektra_hotel', eh.value);
          setElektraHotelId(eh.value);
        }
        if (et || ew) setElektraReady(true);
      }
    } catch (e) { console.error('Settings load error:', e); }
  };

  const loadUsers = async () => {
    const sb = getSupabase(); if (!sb) return;
    try {
      const { data, error } = await sb.from('app_users').select('*');
      if (error || !data || data.length === 0) return;
      const mapped = data.map(u => ({ id: u.uid, name: u.name, email: u.email, pass: u.pass, role: u.role, av: u.av || u.name.substring(0, 2).toUpperCase(), color: u.color || '#f0b429', p: { dash: u.p_dash, acente: u.p_acente, proj: u.p_proj, editor: u.p_editor, ai: u.p_ai, hedef: u.p_hedef, ciro: u.p_ciro, kom: u.p_kom, admin: u.p_admin, addac: u.p_addac } }));
      setUsers(mapped);
      try { localStorage.setItem('rv_users', JSON.stringify(mapped)); } catch (e) {}
      setUser(prev => { if (!prev) return prev; const updated = mapped.find(u => u.id === prev.id || u.email === prev.email); if (updated) { localStorage.setItem('rv_user', JSON.stringify(updated)); return updated; } return prev; });
    } catch (e) { console.error('Load users error:', e); }
  };

  const saveUser = async (u) => {
    const nu = { ...u, av: u.av || u.name.substring(0, 2).toUpperCase().replace(' ', ''), color: u.color || '#f0b429' };
    setUsers(prev => { const exists = prev.find(x => x.id === nu.id); const next = exists ? prev.map(x => x.id === nu.id ? nu : x) : [...prev, nu]; try { localStorage.setItem('rv_users', JSON.stringify(next)); } catch (e) {} return next; });
    if (sbReady) { const sb = getSupabase(); try { const row = { uid: nu.id, name: nu.name, email: nu.email, pass: nu.pass, role: nu.role, av: nu.av, color: nu.color, p_dash: nu.p.dash ? 1 : 0, p_acente: nu.p.acente ? 1 : 0, p_proj: nu.p.proj ? 1 : 0, p_editor: nu.p.editor ? 1 : 0, p_ai: nu.p.ai ? 1 : 0, p_hedef: nu.p.hedef ? 1 : 0, p_ciro: nu.p.ciro ? 1 : 0, p_kom: nu.p.kom ? 1 : 0, p_admin: nu.p.admin ? 1 : 0, p_addac: nu.p.addac ? 1 : 0 }; await sb.from('app_users').upsert(row, { onConflict: 'uid' }); } catch (e) {} }
    return true;
  };

  const deleteUser = async (uid) => {
    setUsers(prev => { const next = prev.filter(u => u.id !== uid); try { localStorage.setItem('rv_users', JSON.stringify(next)); } catch (e) {} return next; });
    if (sbReady) { const sb = getSupabase(); try { await sb.from('app_users').delete().eq('uid', uid); } catch (e) {} }
  };

  const saveGroqKey = async (k) => {
    const sb = getSupabase(); if (!sb) return;
    try { await sb.from('app_settings').upsert({ key: 'groq_api_key', value: k.trim() }, { onConflict: 'key' }); setGroqKey(k.trim()); setGroqSaved(true); setGroqKeyInput(''); } catch (e) { console.error(e); }
  };

  const deleteGroqKey = async () => {
    const sb = getSupabase(); if (!sb) return;
    try { await sb.from('app_settings').delete().eq('key', 'groq_api_key'); setGroqKey(''); setGroqSaved(false); } catch (e) {}
  };

  // ── ELEKTRA PMS FONKSİYONLARI ──
  const saveElektraConfig = async () => {
    const token = elektraInput.trim();
    const hotel = elektraHotelInput.trim();
    const worker = localStorage.getItem('rv_elektra_worker') || '';
    if (!token) return;
    // localStorage
    localStorage.setItem('rv_elektra_token', token);
    if (hotel) localStorage.setItem('rv_elektra_hotel', hotel);
    setElektraToken(token);
    setElektraHotelId(hotel);
    setElektraReady(true);
    setElektraStatus('idle');
    // Supabase'e kaydet
    if (sbReady) {
      const sb = getSupabase();
      if (sb) {
        const rows = [
          { key: 'elektra_token', value: token },
          ...(hotel ? [{ key: 'elektra_hotel', value: hotel }] : []),
          ...(worker ? [{ key: 'elektra_worker', value: worker }] : []),
        ];
        try { await sb.from('app_settings').upsert(rows, { onConflict: 'key' }); } catch (e) { console.error(e); }
      }
    }
  };

  const removeElektraConfig = async () => {
    localStorage.removeItem('rv_elektra_token');
    localStorage.removeItem('rv_elektra_hotel');
    localStorage.removeItem('rv_elektra_worker');
    setElektraToken('');
    setElektraHotelId('');
    setElektraReady(false);
    setElektraInput('');
    setElektraHotelInput('');
    setElektraStatus('idle');
    if (sbReady) {
      const sb = getSupabase();
      if (sb) {
        try {
          await sb.from('app_settings').delete().in('key', ['elektra_token','elektra_hotel','elektra_worker']);
        } catch (e) {}
      }
    }
  };

  // Elektra'dan doluluk + ciro verisi çek ve RevenueOS'a yaz
  const syncFromElektra = async () => {
    const workerUrl = getElektraWorkerUrl();
    if (!workerUrl) return; // Worker URL yoksa çıkış
    setElektraSyncing(true);
    setElektraStatus('testing');
    try {
      const year = new Date().getFullYear();

      let res, data;

      // Her zaman Cloudflare Worker üzerinden
      const q = new URLSearchParams({
        action: 'monthly_stats',
        year,
        ...(elektraHotelId ? { hotel: elektraHotelId } : {}),
      });
      res = await fetch(`${workerUrl}?${q}`);
      data = await res.json();
      if (!res.ok || !data.ok) {
        setElektraStatus(res.status === 401 ? 'error_auth' : 'error');
        setElektraSyncing(false);
        return;
      }
      // Worker { ok, endpoint, months } formatında dönüyor
      // Elektra verisini RevenueOS formatına çevir — gelmeyenler 0
      const rows = data?.months || data?.data?.months || data?.result || [];
      if (rows.length > 0) {
        const mapped = MS.map((m, i) => {
          const row = rows.find(r => r.month === i + 1 || r.monthIndex === i);
          const existing = monthly[i];
          if (!row) return { ...existing, m, g: 0, o: 0, a: 0 };
          return {
            ...existing,
            m,
            g: row.revenue   != null ? row.revenue   : 0,
            o: row.occupancy != null ? row.occupancy : 0,
            a: row.adr       != null ? row.adr       : 0,
          };
        });
        setMonthlySync(mapped);
        const now = new Date().toLocaleString('tr-TR');
        setElektraLastSync(now);
        localStorage.setItem('rv_elektra_last_sync', now);
        // Dashboard'u güncelle
        const curYear = new Date().getFullYear();
        const workerRows = data?.months || [];
        setElektraMonthsCache(prev => ({ ...prev, [curYear]: workerRows }));
        try {
          const stored = JSON.parse(localStorage.getItem('rv_elektra_year_data') || '{}');
          stored[curYear] = workerRows;
          localStorage.setItem('rv_elektra_year_data', JSON.stringify(stored));
        } catch {}
        setElektraStatus('ok');
      } else {
        setElektraStatus('empty');
      }
    } catch (e) {
      console.error('Elektra sync error:', e);
      setElektraStatus('cors');
    }
    setElektraSyncing(false);
  };

  const saveToDB = async (opts = {}) => {
    const sb = getSupabase(); if (!sb) return;
    setDbSync(true);
    try {
      const m = opts.monthly ?? monthly, a = opts.ac ?? ac, occ = opts.simOcc ?? simOcc, adr = opts.simAdr ?? simAdr;
      if (opts.monthly !== undefined || opts.forceAll) await sb.from('monthly_targets').upsert(m.map((row, i) => ({ month_index: i, month_name: row.m, target: row.h, actual: row.g || null, occ_target: row.o || null, adr_target: row.a || null })), { onConflict: 'month_index' });
      if (opts.simOcc !== undefined || opts.simAdr !== undefined || opts.forceAll) await sb.from('app_settings').upsert([{ key: 'sim_occ', value: String(occ) }, { key: 'sim_adr', value: String(adr) }], { onConflict: 'key' });
    } catch (e) { console.error('DB save error:', e); }
    setDbSync(false);
  };

  const testConnection = async () => {
    const url = sbCfg.url.trim(), key = sbCfg.key.trim();
    if (!url || !key) { setSbStatus('error'); return; }
    setSbStatus('connecting');
    try {
      const cleanUrl = url.trim().replace(/\/+$/, '');
      if (!cleanUrl.includes('.supabase.co')) { setSbStatus('error'); return; }
      localStorage.setItem('sb_url', cleanUrl); localStorage.setItem('sb_key', key.trim());
      resetSupabaseClient();
      const client = getSupabase();
      const { error } = await client.from('monthly_targets').select('month_index').limit(1);
      if (error && error.code !== 'PGRST116') { setSbStatus('error'); localStorage.removeItem('sb_url'); localStorage.removeItem('sb_key'); resetSupabaseClient(); return; }
      setSbReady(true); setSbStatus('ok'); setSbModal(false); setSettingsModal(false);
      const { data: existing } = await client.from('monthly_targets').select('month_index').limit(1);
      if (!existing || existing.length === 0) setTimeout(() => saveToDB({ forceAll: true }), 500);
      else loadFromDB();
      loadSettings();
    } catch (e) { setSbStatus('error'); }
  };

  const disconnectDB = () => {
    localStorage.removeItem('sb_url'); localStorage.removeItem('sb_key');
    resetSupabaseClient(); setSbReady(false); setSbStatus('idle');
    setSbCfg({ url: '', key: '' }); setGroqKey(''); setGroqSaved(false);
    setMonthly(DEFM); setAc(DEFC);
  };

  const initialLoadDone = React.useRef(false);
  useEffect(() => { if (sbReady && !initialLoadDone.current) { initialLoadDone.current = true; loadFromDB(); loadSettings(); loadUsers(); } }, [sbReady]);

  // Elektra: kullanıcı giriş yapınca token varsa otomatik sync teklif et (sessiz — hata göstermez)
  const elektraAutoSyncDone = React.useRef(false);
  useEffect(() => {
    const workerUrl = getElektraWorkerUrl();
    if (user && workerUrl && !elektraAutoSyncDone.current) {
      elektraAutoSyncDone.current = true;
      syncFromElektra().catch(() => {});
    }
  }, [user]);

  const setMonthlySync = useCallback((v) => { setMonthly(v); if (sbReady) saveToDB({ monthly: v }); }, [sbReady]);
  const setAcSync = useCallback((v) => { setAc(v); if (sbReady) saveToDB({ ac: v }); }, [sbReady]);
  const setSimOccSync = useCallback((v) => { setSimOcc(v); }, []);
  const setSimAdrSync = useCallback((v) => { setSimAdr(v); }, []);
  const saveSimToDB = useCallback(async (occ, adr) => {
    setSimOcc(occ); setSimAdr(adr);
    if (!sbReady) return;
    const sb = getSupabase(); if (!sb) return;
    setDbSync(true);
    try { await sb.from('app_settings').upsert([{ key: 'sim_occ', value: String(occ) }, { key: 'sim_adr', value: String(adr) }], { onConflict: 'key' }); } catch (e) {}
    setDbSync(false);
  }, [sbReady]);

  const addAcente = useCallback(async (form) => {
    const tmpId = Date.now();
    const newItem = { id: tmpId, ad: form.ad.trim(), tip: form.tip, kom: +form.kom, hedef: +form.hedef * 1000, ind: +form.ind, ciro: 0, ay: Array(12).fill(Math.round(+form.hedef * 1000 / 12)) };
    setAc(prev => [...prev, newItem]);
    const _ready = !!getSupabase(); if (!_ready) return;
    const sb = getSupabase(); if (!sb) return;
    setDbSync(true);
    try {
      const { data: saved, error } = await sb.from('agencies').insert({ name: newItem.ad, type: newItem.tip, commission: newItem.kom, annual_target: newItem.hedef, actual_revenue: 0, discount: newItem.ind }).select().single();
      if (error) setAc(prev => prev.filter(a => a.id !== tmpId));
      else if (saved) { await sb.from('agency_monthly').insert(newItem.ay.map((t, i) => ({ agency_id: saved.id, month_index: i, target: t }))); setAc(prev => prev.map(a => a.id === tmpId ? { ...a, id: saved.id } : a)); }
    } catch (e) { setAc(prev => prev.filter(a => a.id !== tmpId)); }
    setDbSync(false);
  }, [sbReady]);

  const deleteAcente = useCallback(async (id) => {
    setAc(prev => {
      const item = prev.find(a => a.id === id);
      const _ready = !!getSupabase();
      if (_ready && item) { const sb = getSupabase(); if (sb) { setDbSync(true); sb.from('agencies').delete().eq('name', item.ad).then(() => setDbSync(false)); } }
      return prev.filter(a => a.id !== id);
    });
  }, [sbReady]);

  if (!user) return <Login onLogin={u => { setUser(u); localStorage.setItem('rv_user', JSON.stringify(u)); setTab('dash'); }} allUsers={users} />;

  // ── SIDEBAR NAV ──
  const NAV = [
    {
      section: 'Ana', items: [
        { id: 'dash', l: 'Dashboard', icon: '📊', ok: 1 },
      ]
    },
    {
      section: 'Satış', items: [
        { id: 'acente', l: 'Acenteler', icon: '🏢', ok: user.p.acente },
        { id: 'satis', l: 'Satış', icon: '🎯', ok: user.p.acente },
        { id: 'proj', l: 'Projeksiyon', icon: '📈', ok: user.p.proj },
      ]
    },
    {
      section: 'Analiz', items: [
        { id: 'analiz', l: 'Veri Analizi', icon: '🔬', ok: user.p.proj },
        { id: 'zeka', l: 'Zeka Merkezi', icon: '🧠', ok: user.p.proj },
        { id: 'raporlama', l: 'Raporlama', icon: '📋', ok: user.p.ciro },
      ]
    },
    {
      section: 'Operasyon', items: [
        { id: 'operasyon', l: 'Takvim & Ops', icon: '🏨', ok: user.p.proj },
        { id: 'bildirim', l: 'Bildirim', icon: '🔔', ok: 1 },
      ]
    },
    {
      section: 'Yönetim', items: [
        { id: 'editor', l: 'Hedef Editörü', icon: '🎯', ok: 1 },
        { id: 'ai', l: 'AI Asistan', icon: '🤖', ok: user.p.ai },
        { id: 'users', l: 'Kullanıcılar', icon: '👥', ok: user.p.admin },
      ]
    },
  ];

  const hT = monthly.reduce((a, b) => a + b.h, 0);
  const gT2 = monthly.filter(m => m.g != null).reduce((a, b) => a + b.g, 0);
  const pct2 = hT > 0 ? gT2 / hT * 100 : 0;
  const critCount = (pct2 < 70 ? 1 : 0) + ac.filter(a => a.ciro / a.hedef * 100 < 50).length;
  const activeLabel = NAV.flatMap(g => g.items).find(it => it.id === tab)?.l || 'Dashboard';

  return (
    <div className="app-shell" onClick={() => setSidebarOpen(false)}>

      {/* ── SIDEBAR ── */}
      {sidebarOpen && <div className={`sidebar-overlay${sidebarOpen?' open':''}`} onClick={()=>setSidebarOpen(false)}/>}
      <div className={`sidebar${sidebarOpen ? ' open' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="sidebar-logo">
          <div className="wordmark">Revenue<em>OS</em></div>
          <span className="v-badge">v3</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
          {NAV.map((group, gi) => (
            <div key={gi}>
              <div className="nav-section">
                <div className="nav-section-label">{group.section}</div>
              </div>
              <div style={{ padding: '0 6px' }}>
                {group.items.filter(it => it.ok).map(it => {
                  const crit = it.id === 'bildirim' ? critCount : 0;
                  return (
                    <button key={it.id}
                      className={`nav-item${tab === it.id ? ' active' : ''}`}
                      onClick={() => { setTab(it.id); setSidebarOpen(false); }}>
                      <span className="nav-icon">{it.icon}</span>
                      <span>{it.l}</span>
                      {crit > 0 && <span className="nav-badge">{crit}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar" style={{ background: user.color + '22', color: user.color }}>{user.av}</div>
            <div className="user-info">
              <div className="uname">{user.name}</div>
              <div className="urole">{RI[user.role]} {user.role}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
            <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => setThemeModal(p => !p)} title="Tema">🎨</button>
            <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => setSettingsModal(true)} title="Ayarlar">⚙</button>
            <button className="btn btn-sm btn-danger" style={{ flex: 1 }}
              onClick={() => { setUser(null); localStorage.removeItem('rv_user'); }} title="Çıkış">↗</button>
          </div>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div className="main-area">
        {/* Topbar */}
        <div className="topbar">
          <button className="menu-toggle" onClick={e => { e.stopPropagation(); setSidebarOpen(p => !p); }}>☰</button>
          <span className="page-title">{activeLabel}</span>
          <div className="topbar-right">
            {dbSync && <div className="topbar-pill"><div className="live-dot" />Senkronize ediliyor</div>}
            <div className="topbar-pill" style={{ cursor: 'default' }}>
              <div className="live-dot" /><span>CANLI</span>
            </div>
            <div className="topbar-pill" style={{ cursor: 'default' }}>
              <span style={{ color: 'var(--gold)', fontWeight: 700 }}>€{(hT / 1e6).toFixed(1)}M</span>
              <span style={{ color: 'var(--text3)' }}>Hedef</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="page-content">
          {tab === 'dash' && <Dashboard user={user} monthly={monthly} simOcc={simOcc} setSimOcc={setSimOccSync} simAdr={simAdr} setSimAdr={setSimAdrSync} saveSimToDB={saveSimToDB} elektraReady={elektraReady} elektraStatus={elektraStatus} elektraLastSync={elektraLastSync} elektraSyncing={elektraSyncing} onElektraSync={syncFromElektra} elektraWorkerUrl={getElektraWorkerUrl()} elektraMonthsCache={elektraMonthsCache} />}
          {tab === 'acente' && <Acente user={user} ac={ac} setAc={setAcSync} />}
          {tab === 'proj' && <Projeksiyon simOcc={simOcc} simAdr={simAdr} monthly={monthly} />}
          {tab === 'analiz' && <Analiz monthly={monthly} ac={ac} simOcc={simOcc} simAdr={simAdr} />}
          {tab === 'satis' && <Satis user={user} ac={ac} monthly={monthly} simOcc={simOcc} simAdr={simAdr} />}
          {tab === 'operasyon' && <Operasyonel user={user} monthly={monthly} simOcc={simOcc} simAdr={simAdr} />}
          {tab === 'bildirim' && <Bildirim user={user} monthly={monthly} ac={ac} simOcc={simOcc} simAdr={simAdr} />}
          {tab === 'raporlama' && <Raporlama user={user} monthly={monthly} ac={ac} simOcc={simOcc} simAdr={simAdr} />}
          {tab === 'zeka' && <ZekaMerkezi user={user} monthly={monthly} ac={ac} simOcc={simOcc} simAdr={simAdr} setSimAdr={setSimAdrSync} setSimOcc={setSimOccSync} />}
          {tab === 'editor' && <HedefEditor user={user} monthly={monthly} setMonthly={setMonthlySync} ac={ac} setAc={setAcSync} />}
          {tab === 'ai' && <AIAsistan user={user} monthly={monthly} ac={ac} simOcc={simOcc} simAdr={simAdr} groqKey={groqKey} />}
          {tab === 'users' && <KullaniciYonetimi user={user} users={users} saveUser={saveUser} deleteUser={deleteUser} sbReady={sbReady} />}
        </div>
      </div>

      {/* ── TEMA MODAL ── */}
      {themeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 400 }} onClick={() => setThemeModal(false)}>
          <div style={{ position: 'fixed', bottom: 80, left: 16, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, padding: 12, boxShadow: 'var(--shadow-lg)', minWidth: 200, zIndex: 500 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.08em' }}>Tema Seç</div>
            {Object.keys(THEMES).map(name => (
              <button key={name}
                onClick={() => { setTheme(name); applyTheme(name); setThemeModal(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', marginBottom: 2, background: theme === name ? 'rgba(255,255,255,0.06)' : 'transparent', border: `1px solid ${theme === name ? 'var(--gold)' : 'transparent'}`, borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ display: 'flex', gap: 3 }}>
                  {['--gold', '--teal', '--blue', '--rose'].map(v => (
                    <div key={v} style={{ width: 8, height: 8, borderRadius: '50%', background: THEMES[name][v] || '#888' }} />
                  ))}
                </div>
                <span style={{ fontSize: 12, color: theme === name ? 'var(--gold)' : 'var(--text)', fontWeight: theme === name ? 600 : 400 }}>{name}</span>
                {theme === name && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--gold)' }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── AYARLAR MODAL ── */}
      {settingsModal && (
        <div className="overlay" onClick={() => setSettingsModal(false)}>
          <div className="modal" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSettingsModal(false)}
              style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20 }}>×</button>
            <div className="modal-title">⚙ Ayarlar</div>
            <div className="modal-sub">Supabase, Groq API ve entegrasyonlar</div>

            {/* Supabase */}
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>🗄 Supabase</div>
                <span className={`badge ${sbReady ? 'badge-green' : 'badge-red'}`}>{sbReady ? 'Bağlı' : 'Bağlı Değil'}</span>
              </div>
              {sbReady ? (
                <div>
                  <div className="notif notif-success" style={{ marginBottom: 10 }}>Bağlantı aktif. Veriler bulutta saklanıyor.</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm" style={{ flex: 1 }} onClick={loadFromDB} disabled={dbSync}>{dbSync ? '⏳' : '🔄 Yenile'}</button>
                    <button className="btn btn-sm btn-danger" style={{ flex: 1 }} onClick={disconnectDB}>Bağlantıyı Kes</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="field"><label>Project URL</label><input className="inp" value={sbCfg.url} onChange={e => setSbCfg({ ...sbCfg, url: e.target.value })} placeholder="https://xxx.supabase.co" style={{ fontSize: 12, fontFamily: 'var(--mono)' }} /></div>
                  <div className="field"><label>Anon Key</label><input className="inp" type="password" value={sbCfg.key} onChange={e => setSbCfg({ ...sbCfg, key: e.target.value })} placeholder="eyJhbGci..." style={{ fontSize: 12, fontFamily: 'var(--mono)' }} /></div>
                  {sbStatus === 'error' && <div className="notif notif-error" style={{ marginBottom: 8 }}>❌ Bağlantı hatası. Bilgileri kontrol edin.</div>}
                  <button className="btn btn-primary btn-full" onClick={testConnection} disabled={!sbCfg.url || !sbCfg.key || sbStatus === 'connecting'}>
                    {sbStatus === 'connecting' ? '⏳ Bağlanıyor…' : 'Bağlan'}
                  </button>
                </div>
              )}
            </div>

            {/* Groq */}
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>🤖 Groq API</div>
                <span className={`badge ${groqSaved ? 'badge-green' : 'badge-red'}`}>{groqSaved ? 'Aktif' : 'Bağlı Değil'}</span>
              </div>
              {groqSaved ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>gsk_•••••••••••••••••</div>
                  <button className="btn btn-sm btn-danger" onClick={deleteGroqKey} disabled={!sbReady}>Sil</button>
                </div>
              ) : (
                <div>
                  <div className="field">
                    <label>API Key — <a href="https://console.groq.com/keys" target="_blank" style={{ color: 'var(--gold)', textDecoration: 'none' }}>console.groq.com ↗</a></label>
                    <input className="inp" type="password" value={groqKeyInput} onChange={e => setGroqKeyInput(e.target.value)} placeholder="gsk_..." style={{ fontSize: 12, fontFamily: 'var(--mono)' }} />
                  </div>
                  {!sbReady && <div className="notif notif-warn" style={{ marginBottom: 8 }}>Önce Supabase bağlantısı gerekli.</div>}
                  <button className="btn btn-primary btn-full" onClick={() => saveGroqKey(groqKeyInput.trim())} disabled={!groqKeyInput.trim() || !sbReady}>Kaydet</button>
                </div>
              )}
            </div>


            {/* ── ELEKTRA WEB PMS ── */}
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, background: 'rgba(245,166,35,0.15)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>⚡</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Elektra Web PMS</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>Doluluk · Ciro · ADR · Otomatik Sync</div>
                  </div>
                </div>
                <span className={`badge ${elektraReady ? 'badge-green' : 'badge-red'}`}>
                  {elektraReady ? 'Bağlı' : 'Bağlı Değil'}
                </span>
              </div>

              {elektraReady ? (
                <div>
                  {/* Bağlı durumu */}
                  <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>⚡</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--teal)' }}>Token aktif</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 2 }}>
                        {elektraToken.substring(0, 20)}•••
                        {elektraHotelId && <span style={{ marginLeft: 8, color: 'var(--text3)' }}>Otel ID: {elektraHotelId}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Sync durumu */}
                  {elektraStatus === 'ok' && (
                    <div className="notif notif-success" style={{ marginBottom: 10 }}>
                      ✅ Veriler başarıyla çekildi. Dashboard güncellendi.
                      {elektraLastSync && <div style={{ fontSize: 10, opacity: .7, marginTop: 3 }}>Son sync: {elektraLastSync}</div>}
                    </div>
                  )}
                  {elektraStatus === 'empty' && (
                    <div className="notif notif-warn" style={{ marginBottom: 10 }}>
                      ⚠ Bağlantı başarılı ama veri gelmedi. Elektra'da yıl verisi olduğunu kontrol edin.
                    </div>
                  )}
                  {elektraStatus === 'error' && (
                    <div className="notif notif-error" style={{ marginBottom: 10 }}>
                      ❌ Veri çekme hatası. Token veya Otel ID kontrol edin.
                    </div>
                  )}
                  {elektraStatus === 'error_auth' && (
                    <div className="notif notif-error" style={{ marginBottom: 10 }}>
                      🔒 Kimlik doğrulama hatası. Token geçersiz veya süresi dolmuş.
                    </div>
                  )}
                  {elektraStatus === 'cors' && (
                    <div>
                      <div className="notif notif-warn" style={{ marginBottom: 8 }}>
                        ⚠ CORS hatası — Worker URL'si girilmeli.
                      </div>
                      <div className="field">
                        <label>Cloudflare Worker URL</label>
                        <input className="inp"
                          defaultValue={localStorage.getItem('rv_elektra_worker') || ''}
                          onChange={async e => {
                            const v = e.target.value.trim();
                            localStorage.setItem('rv_elektra_worker', v);
                            if (sbReady && v) {
                              const sb = getSupabase();
                              if (sb) try { await sb.from('app_settings').upsert({ key: 'elektra_worker', value: v }, { onConflict: 'key' }); } catch {}
                            }
                          }}
                          placeholder="https://elektra-proxy.KULLANICI.workers.dev"
                          style={{ fontSize: 11, fontFamily: 'var(--mono)' }} />
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4, lineHeight: 1.6 }}>
                          Ayarlar indirilebilir <code style={{ fontFamily: 'var(--mono)', background: 'var(--bg2)', padding: '1px 4px', borderRadius: 3 }}>elektra-worker.js</code> dosyasını Cloudflare Workers'a yükleyin.
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm btn-primary" style={{ flex: 2 }}
                      onClick={syncFromElektra} disabled={elektraSyncing}>
                      {elektraSyncing ? '⏳ Senkronize ediliyor…' : '🔄 Veriyi Güncelle'}
                    </button>
                    <button className="btn btn-sm btn-danger" style={{ flex: 1 }}
                      onClick={removeElektraConfig}>
                      Bağlantıyı Kes
                    </button>
                  </div>

                  <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>Otomatik Sync</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.7 }}>
                      Dashboard her açıldığında otomatik güncel veri çekilmez.
                      "Veriyi Güncelle" butonuna basınca anlık sync yapılır.
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 12, padding: '8px 10px', background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>📋 Nasıl alırsınız?</div>
                    <div>1. Elektraweb'i arayın: <span style={{ fontFamily: 'var(--mono)', color: 'var(--gold)' }}>0850 777 0444</span></div>
                    <div>2. "API entegrasyonu için JWT token almak istiyorum" deyin</div>
                    <div>3. Token ve Otel ID'nizi buraya girin</div>
                  </div>

                  <div className="field">
                    <label>JWT Token <span style={{ color: 'var(--red)', fontWeight: 600 }}>*</span></label>
                    <input
                      className="inp"
                      type="password"
                      value={elektraInput}
                      onChange={e => setElektraInput(e.target.value)}
                      placeholder="eyJhbGci… (Elektraweb'den alınan token)"
                      style={{ fontSize: 11, fontFamily: 'var(--mono)' }}
                    />
                  </div>
                  <div className="field">
                    <label>Otel ID <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400 }}>(isteğe bağlı — çok otelli hesaplar için)</span></label>
                    <input
                      className="inp"
                      type="text"
                      value={elektraHotelInput}
                      onChange={e => setElektraHotelInput(e.target.value)}
                      placeholder="örn: 1234"
                      style={{ fontSize: 12, fontFamily: 'var(--mono)' }}
                    />
                  </div>

                  <button
                    className="btn btn-primary btn-full"
                    onClick={saveElektraConfig}
                    disabled={!elektraInput.trim()}>
                    Kaydet & Bağlan
                  </button>
                </div>
              )}
            </div>

            <button className="btn btn-full" style={{ marginTop: 8 }} onClick={() => setSettingsModal(false)}>Kapat</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
