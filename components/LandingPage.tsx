'use client'
import { useState, useEffect } from 'react'
import { SignInButton } from '@clerk/nextjs'

const HERO_POOL = [
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600&q=85',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1600&q=85',
  'https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=1600&q=85',
  'https://images.unsplash.com/photo-1488085061387-422e29b40080?w=1600&q=85',
]

const MOODS = [
  { id:'relax',     label:'Relaxed',   emoji:'🌊', color:'#22d3ee' },
  { id:'adventure', label:'Adventure', emoji:'🧗', color:'#4ade80' },
  { id:'culture',   label:'Culture',   emoji:'🏛',  color:'#a78bfa' },
  { id:'romance',   label:'Romance',   emoji:'🌹', color:'#f472b6' },
  { id:'party',     label:'Nightlife', emoji:'🎉', color:'#fbbf24' },
  { id:'nature',    label:'Nature',    emoji:'🌿', color:'#34d399' },
]

const FEATURED = [
  { name:'Tokyo',        country:'Japan',        tag:'City',      moods:['culture','party'],    bestTime:'Mar–May', budget:'$$',  quickTrips:['3 days','5 days','7 days'],  fb:'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=85' },
  { name:'Bali',         country:'Indonesia',    tag:'Beach',     moods:['relax','adventure'],  bestTime:'Apr–Oct', budget:'$',   quickTrips:['5 days','7 days','10 days'], fb:'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=85' },
  { name:'Paris',        country:'France',       tag:'Culture',   moods:['culture','romance'],  bestTime:'Apr–Jun', budget:'$$$', quickTrips:['3 days','5 days','7 days'],  fb:'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=85' },
  { name:'Santorini',    country:'Greece',       tag:'Beach',     moods:['relax','romance'],    bestTime:'Jun–Sep', budget:'$$$', quickTrips:['4 days','7 days'],           fb:'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=600&q=85' },
  { name:'New York',     country:'USA',          tag:'City',      moods:['culture','party'],    bestTime:'Sep–Nov', budget:'$$$', quickTrips:['3 days','5 days','7 days'],  fb:'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&q=85' },
  { name:'Kyoto',        country:'Japan',        tag:'Culture',   moods:['culture','nature'],   bestTime:'Mar–May', budget:'$$',  quickTrips:['3 days','5 days'],           fb:'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&q=85' },
  { name:'Queenstown',   country:'New Zealand',  tag:'Adventure', moods:['adventure','nature'], bestTime:'Dec–Feb', budget:'$$$', quickTrips:['5 days','7 days','10 days'], fb:'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=85' },
  { name:'Amalfi Coast', country:'Italy',        tag:'Romance',   moods:['romance','relax'],    bestTime:'May–Sep', budget:'$$$', quickTrips:['4 days','7 days'],           fb:'https://images.unsplash.com/photo-1533587851505-d119e13fa0d7?w=600&q=85' },
  { name:'Medellin',     country:'Colombia',     tag:'City',      moods:['party','culture'],    bestTime:'Dec–Mar', budget:'$',   quickTrips:['4 days','7 days'],           fb:'https://images.unsplash.com/photo-1598023696416-0193a0bcd302?w=600&q=85' },
  { name:'Phuket',       country:'Thailand',     tag:'Beach',     moods:['relax','party'],      bestTime:'Nov–Apr', budget:'$',   quickTrips:['5 days','7 days','10 days'], fb:'https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?w=600&q=85' },
  { name:'Patagonia',    country:'Argentina',    tag:'Nature',    moods:['adventure','nature'], bestTime:'Nov–Mar', budget:'$$',  quickTrips:['7 days','10 days','14 days'],fb:'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=600&q=85' },
  { name:'Marrakech',    country:'Morocco',      tag:'Culture',   moods:['culture','adventure'],bestTime:'Mar–May', budget:'$',   quickTrips:['3 days','5 days','7 days'],  fb:'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=600&q=85' },
]

