import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SUPABASE_URL, SUPABASE_KEY } from './config';
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

function App(){
  const [user,setUser]=useState(()=>{try{const u=localStorage.getItem('rv_user');return u?JSON.parse(u):null;}catch{return null;}});
  const [tab,setTab]=useState('dash');
  const [theme,setTheme]=useState(()=>localStorage.getItem('rv_theme')||'Koyu Okyanus');
  const [themeModal,setThemeModal]=useState(false);
  useEffect(()=>{ applyTheme(theme); },[theme]);
  useEffect(()=>{
    const close=()=>setNavOpen(null);
    document.addEventListener('click',close);
    return()=>document.removeEventListener('click',close);
  },[]);
  const [simOcc,setSimOcc]=useState(85);
  const [simAdr,setSimAdr]=useState(225);
  const [monthly,setMonthly]=useState(DEFM);
  const [ac,setAc]=useState(DEFC);
  const [sbCfg,setSbCfg]=useState({url:(SUPABASE_URL&&SUPABASE_URL.trim())||localStorage.getItem('sb_url')||'',key:(SUPABASE_KEY&&SUPABASE_KEY.trim())||localStorage.getItem('sb_key')||''});
  const [sbReady,setSbReady]=useState(!!(  (SUPABASE_URL&&SUPABASE_URL.trim()) || localStorage.getItem('sb_url')  ) && !!( (SUPABASE_KEY&&SUPABASE_KEY.trim()) || localStorage.getItem('sb_key') ));
  const [sbStatus,setSbStatus]=useState('idle'); // idle | connecting | ok | error
  const [sbModal,setSbModal]=useState(false);
  const [settingsModal,setSettingsModal]=useState(false);
  const [groqKey,setGroqKey]=useState('');
  const [groqSaved,setGroqSaved]=useState(false);
  const [groqKeyInput,setGroqKeyInput]=useState('');
  const [dbSync,setDbSync]=useState(false);
  const [users,setUsers]=useState(()=>{
    try{
      const saved=localStorage.getItem('rv_users');
      if(saved){ const parsed=JSON.parse(saved); if(parsed&&parsed.length>0) return parsed; }
    }catch(e){}
    return USERS;
  });
  const [userModal,setUserModal]=useState(false);
  const [navOpen,setNavOpen]=useState(null); // hangi grup dropdown açık

  // Supabaseden veri yükle
  const loadFromDB = async () => {
    const sb=getSupabase(); if(!sb)return;
    setDbSync(true);
    try{
      const [{data:mData},{data:aData}]=await Promise.all([
        sb.from('monthly_targets').select('*').order('month_index'),
        sb.from('agencies').select('*,agency_monthly(month_index,target)')
      ]);
      if(mData&&mData.length>0){
        const mapped=mData.map(r=>({
          m:MS[r.month_index], g:r.actual||null,
          h:r.target, o:r.occ_target||null, a:r.adr_target||null
        }));
        setMonthly(mapped);
      }
      if(aData&&aData.length>0){
        const mapped=aData.map(r=>({
          id:r.id, ad:r.name, tip:r.type, kom:r.commission,
          hedef:r.annual_target, ciro:r.actual_revenue||0, ind:r.discount||0,
          ay: Array(12).fill(0).map((_,i)=>{
            const m=r.agency_monthly?.find(x=>x.month_index===i);
            return m?m.target:Math.round(r.annual_target/12);
          })
        }));
        setAc(mapped);
      }
    }catch(e){console.error('DB load error:',e);}
    setDbSync(false);
  };

  // Supabaseden ayarları yükle (Groq key + sim parametreleri)
  const loadSettings = async () => {
    const sb=getSupabase(); if(!sb)return;
    try{
      const {data}=await sb.from('app_settings').select('key,value');
      if(data){
        const gk=data.find(r=>r.key==='groq_api_key');
        if(gk){setGroqKey(gk.value);setGroqSaved(true);}
        const occ=data.find(r=>r.key==='sim_occ');
        if(occ){setSimOcc(+occ.value);}
        const adr=data.find(r=>r.key==='sim_adr');
        if(adr){setSimAdr(+adr.value);}
      }
    }catch(e){console.error('Settings load error:',e);}
  };

  // Kullanıcıları DB'den yükle
  const loadUsers = async () => {
    const sb=getSupabase(); if(!sb)return;
    try{
      const {data,error}=await sb.from('app_users').select('*');
      if(error||!data||data.length===0)return;
      const mapped=data.map(u=>({
        id:u.uid, name:u.name, email:u.email, pass:u.pass,
        role:u.role, av:u.av||u.name.substring(0,2).toUpperCase(),
        color:u.color||'#f0b429',
        p:{dash:u.p_dash,acente:u.p_acente,proj:u.p_proj,editor:u.p_editor,
           ai:u.p_ai,hedef:u.p_hedef,ciro:u.p_ciro,kom:u.p_kom,
           admin:u.p_admin,addac:u.p_addac}
      }));
      setUsers(mapped);
      // Logged-in user'ı güncelle
      saveUsersLocal(mapped);
      setUser(prev=>{
        if(!prev)return prev;
        const updated=mapped.find(u=>u.id===prev.id||u.email===prev.email);
        if(updated){localStorage.setItem('rv_user',JSON.stringify(updated));return updated;}
        return prev;
      });
    }catch(e){console.error('Load users error:',e);}
  };

  // Kullanicilar LocalStorage'a kaydet (Supabase yoksa fallback)
  const saveUsersLocal = (list) => {
    try{ localStorage.setItem('rv_users', JSON.stringify(list)); }catch(e){}
  };

  const saveUser = async (u) => {
    const normalizedU = {
      ...u,
      av: u.av||u.name.substring(0,2).toUpperCase().replace(' ',''),
      color: u.color||'#f0b429',
    };
    // Her zaman local state guncelle
    setUsers(prev => {
      const exists = prev.find(x=>x.id===normalizedU.id);
      const next = exists
        ? prev.map(x=>x.id===normalizedU.id ? normalizedU : x)
        : [...prev, normalizedU];
      saveUsersLocal(next);
      return next;
    });
    // Supabase varsa DB'ye de yaz
    if(sbReady){
      const sb=getSupabase();
      try{
        const row={
          uid:normalizedU.id, name:normalizedU.name, email:normalizedU.email, pass:normalizedU.pass,
          role:normalizedU.role, av:normalizedU.av, color:normalizedU.color,
          p_dash:normalizedU.p.dash?1:0, p_acente:normalizedU.p.acente?1:0, p_proj:normalizedU.p.proj?1:0,
          p_editor:normalizedU.p.editor?1:0, p_ai:normalizedU.p.ai?1:0, p_hedef:normalizedU.p.hedef?1:0,
          p_ciro:normalizedU.p.ciro?1:0, p_kom:normalizedU.p.kom?1:0, p_admin:normalizedU.p.admin?1:0,
          p_addac:normalizedU.p.addac?1:0
        };
        const {error}=await sb.from('app_users').upsert(row,{onConflict:'uid'});
        if(error) console.error('Supabase save user error:',error);
      }catch(e){ console.error('Supabase save user error:',e); }
    }
    return true;
  };

  const deleteUser = async (uid) => {
    // Her zaman local state ve localStorage'dan sil
    setUsers(prev => {
      const next = prev.filter(u=>u.id!==uid);
      saveUsersLocal(next);
      return next;
    });
    // Supabase varsa DB'den de sil
    if(sbReady){
      const sb=getSupabase();
      try{ await sb.from('app_users').delete().eq('uid',uid); }
      catch(e){ console.error('Supabase delete user error:',e); }
    }
  };

  const initUsersInDB = async () => {
    const sb=getSupabase(); if(!sb)return;
    const {data}=await sb.from('app_users').select('uid').limit(1);
    if(!data||data.length===0){
      for(const u of USERS){ await saveUser(u); }
    }
  };

  // Groq key'i Supabase'e kaydet
  const saveGroqKey = async (k) => {
    const sb=getSupabase();
    if(!sb){ console.warn('No Supabase'); return; }
    try{
      const {error}=await sb.from('app_settings').upsert({key:'groq_api_key',value:k.trim()},{onConflict:'key'});
      if(error){console.error('Groq key save error:',error);return;}
      setGroqKey(k.trim()); setGroqSaved(true); setGroqKeyInput('');
    }catch(e){console.error('Settings save error:',e);}
  };

  // Groq key'i sil
  const deleteGroqKey = async () => {
    const sb=getSupabase(); if(!sb)return;
    try{
      await sb.from('app_settings').delete().eq('key','groq_api_key');
      setGroqKey(''); setGroqSaved(false);
    }catch(e){console.error('Settings delete error:',e);}
  };

  // Supabase'e veri kaydet
  const saveToDB = async (opts={}) => {
    const sb=getSupabase(); if(!sb)return;
    setDbSync(true);
    try{
      const m = opts.monthly ?? monthly;
      const a = opts.ac ?? ac;
      const occ = opts.simOcc ?? simOcc;
      const adr = opts.simAdr ?? simAdr;

      // Aylık hedefler
      if(opts.monthly !== undefined || opts.forceAll){
        const mRows=m.map((row,i)=>({
          month_index:i, month_name:row.m,
          target:row.h, actual:row.g||null,
          occ_target:row.o||null, adr_target:row.a||null
        }));
        await sb.from('monthly_targets').upsert(mRows,{onConflict:'month_index'});
      }

      // Acenteler
      if(opts.ac !== undefined || opts.forceAll){
        const aRows=a.map(ag=>({
          id:typeof ag.id==='number'&&ag.id<100000?ag.id:undefined,
          name:ag.ad, type:ag.tip, commission:ag.kom,
          annual_target:ag.hedef, actual_revenue:ag.ciro, discount:ag.ind
        }));
        const {data:savedAc}=await sb.from('agencies').upsert(aRows,{onConflict:'name'}).select();
        if(savedAc){
          const ayRows=savedAc.flatMap(sa=>{
            const orig=a.find(ag=>ag.ad===sa.name);
            return orig?orig.ay.map((t,i)=>({agency_id:sa.id,month_index:i,target:t})):[];
          });
          if(ayRows.length>0)
            await sb.from('agency_monthly').upsert(ayRows,{onConflict:'agency_id,month_index'});
        }
      }

      // Simülasyon parametreleri + diğer ayarlar
      if(opts.simOcc !== undefined || opts.simAdr !== undefined || opts.forceAll){
        await sb.from('app_settings').upsert([
          {key:'sim_occ', value:String(occ)},
          {key:'sim_adr', value:String(adr)},
        ],{onConflict:'key'});
      }

    }catch(e){console.error('DB save error:',e);}
    setDbSync(false);
  };

  // Bağlantı test et
  const testConnection = async () => {
    const url=sbCfg.url.trim(); const key=sbCfg.key.trim();
    if(!url||!key){setSbStatus('error');return;}
    setSbStatus('connecting');
    try{
      // URL formatını doğrula
      const cleanUrl = url.trim().replace(/\/+$/,'');
      if(!cleanUrl.includes('.supabase.co')){
        setSbStatus('error'); return;
      }
      localStorage.setItem('sb_url', cleanUrl);
      localStorage.setItem('sb_key', key.trim());
      resetSupabaseClient(); // Singleton'ı sıfırla
      const client = getSupabase();
      const {error}=await client.from('monthly_targets').select('month_index').limit(1);
      if(error && error.code!=='PGRST116'){
        setSbStatus('error');
        localStorage.removeItem('sb_url'); localStorage.removeItem('sb_key');
        resetSupabaseClient();
        return;
      }
      setSbReady(true); setSbStatus('ok'); setSbModal(false);
      const {data:existing}=await client.from('monthly_targets').select('month_index').limit(1);
      if(!existing||existing.length===0){
        // DB boş — mevcut lokal veriyi yükle
        setTimeout(()=>saveToDB({forceAll:true}),500);
      } else {
        loadFromDB();
      }
      loadSettings();
    }catch(e){ setSbStatus('error'); }
  };

  const disconnectDB = () => {
    localStorage.removeItem('sb_url'); localStorage.removeItem('sb_key');
    resetSupabaseClient();
    setSbReady(false); setSbStatus('idle');
    setSbCfg({url:'',key:''});
    setGroqKey(''); setGroqSaved(false);
    setMonthly(DEFM); setAc(DEFC);
  };

  // Sadece sayfa ilk açıldığında yükle — değişiklikler ezilmesin
  const initialLoadDone = React.useRef(false);
  useEffect(()=>{
    if(sbReady && !initialLoadDone.current){
      initialLoadDone.current = true;
      loadFromDB();
      loadSettings();
      loadUsers();
    }
  },[sbReady]);

  // setMonthly ve setAc'yi sarmala — DB varsa otomatik sync
  const setMonthlySync = useCallback((v) => { setMonthly(v); if(sbReady)saveToDB({monthly:v}); },[sbReady]);
  const setAcSync = useCallback((v) => { setAc(v); if(sbReady)saveToDB({ac:v}); },[sbReady]);

  const setSimOccSync = useCallback((v) => { setSimOcc(v); },[]);
  const setSimAdrSync = useCallback((v) => { setSimAdr(v); },[]);
  const saveSimToDB = useCallback(async(occ,adr) => {
    setSimOcc(occ); setSimAdr(adr);
    if(!sbReady) return;
    const sb=getSupabase(); if(!sb) return;
    setDbSync(true);
    try{
      await sb.from('app_settings').upsert([
        {key:'sim_occ',value:String(occ)},
        {key:'sim_adr',value:String(adr)},
      ],{onConflict:'key'});
    }catch(e){console.error('Sim save error:',e);}
    setDbSync(false);
  },[sbReady]);

  // Acente ekle — state + DB
  const addAcente = useCallback(async (form) => {
    const tmpId = Date.now();
    const newItem = {
      id:tmpId, ad:form.ad.trim(), tip:form.tip,
      kom:+form.kom, hedef:+form.hedef*1000,
      ind:+form.ind, ciro:0,
      ay:Array(12).fill(Math.round(+form.hedef*1000/12))
    };
    // Önce UI'ı güncelle
    setAc(prev=>[...prev,newItem]);
    // Sonra DBye yaz — sbReady closure yerine localStorageden kontrol
    const _ready = !!getSupabase();
    if(!_ready) return;
    const sb=getSupabase();
    if(!sb) return;
    setDbSync(true);
    try{
      const {data:saved,error}=await sb.from('agencies').insert({
        name:newItem.ad, type:newItem.tip, commission:newItem.kom,
        annual_target:newItem.hedef, actual_revenue:0, discount:newItem.ind
      }).select().single();
      if(error){
        console.error('Add agency error:',error);
        // DBye yazılamadıysa UIdan da geri al
        setAc(prev=>prev.filter(a=>a.id!==tmpId));
      } else if(saved){
        const ayRows=newItem.ay.map((t,i)=>({agency_id:saved.id,month_index:i,target:t}));
        await sb.from('agency_monthly').insert(ayRows);
        // Geçici ID'yi gerçek DB ID'siyle değiştir
        setAc(prev=>prev.map(a=>a.id===tmpId?{...a,id:saved.id}:a));
      }
    }catch(e){
      console.error('Add agency error:',e);
      setAc(prev=>prev.filter(a=>a.id!==tmpId));
    }
    setDbSync(false);
  },[sbReady]);

  // Acente sil — state + DB
  const deleteAcente = useCallback(async (id) => {
    // Önce state'den bul (closure sorunu yaşanmasın)
    setAc(prev => {
      const item = prev.find(a=>a.id===id);
      const _ready = !!getSupabase();
      if(_ready && item){
        const sb=getSupabase();
        if(sb){
          setDbSync(true);
          sb.from('agencies').delete().eq('name', item.ad)
            .then(({error})=>{
              if(error) console.error('Delete error:',error);
              setDbSync(false);
            });
        }
      }
      return prev.filter(a=>a.id!==id);
    });
  },[sbReady]);

  if(!user)return <Login onLogin={u=>{setUser(u);localStorage.setItem('rv_user',JSON.stringify(u));setTab('dash');}} allUsers={users}/>;

  // Gruplu navigasyon yapısı
  const NAV_GROUPS=[
    {id:'genel', l:'Ana Sayfa', icon:'📊', single:true, tab:'dash', ok:1},
    {id:'satis_grup', l:'Satış & Acente', icon:'💼', ok:user.p.acente, items:[
      {id:'acente',    l:'Acenteler',       icon:'🏢', desc:'Acente ciro ve hedef takibi',  ok:user.p.acente},
      {id:'satis',     l:'Satış Araçları',  icon:'🎯', desc:'Skor kartı, kotasyon, sözleşme', ok:user.p.acente},
      {id:'proj',      l:'Projeksiyon',     icon:'📈', desc:'Senaryo ve simülasyon',       ok:user.p.proj},
    ]},
    {id:'analiz_grup', l:'Analiz & Veri', icon:'🔬', ok:user.p.proj, items:[
      {id:'analiz',    l:'Veri Analizi',    icon:'🔬', desc:'Pick-up, forecast, kanal mix, LoS', ok:user.p.proj},
      {id:'zeka',      l:'Zeka Merkezi',    icon:'🧠', desc:'Rakip fiyat, anomali, insight',    ok:user.p.proj},
      {id:'raporlama', l:'Raporlama',       icon:'📋', desc:'PDF raporlar, CSV export',          ok:user.p.ciro},
    ]},
    {id:'ops_grup', l:'Operasyon', icon:'🏨', ok:user.p.proj, items:[
      {id:'operasyon', l:'Operasyonel',     icon:'🏨', desc:'Takvim, upgrade, blackout',    ok:user.p.proj},
      {id:'bildirim',  l:'Bildirim & Takip',icon:'🔔', desc:'Alertler, görevler, log',     ok:1},
    ]},
    {id:'yonetim_grup', l:'Yönetim', icon:'⚙️', ok:1, items:[
      {id:'editor',    l:'Hedef Editörü',   icon:'🎯', desc:'Aylık hedef ve bütçe düzenleme', ok:1},
      {id:'ai',        l:'AI Asistan',      icon:'🤖', desc:'Yapay zeka analiz asistanı',     ok:user.p.ai},
      {id:'users',     l:'Kullanıcılar',    icon:'👥', desc:'Kullanıcı ve yetki yönetimi',    ok:user.p.admin},
    ]},
  ];
  // Tüm tab idleri (render için)
  const TABS=NAV_GROUPS.flatMap(g=>g.single?[{id:g.tab,ok:g.ok}]:(g.items||[]));
  const hT=monthly.reduce((a,b)=>a+b.h,0);
  const perms=[user.p.editor&&{l:'Hedef Düzenle',g:1},user.p.ciro&&{l:'Ciro Görüntüle',g:1},user.p.kom&&{l:'Komisyon Görüntüle',g:1},!user.p.admin&&{l:'Kullanıcı Yönetimi—Kısıtlı',g:0}].filter(Boolean);

  return(
    <div>
      <div className="header">
        <div className="logo">Revenue<em style={{color:'var(--gold)',fontStyle:'normal'}}>OS</em></div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div className="lpill"><div className="ldot"/>CANLI</div>
          <div style={{fontSize:11,color:'var(--text2)',fontFamily:'var(--mono)'}}>Elektra Web PMS • Demo</div>
          {dbSync&&(
            <div style={{display:'flex',alignItems:'center',gap:5,background:'rgba(240,180,41,0.1)',border:'1px solid rgba(240,180,41,0.3)',borderRadius:20,padding:'4px 10px'}}>
              <div style={{width:5,height:5,borderRadius:'50%',background:'var(--gold)',animation:'pulse 2s infinite'}}/>
              <span style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--gold)'}}>Senkronize ediliyor…</span>
            </div>
          )}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div className="uchip"><div className="avatar" style={{background:user.color+'22',color:user.color}}>{user.av}</div><span style={{fontSize:12,fontWeight:600}}>{user.name}</span><span style={{fontSize:10,color:'var(--text2)',fontFamily:'var(--mono)'}}>{RI[user.role]} {user.role}</span></div>
          <button className="logout" style={{borderColor:themeModal?'var(--teal)':'',color:themeModal?'var(--teal)':''}} onClick={()=>setThemeModal(p=>!p)}>🎨 {theme}</button>
          <button className="logout" style={{borderColor:settingsModal?'var(--gold)':'',color:settingsModal?'var(--gold)':''}} onClick={()=>setSettingsModal(true)}>⚙ Ayarlar</button>
          <button className="logout" onClick={()=>{setUser(null);localStorage.removeItem('rv_user');}}>Çıkış ↗</button>
        </div>
      </div>
      <div className="pbar">
        <span style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)',fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase'}}>YETKİLER:</span>
        {perms.map((p,i)=><span key={i} className={`ptag ${p.g?'ptg':'ptr'}`}>{p.l}</span>)}
      </div>
      {/* ── GROUPED NAV ── */}
      <div className="tabs" style={{position:'relative',zIndex:200}} onClick={()=>setNavOpen(null)}>
        {NAV_GROUPS.map(g=>{
          // Kritik badge hesabı
          const hT2=monthly.reduce((a,b)=>a+b.h,0);
          const gT2=monthly.filter(m=>m.g!=null).reduce((a,b)=>a+b.g,0);
          const pct2=gT2/hT2*100;
          const hasCrit=(g.items||[]).some(it=>it.id==='bildirim')
            ? (pct2<70?1:0)+ac.filter(a=>a.ciro/a.hedef*100<50).length : 0;
          const groupActive = g.single ? tab===g.tab : (g.items||[]).some(it=>it.id===tab);
          const isOpen = navOpen===g.id;

          if(g.single) return(
            <button key={g.id}
              className={`tab${groupActive?' act':''}${!g.ok?' lkd':''}`}
              onClick={e=>{e.stopPropagation();g.ok&&setTab(g.tab);setNavOpen(null);}}
              style={{display:'flex',alignItems:'center',gap:5}}>
              {g.icon} {g.l}
            </button>
          );

          return(
            <div key={g.id} style={{position:'relative'}} onClick={e=>e.stopPropagation()}>
              <button
                className={`tab${groupActive?' act':''}`}
                onClick={()=>setNavOpen(isOpen?null:g.id)}
                style={{display:'flex',alignItems:'center',gap:5,position:'relative',
                  paddingRight:g.items?.length?20:undefined}}>
                {g.icon} {g.l}
                <span style={{fontSize:8,opacity:0.6,position:'absolute',right:6,top:'50%',transform:'translateY(-50%) rotate('+(isOpen?'180':'0')+'deg)',transition:'transform .2s'}}>▼</span>
                {hasCrit>0&&<span style={{position:'absolute',top:4,right:14,background:'#ef4444',color:'#fff',borderRadius:'50%',width:14,height:14,fontSize:9,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,lineHeight:1}}>{hasCrit}</span>}
              </button>
              {/* Dropdown */}
              {isOpen&&(
                <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,
                  background:'var(--bg2)',border:'1px solid var(--border)',
                  borderRadius:12,padding:'6px',minWidth:220,
                  boxShadow:'0 12px 40px rgba(0,0,0,0.4)',zIndex:300}}>
                  <div style={{fontSize:9,color:'var(--text3)',fontFamily:'var(--mono)',
                    textTransform:'uppercase',letterSpacing:'.08em',padding:'4px 10px 8px',
                    borderBottom:'1px solid var(--border)',marginBottom:4}}>
                    {g.l}
                  </div>
                  {(g.items||[]).map(it=>{
                    const isAct = tab===it.id;
                    const locked = !it.ok;
                    return(
                      <button key={it.id}
                        onClick={()=>{ if(!locked){setTab(it.id);setNavOpen(null);} }}
                        style={{display:'flex',alignItems:'flex-start',gap:10,width:'100%',
                          padding:'8px 10px',marginBottom:2,borderRadius:8,cursor:locked?'not-allowed':'pointer',
                          background:isAct?'rgba(255,255,255,0.06)':'transparent',
                          border:`1px solid ${isAct?'var(--gold)':'transparent'}`,
                          textAlign:'left',transition:'all .12s',opacity:locked?0.45:1}}
                        onMouseOver={e=>{if(!locked&&!isAct)e.currentTarget.style.background='rgba(255,255,255,0.04)';}}
                        onMouseOut={e=>{if(!isAct)e.currentTarget.style.background='transparent';}}>
                        <span style={{fontSize:16,flexShrink:0,marginTop:1}}>{it.icon}</span>
                        <div>
                          <div style={{fontSize:12,fontWeight:isAct?700:500,
                            color:isAct?'var(--gold)':'var(--text)',display:'flex',alignItems:'center',gap:6}}>
                            {it.l}
                            {locked&&<span style={{fontSize:9,color:'var(--text3)'}}>🔒</span>}
                            {isAct&&<span style={{fontSize:9,color:'var(--gold)'}}>✓</span>}
                          </div>
                          <div style={{fontSize:10,color:'var(--text3)',marginTop:1,lineHeight:1.4}}>{it.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:7}}>
          <span style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)',fontWeight:600,letterSpacing:'.06em',textTransform:'uppercase'}}>YIL HEDEFİ</span>
          <span style={{fontSize:15,fontWeight:700,fontFamily:'var(--ff)',color:'var(--gold)'}}>€{(hT/1e6).toFixed(1)}M</span>
        </div>
      </div>
      <div className="main">
        {/* Breadcrumb */}
        {tab!=='dash'&&(()=>{
          const group=NAV_GROUPS.find(g=>g.items&&g.items.some(it=>it.id===tab));
          const item=group&&group.items.find(it=>it.id===tab);
          if(!group||!item) return null;
          return(
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:16,
              padding:'6px 12px',background:'rgba(255,255,255,0.03)',borderRadius:8,
              border:'1px solid var(--border)',width:'fit-content'}}>
              <span style={{fontSize:11,color:'var(--text3)'}}>{group.icon} {group.l}</span>
              <span style={{fontSize:10,color:'var(--text3)',opacity:0.5}}>›</span>
              <span style={{fontSize:11,fontWeight:600,color:'var(--gold)'}}>{item.icon} {item.l}</span>
            </div>
          );
        })()}
        {tab==='dash'&&<Dashboard user={user} monthly={monthly} simOcc={simOcc} setSimOcc={setSimOccSync} simAdr={simAdr} setSimAdr={setSimAdrSync} saveSimToDB={saveSimToDB}/>}
        {tab==='acente'&&<Acente user={user} ac={ac} setAc={setAcSync}/>}
        {tab==='proj'&&<Projeksiyon simOcc={simOcc} simAdr={simAdr} monthly={monthly}/>}
        {tab==='analiz'&&<Analiz monthly={monthly} ac={ac} simOcc={simOcc} simAdr={simAdr}/>}
        {tab==='satis'&&<Satis user={user} ac={ac} monthly={monthly} simOcc={simOcc} simAdr={simAdr}/>}
        {tab==='operasyon'&&<Operasyonel user={user} monthly={monthly} simOcc={simOcc} simAdr={simAdr}/>}
        {tab==='bildirim'&&<Bildirim user={user} monthly={monthly} ac={ac} simOcc={simOcc} simAdr={simAdr}/>}
        {tab==='raporlama'&&<Raporlama user={user} monthly={monthly} ac={ac} simOcc={simOcc} simAdr={simAdr}/>}
        {tab==='zeka'&&<ZekaMerkezi user={user} monthly={monthly} ac={ac} simOcc={simOcc} simAdr={simAdr} setSimAdr={setSimAdrSync} setSimOcc={setSimOccSync}/>}
        {tab==='editor'&&<HedefEditor user={user} monthly={monthly} setMonthly={setMonthlySync} ac={ac} setAc={setAcSync}/>}
        {tab==='ai'&&<AIAsistan user={user} monthly={monthly} ac={ac} simOcc={simOcc} simAdr={simAdr} groqKey={groqKey}/>}
        {tab==='users'&&<KullaniciYonetimi user={user} users={users} saveUser={saveUser} deleteUser={deleteUser} sbReady={sbReady}/>}
      </div>

      {themeModal&&(
        <div style={{position:'fixed',top:62,right:16,zIndex:500,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:14,padding:'12px',boxShadow:'0 8px 40px rgba(0,0,0,0.6)',minWidth:220}}
          onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)',marginBottom:10,textTransform:'uppercase',letterSpacing:'.08em'}}>Tema Seç</div>
          {Object.keys(THEMES).map(name=>(
            <button key={name} onClick={()=>{setTheme(name);applyTheme(name);setThemeModal(false);}}
              style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'8px 12px',marginBottom:4,
                background:theme===name?'rgba(255,255,255,0.06)':'transparent',
                border:`1px solid ${theme===name?'var(--gold)':'transparent'}`,
                borderRadius:8,cursor:'pointer',textAlign:'left',transition:'all .15s'}}>
              <div style={{display:'flex',gap:3}}>
                {['--gold','--teal','--blue','--rose'].map(v=>(
                  <div key={v} style={{width:8,height:8,borderRadius:'50%',
                    background:THEMES[name][v]||'#888'}}/>
                ))}
              </div>
              <span style={{fontSize:12,color:theme===name?'var(--gold)':'var(--text)',fontWeight:theme===name?600:400}}>{name}</span>
              {theme===name&&<span style={{marginLeft:'auto',fontSize:10,color:'var(--gold)'}}>✓</span>}
            </button>
          ))}
          <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)',fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)',textAlign:'center'}}>
            Tercih tarayıcıda saklanır
          </div>
        </div>
      )}

      {settingsModal&&(
        <div className="overlay" onClick={()=>setSettingsModal(false)}>
          <div className="modal" style={{width:500}} onClick={e=>e.stopPropagation()}>
            <button onClick={()=>setSettingsModal(false)} style={{position:'absolute',top:14,right:14,background:'rgba(255,255,255,0.05)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text2)',cursor:'pointer',padding:'3px 8px',fontSize:13}}>✕</button>

            <div style={{fontFamily:'var(--ff)',fontSize:16,fontWeight:700,marginBottom:20}}>⚙ Ayarlar & Entegrasyonlar</div>

            <div style={{display:'flex',flexDirection:'column',gap:3,marginBottom:22}}>

              <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid var(--border)',borderRadius:12,padding:'16px'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:28,height:28,background:'rgba(6,214,160,0.12)',border:'1px solid rgba(6,214,160,0.25)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>🗄</div>
                    <div>
                      <div style={{fontSize:13,fontWeight:600}}>Supabase</div>
                      <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)'}}>Bulut veritabanı</div>
                    </div>
                  </div>
                  <span style={{fontSize:10,fontFamily:'var(--mono)',padding:'3px 8px',borderRadius:6,background:sbReady?'var(--teal-dim)':'rgba(255,255,255,0.05)',border:`1px solid ${sbReady?'rgba(6,214,160,0.25)':'var(--border)'}`,color:sbReady?'var(--teal)':'var(--text3)'}}>{sbReady?'✓ Bağlı':'Bağlı değil'}</span>
                </div>
                {sbReady?(
                  <div>
                    <div style={{fontSize:11,color:'var(--text2)',fontFamily:'var(--mono)',marginBottom:10,background:'rgba(0,0,0,0.2)',borderRadius:8,padding:'8px 10px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                      <span>{((SUPABASE_URL&&SUPABASE_URL.trim())||localStorage.getItem('sb_url')||'').replace('https://','').split('.supabase')[0]}.supabase.co</span>
                      {SUPABASE_URL&&SUPABASE_URL.trim()&&<span style={{fontSize:9,padding:'2px 6px',background:'rgba(6,214,160,0.1)',border:'1px solid rgba(6,214,160,0.3)',borderRadius:4,color:'var(--teal)'}}>Sabit config</span>}
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <button className="btn bg" style={{flex:1,fontSize:11}} onClick={loadFromDB} disabled={dbSync}>🔄 Veriyi Yenile</button>
                      <button className="btn" style={{flex:1,fontSize:11,background:'var(--rose-dim)',border:'1px solid rgba(247,37,133,.3)',color:'#ff6eb4'}} onClick={()=>{disconnectDB();}}>Bağlantıyı Kes</button>
                    </div>
                  </div>
                ):(
                  <div>
                    <div className="mg" style={{marginBottom:10}}>
                      <label className="lbl">Project URL</label>
                      <input className="inp" value={sbCfg.url} onChange={e=>setSbCfg({...sbCfg,url:e.target.value})} placeholder="https://xxxxxxxxxxxx.supabase.co" style={{fontFamily:'var(--mono)',fontSize:11}} onChange={e=>setSbCfg({...sbCfg,url:e.target.value.trim()})}/>
                    </div>
                    <div style={{marginBottom:12}}>
                      <label className="lbl">Anon Key</label>
                      <input className="inp" type="password" value={sbCfg.key} onChange={e=>setSbCfg({...sbCfg,key:e.target.value})} placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…" style={{fontFamily:'var(--mono)',fontSize:11}}/>
                    </div>
                    {sbStatus==='error'&&<div style={{fontSize:11,color:'#ff6eb4',marginBottom:8,fontFamily:'var(--mono)'}}>❌ Bağlantı hatası. Bilgileri kontrol edin.</div>}
                    <button className="btn bp" style={{width:'100%'}} onClick={testConnection} disabled={!sbCfg.url||!sbCfg.key||sbStatus==='connecting'}>
                      {sbStatus==='connecting'?'⏳ Bağlanıyor…':'🔌 Bağlan'}
                    </button>
                  </div>
                )}
              </div>

              <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid var(--border)',borderRadius:12,padding:'16px',marginTop:8}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:28,height:28,background:'rgba(240,180,41,0.12)',border:'1px solid rgba(240,180,41,0.25)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>🤖</div>
                    <div>
                      <div style={{fontSize:13,fontWeight:600}}>Groq API</div>
                      <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)'}}>Llama 3.3 · AI Asistan</div>
                    </div>
                  </div>
                  <span style={{fontSize:10,fontFamily:'var(--mono)',padding:'3px 8px',borderRadius:6,background:groqSaved?'var(--gold-dim)':'rgba(255,255,255,0.05)',border:`1px solid ${groqSaved?'rgba(240,180,41,0.3)':'var(--border)'}`,color:groqSaved?'var(--gold2)':'var(--text3)'}}>{groqSaved?'✓ Aktif':'Bağlı değil'}</span>
                </div>
                {groqSaved?(
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{flex:1,fontSize:11,color:'var(--text2)',fontFamily:'var(--mono)',background:'rgba(0,0,0,0.2)',borderRadius:8,padding:'8px 10px'}}>gsk_••••••••••••••••••••••••••••••</div>
                    <button className="btn" style={{fontSize:11,background:'var(--rose-dim)',border:'1px solid rgba(247,37,133,.3)',color:'#ff6eb4',padding:'7px 12px'}} onClick={deleteGroqKey} disabled={!sbReady}>Sil</button>
                  </div>
                ):(
                  <div>
                    <div style={{marginBottom:10}}>
                      <label className="lbl">API Key — <a href="https://console.groq.com/keys" target="_blank" style={{color:'var(--gold)',textDecoration:'none',fontWeight:400}}>console.groq.com/keys ↗</a></label>
                      <input className="inp" type="password" value={groqKeyInput} onChange={e=>setGroqKeyInput(e.target.value)} placeholder="gsk_••••••••••••••••••••••••••••••••" style={{fontFamily:'var(--mono)',fontSize:11}}/>
                    </div>
                    {!sbReady&&<div style={{fontSize:11,color:'var(--gold)',fontFamily:'var(--mono)',marginBottom:8}}>⚠ Önce Supabase'e bağlanın</div>}
                    <button className="btn bp" style={{width:'100%'}} onClick={()=>saveGroqKey(groqKeyInput.trim())} disabled={!groqKeyInput.trim()||!sbReady}>
                      💾 Kaydet
                    </button>
                  </div>
                )}
              </div>

            </div>

            <button className="btn bg" style={{width:'100%'}} onClick={()=>setSettingsModal(false)}>Kapat</button>
          </div>
        </div>
      )}

      {sbModal&&(
        <div className="overlay" onClick={()=>setSbModal(false)}>
          <div className="modal" style={{width:480}} onClick={e=>e.stopPropagation()}>
            <button onClick={()=>setSbModal(false)} style={{position:'absolute',top:14,right:14,background:'rgba(255,255,255,0.05)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text2)',cursor:'pointer',padding:'3px 8px',fontSize:13}}>✕</button>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
              <div style={{width:36,height:36,background:'linear-gradient(135deg,rgba(6,214,160,0.2),rgba(76,201,240,0.15))',border:'1px solid rgba(6,214,160,0.3)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>🗄</div>
              <div>
                <div style={{fontFamily:'var(--ff)',fontSize:15,fontWeight:700}}>Supabase Bağlantısı</div>
                <div style={{fontSize:11,color:'var(--text2)',fontFamily:'var(--mono)',marginTop:2}}>Verileri bulut veritabanında sakla</div>
              </div>
            </div>

            {sbReady?(
              <div>
                <div style={{background:'var(--teal-dim)',border:'1px solid rgba(6,214,160,0.25)',borderRadius:10,padding:'12px 14px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:18}}>✅</span>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:'var(--teal)'}}>Bağlantı aktif</div>
                    <div style={{fontSize:10,color:'var(--text2)',fontFamily:'var(--mono)',marginTop:2}}>{((SUPABASE_URL&&SUPABASE_URL.trim())||localStorage.getItem('sb_url')||'').replace('https://','').split('.')[0]}…supabase.co</div>
                  </div>
                  <button className="btn bg" style={{marginLeft:'auto',fontSize:11,padding:'5px 12px'}} onClick={loadFromDB} disabled={dbSync}>{dbSync?'⏳ Yükleniyor…':'🔄 Yenile'}</button>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16}}>
                  {[['📅 Aylık Hedefler',monthly.length+' kayıt'],['🏢 Acenteler',ac.length+' kayıt'],['☁️ Otomatik Sync','Aktif'],['🔒 Güvenli','RLS korumalı']].map(([l,v],i)=>(
                    <div key={i} style={{background:'rgba(255,255,255,0.03)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 12px'}}>
                      <div style={{fontSize:10,color:'var(--text2)',fontFamily:'var(--mono)',marginBottom:3}}>{l}</div>
                      <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button className="btn bg" style={{flex:1}} onClick={()=>setSbModal(false)}>Kapat</button>
                  <button className="btn" style={{flex:1,background:'var(--rose-dim)',border:'1px solid rgba(247,37,133,.3)',color:'#ff6eb4'}} onClick={disconnectDB}>Bağlantıyı Kes</button>
                </div>
              </div>
            ):(
              <div>
                <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 14px',marginBottom:16,fontSize:12,color:'var(--text2)',lineHeight:1.8}}>
                  <div style={{fontWeight:600,color:'var(--text)',marginBottom:6}}>📋 Kurulum Adımları</div>
                  <div>1. <a href="https://supabase.com" target="_blank" style={{color:'var(--gold)',textDecoration:'none'}}>supabase.com</a>'da ücretsiz proje oluştur</div>
                  <div>2. SQL editöründe aşağıdaki şemayı çalıştır</div>
                  <div>3. Project URL ve anon key'i buraya gir</div>
                </div>

                <div style={{background:'rgba(0,0,0,0.3)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 12px',marginBottom:16,fontFamily:'var(--mono)',fontSize:10,color:'var(--teal)',lineHeight:1.9,overflowX:'auto',whiteSpace:'pre'}}>
{`create table monthly_targets (
  month_index int primary key,
  month_name  text,
  target      bigint,
  actual      bigint,
  occ_target  numeric,
  adr_target  numeric
);

create table agencies (
  id             serial primary key,
  name           text unique,
  type           text,
  commission     numeric,
  annual_target  bigint,
  actual_revenue bigint default 0,
  discount       numeric default 0
);

create table agency_monthly (
  agency_id   int references agencies(id) on delete cascade,
  month_index int,
  target      bigint,
  primary key (agency_id, month_index)
);`}
                </div>

                <div className="mg">
                  <label className="lbl">Project URL</label>
                  <input className="inp" value={sbCfg.url} onChange={e=>setSbCfg({...sbCfg,url:e.target.value})} placeholder="https://xxxxxxxxxxxx.supabase.co" style={{fontFamily:'var(--mono)',fontSize:12}} onChange={e=>setSbCfg({...sbCfg,url:e.target.value.trim()})}/>
                </div>
                <div className="mg">
                  <label className="lbl">Anon Key (public)</label>
                  <input className="inp" type="password" value={sbCfg.key} onChange={e=>setSbCfg({...sbCfg,key:e.target.value})} placeholder="eyJhbGciOiJIUzI1NiIsInR5c…" style={{fontFamily:'var(--mono)',fontSize:12}}/>
                </div>

                {sbStatus==='error'&&<div className="notif" style={{background:'var(--rose-dim)',border:'1px solid rgba(247,37,133,.3)',color:'#ff6eb4',marginBottom:12}}>❌ Bağlantı kurulamadı. URL ve key'i kontrol edin.</div>}
                {sbStatus==='connecting'&&<div className="notif nb" style={{marginBottom:12}}>⏳ Bağlanılıyor…</div>}

                <div style={{display:'flex',gap:8}}>
                  <button className="btn bg" style={{flex:1}} onClick={()=>setSbModal(false)}>İptal</button>
                  <button className="btn bp" style={{flex:2}} onClick={testConnection} disabled={!sbCfg.url||!sbCfg.key||sbStatus==='connecting'}>
                    {sbStatus==='connecting'?'⏳ Test ediliyor…':'🔌 Bağlan & Senkronize Et'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
