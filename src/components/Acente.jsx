import React, { useState, useEffect } from 'react';
import { PieChartSVG } from './Charts';
import { fmt, fmtK } from '../utils/format';
import { getSupabase } from '../utils/supabase';

const ELEKTRA_WORKER = 'https://elektra-proxy.noxinn-presentation.workers.dev';

function Acente({user,ac,setAc}){
  const [f,setF]=useState('hepsi');
  const [modal,setModal]=useState(false);
  const [view,setView]=useState('liste');
  const [delId,setDelId]=useState(null);
  const [saving,setSaving]=useState(false);
  const [saveMsg,setSaveMsg]=useState('');
  const [pendingDelete,setPendingDelete]=useState(null);
  const [localAc,setLocalAc]=useState(ac);
  const [dirty,setDirty]=useState(false);
  const [form,setForm]=useState({ad:'',tip:'TO',kom:15,hedef:500,ind:5});

  // Elektra sync
  const [elektraModal,setElektraModal]=useState(false);
  const [elektraAgencies,setElektraAgencies]=useState([]);
  const [elektraLoading,setElektraLoading]=useState(false);
  const [elektraYear,setElektraYear]=useState(new Date().getFullYear());
  const [selected,setSelected]=useState({}); // {id: true/false}
  const [syncMsg,setSyncMsg]=useState('');

  useEffect(()=>{ if(!dirty) setLocalAc(ac); },[ac]);

  const list=f==='hepsi'?localAc:localAc.filter(a=>a.tip===f);
  const tC=localAc.reduce((a,b)=>a+b.ciro,0),tH=localAc.reduce((a,b)=>a+b.hedef,0);
  const CLR=['#4cc9f0','#f0b429','#06d6a0','#f72585','#ffd166','#06b6d4','#c4b5fd','#67e8f9'];

  // ── ELEKTRA SYNC ──
  const loadElektraAgencies = async (year) => {
    setElektraLoading(true);
    setSyncMsg('');
    try {
      const res = await fetch(`${ELEKTRA_WORKER}?action=agencies&year=${year}`);
      const data = await res.json();
      if (data.ok && data.agencies) {
        setElektraAgencies(data.agencies.filter(a => a.totalRooms > 0));
        // Hepsini varsayılan olarak seç
        const sel = {};
        data.agencies.filter(a => a.totalRooms > 0).forEach(a => { sel[a.id] = true; });
        setSelected(sel);
      } else {
        setSyncMsg('❌ Elektra verisi alınamadı');
      }
    } catch(e) {
      setSyncMsg('❌ Bağlantı hatası: ' + e.message);
    }
    setElektraLoading(false);
  };

  const doSync = async () => {
    const toSync = elektraAgencies.filter(a => selected[a.id]);
    if (!toSync.length) return;
    setSaving(true); setSyncMsg('');

    const sb = getSupabase();
    const newAc = [];

    for (const ea of toSync) {
      // Tip belirle
      const tip = ea.name.includes('ONLINE') || ea.name.includes('OTA') || ea.name.includes('BOOKING') || ea.name.includes('EXPEDIA') ? 'OTA'
        : ea.name.includes('WALKIN') || ea.name.includes('DİREKT') || ea.name.includes('DIREKT') ? 'Direkt'
        : 'TO';

      const hedef = ea.totalRevenue > 0 ? Math.round(ea.totalRevenue * 1.1) : Math.round(ea.totalRooms * 150 * 7); // %10 büyüme hedefi
      const ciro  = Math.round(ea.totalRevenue);
      const aylar = ea.monthsRevenue.map(v => Math.round(v || 0));

      const item = {
        id: ea.id,
        ad: ea.name,
        tip,
        kom: 15,
        hedef: Math.max(hedef, 10000),
        ind: 5,
        ciro,
        ay: aylar,
        elektraId: ea.id,
      };

      newAc.push(item);

      // Supabase'e kaydet
      if (sb) {
        try {
          // Mevcut acente var mı?
          const { data: existing } = await sb.from('agencies').select('id').eq('name', ea.name).single();
          if (existing) {
            await sb.from('agencies').update({
              actual_revenue: ciro, annual_target: item.hedef,
            }).eq('id', existing.id);
            await sb.from('agency_monthly').delete().eq('agency_id', existing.id);
            await sb.from('agency_monthly').insert(aylar.map((t,i)=>({agency_id: existing.id, month_index: i, target: t})));
          } else {
            const { data: saved } = await sb.from('agencies').insert({
              name: ea.name, type: tip, commission: 15,
              annual_target: item.hedef, actual_revenue: ciro, discount: 5,
            }).select().single();
            if (saved) {
              await sb.from('agency_monthly').insert(aylar.map((t,i)=>({agency_id: saved.id, month_index: i, target: t})));
              item.id = saved.id;
            }
          }
        } catch(e) { console.error('Supabase acente kayıt hatası:', e); }
      }
    }

    // Mevcut listeyle birleştir — aynı isimde olanları güncelle
    setLocalAc(prev => {
      const updated = [...prev];
      for (const na of newAc) {
        const idx = updated.findIndex(a => a.ad === na.ad || a.elektraId === na.elektraId);
        if (idx >= 0) updated[idx] = { ...updated[idx], ...na };
        else updated.push(na);
      }
      return updated.sort((a,b) => b.ciro - a.ciro);
    });

    setAc(prev => {
      const updated = [...prev];
      for (const na of newAc) {
        const idx = updated.findIndex(a => a.ad === na.ad);
        if (idx >= 0) updated[idx] = { ...updated[idx], ...na };
        else updated.push(na);
      }
      return updated.sort((a,b) => b.ciro - a.ciro);
    });

    setSyncMsg(`✅ ${toSync.length} acente senkronize edildi!`);
    setSaving(false);
    setDirty(false);
    setTimeout(() => { setElektraModal(false); setSyncMsg(''); }, 2000);
  };

  const handleAdd=()=>{
    if(!form.ad.trim())return;
    const newItem={ id:Date.now(), ad:form.ad.trim(), tip:form.tip, kom:+form.kom, hedef:+form.hedef*1000, ind:+form.ind, ciro:0, ay:Array(12).fill(Math.round(+form.hedef*1000/12)) };
    setLocalAc(prev=>[...prev,newItem]);
    setDirty(true);
    setForm({ad:'',tip:'TO',kom:15,hedef:500,ind:5});
    setModal(false);
  };

  const handleDelete=(id)=>{
    setLocalAc(prev=>prev.filter(a=>a.id!==id));
    setDirty(true);
    setPendingDelete(null);
    setDelId(null);
  };

  const saveAll=async()=>{
    const sb=getSupabase();
    setSaving(true); setSaveMsg('');
    try{
      if(sb){
        const {data:dbAc}=await sb.from('agencies').select('id,name');
        const dbNames=(dbAc||[]).map(a=>a.name);
        const localNames=localAc.map(a=>a.ad);
        const toDelete=(dbAc||[]).filter(a=>!localNames.includes(a.name));
        for(const a of toDelete){ await sb.from('agencies').delete().eq('id',a.id); }
        const toAdd=localAc.filter(a=>!dbNames.includes(a.ad));
        for(const a of toAdd){
          const {data:saved}=await sb.from('agencies').insert({ name:a.ad, type:a.tip, commission:a.kom, annual_target:a.hedef, actual_revenue:a.ciro||0, discount:a.ind }).select().single();
          if(saved){ await sb.from('agency_monthly').insert(a.ay.map((t,i)=>({agency_id:saved.id,month_index:i,target:t}))); }
        }
      }
      setAc(localAc);
      setDirty(false);
      setSaveMsg('✅ Kaydedildi!');
      setTimeout(()=>setSaveMsg(''),2500);
    }catch(e){ setSaveMsg('❌ Kayıt hatası: '+e.message); }
    setSaving(false);
  };

  const discardChanges=()=>{ setLocalAc(ac); setDirty(false); };

  const MFull=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];

  return(
    <>
    <div>
      <div className="kgrid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
        {[
          {l:'Toplam Acente Cirosu',v:fmt(tC),d:`%${(tC/tH*100||0).toFixed(1)} hedefe ulaşıldı`,c:'#00d4ff'},
          {l:'Acente Hedef',v:fmt(tH),d:`Açık: ${fmt(tH-tC)}`,c:'#a78bfa'},
          {l:'En İyi',v:localAc.sort((a,b)=>b.ciro-a.ciro)[0]?.ad||'—',d:localAc[0]?`${fmtK(localAc[0].ciro)} ciro`:'—',c:'#10b981'},
          {l:'Aktif Acente',v:localAc.filter(a=>a.ciro>0).length,d:`${localAc.length} toplam`,c:'#4cc9f0'},
        ].map((k,i)=>(
          <div key={i} className="kcard" style={{'--kc':k.c}}><div className="klbl">{k.l}</div><div className="kval" style={{color:k.c,fontSize:typeof k.v==='string'&&k.v.length>8?16:22}}>{k.v}</div><div className="kdelta" style={{color:'#10b981'}}>{k.d}</div></div>
        ))}
      </div>

      <div className="g65">
        <div className="panel">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:8}}>
            <div className="ptitle" style={{margin:0}}>🏢 Acente Performansı</div>
            <div style={{display:'flex',gap:5,alignItems:'center',flexWrap:'wrap'}}>
              {['hepsi','TO','OTA','Direkt'].map(x=><button key={x} className={`btn ${f===x?'bp':'bg'}`} style={{padding:'4px 11px',fontSize:11}} onClick={()=>setF(x)}>{x}</button>)}
              <div style={{width:1,height:20,background:'var(--border)',margin:'0 4px'}}/>
              <button className={`btn ${view==='liste'?'bp':'bg'}`} style={{padding:'4px 11px',fontSize:11}} onClick={()=>setView('liste')}>📋 Liste</button>
              <button className={`btn ${view==='kontrat'?'bp':'bg'}`} style={{padding:'4px 11px',fontSize:11}} onClick={()=>setView('kontrat')}>💰 Kontrat vs EB</button>
              {/* Elektra Sync butonu */}
              <button className="btn bg" style={{padding:'4px 12px',fontSize:11,borderColor:'var(--gold)',color:'var(--gold)',marginLeft:6}}
                onClick={()=>{ setElektraModal(true); loadElektraAgencies(elektraYear); }}>
                ⚡ Elektra'dan Senkronize Et
              </button>
              {user.p.addac&&<button className="btn bg" style={{padding:'4px 12px',fontSize:11,borderColor:'var(--teal)',color:'var(--teal)'}} onClick={()=>setModal(true)}>+ Acente Ekle</button>}
            </div>
          </div>

          {dirty&&(
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,padding:'8px 12px',background:'rgba(240,180,41,0.08)',border:'1px solid rgba(240,180,41,0.3)',borderRadius:10}}>
              <span style={{flex:1,fontSize:12,color:'var(--gold)',fontFamily:'var(--mono)'}}>● Kaydedilmemiş değişiklik var</span>
              <button className="btn bg" style={{fontSize:11,padding:'4px 10px'}} onClick={discardChanges} disabled={saving}>↩ Geri Al</button>
              <button className="btn bp" style={{fontSize:12,padding:'5px 16px'}} onClick={saveAll} disabled={saving}>{saving?'⏳ Kaydediliyor…':'💾 Kaydet'}</button>
            </div>
          )}
          {saveMsg&&<div style={{marginBottom:10,padding:'7px 12px',borderRadius:8,fontSize:12,fontFamily:'var(--mono)',background:saveMsg.startsWith('✅')?'rgba(6,214,160,0.08)':'rgba(247,37,133,0.08)',border:`1px solid ${saveMsg.startsWith('✅')?'rgba(6,214,160,0.3)':'rgba(247,37,133,0.3)'}`,color:saveMsg.startsWith('✅')?'var(--teal)':'#ff6eb4'}}>{saveMsg}</div>}

          {view==='liste'&&(
            <table className="tbl">
              <thead><tr><th>Acente</th><th>Tip</th>{user.p.ciro&&<th>Ciro</th>}{user.p.hedef&&<th>Hedef</th>}<th>%</th>{user.p.kom&&<th>Kom</th>}<th>Durum</th>{user.p.addac&&<th></th>}</tr></thead>
              <tbody>
                {list.map(a=>{const p=(a.ciro/a.hedef*100||0).toFixed(0);const d=p>=100?'iyi':p>=80?'geride':'kritik';return(
                  <tr key={a.id}>
                    <td style={{fontWeight:600}}>
                      {a.ad}
                      {a.elektraId&&<span style={{fontSize:9,color:'var(--gold)',fontFamily:'var(--mono)',marginLeft:5}}>⚡</span>}
                    </td>
                    <td><span className={`badge ${a.tip==='OTA'?'bb2':a.tip==='Direkt'?'bg2':'by2'}`}>{a.tip}</span></td>
                    {user.p.ciro&&<td style={{fontFamily:'var(--mono)',fontSize:11}}>{fmtK(a.ciro)}</td>}
                    {user.p.hedef&&<td style={{fontFamily:'var(--mono)',fontSize:11,color:'var(--text2)'}}>{fmtK(a.hedef)}</td>}
                    <td><div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:38,height:4,background:'rgba(255,255,255,0.04)',borderRadius:2}}><div style={{width:`${Math.min(p,100)}%`,height:'100%',background:p>=100?'var(--teal)':p>=80?'var(--gold)':'var(--rose)',borderRadius:2}}/></div><span style={{fontFamily:'var(--mono)',fontSize:10,color:p>=100?'var(--teal)':p>=80?'var(--gold)':'#ff6eb4'}}>%{p}</span></div></td>
                    {user.p.kom&&<td style={{fontFamily:'var(--mono)',fontSize:11}}>%{a.kom}</td>}
                    <td><span className={`badge ${d==='iyi'?'bg2':d==='geride'?'by2':'br2'}`}>{d==='iyi'?'✓ İyi':d==='geride'?'⚡ Geride':'🚨 Kritik'}</span></td>
                    {user.p.addac&&<td><button onClick={()=>{setPendingDelete({id:a.id,name:a.ad});setDelId(a.id);}} style={{background:'none',border:'1px solid rgba(247,37,133,0.25)',borderRadius:6,color:'#ff6eb4',cursor:'pointer',padding:'3px 8px',fontSize:11}} onMouseOver={e=>e.target.style.background='var(--rose-dim)'} onMouseOut={e=>e.target.style.background='none'}>✕</button></td>}
                  </tr>
                );})}
              </tbody>
            </table>
          )}

          {view==='kontrat'&&(
            <div className="notif nb">💡 Kontrat vs EB karşılaştırması için acentelerin kontrat ve EB fiyatlarını manuel girin.</div>
          )}
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div className="panel">
            <div className="ptitle">🥧 Ciro Dağılımı</div>
            <div style={{height:180}}>
              <PieChartSVG data={ac.filter(a=>a.ciro>0).slice(0,8).map((a,i)=>({name:a.ad,value:a.ciro,fill:CLR[i]}))} size={170}/>
            </div>
          </div>
          <div className="panel">
            <div className="ptitle">📊 Top 5 Acente</div>
            {localAc.sort((a,b)=>b.ciro-a.ciro).slice(0,5).map((a,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                <div style={{fontSize:11,fontWeight:600,color:'var(--text)'}}>{i+1}. {a.ad}</div>
                <div style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--teal)'}}>{fmtK(a.ciro)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* ── ELEKTRA SYNC MODAL ── */}
    {elektraModal&&(
      <div className="overlay" onClick={()=>setElektraModal(false)}>
        <div className="modal" style={{width:760,maxHeight:'85vh',overflow:'hidden',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
          <button onClick={()=>setElektraModal(false)} style={{position:'absolute',top:14,right:14,background:'rgba(255,255,255,0.05)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text2)',cursor:'pointer',padding:'3px 8px',fontSize:13}}>✕</button>

          <div style={{fontFamily:'var(--ff)',fontSize:16,fontWeight:700,marginBottom:4,color:'var(--gold)'}}>⚡ Elektra'dan Acente Senkronizasyonu</div>
          <div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)',marginBottom:16}}>Elektra PMS'ten acenteleri ve gerçek ciro verilerini çek</div>

          {/* Yıl seçici */}
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
            <span style={{fontSize:12,color:'var(--text2)'}}>Yıl:</span>
            {[2024,2025,2026].map(y=>(
              <button key={y} className={`btn ${elektraYear===y?'bp':'bg'}`} style={{fontSize:12,padding:'4px 14px'}}
                onClick={()=>{ setElektraYear(y); loadElektraAgencies(y); }}>{y}</button>
            ))}
            {elektraLoading&&<span style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--mono)'}}>⏳ Yükleniyor…</span>}
            {!elektraLoading&&elektraAgencies.length>0&&(
              <span style={{fontSize:11,color:'var(--teal)',fontFamily:'var(--mono)',marginLeft:'auto'}}>
                {elektraAgencies.length} acente bulundu • {Object.values(selected).filter(Boolean).length} seçili
              </span>
            )}
          </div>

          {syncMsg&&<div style={{marginBottom:10,padding:'8px 12px',borderRadius:8,fontSize:12,fontFamily:'var(--mono)',background:syncMsg.startsWith('✅')?'rgba(6,214,160,0.08)':'rgba(247,37,133,0.08)',border:`1px solid ${syncMsg.startsWith('✅')?'rgba(6,214,160,0.3)':'rgba(247,37,133,0.3)'}`,color:syncMsg.startsWith('✅')?'var(--teal)':'#ff6eb4'}}>{syncMsg}</div>}

          {/* Acente listesi */}
          <div style={{flex:1,overflowY:'auto',border:'1px solid var(--border)',borderRadius:10}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead style={{position:'sticky',top:0,background:'var(--bg2)',zIndex:1}}>
                <tr style={{borderBottom:'1px solid var(--border)'}}>
                  <th style={{padding:'8px 10px',textAlign:'left',width:32}}>
                    <input type="checkbox" checked={elektraAgencies.length>0&&elektraAgencies.every(a=>selected[a.id])}
                      onChange={e=>{ const s={}; elektraAgencies.forEach(a=>{s[a.id]=e.target.checked;}); setSelected(s); }}/>
                  </th>
                  <th style={{padding:'8px 10px',textAlign:'left',color:'var(--text3)',fontWeight:500}}>Acente</th>
                  <th style={{padding:'8px 10px',textAlign:'center',color:'var(--teal)',fontWeight:500}}>Toplam Oda</th>
                  <th style={{padding:'8px 10px',textAlign:'center',color:'var(--gold)',fontWeight:500}}>Ciro (€)</th>
                  <th style={{padding:'8px 10px',textAlign:'center',color:'var(--blue)',fontWeight:500}}>Misafir</th>
                  <th style={{padding:'8px 10px',textAlign:'center',color:'var(--text3)',fontWeight:500}}>Aylık Dağılım</th>
                </tr>
              </thead>
              <tbody>
                {elektraAgencies.map(a=>(
                  <tr key={a.id} style={{borderBottom:'1px solid rgba(255,255,255,0.04)',background:selected[a.id]?'rgba(245,166,35,0.04)':'transparent',cursor:'pointer'}}
                    onClick={()=>setSelected(prev=>({...prev,[a.id]:!prev[a.id]}))}>
                    <td style={{padding:'8px 10px'}} onClick={e=>e.stopPropagation()}>
                      <input type="checkbox" checked={!!selected[a.id]} onChange={e=>setSelected(prev=>({...prev,[a.id]:e.target.checked}))}/>
                    </td>
                    <td style={{padding:'8px 10px',fontWeight:600,color:selected[a.id]?'var(--gold)':'var(--text)'}}>{a.name}</td>
                    <td style={{padding:'8px 10px',textAlign:'center',fontFamily:'var(--mono)',color:'var(--teal)',fontWeight:600}}>{a.totalRooms.toLocaleString('tr-TR')}</td>
                    <td style={{padding:'8px 10px',textAlign:'center',fontFamily:'var(--mono)',color:'var(--gold)',fontWeight:600}}>
                      {a.totalRevenue>0?`€${Math.round(a.totalRevenue).toLocaleString('tr-TR')}`:'—'}
                    </td>
                    <td style={{padding:'8px 10px',textAlign:'center',fontFamily:'var(--mono)',color:'var(--blue)'}}>{a.totalPax.toLocaleString('tr-TR')}</td>
                    <td style={{padding:'8px 10px'}}>
                      <div style={{display:'flex',gap:2}}>
                        {a.months.map((v,i)=>(
                          <div key={i} title={`${MFull[i]}: ${v} oda`}
                            style={{width:16,height:16,borderRadius:3,fontSize:8,display:'flex',alignItems:'center',justifyContent:'center',
                              background:v>0?`rgba(6,214,160,${Math.min(v/500,1)*0.8+0.1})`:'rgba(255,255,255,0.04)',
                              color:v>0?'var(--teal)':'var(--text3)',fontFamily:'var(--mono)',fontWeight:600}}>
                            {v>0?MFull[i].slice(0,1):'·'}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{display:'flex',gap:10,marginTop:14,alignItems:'center'}}>
            <div style={{flex:1,fontSize:11,color:'var(--text3)'}}>
              Seçili acentelerin {elektraYear} yılı gerçek ciro ve oda verileri RevenueOS'a aktarılacak.
              Hedef = gerçek ciro × 1.1 (%10 büyüme hedefi) olarak ayarlanacak.
            </div>
            <button className="btn bg" style={{padding:'8px 20px'}} onClick={()=>setElektraModal(false)}>İptal</button>
            <button className="btn bp" style={{padding:'8px 24px',fontSize:13}} onClick={doSync}
              disabled={saving||!Object.values(selected).some(Boolean)}>
              {saving?'⏳ Aktarılıyor…':`⚡ ${Object.values(selected).filter(Boolean).length} Acenteyi Aktar`}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Manuel ekle modal */}
    {modal&&(
      <div className="overlay" onClick={()=>setModal(false)}>
        <div className="modal" style={{width:400}} onClick={e=>e.stopPropagation()}>
          <button onClick={()=>setModal(false)} style={{position:'absolute',top:14,right:14,background:'rgba(255,255,255,0.05)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text2)',cursor:'pointer',padding:'3px 8px',fontSize:13}}>✕</button>
          <div style={{fontFamily:'var(--ff)',fontSize:16,fontWeight:700,marginBottom:20}}>+ Yeni Acente Ekle</div>
          <div className="mg"><label className="lbl">Acente Adı</label><input className="inp" value={form.ad} onChange={e=>setForm({...form,ad:e.target.value})} placeholder="örn: Jet2holidays"/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
            <div><label className="lbl">Tip</label><select className="inp" value={form.tip} onChange={e=>setForm({...form,tip:e.target.value})}><option value="TO">Tour Operatör (TO)</option><option value="OTA">Online (OTA)</option><option value="Direkt">Direkt</option></select></div>
            <div><label className="lbl">Komisyon %</label><input className="inp" type="number" min="0" max="30" value={form.kom} onChange={e=>setForm({...form,kom:e.target.value})}/></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
            <div><label className="lbl">Yıllık Hedef (€K)</label><input className="inp" type="number" min="0" value={form.hedef} onChange={e=>setForm({...form,hedef:e.target.value})} placeholder="500"/></div>
            <div><label className="lbl">İndirim %</label><input className="inp" type="number" min="0" max="30" value={form.ind} onChange={e=>setForm({...form,ind:e.target.value})}/></div>
          </div>
          <div style={{display:'flex',gap:10}}>
            <button className="btn bg" style={{flex:1}} onClick={()=>setModal(false)}>İptal</button>
            <button className="btn bp" style={{flex:2}} onClick={handleAdd} disabled={!form.ad.trim()}>✅ Acente Ekle</button>
          </div>
        </div>
      </div>
    )}

    {delId&&(
      <div className="overlay" onClick={()=>setDelId(null)}>
        <div className="modal" style={{width:360,textAlign:'center'}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:36,marginBottom:12}}>🗑️</div>
          <div style={{fontFamily:'var(--ff)',fontSize:15,fontWeight:700,marginBottom:8}}>Acenteyi Sil</div>
          <div style={{fontSize:13,color:'var(--text2)',marginBottom:22}}><strong style={{color:'var(--gold)'}}>{localAc.find(a=>a.id===delId)?.ad}</strong> — bu işlem geri alınamaz.</div>
          <div style={{display:'flex',gap:10}}>
            <button className="btn bg" style={{flex:1}} onClick={()=>setDelId(null)}>Vazgeç</button>
            <button className="btn" style={{flex:1,background:'var(--rose-dim)',border:'1px solid rgba(247,37,133,.3)',color:'#ff6eb4'}} onClick={()=>handleDelete(delId)}>Evet, Sil</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default Acente;