export default function LandingPage() {
  const [heroBgIdx, setHeroBgIdx]       = useState(0)
  const [selectedMood, setSelectedMood] = useState<string|null>(null)
  const [mounted, setMounted]           = useState(false)

  useEffect(() => {
    setMounted(true)
    const t = setInterval(() => setHeroBgIdx(i => (i + 1) % HERO_POOL.length), 5500)
    return () => clearInterval(t)
  }, [])

  if (!mounted) return <div style={{ minHeight:'100vh', background:'#080810' }} />

  const c = {
    bg:        '#080810',
    surface:   'rgba(14,14,24,0.94)',
    surfaceHi: 'rgba(22,22,38,0.97)',
    border:    'rgba(255,255,255,0.07)',
    borderHi:  'rgba(255,255,255,0.13)',
    text:      '#ececff',
    textSec:   'rgba(236,236,255,0.5)',
    textTert:  'rgba(236,236,255,0.24)',
    accent:    '#22d3ee',
    accentGlow:'rgba(34,211,238,0.18)',
    accentSoft:'rgba(34,211,238,0.07)',
    violet:    '#a78bfa',
  }

  const filtered = selectedMood
    ? FEATURED.filter(d => d.moods.includes(selectedMood))
    : FEATURED

  // Split: first card is hero, rest go in horizontal scroll
  const heroCard  = filtered[0]
  const scrollCards = filtered.slice(1)

  return (
    <div style={{
      fontFamily:"-apple-system,'SF Pro Display',BlinkMacSystemFont,'Helvetica Neue',sans-serif",
      minHeight:'100vh',
      background:c.bg,
      position:'relative',
      overflow:'hidden',
    }}>
      <style>{`
        *{box-sizing:border-box}

        @keyframes floatbg{0%,100%{transform:scale(1.04) translateY(0)}50%{transform:scale(1.08) translateY(-14px)}}
        @keyframes up0{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glowpulse{0%,100%{opacity:0.6}50%{opacity:1}}

        .land-aup { animation:up0 0.55s cubic-bezier(0.25,0.46,0.45,0.94) both }
        .land-aup1{ animation:up0 0.55s cubic-bezier(0.25,0.46,0.45,0.94) 0.1s both }
        .land-aup2{ animation:up0 0.55s cubic-bezier(0.25,0.46,0.45,0.94) 0.2s both }
        .land-aup3{ animation:up0 0.55s cubic-bezier(0.25,0.46,0.45,0.94) 0.3s both }
        .land-aup4{ animation:up0 0.55s cubic-bezier(0.25,0.46,0.45,0.94) 0.4s both }

        /* Hero big card */
        .hero-card{
          position:relative;border-radius:20px;overflow:hidden;
          cursor:pointer;border:none;padding:0;text-align:left;
          display:block;width:100%;
          transition:transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94),box-shadow 0.28s;
        }
        .hero-card:hover{transform:translateY(-3px) scale(1.01)}
        .hero-card:active{transform:scale(0.98)}
        .hero-card img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.55s}
        .hero-card:hover img{transform:scale(1.05)}

        /* Horizontal scroll cards */
        .dest-scroll{
          display:flex;gap:12px;overflow-x:auto;padding-bottom:10px;
          scrollbar-width:none;-ms-overflow-style:none;
        }
        .dest-scroll::-webkit-scrollbar{display:none}

        .dest-pill{
          flex-shrink:0;position:relative;width:155px;height:200px;
          border-radius:18px;overflow:hidden;cursor:pointer;border:none;padding:0;
          transition:transform 0.22s cubic-bezier(0.25,0.46,0.45,0.94),box-shadow 0.22s;
        }
        .dest-pill:hover{transform:translateY(-4px) scale(1.03)}
        .dest-pill:active{transform:scale(0.97)}
        .dest-pill img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.45s}
        .dest-pill:hover img{transform:scale(1.08)}

        .mood-btn{
          display:flex;align-items:center;gap:7px;
          padding:8px 15px;border-radius:999px;
          font-size:13px;font-weight:600;cursor:pointer;
          font-family:inherit;
          transition:all 0.22s cubic-bezier(0.25,0.46,0.45,0.94);
        }
        .mood-btn:active{transform:scale(0.95)}

        .signin-btn{
          display:inline-flex;align-items:center;gap:9px;
          padding:14px 32px;border-radius:14px;
          font-size:15px;font-weight:700;cursor:pointer;
          font-family:inherit;letter-spacing:-0.01em;
          transition:all 0.22s cubic-bezier(0.25,0.46,0.45,0.94);
        }
        .signin-btn:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(34,211,238,0.35)!important}
        .signin-btn:active{transform:scale(0.97)}

        .quick-chip{
          padding:5px 13px;border-radius:999px;font-size:11px;font-weight:700;
          background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.22);
          color:white;cursor:default;font-family:inherit;backdrop-filter:blur(6px);
        }

        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(150,150,200,0.16);border-radius:2px}
      `}</style>

      {/* ── Background — NO grid ── */}
      <div style={{ position:'fixed',inset:0,zIndex:0,overflow:'hidden' }}>
        {HERO_POOL.map((src, i) => (
          <div key={i} style={{
            position:'absolute',inset:'-10%',
            backgroundImage:`url(${src})`,
            backgroundSize:'cover',backgroundPosition:'center',
            opacity: i === heroBgIdx ? 0.16 : 0,
            transition:'opacity 2.2s ease',
            animation:'floatbg 22s ease-in-out infinite',
            animationDelay:`${i*0.7}s`,
            filter:'saturate(0.65) brightness(0.78)',
            willChange:'transform,opacity',
          }} />
        ))}
        {/* Dark overlay — clean, no grid */}
        <div style={{
          position:'absolute',inset:0,
          background:'linear-gradient(145deg,rgba(8,8,16,0.84) 0%,rgba(8,8,16,0.62) 45%,rgba(8,8,16,0.9) 100%)',
        }} />
        {/* Ambient orbs only */}
        <div style={{ position:'absolute',top:'6%',right:'8%',width:500,height:500,borderRadius:'50%',
          background:'radial-gradient(circle,rgba(34,211,238,0.09),transparent 68%)',pointerEvents:'none' }} />
        <div style={{ position:'absolute',bottom:'10%',left:'4%',width:380,height:380,borderRadius:'50%',
          background:'radial-gradient(circle,rgba(167,139,250,0.06),transparent 68%)',pointerEvents:'none' }} />
      </div>

      {/* ── Shell ── */}
      <div style={{ position:'relative',zIndex:10,maxWidth:780,margin:'0 auto',padding:'0 0 100px' }}>

        {/* ── Nav ── */}
        <div style={{
          position:'sticky',top:0,zIndex:100,
          background:'rgba(8,8,16,0.84)',
          backdropFilter:'blur(20px) saturate(180%)',
          WebkitBackdropFilter:'blur(20px) saturate(180%)',
          borderBottom:`0.5px solid ${c.border}`,
          padding:'13px 22px 11px',
          display:'flex',alignItems:'center',justifyContent:'space-between',
        }}>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <svg width="30" height="30" viewBox="0 0 32 32">
              <polygon points="16,2 30,9 30,23 16,30 2,23 2,9" fill="none" stroke={c.accent} strokeWidth="1.5" opacity="0.9" />
              <text x="16" y="21" textAnchor="middle" fontSize="13" fill={c.accent}>✈</text>
            </svg>
            <div>
              <p style={{ margin:0,fontSize:15,fontWeight:700,color:c.text,letterSpacing:'-0.01em' }}>Voyage</p>
              <p style={{ margin:0,fontSize:9,color:c.textSec,letterSpacing:'0.12em',fontWeight:600,textTransform:'uppercase' }}>AI Travel Planner</p>
            </div>
          </div>
          <SignInButton mode="modal">
            <button className="signin-btn" style={{
              background:'rgba(34,211,238,0.1)',
              border:`1px solid ${c.accent}`,
              color:c.accent,
              fontSize:12,
              padding:'8px 20px',
              boxShadow:`0 0 16px ${c.accentGlow}`,
            }}>Sign in →</button>
          </SignInButton>
        </div>

        {/* ── Hero headline ── */}
        <div className="land-aup" style={{ padding:'52px 22px 8px' }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:14 }}>
            <div style={{ width:22,height:1.5,background:c.accent,opacity:0.85,borderRadius:1 }} />
            <p style={{ margin:0,fontSize:10,fontWeight:700,color:c.accent,letterSpacing:'0.18em',textTransform:'uppercase' }}>
              AI-Powered Travel Planning
            </p>
          </div>

          <h1 style={{ margin:'0 0 18px',fontSize:52,fontWeight:800,color:c.text,letterSpacing:'-0.038em',lineHeight:1.02 }}>
            Your perfect trip,<br/>
            <span style={{ color:c.accent,position:'relative',display:'inline-block' }}>
              planned in seconds.
              <svg style={{ position:'absolute',bottom:-6,left:0,width:'100%',height:6,overflow:'visible' }} preserveAspectRatio="none">
                <line x1="0" y1="3" x2="100%" y2="3" stroke={c.accent} strokeWidth="1.5" strokeDasharray="5 4" opacity="0.5" />
              </svg>
            </span>
          </h1>

          <p style={{ margin:'0 0 26px',fontSize:16,color:c.textSec,lineHeight:1.65,maxWidth:460 }}>
            Tell us where you want to go — we'll build a day-by-day itinerary with photos, local tips, and a full budget breakdown.
          </p>

          {/* Feature pills */}
          <div style={{ display:'flex',gap:8,flexWrap:'wrap',marginBottom:4 }}>
            {[
              { icon:'⬡', label:'Day-by-day itinerary' },
              { icon:'◎', label:'Local research & tips' },
              { icon:'◇', label:'Budget breakdown'     },
              { icon:'◈', label:'Live AI generation'   },
            ].map(f => (
              <div key={f.label} style={{
                display:'flex',alignItems:'center',gap:6,
                padding:'6px 13px',borderRadius:999,
                background:'rgba(255,255,255,0.04)',
                border:`0.5px solid ${c.borderHi}`,
                fontSize:12,fontWeight:600,color:c.textSec,
              }}>
                <span style={{ color:c.accent,fontSize:11 }}>{f.icon}</span>
                {f.label}
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="land-aup1" style={{ padding:'20px 22px 44px' }}>
          <SignInButton mode="modal">
            <button className="signin-btn" style={{
              background:`linear-gradient(135deg,rgba(34,211,238,0.18),rgba(167,139,250,0.14))`,
              border:`1px solid ${c.accent}`,
              color:'white',
              fontSize:15,
              boxShadow:`0 0 32px ${c.accentGlow}, 0 4px 24px rgba(0,0,0,0.4)`,
            }}>
              <span style={{ fontSize:18 }}>✈</span>
              Start Planning for Free
            </button>
          </SignInButton>
          <p style={{ margin:'10px 0 0',fontSize:11,color:c.textTert,letterSpacing:'0.06em' }}>
            No credit card required
          </p>
        </div>

        {/* ── Mood selector ── */}
        <div className="land-aup2" style={{ padding:'0 22px' }}>
          <p style={{ margin:'0 0 12px',fontSize:11,fontWeight:700,color:c.textSec,letterSpacing:'0.12em',textTransform:'uppercase' }}>
            What's your travel vibe?
          </p>
          <div style={{ display:'flex',gap:8,flexWrap:'wrap',marginBottom:28 }}>
            {MOODS.map(m => {
              const active = selectedMood === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMood(active ? null : m.id)}
                  className="mood-btn"
                  style={{
                    border:`1px solid ${active ? m.color : c.border}`,
                    background: active ? `${m.color}18` : 'rgba(255,255,255,0.03)',
                    color: active ? m.color : c.textSec,
                    boxShadow: active ? `0 0 16px ${m.color}33` : 'none',
                  }}
                >
                  <span style={{ fontSize:15 }}>{m.emoji}</span>
                  {m.label}
                </button>
              )
            })}
          </div>

          {/* Section header */}
          <div style={{ display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:14 }}>
            <p style={{ margin:0,fontSize:20,fontWeight:700,color:c.text,letterSpacing:'-0.02em' }}>
              {selectedMood ? (MOODS.find(m=>m.id===selectedMood)?.label + ' Escapes') : 'Featured Trips'}
            </p>
            <p style={{ margin:0,fontSize:12,color:c.textTert,fontWeight:500 }}>
              {filtered.length} destinations
            </p>
          </div>
        </div>

        {/* ── Big hero card ── */}
        {heroCard && (() => {
          const moodMeta = MOODS.find(m => m.id === heroCard.moods[0])
          return (
            <div className="land-aup3" style={{ padding:'0 22px',marginBottom:12 }}>
              <div className="hero-card" style={{ height:248,boxShadow:'0 8px 48px rgba(0,0,0,0.65)' }}>
                <img src={heroCard.fb} alt={heroCard.name} />
                <div style={{ position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,0.9) 0%,rgba(0,0,0,0.08) 55%,transparent 100%)' }} />

                {/* Mood tags */}
                <div style={{ position:'absolute',top:14,left:14,display:'flex',gap:6 }}>
                  {heroCard.moods.slice(0,2).map(mid => {
                    const mood = MOODS.find(m => m.id === mid)
                    return mood ? (
                      <div key={mid} style={{
                        padding:'4px 11px',borderRadius:999,fontSize:10,fontWeight:700,
                        background:`${mood.color}22`,border:`1px solid ${mood.color}55`,
                        color:mood.color,backdropFilter:'blur(6px)',
                      }}>
                        {mood.emoji} {mood.label}
                      </div>
                    ) : null
                  })}
                </div>

                {/* Corner accent */}
                <div style={{ position:'absolute',top:0,right:0,width:22,height:22,
                  borderTop:`1.5px solid ${c.accent}`,borderRight:`1.5px solid ${c.accent}`,
                  borderRadius:'0 20px 0 0',opacity:0.7 }} />

                <div style={{ position:'absolute',bottom:0,left:0,right:0,padding:'0 18px 18px' }}>
                  <div style={{ display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:12 }}>
                    <div>
                      <p style={{ margin:0,color:'white',fontSize:30,fontWeight:800,letterSpacing:'-0.025em',textShadow:'0 2px 12px rgba(0,0,0,0.7)' }}>{heroCard.name}</p>
                      <p style={{ margin:'3px 0 0',color:'rgba(255,255,255,0.45)',fontSize:13,fontWeight:500 }}>{heroCard.country}</p>
                    </div>
                    <div style={{ textAlign:'right',flexShrink:0 }}>
                      <p style={{ margin:0,color:'rgba(255,255,255,0.35)',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em' }}>Best time</p>
                      <p style={{ margin:'2px 0 0',color:'white',fontSize:12,fontWeight:700 }}>{heroCard.bestTime}</p>
                      <p style={{ margin:'5px 0 0',color:moodMeta?.color || c.accent,fontSize:14,fontWeight:800,
                        filter:`drop-shadow(0 0 6px ${moodMeta?.color || c.accent}55)` }}>{heroCard.budget}</p>
                    </div>
                  </div>
                  <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
                    {heroCard.quickTrips.map(q => (
                      <div key={q} className="quick-chip">{q}</div>
                    ))}
                    <SignInButton mode="modal">
                      <button style={{
                        padding:'5px 14px',borderRadius:999,fontSize:11,fontWeight:700,
                        background:`${c.accent}22`,border:`1px solid ${c.accent}66`,
                        color:c.accent,cursor:'pointer',fontFamily:'inherit',backdropFilter:'blur(6px)',
                      }}>
                        Plan this trip →
                      </button>
                    </SignInButton>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── Horizontal scroll cards ── */}
        <div className="land-aup4">
          <div className="dest-scroll" style={{ padding:'4px 22px 14px' }}>
            {scrollCards.map(d => {
              const moodMeta = MOODS.find(m => m.id === d.moods[0])
              return (
                <div key={d.name} className="dest-pill"
                  style={{ boxShadow:'0 6px 28px rgba(0,0,0,0.6)' }}>
                  <img src={d.fb} alt={d.name} />
                  <div style={{ position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.02) 55%,transparent 100%)' }} />

                  {/* Mood/tag pill */}
                  <div style={{
                    position:'absolute',top:10,left:10,
                    padding:'3px 9px',borderRadius:999,
                    fontSize:9,fontWeight:700,letterSpacing:'0.07em',
                    background: moodMeta ? `${moodMeta.color}22` : 'rgba(0,0,0,0.4)',
                    border: moodMeta ? `1px solid ${moodMeta.color}55` : '0.5px solid rgba(255,255,255,0.2)',
                    color: moodMeta?.color || 'white',
                    backdropFilter:'blur(8px)',
                  }}>
                    {moodMeta?.emoji} {d.tag}
                  </div>

                  {/* Corner accent */}
                  <div style={{ position:'absolute',top:0,right:0,width:16,height:16,
                    borderTop:`1.5px solid ${c.accent}`,borderRight:`1.5px solid ${c.accent}`,
                    borderRadius:'0 18px 0 0',opacity:0.6 }} />

                  <div style={{ position:'absolute',bottom:0,left:0,right:0,padding:'0 12px 13px' }}>
                    <p style={{ margin:0,color:'white',fontSize:14,fontWeight:700,lineHeight:1.2 }}>{d.name}</p>
                    <p style={{ margin:'2px 0 6px',color:'rgba(255,255,255,0.45)',fontSize:10 }}>{d.country}</p>

                    {/* Budget badge */}
                    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                      <div style={{
                        display:'inline-flex',alignItems:'center',
                        padding:'3px 8px',borderRadius:999,fontSize:9,fontWeight:700,
                        background:'rgba(255,255,255,0.1)',border:'0.5px solid rgba(255,255,255,0.2)',
                        color:'rgba(255,255,255,0.8)',
                      }}>
                        📅 {d.quickTrips[0]}
                      </div>
                      <span style={{ fontSize:12,fontWeight:800,color:moodMeta?.color || c.accent,
                        filter:`drop-shadow(0 0 5px ${moodMeta?.color || c.accent}55)` }}>
                        {d.budget}
                      </span>
                    </div>

                    <SignInButton mode="modal">
                      <button style={{
                        marginTop:8,width:'100%',
                        padding:'5px 0',borderRadius:999,fontSize:10,fontWeight:700,
                        background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.18)',
                        color:'white',cursor:'pointer',fontFamily:'inherit',backdropFilter:'blur(6px)',
                      }}>
                        Plan trip →
                      </button>
                    </SignInButton>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Bottom CTA ── */}
        <div style={{ textAlign:'center',margin:'44px 22px 0',paddingTop:32,borderTop:`0.5px solid ${c.border}` }}>
          <p style={{ margin:'0 0 6px',fontSize:24,fontWeight:800,color:c.text,letterSpacing:'-0.02em' }}>
            Ready to explore?
          </p>
          <p style={{ margin:'0 0 24px',fontSize:14,color:c.textSec }}>
            Sign in to generate your personalised AI itinerary.
          </p>
          <SignInButton mode="modal">
            <button className="signin-btn" style={{
              background:`linear-gradient(135deg,rgba(34,211,238,0.18),rgba(167,139,250,0.14))`,
              border:`1px solid ${c.accent}`,
              color:'white',
              fontSize:15,
              boxShadow:`0 0 32px ${c.accentGlow}, 0 4px 24px rgba(0,0,0,0.4)`,
            }}>
              <span style={{ fontSize:18 }}>✈</span>
              Get Started Free
            </button>
          </SignInButton>
        </div>

        <p style={{ textAlign:'center',fontSize:10,marginTop:28,color:c.textTert,letterSpacing:'0.08em',fontWeight:600,textTransform:'uppercase' }}>
          Voyage · Powered by AI
        </p>
      </div>
    </div>
  )
}