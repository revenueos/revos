import React, { useState, useMemo } from 'react';
import { AreaChartSVG, Legend } from './Charts';
import { fmt, fmtK } from '../utils/format';
import { MF } from '../data/constants';

function Dashboard({user,monthly,simOcc,setSimOcc,simAdr,setSimAdr,saveSimToDB,
  elektraReady,elektraStatus,elektraLastSync,elektraSyncing,onElektraSync,elektraWorkerUrl,elektraMonthsCache}){
  const WORKER_URL = elektraWorkerUrl || 'https://elektra-proxy.noxinn-presentation.workers.dev';
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

  // Elektra dönem seçici
  const curYear = new Date().getFullYear();
  const [elektraYear, setElektraYear] = useState(curYear);
  const [elektraMonth, setElektraMonth] = useState(null); // null = yıllık görünüm
  const [elektraDetail, setElektraDetail] = useState(null); // seçili ay detayı
  const [elektraYearData, setElektraYearData] = useState(() => {
    try {
      const saved = localStorage.getItem('rv_elektra_year_data');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  }); // {year: months[]}

  // App'ten gelen cache güncellenince state'i de güncelle
  React.useEffect(() => {
    if (elektraMonthsCache && Object.keys(elektraMonthsCache).length > 0) {
      setElektraYearData(prev => ({ ...prev, ...elektraMonthsCache }));
    }
  }, [elektraMonthsCache]);
  const [elektraLoading, setElektraLoading] = useState(false);

  const MFull = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

  const loadElektraYear = async (year) => {
    const workerUrl = WORKER_URL;
    if (!workerUrl) return;
    if (elektraYearData[year]) { setElektraYear(year); return; }
    setElektraLoading(true);
    try {
      const q = new URLSearchParams({ action: 'monthly_stats', token, year });
      const res = await fetch(`${workerUrl}?${q}`);
      const data = await res.json();
      if (data.ok && data.months) {
        setElektraYearData(prev => {
          const updated = { ...prev, [year]: data.months };
          try { localStorage.setItem('rv_elektra_year_data', JSON.stringify(updated)); } catch {}
          return updated;
        });
      }
    } catch(e) {}
    setElektraLoading(false);
    setElektraYear(year);
  };

  const elektraMonths = elektraYearData[elektraYear] || [];

  // Elektra bağlıysa ve cache'de veri yoksa otomatik yükle
  React.useEffect(() => {
    if (elektraReady && !elektraYearData[elektraYear] && !elektraLoading && WORKER_URL) {
      loadElektraYear(elektraYear);
    }
  }, [elektraReady, elektraYear]);

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

      {/* ── ELEKTRA VERİ PANELİ ── */}
      {elektraReady && (
        <div className="panel" style={{marginBottom:16}}>
          <div className="ptitle" style={{marginBottom:12}}>
            ⚡ Elektra PMS Verileri
            {elektraLoading && <span style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)',marginLeft:8}}>yükleniyor…</span>}
          </div>

          {/* Yıl/Ay Seçici */}
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14,flexWrap:'wrap'}}>
            {/* Yıl seçici */}
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <button className="btn bg" style={{padding:'4px 10px',fontSize:12}}
                onClick={()=>loadElektraYear(elektraYear-1)}>◀</button>
              <div style={{fontSize:14,fontWeight:700,fontFamily:'var(--mono)',color:'var(--gold)',minWidth:50,textAlign:'center'}}>{elektraYear}</div>
              <button className="btn bg" style={{padding:'4px 10px',fontSize:12}}
                onClick={()=>loadElektraYear(elektraYear+1)} disabled={elektraYear>=curYear}>▶</button>
            </div>

            {/* Ay seçici */}
            <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
              <button
                className={`btn ${elektraMonth===null?'bp':'bg'}`}
                style={{fontSize:10,padding:'3px 10px'}}
                onClick={()=>{setElektraMonth(null);setElektraDetail(null);}}>
                Yıllık
              </button>
              {MFull.map((m,i)=>{
                const row = elektraMonths.find(r=>r.month===i+1);
                const hasData = row && (row.occupancy>0||row.rooms>0);
                return (
                  <button key={i}
                    className={`btn ${elektraMonth===i?'bp':'bg'}`}
                    style={{fontSize:10,padding:'3px 8px',
                      color: hasData ? 'var(--teal)' : 'var(--text3)',
                      borderColor: hasData ? 'rgba(6,214,160,0.3)' : undefined}}
                    onClick={()=>{
                      setElektraMonth(i);
                      setElektraDetail(row||null);
                      if(!elektraYearData[elektraYear]) loadElektraYear(elektraYear);
                    }}>
                    {m.slice(0,3)}
                  </button>
                );
              })}
            </div>

            <button className="btn bg" style={{fontSize:10,padding:'3px 10px',marginLeft:'auto'}}
              onClick={()=>{
                // Cache'i temizle ve yeniden çek
                setElektraYearData(prev => {
                  const updated = {...prev};
                  delete updated[elektraYear];
                  try { localStorage.setItem('rv_elektra_year_data', JSON.stringify(updated)); } catch {}
                  return updated;
                });
                setTimeout(() => loadElektraYear(elektraYear), 50);
              }}
              disabled={elektraLoading}>
              🔄 Yenile
            </button>
          </div>

          {/* Yıllık Özet */}
          {elektraMonth===null && (
            <div>
              {elektraMonths.length === 0 ? (
                <div style={{textAlign:'center',padding:'24px',color:'var(--text3)',fontSize:12}}>
                  {elektraLoading ? '⏳ Yükleniyor…' : 'Veri yok — Yenile butonuna basın'}
                </div>
              ) : (
                <>
                  {/* Özet KPI */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:14}}>
                    {[
                      {l:'Sezon Ort. OCC', v: (() => { const d=elektraMonths.filter(m=>m.occupancy>0); return d.length?`%${Math.round(d.reduce((a,b)=>a+b.occupancy,0)/d.length)}`:'-'; })(), c:'var(--teal)', icon:'🏨'},
                      {l:'Günlük Ort. Dolu Oda', v: (() => { const d=elektraMonths.filter(m=>m.rooms>0); return d.length?`${Math.round(d.reduce((a,b)=>a+b.rooms,0)/d.length)}/gün`:'-'; })(), c:'var(--blue)', icon:'🛏'},
                      {l:'Toplam Konaklama', v: (() => { const t=elektraMonths.reduce((a,b)=>a+(b.rooms_total||b.rooms||0),0); return t?t.toLocaleString('tr-TR')+' gece':'-'; })(), c:'#4cc9f0', icon:'🌙'},
                      {l:'Ort. ADR', v: (() => { const d=elektraMonths.filter(m=>m.adr>0); return d.length?`€${Math.round(d.reduce((a,b)=>a+b.adr,0)/d.length)}`:'-'; })(), c:'var(--gold)', icon:'💰'},
                      {l:'Kapasite', v: (() => { const c=elektraMonths.find(m=>m.capacity>0); return c?c.capacity+' oda':'-'; })(), c:'#a78bfa', icon:'🏗'},
                    ].map((k,i)=>(
                      <div key={i} style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 14px'}}>
                        <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)',marginBottom:6}}>{k.icon} {k.l}</div>
                        <div style={{fontSize:20,fontWeight:700,color:k.c,fontFamily:'var(--ff)'}}>{k.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Aylık OCC tablosu */}
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                      <thead>
                        <tr style={{borderBottom:'1px solid var(--border)'}}>
                          <th style={{textAlign:'left',padding:'6px 8px',color:'var(--text3)',fontWeight:500,fontSize:11}}>Ay</th>
                          <th style={{textAlign:'center',padding:'6px 8px',color:'var(--teal)',fontWeight:600,fontSize:11}}>OCC %</th>
                          <th style={{textAlign:'center',padding:'6px 8px',color:'var(--gold)',fontWeight:600,fontSize:11}}>ADR €</th>
                          <th style={{textAlign:'center',padding:'6px 8px',color:'var(--blue)',fontWeight:600,fontSize:11}}>Dolu Oda</th>
                          <th style={{textAlign:'center',padding:'6px 8px',color:'#4cc9f0',fontWeight:600,fontSize:11}}>Toplam Konaklama</th>
                          <th style={{textAlign:'center',padding:'6px 8px',color:'#a78bfa',fontWeight:600,fontSize:11}}>Kapasite</th>
                          <th style={{textAlign:'left',padding:'6px 8px',color:'var(--text3)',fontWeight:500,fontSize:11}}>Doluluk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {elektraMonths.map((row,i)=>{
                          const occ = row.occupancy || 0;
                          const hasData = occ > 0 || row.rooms > 0;
                          return (
                            <tr key={i}
                              style={{borderBottom:'1px solid rgba(255,255,255,0.04)',cursor:'pointer',
                                background: hasData ? 'rgba(6,214,160,0.03)' : 'transparent'}}
                              onClick={()=>{setElektraMonth(i);setElektraDetail(row);}}>
                              <td style={{padding:'8px 8px',fontWeight:600,color:hasData?'var(--text)':'var(--text3)'}}>
                                {MFull[row.month-1]}
                              </td>
                              <td style={{textAlign:'center',padding:'8px',fontFamily:'var(--mono)',
                                fontWeight:700,color:occ>=80?'var(--teal)':occ>=50?'var(--gold)':occ>0?'var(--text2)':'var(--text3)'}}>
                                {occ > 0 ? `%${occ.toFixed(0)}` : '—'}
                              </td>
                              <td style={{textAlign:'center',padding:'8px',fontFamily:'var(--mono)',color:row.adr>0?'var(--gold)':'var(--text3)'}}>
                                {row.adr > 0 ? `€${row.adr}` : '—'}
                              </td>
                              <td style={{textAlign:'center',padding:'8px',fontFamily:'var(--mono)',color:'var(--blue)'}}>
                                {row.rooms > 0 ? `${row.rooms}/gün` : '—'}
                              </td>
                              <td style={{textAlign:'center',padding:'8px',fontFamily:'var(--mono)',color:'#4cc9f0'}}>
                                {row.rooms_total > 0 ? row.rooms_total.toLocaleString('tr-TR') : '—'}
                              </td>
                              <td style={{textAlign:'center',padding:'8px',fontFamily:'var(--mono)',color:'#a78bfa'}}>
                                {row.capacity > 0 ? row.capacity : '—'}
                              </td>
                              <td style={{padding:'8px',minWidth:120}}>
                                {occ > 0 ? (
                                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                                    <div style={{flex:1,height:6,background:'rgba(255,255,255,0.08)',borderRadius:3}}>
                                      <div style={{width:`${Math.min(occ,100)}%`,height:'100%',borderRadius:3,
                                        background:occ>=80?'var(--teal)':occ>=50?'var(--gold)':'#ff6eb4'}}/>
                                    </div>
                                    <span style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--text3)',minWidth:28}}>
                                      {occ.toFixed(0)}%
                                    </span>
                                  </div>
                                ) : <span style={{color:'var(--text3)',fontSize:11}}>—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Aylık Detay */}
          {elektraMonth !== null && (
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                <button className="btn bg" style={{fontSize:11,padding:'4px 10px'}}
                  onClick={()=>{setElektraMonth(null);setElektraDetail(null);}}>
                  ← Yıllık Görünüm
                </button>
                <span style={{fontWeight:700,fontSize:14,color:'var(--gold)'}}>
                  {MFull[elektraMonth]} {elektraYear}
                </span>
              </div>

              {elektraDetail ? (
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
                  {[
                    {l:'Doluluk', v:elektraDetail.occupancy>0?`%${elektraDetail.occupancy.toFixed(1)}`:'—', c:'var(--teal)', icon:'🏨'},
                    {l:'Ort. Oda Fiyatı (ADR)', v:elektraDetail.adr>0?`€${elektraDetail.adr}`:'—', c:'var(--gold)', icon:'💰'},
                    {l:'Dolu Oda (Günlük Ort.)', v:elektraDetail.rooms>0?`${elektraDetail.rooms} oda`:'—', c:'var(--blue)', icon:'🛏'},
                    {l:'Toplam Kapasite', v:elektraDetail.capacity>0?`${elektraDetail.capacity} oda`:'—', c:'#a78bfa', icon:'🏗'},
                  ].map((k,i)=>(
                    <div key={i} style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px'}}>
                      <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)',marginBottom:8}}>{k.icon} {k.l}</div>
                      <div style={{fontSize:26,fontWeight:700,color:k.c,fontFamily:'var(--ff)'}}>{k.v}</div>
                    </div>
                  ))}
                  {elektraDetail.occupancy > 0 && (
                    <div style={{gridColumn:'1/-1',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px'}}>
                      <div style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)',marginBottom:10}}>📊 RevPAR</div>
                      <div style={{fontSize:22,fontWeight:700,color:'var(--gold)',fontFamily:'var(--ff)'}}>
                        €{elektraDetail.adr > 0 ? Math.round(elektraDetail.adr * elektraDetail.occupancy / 100) : '—'}
                      </div>
                      <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>
                        ADR €{elektraDetail.adr} × OCC %{elektraDetail.occupancy?.toFixed(0)}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{textAlign:'center',padding:'24px',color:'var(--text3)',fontSize:12}}>
                  Bu ay için Elektra verisi yok
                </div>
              )}
            </div>
          )}
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
