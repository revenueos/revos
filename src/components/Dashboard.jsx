import React, { useState, useMemo } from 'react';
import { AreaChartSVG, Legend } from './Charts';
import { fmt, fmtK } from '../utils/format';
import { MF } from '../data/constants';

function Dashboard({user,monthly,simOcc,setSimOcc,simAdr,setSimAdr,saveSimToDB,
  elektraReady,elektraStatus,elektraLastSync,elektraSyncing,onElektraSync}){
  const [simMode,setSimMode]=useState('Oda Başı');
  const [simPP,setSimPP]=useState(95);
  const [simPax,setSimPax]=useState(2.0);
  const [simDirty,setSimDirty]=useState(false);
  const [origSim,setOrigSim]=useState({occ:simOcc,adr:simAdr});
  const [showPY,setShowPY]=useState(false);
  const [sezonAcilis,setSezonAcilis]=useState(()=>localStorage.getItem('rv_sezon_acilis')||'');
  const [sezonKapanis,setSezonKapanis]=useState(()=>localStorage.getItem('rv_sezon_kapanis')||'');
  const [showSezon,setShowSezon]=useState(false);
  const effectiveAdr = simMode==='Oda Başı' ? simAdr : simPP*simPax;

  const sezonGun = React.useMemo(()=>{
    if(!sezonAcilis||!sezonKapanis) return 365;
    const a=new Date(sezonAcilis), k=new Date(sezonKapanis);
    if(isNaN(a)||isNaN(k)||k<=a) return 365;
    return Math.round((k-a)/(1000*60*60*24))+1;
  },[sezonAcilis,sezonKapanis]);

  const sezonAylar = React.useMemo(()=>{
    if(!sezonAcilis||!sezonKapanis) return null;
    const a=new Date(sezonAcilis), k=new Date(sezonKapanis);
    if(isNaN(a)||isNaN(k)||k<=a) return null;
    const aylar=[];
    for(let d=new Date(a); d<=k; d.setMonth(d.getMonth()+1)){
      aylar.push(d.getMonth());
    }
    return [...new Set(aylar)];
  },[sezonAcilis,sezonKapanis]);

  const totalOdaSim = 280;
  const sezonSimT = Math.round(totalOdaSim * (simOcc/100) * effectiveAdr * sezonGun);

  const gT=monthly.filter(m=>m.g!=null).reduce((a,b)=>a+b.g,0);
  const hT=monthly.reduce((a,b)=>a+b.h,0);
  const pct=(gT/hT*100).toFixed(1);
  const kalan=monthly.filter(m=>m.g==null).length;
  const ayG=kalan>0?(hT-gT)/kalan:0;
  const rp=(effectiveAdr*simOcc/100).toFixed(0);
  const pyRealT=monthly.filter(m=>m.g!=null).reduce((a,b)=>a+(b.py||0),0);
  const pyFullT=monthly.reduce((a,b)=>a+(b.py||0),0);
  const yoy=pyRealT>0?((gT-pyRealT)/pyRealT*100).toFixed(1):null;
  const simD=monthly.map((m,i)=>{
    const inSezon = !sezonAylar || sezonAylar.includes(i);
    return m.g!=null
      ? {...m,gercek:m.g,hedef:m.h,inSezon}
      : {...m,gercek:null,hedef:m.h,inSezon,
          sim:inSezon?Math.round(totalOdaSim*(simOcc/100)*effectiveAdr*30):0};
  });
  const simT=gT+simD.filter(m=>m.sim).reduce((a,b)=>a+(b.sim||0),0);
  const displaySimT = (sezonAcilis&&sezonKapanis) ? sezonSimT : simT;

  // Elektra'dan gelen OCC verisi var mı?
  const elektraOccData = monthly.some(m => m.o > 0);
  const elektraAdrData = monthly.some(m => m.a > 0);
  const avgOcc = elektraOccData
    ? Math.round(monthly.filter(m=>m.o>0).reduce((a,b)=>a+(b.o||0),0) / monthly.filter(m=>m.o>0).length)
    : null;
  const avgAdr = elektraAdrData
    ? Math.round(monthly.filter(m=>m.a>0).reduce((a,b)=>a+(b.a||0),0) / monthly.filter(m=>m.a>0).length)
    : null;

  const ins=[
    pct<85?{c:'#ef4444',t:'🚨 Kritik Açık',x:`Hedefin %${pct}. ${kalan} ayda aylık ${fmtK(ayG)} ek ciro gerekiyor.`}
          :{c:'#10b981',t:'✅ Hedef Yolunda',x:`%${pct} performansla ilerliyorsunuz. ADR artışı için fırsat var.`},
    {c:'#00d4ff',t:'💡 Kapasite',x:`Doluluk %${simOcc}, ${simMode==='Kişi Başı'?`PP €${simPP}`:''} ADR €${effectiveAdr.toFixed(0)}. ${simOcc>90?'Fiyat artışı için ideal zaman.':'OTA kanallarında kampanya açın.'}`},
    {c:'#f59e0b',t:'🎯 Acente Aksiyonu',x:"Corendon hedefin %63 uzerinde. 5+ gece rezervasyonda %3 ek komisyon teklif edin."},
    {c:'#a78bfa',t:'📊 RevPAR',x:`RevPAR €${rp} | ADR €${effectiveAdr.toFixed(0)} | ${simMode==='Kişi Başı'?`PP €${simPP} × ${simPax.toFixed(1)} pax`:'Oda bazlı fiyatlama aktif'}.`},
  ];

  return(
    <div>
      {/* ── ELEKTRA SYNC BAR ── */}
      {elektraReady && (
        <div style={{
          display:'flex', alignItems:'center', gap:10, marginBottom:12,
          padding:'10px 14px', borderRadius:10,
          background:'rgba(245,166,35,0.06)', border:'1px solid rgba(245,166,35,0.2)',
        }}>
          <span style={{fontSize:16}}>⚡</span>
          <div style={{flex:1}}>
            <div style={{fontSize:12, fontWeight:600, color:'var(--gold)'}}>
              Elektra PMS {elektraStatus==='ok'?'✅ Bağlı ve Senkronize':elektraStatus==='idle'?'Hazır':'Bağlı'}
            </div>
            {elektraLastSync && (
              <div style={{fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)'}}>
                Son sync: {elektraLastSync}
                {elektraOccData && ` • OCC avg: %${avgOcc}`}
                {elektraAdrData && ` • ADR avg: €${avgAdr}`}
              </div>
            )}
          </div>
          <button
            style={{fontSize:11, padding:'5px 12px', borderRadius:6,
              background:elektraSyncing?'rgba(255,255,255,0.05)':'rgba(245,166,35,0.15)',
              border:'1px solid rgba(245,166,35,0.3)', color:'var(--gold)',
              cursor:elektraSyncing?'not-allowed':'pointer', whiteSpace:'nowrap'}}
            onClick={onElektraSync} disabled={elektraSyncing}>
            {elektraSyncing ? '⏳ Senkronize…' : '🔄 Güncelle'}
          </button>
        </div>
      )}

      <div className="aip">
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
          <div style={{width:32,height:32,background:'linear-gradient(135deg,var(--gold),var(--teal))',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>🤖</div>
          <div><div style={{fontFamily:'var(--ff)',fontSize:14,fontWeight:700,color:'var(--text)'}}>AI Satış Asistanı</div><div style={{fontSize:10,color:'var(--text2)',fontFamily:'var(--mono)'}}>Anlık analiz • {new Date().toLocaleDateString('tr-TR')}</div></div>
          <div style={{marginLeft:'auto',display:'flex',gap:6}}>
            {[`📊 ${pct}% hedef`,`🏨 ${simOcc}% doluluk`].map((t,i)=><span key={i} style={{background:'rgba(255,255,255,0.04)',border:'1px solid var(--border)',borderRadius:20,padding:'3px 10px',fontSize:10,fontFamily:'var(--mono)',color:'var(--text2)'}}>{t}</span>)}
          </div>
        </div>
        <div className="aigrid">
          {ins.map((n,i)=><div key={i} className="aicard" style={{'--ac':n.c}}><div className="t">{n.t}</div><div className="x">{n.x}</div></div>)}
        </div>
      </div>

      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
        <button className={`btn ${showPY?'bp':'bg'}`} style={{fontSize:11,padding:'5px 14px'}}
          onClick={()=>setShowPY(p=>!p)}>
          📅 Önceki Yıl {showPY?'▲':'▼'}
        </button>
        {showPY&&yoy!=null&&(
          <span style={{fontSize:12,fontFamily:'var(--mono)',fontWeight:700,
            color:+yoy>=0?'var(--teal)':'#ff6eb4',
            background:+yoy>=0?'rgba(6,214,160,0.08)':'rgba(255,110,180,0.08)',
            border:`1px solid ${+yoy>=0?'rgba(6,214,160,0.25)':'rgba(255,110,180,0.25)'}`,
            borderRadius:20,padding:'3px 12px'}}>
            {+yoy>=0?'▲':'▼'} %{Math.abs(yoy)} YoY — aynı dönem geçen yıla göre
          </span>
        )}
      </div>

      {/* ── KPI KARTLARI ── */}
      <div className="kgrid">
        {[
          {l:'Gerçekleşen Ciro',v:fmt(gT),
            d:`↑ %${pct} hedefe ulaşıldı`,
            s:showPY&&pyRealT?`Geçen yıl: ${fmt(pyRealT)}`:' Oca—Eyl 2024',c:'#00d4ff',
            py:showPY&&pyRealT?{v:fmt(pyRealT),delta:yoy}:null},
          {l:'Yıllık Hedef',v:fmt(hT),
            d:`Kalan: ${fmt(hT-gT)}`,
            s:showPY?`Geçen yıl toplam: ${fmt(pyFullT)}`:`${kalan} ay kaldı`,c:'#a78bfa',
            py:showPY?{v:fmt(pyFullT)}:null},
          {l:'Simüle Yıl Sonu',v:fmt(simT),d:displaySimT>=hT?'✓ Hedef aşılıyor':`▼ ${fmt(hT-displaySimT)} açık`,c:displaySimT>=hT?'#10b981':'#ef4444',neg:simT<hT},
          {l:'RevPAR',v:`€${rp}`,d:`ADR €${simAdr} × OCC %${simOcc}`,c:'#f59e0b'},
          ...(user.p.hedef?[{l:'Aylık Gereken',v:fmtK(ayG),d:'Hedefe ulaşmak için/ay',c:'#ef4444',neg:true}]:[]),
          {l:'Aktif Acente',v:'8',d:'2 kritik takipte',c:'#00d4ff'},
        ].map((k,i)=>(
          <div key={i} className="kcard" style={{'--kc':k.c}}>
            <div className="klbl">{k.l}</div>
            <div className="kval" style={{color:k.c,fontSize:k.v.length>7?17:22}}>{k.v}</div>
            <div className="kdelta" style={{color:k.neg?'#ef4444':'#10b981'}}>{k.d}</div>
            {k.py&&<div style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
              <span style={{fontSize:9,color:'var(--text3)',fontFamily:'var(--mono)'}}>GY:</span>
              <span style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--text2)'}}>{k.py.v}</span>
              {k.py.delta&&<span style={{fontSize:10,fontWeight:700,color:+k.py.delta>=0?'var(--teal)':'#ff6eb4'}}>
                {+k.py.delta>=0?'▲':'▼'}%{Math.abs(k.py.delta)}
              </span>}
            </div>}
            {!k.py&&k.s&&<div style={{fontSize:10,color:'var(--text2)',marginTop:3}}>{k.s}</div>}
          </div>
        ))}

        {/* Elektra OCC Kartı */}
        {elektraReady && (
          <div className="kcard" style={{'--kc':'var(--teal)'}}>
            <div className="klbl">⚡ Ort. Doluluk (Elektra)</div>
            <div className="kval" style={{color:'var(--teal)',fontSize:22}}>
              {avgOcc != null ? `%${avgOcc}` : '—'}
            </div>
            <div className="kdelta" style={{color:'var(--teal)'}}>
              {avgOcc != null ? 'Sezon ortalaması' : 'Sync gerekiyor'}
            </div>
            <div style={{fontSize:10,color:'var(--text3)',marginTop:3,fontFamily:'var(--mono)'}}>
              {elektraAdrData ? `ADR: €${avgAdr}` : 'ADR henüz yok'}
            </div>
          </div>
        )}
      </div>

      <div className="g65">
        <div className="panel">
          <div className="ptitle">📈 Aylık Ciro: Gerçekleşen vs Hedef vs Simülasyon</div>
          <AreaChartSVG data={simD} keys={['hedef','gercek','sim']} colors={['rgba(240,180,41,0.6)','#4cc9f0','#06d6a0']} height={230}/>
          <Legend keys={['hedef','gercek','sim']} colors={['rgba(240,180,41,0.8)','#4cc9f0','#06d6a0']} labels={['Hedef','Gerçekleşen','Simülasyon']}/>
        </div>
        <div className="panel">
          <div className="ptitle">⚙️ Simülasyon</div>
          {user.p.editor?<>
            <div style={{display:'flex',gap:6,marginBottom:10}}>
              {['Oda Başı','Kişi Başı'].map(m=>(
                <button key={m} className={`btn ${simMode===m?'bp':'bg'}`} style={{flex:1,fontSize:11,padding:'4px 0'}} onClick={()=>setSimMode(m)}>{m}</button>
              ))}
            </div>
            <div style={{marginBottom:10}}>
              <button className={`btn ${showSezon?'bp':'bg'}`}
                style={{width:'100%',fontSize:11,padding:'5px 0',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}
                onClick={()=>setShowSezon(s=>!s)}>
                📅 Sezon Tarihleri {sezonAcilis&&sezonKapanis
                  ? <span style={{fontFamily:'var(--mono)',fontSize:10}}>({sezonGun} gün)</span>
                  : <span style={{opacity:0.6,fontSize:10}}>(365 gün — tam yıl)</span>}
                <span style={{fontSize:9,opacity:0.7,marginLeft:2}}>{showSezon?'▲':'▼'}</span>
              </button>
              {showSezon&&(
                <div style={{marginTop:8,padding:'12px',background:'rgba(255,255,255,0.03)',border:'1px solid var(--border)',borderRadius:10}}>
                  <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)',marginBottom:10,lineHeight:1.6}}>
                    Sezonluk otel için açılış-kapanış tarihlerini girin.<br/>Simülasyon yalnızca bu dönem üzerinden hesaplanır.
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                    <div>
                      <label className="lbl">Açılış Tarihi</label>
                      <input type="date" className="inp" value={sezonAcilis}
                        onChange={e=>{setSezonAcilis(e.target.value);localStorage.setItem('rv_sezon_acilis',e.target.value);setSimDirty(true);}}/>
                    </div>
                    <div>
                      <label className="lbl">Kapanış Tarihi</label>
                      <input type="date" className="inp" value={sezonKapanis}
                        onChange={e=>{setSezonKapanis(e.target.value);localStorage.setItem('rv_sezon_kapanis',e.target.value);setSimDirty(true);}}/>
                    </div>
                  </div>
                  {sezonAcilis&&sezonKapanis&&sezonGun>0&&(
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:8}}>
                      {[
                        {l:'Sezon Süresi', v:`${sezonGun} gün`, c:'var(--teal)'},
                        {l:'Aktif Aylar', v:`${sezonAylar?.length||0} ay`, c:'var(--gold)'},
                        {l:'Sezon Ciro', v:`€${(sezonSimT/1e6).toFixed(2)}M`, c:'#a78bfa'},
                      ].map((k,i)=>(
                        <div key={i} style={{background:'rgba(255,255,255,0.03)',border:'1px solid var(--border)',borderRadius:8,padding:'6px 10px',textAlign:'center'}}>
                          <div style={{fontSize:9,color:'var(--text3)',fontFamily:'var(--mono)',marginBottom:3}}>{k.l}</div>
                          <div style={{fontSize:13,fontWeight:700,color:k.c,fontFamily:'var(--ff)'}}>{k.v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {sezonAylar&&(
                    <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                      {MF.map((m,i)=>{
                        const aktif=sezonAylar.includes(i);
                        return(
                          <div key={i} style={{fontSize:10,fontFamily:'var(--mono)',padding:'2px 7px',borderRadius:4,fontWeight:aktif?700:400,
                            background:aktif?'rgba(6,214,160,0.15)':'rgba(255,255,255,0.03)',
                            border:`1px solid ${aktif?'rgba(6,214,160,0.35)':'rgba(255,255,255,0.06)'}`,
                            color:aktif?'var(--teal)':'var(--text3)'}}>
                            {m}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {sezonAcilis&&sezonKapanis&&(
                    <button className="btn bg"
                      style={{width:'100%',fontSize:10,padding:'4px',marginTop:8,color:'#ff6eb4',borderColor:'rgba(247,37,133,0.2)'}}
                      onClick={()=>{setSezonAcilis('');setSezonKapanis('');localStorage.removeItem('rv_sezon_acilis');localStorage.removeItem('rv_sezon_kapanis');setSimDirty(true);}}>
                      ✕ Sezon Kaldır — Tam Yıl (365 gün)
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="mg"><label className="lbl">Doluluk: %{simOcc}</label><input type="range" className="slider" min="30" max="100" value={simOcc} onChange={e=>{setSimOcc(+e.target.value);setSimDirty(true);}}/></div>
            {simMode==='Oda Başı'?(
              <div className="mg"><label className="lbl">ADR (Oda Başı): €{simAdr}</label><input type="range" className="slider" min="100" max="600" step="5" value={simAdr} onChange={e=>{setSimAdr(+e.target.value);setSimDirty(true);}}/></div>
            ):(
              <>
                <div className="mg"><label className="lbl">Per Person/Night: €{simPP}</label><input type="range" className="slider" min="40" max="350" step="5" value={simPP} onChange={e=>{setSimPP(+e.target.value);setSimDirty(true);}}/></div>
                <div className="mg"><label className="lbl">Ort. Pax/Oda: {simPax.toFixed(1)}</label><input type="range" className="slider" min="1" max="4" step="0.1" value={simPax} onChange={e=>{setSimPax(+e.target.value);setSimDirty(true);}}/></div>
                <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)',marginBottom:8}}>
                  ADR = €{simPP} × {simPax.toFixed(1)} pax = <strong style={{color:'var(--gold)'}}>€{(simPP*simPax).toFixed(0)}</strong>
                </div>
              </>
            )}
            {simDirty&&(
              <div style={{display:'flex',gap:8,marginTop:4}}>
                <button className="btn bg" style={{flex:1,fontSize:11}} onClick={()=>{setSimOcc(origSim.occ);setSimAdr(origSim.adr);setSimDirty(false);}}>↩ Geri Al</button>
                <button className="btn bp" style={{flex:1,fontSize:11}} onClick={()=>{setSimOcc(simOcc);setSimAdr(simAdr);setOrigSim({occ:simOcc,adr:simAdr});setSimDirty(false);saveSimToDB(simOcc,simAdr);}}>💾 Kaydet</button>
              </div>
            )}
          </>:<div className="notif ny">Revenue Manager yetkisi gereklidir.</div>}
          <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid var(--border)',borderRadius:12,padding:14,marginTop:10}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[
                ['Yıl Sonu',fmt(displaySimT),displaySimT>=hT?'var(--teal)':'#ff6eb4',18],
                ['RevPAR',`€${rp}`,'var(--gold)',18],
                ['ADR',`€${effectiveAdr.toFixed(0)}`,'var(--blue)',14],
                ['Fark',displaySimT>=hT?`+${fmt(displaySimT-hT)}`:`-${fmt(hT-displaySimT)}`,displaySimT>=hT?'var(--teal)':'#ff6eb4',14]
              ].map(([l,v,c,fs])=>(
                <div key={l}><div style={{fontSize:9,color:'var(--text2)',fontFamily:'var(--mono)',marginBottom:2,textTransform:'uppercase'}}>{l}</div><div style={{fontSize:fs,fontWeight:700,fontFamily:'var(--ff)',color:c}}>{v}</div></div>
              ))}
            </div>
            {simMode==='Kişi Başı'&&(
              <div style={{marginTop:10,padding:'8px 10px',background:'rgba(6,214,160,0.06)',border:'1px solid rgba(6,214,160,0.2)',borderRadius:8,fontSize:11,color:'var(--text2)'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,fontFamily:'var(--mono)'}}>
                  <span style={{color:'var(--text3)'}}>PP/Night:</span><span style={{color:'var(--teal)'}}>€{simPP}</span>
                  <span style={{color:'var(--text3)'}}>Pax/Oda:</span><span style={{color:'var(--teal)'}}>{simPax.toFixed(1)}</span>
                  <span style={{color:'var(--text3)'}}>TRevPAR:</span><span style={{color:'var(--gold)'}}>€{(simPP*simPax*simOcc/100).toFixed(0)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── AYLIK KIRILIM ── */}
      <div className="panel" style={{marginBottom:18}}>
        <div className="ptitle">
          📅 Aylık Kırılım
          {elektraReady && <span style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--gold)',fontWeight:400,marginLeft:4}}>⚡ Elektra</span>}
        </div>
        <div className="mgrid">
          {simD.map((m,i)=>{
            const val=m.gercek??m.sim;
            const p=val?(val/m.hedef*100):0;
            const sezonDisinda = sezonAylar && !sezonAylar.includes(i) && !m.gercek;
            const c=m.gercek?(p>=100?'#10b981':'#00d4ff'):'#10b981';
            const pyVal=m.py||null;
            const pyP=pyVal&&m.hedef?(pyVal/m.hedef*100):0;
            const yoyM=pyVal&&val?((val-pyVal)/pyVal*100).toFixed(0):null;
            const mOcc = monthly[i]?.o;
            const mAdr = monthly[i]?.a;
            const hasElektra = elektraReady && (mOcc > 0 || mAdr > 0);
            return(
              <div key={i} className={`mcell${m.gercek!=null?' real':m.sim?' sim':''}`}
                style={hasElektra?{border:'1px solid rgba(245,166,35,0.25)',background:'rgba(245,166,35,0.03)'}:{}}>
                <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)',marginBottom:3,textTransform:'uppercase',letterSpacing:'.06em',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  {m.m}
                  {hasElektra && <span style={{color:'var(--gold)',fontSize:9}}>⚡</span>}
                </div>
                <div style={{fontSize:13,fontWeight:700,fontFamily:'var(--ff)',color:c}}>{val?`${(val/1e6).toFixed(1)}M`:'-'}</div>
                <div style={{fontSize:9,color:'var(--text3)',marginTop:2,fontFamily:'var(--mono)'}}>{m.gercek!=null?`Ger.%${p.toFixed(0)}`:m.sim?`Sim.%${p.toFixed(0)}`:'Bekl.'}</div>
                {val&&<div style={{marginTop:4,height:3,background:'rgba(255,255,255,0.08)',borderRadius:2,overflow:'hidden'}}><div style={{width:`${Math.min(p,100)}%`,height:'100%',background:c}}/></div>}
                {/* Elektra OCC/ADR */}
                {hasElektra && (
                  <div style={{marginTop:4,paddingTop:4,borderTop:'1px solid rgba(245,166,35,0.15)'}}>
                    {mOcc > 0 && <div style={{fontSize:9,color:'var(--gold)',fontFamily:'var(--mono)'}}>OCC %{mOcc.toFixed(0)}</div>}
                    {mAdr > 0 && <div style={{fontSize:9,color:'var(--gold)',fontFamily:'var(--mono)'}}>ADR €{mAdr}</div>}
                  </div>
                )}
                {showPY&&pyVal&&<div style={{marginTop:4,borderTop:'1px solid rgba(255,255,255,0.06)',paddingTop:4}}>
                  <div style={{fontSize:9,color:'var(--text3)',fontFamily:'var(--mono)'}}>{`GY: ${(pyVal/1e6).toFixed(1)}M`}</div>
                  {yoyM&&<div style={{fontSize:9,fontWeight:700,color:+yoyM>=0?'var(--teal)':'#ff6eb4'}}>{+yoyM>=0?'▲':'▼'}{Math.abs(yoyM)}%</div>}
                </div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
