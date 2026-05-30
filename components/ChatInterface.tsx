'use client';
import { useState, useEffect, useRef } from 'react'
import Vapi from '@vapi-ai/web'

type PlanData = { plan: string; research: string; budget: string | Record<string,unknown> } | null
type Tab = 'stream' | 'plan' | 'research' | 'budget'

function stripMarkdown(text: string): string {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '').replace(/`(.*?)`/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/^[-*]\s/gm, '• ').trim()
}

function parsePlan(text: string): { title: string; body: string }[] {
  if (!text || typeof text !== 'string') return []
  const clean = stripMarkdown(text)
  const lines = clean.split('\n').filter(l => l.trim())
  const sections: { title: string; body: string }[] = []
  let current: { title: string; lines: string[] } | null = null
  for (const line of lines) {
    const isHeader = /^(day\s*\d+|overview|budget|tip|arrival|departure|getting there|accommodation|food|transport|flight|activity|total)/i.test(line.trim())
    if (isHeader) {
      if (current) sections.push({ title: current.title, body: current.lines.join('\n') })
      current = { title: line.trim(), lines: [] }
    } else {
      if (current) current.lines.push(line)
      else sections.push({ title: '', body: line })
    }
  }
  if (current) sections.push({ title: current.title, body: current.lines.join('\n') })
  return sections.filter(s => s.title || s.body)
}

function extractKeyword(text: string): string {
  return text.split(',')[0].trim().replace(/\d+\s*(days?|nights?)\s*(in|to)\s*/i, '').trim()
}

// Warm vibrant palette for day cards
const CARD_PALETTE = [
  { bg: '#FFF8F0', border: '#F97316', pill: '#F97316', pillText: '#fff', text: '#431407' },
  { bg: '#F0F9FF', border: '#0EA5E9', pill: '#0EA5E9', pillText: '#fff', text: '#0C4A6E' },
  { bg: '#F0FDF4', border: '#22C55E', pill: '#22C55E', pillText: '#fff', text: '#14532D' },
  { bg: '#FDF4FF', border: '#D946EF', pill: '#D946EF', pillText: '#fff', text: '#4A044E' },
  { bg: '#FFFBEB', border: '#EAB308', pill: '#EAB308', pillText: '#fff', text: '#451A03' },
  { bg: '#FFF1F2', border: '#F43F5E', pill: '#F43F5E', pillText: '#fff', text: '#4C0519' },
  { bg: '#F0FDFA', border: '#14B8A6', pill: '#14B8A6', pillText: '#fff', text: '#134E4A' },
]
const getDayPalette = (i: number) => CARD_PALETTE[i % CARD_PALETTE.length]

async function fetchPexels(query: string, count = 4): Promise<string[]> {
  const key = process.env.NEXT_PUBLIC_PEXELS_API_KEY
  if (!key) return []
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query + ' travel landmark')}&per_page=${count}&orientation=landscape`,
      { headers: { Authorization: key } }
    )
    const data = await res.json()
    return (data.photos || []).map((p: { src: { large: string } }) => p.src.large)
  } catch { return [] }
}

async function fetchSectionImage(query: string): Promise<string> {
  const key = process.env.NEXT_PUBLIC_PEXELS_API_KEY
  if (!key) return ''
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query + ' travel')}&per_page=1&orientation=landscape`,
      { headers: { Authorization: key } }
    )
    const data = await res.json()
    return data.photos?.[0]?.src?.large || ''
  } catch { return '' }
}

const HERO_POOL = [
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600&q=85',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1600&q=85',
  'https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=1600&q=85',
  'https://images.unsplash.com/photo-1488085061387-422e29b40080?w=1600&q=85',
]

const POPULAR = [
  { name: 'Tokyo',        country: 'Japan',      tag: 'City',      duration: '7 days', emoji: '🗼', fb: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=500&q=85' },
  { name: 'Bali',         country: 'Indonesia',  tag: 'Beach',     duration: '5 days', emoji: '🌺', fb: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=500&q=85' },
  { name: 'Paris',        country: 'France',     tag: 'Culture',   duration: '4 days', emoji: '🗼', fb: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=500&q=85' },
  { name: 'Santorini',    country: 'Greece',     tag: 'Beach',     duration: '5 days', emoji: '🏛', fb: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=500&q=85' },
  { name: 'New York',     country: 'USA',        tag: 'City',      duration: '5 days', emoji: '🗽', fb: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=500&q=85' },
  { name: 'Kyoto',        country: 'Japan',      tag: 'Culture',   duration: '4 days', emoji: '⛩', fb: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=500&q=85' },
  { name: 'Maldives',     country: 'South Asia', tag: 'Beach',     duration: '6 days', emoji: '🏝', fb: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=500&q=85' },
  { name: 'Machu Picchu', country: 'Peru',       tag: 'Adventure', duration: '7 days', emoji: '🏔', fb: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?w=500&q=85' },
]

function generatePDF(destination: string, planData: PlanData) {
  if (!planData) return
  const sections = parsePlan(planData.plan)
  const budgetSections = typeof planData.budget === 'string' ? parsePlan(planData.budget) : []
  const researchSections = parsePlan(planData.research)
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${destination} — Voyage</title>
  <style>@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',sans-serif;background:#FFFDF9;color:#1C1410}
  .cover{background:linear-gradient(135deg,#FF6B35 0%,#F7931E 50%,#FFD700 100%);padding:56px 48px 48px;color:white}
  .cover-eyebrow{font-size:10px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;opacity:.7;margin-bottom:10px}
  .cover-title{font-family:'Fraunces',serif;font-size:58px;font-weight:900;line-height:.95;margin-bottom:10px}
  .cover-sub{font-size:14px;opacity:.7;margin-bottom:22px}
  .cover-chips{display:flex;gap:10px}.cover-chip{background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.3);border-radius:999px;padding:5px 14px;font-size:11px;font-weight:600}
  .stripe{height:5px;background:linear-gradient(90deg,#FF6B35,#F7931E,#FFD700,#22C55E,#0EA5E9)}
  .body{padding:40px 48px}.sec{margin-bottom:32px}
  .sec-head{font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#F97316;border-bottom:2px solid #FED7AA;padding-bottom:8px;margin-bottom:16px}
  .card{padding:16px 20px;border-radius:12px;margin-bottom:12px;border-left:3px solid}
  .day-card{background:#FFF8F0;border-left-color:#F97316}.day-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#F97316;margin-bottom:4px}
  .day-body{font-size:13px;line-height:1.8;color:#431407;white-space:pre-wrap}
  .budget-card{background:#FFFBEB;border-left-color:#EAB308}.budget-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#CA8A04;margin-bottom:4px}
  .budget-body{font-size:13px;line-height:1.8;color:#451A03;white-space:pre-wrap}
  .research-card{background:#F0FDF4;border-left-color:#22C55E}.research-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#16A34A;margin-bottom:4px}
  .research-body{font-size:13px;line-height:1.8;color:#14532D;white-space:pre-wrap}
  .footer{text-align:center;padding:24px;font-size:10px;color:#A78BFA;letter-spacing:.1em;text-transform:uppercase;border-top:1px solid #FED7AA}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
  <div class="cover"><div class="cover-eyebrow">Voyage · AI Travel Companion</div>
  <div class="cover-title">${destination}</div>
  <div class="cover-sub">Your personalised AI-crafted itinerary</div>
  <div class="cover-chips"><div class="cover-chip">✈ Trip Plan</div><div class="cover-chip">📅 ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div></div></div>
  <div class="stripe"></div>
  <div class="body">
  <div class="sec"><div class="sec-head">Day-by-Day Itinerary</div>${sections.map(s=>`<div class="card day-card">${s.title?`<div class="day-label">${s.title}</div>`:''}<div class="day-body">${s.body.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div></div>`).join('')}</div>
  ${budgetSections.length>0?`<div class="sec"><div class="sec-head">Budget Breakdown</div>${budgetSections.map(s=>`<div class="card budget-card">${s.title?`<div class="budget-label">${s.title}</div>`:''}<div class="budget-body">${s.body.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div></div>`).join('')}</div>`:''}
  ${researchSections.length>0?`<div class="sec"><div class="sec-head">Research & Tips</div>${researchSections.map(s=>`<div class="card research-card">${s.title?`<div class="research-label">${s.title}</div>`:''}<div class="research-body">${s.body.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div></div>`).join('')}</div>`:''}
  </div><div class="footer">Voyage · AI Travel Companion · ${new Date().toLocaleDateString()}</div>
  <script>window.onload=()=>{window.print()}</script></body></html>`
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (!win) { const a = document.createElement('a'); a.href=url; a.download=`${destination}-voyage.html`; a.click() }
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export default function ChatInterface() {
  const [streamedText, setStreamedText]   = useState("")
  const [trip, setTrip]                   = useState("")
  const [planData, setPlanData]           = useState<PlanData>(null)
  const [activeTab, setActiveTab]         = useState<Tab>('stream')
  const [isLoading, setIsLoading]         = useState(false)
  const [dark, setDark]                   = useState(false)
  const [mounted, setMounted]             = useState(false)
  const [heroImages, setHeroImages]       = useState<string[]>([])
  const [heroIdx, setHeroIdx]             = useState(0)
  const [heroBgIdx, setHeroBgIdx]         = useState(0)
  const [popImages, setPopImages]         = useState<Record<string,string>>({})
  const [sectionImages, setSectionImages] = useState<Record<number,string>>({})
  const [isListening, setIsListening]     = useState(false)
  const [vapiError, setVapiError]         = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const vapiRef  = useRef<InstanceType<typeof Vapi> | null>(null)

  useEffect(() => {
    setMounted(true)
    setDark(new Date().getHours() >= 18 || new Date().getHours() < 6)
    POPULAR.forEach(async d => {
      const imgs = await fetchPexels(`${d.name} ${d.country}`, 1)
      if (imgs[0]) setPopImages(prev => ({ ...prev, [d.name]: imgs[0] }))
    })
    const t = setInterval(() => setHeroBgIdx(i => (i + 1) % HERO_POOL.length), 5500)
    const key = process.env.NEXT_PUBLIC_VAPI_API_KEY
    if (key) {
      vapiRef.current = new Vapi(key)
      vapiRef.current.on('message', (msg: { type: string; transcript?: string }) => {
        if (msg.type === 'transcript' && msg.transcript) {
          setTrip(msg.transcript)
          if (inputRef.current) inputRef.current.value = msg.transcript
        }
      })
      vapiRef.current.on('call-end', () => setIsListening(false))
      vapiRef.current.on('error', () => {
        setIsListening(false); setVapiError('Voice unavailable')
        setTimeout(() => setVapiError(''), 4000)
      })
    }
    return () => { vapiRef.current?.stop(); clearInterval(t) }
  }, [])

  useEffect(() => {
    if (!planData) return
    const sections = parsePlan(planData.plan)
    const dest = extractKeyword(trip)
    sections.forEach(async (s, i) => {
      if (i % 2 === 0) {
        const q = s.title ? `${dest} ${s.title}` : dest
        const img = await fetchSectionImage(q)
        if (img) setSectionImages(prev => ({ ...prev, [i]: img }))
      }
    })
  }, [planData])

  async function toggleVoice() {
    if (!vapiRef.current) { setVapiError('Vapi key missing'); return }
    if (isListening) { vapiRef.current.stop(); setIsListening(false) }
    else {
      setIsListening(true)
      await vapiRef.current.start({
        transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en' },
        model: { provider: 'openai', model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: 'Listen and repeat back as a concise trip description.' }] },
        voice: { provider: 'playht', voiceId: 'jennifer' },
      })
    }
  }

  function handleClick() {
    setStreamedText(""); setActiveTab('stream')
    const socket = new WebSocket("wss://travelcompanion-backend.onrender.com/ws")
    socket.addEventListener("message", e => { if (e.data !== "[DONE]") setStreamedText(p => p + e.data) })
    socket.onopen = () => socket.send(trip)
  }

  async function handlePlan() {
    setIsLoading(true); setSectionImages({})
    const imgs = await fetchPexels(extractKeyword(trip), 5)
    setHeroImages(imgs); setHeroIdx(0)
    try {
      const res = await fetch("https://travelcompanion-backend.onrender.com/plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_input: trip }),
      })
      setPlanData(await res.json()); setActiveTab('plan')
    } catch (e) { console.error(e) }
    finally { setIsLoading(false) }
  }

  function handleDestClick(name: string, country: string, duration: string) {
    const q = `${duration} in ${name}, ${country}, medium budget`
    setTrip(q); if (inputRef.current) inputRef.current.value = q
  }

  const D = dark
  if (!mounted) return <div style={{ minHeight:'100vh', background:'#FFFDF9' }} />

  return (
    <div style={{ fontFamily:"'DM Sans', -apple-system, sans-serif", minHeight:'100vh', background: D?'#120D0A':'#FFFDF9', transition:'background 0.5s', position:'relative', overflow:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,700;0,9..144,900;1,9..144,700&family=DM+Sans:wght@300;400;500;600;700&display=swap');

        *{box-sizing:border-box}

        /* Animations */
        @keyframes bgdrift{0%,100%{transform:scale(1.06) translate(0,0)}33%{transform:scale(1.09) translate(-8px,-6px)}66%{transform:scale(1.07) translate(6px,-10px)}}
        @keyframes fadeup{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadein{from{opacity:0}to{opacity:1}}
        @keyframes cursor{0%,49%{opacity:1}50%,100%{opacity:0}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes recdot{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.75);opacity:.4}}
        @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
        @keyframes cardpop{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes streakin{from{opacity:0}to{opacity:1}}

        .fu{animation:fadeup .52s cubic-bezier(.22,.68,0,1.2) both}
        .fu1{animation:fadeup .52s cubic-bezier(.22,.68,0,1.2) .08s both}
        .fu2{animation:fadeup .52s cubic-bezier(.22,.68,0,1.2) .16s both}
        .fu3{animation:fadeup .52s cubic-bezier(.22,.68,0,1.2) .24s both}
        .cardpop{animation:cardpop .38s cubic-bezier(.22,.68,0,1.2) both}

        /* Scrollbar */
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(249,115,22,.25);border-radius:2px}

        /* Destination cards */
        .dest-row{display:flex;gap:14px;overflow-x:auto;padding-bottom:12px;scrollbar-width:none;-ms-overflow-style:none}
        .dest-row::-webkit-scrollbar{display:none}
        .dest-card{flex-shrink:0;position:relative;width:152px;height:192px;border-radius:20px;overflow:hidden;cursor:pointer;border:none;padding:0;transition:transform .25s cubic-bezier(.22,.68,0,1.2),box-shadow .25s}
        .dest-card:hover{transform:translateY(-5px) scale(1.03);box-shadow:0 20px 40px rgba(249,115,22,.22)}
        .dest-card:active{transform:scale(.97)}
        .dest-card img{width:100%;height:100%;object-fit:cover;transition:transform .5s}
        .dest-card:hover img{transform:scale(1.1)}

        /* Tab bar */
        .tab-pill{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:11px 4px 9px;border:none;cursor:pointer;font-family:inherit;background:transparent;position:relative;transition:all .2s}
        .tab-pill::after{content:'';position:absolute;bottom:0;left:20%;right:20%;height:2.5px;border-radius:99px;background:var(--tacc,transparent);opacity:0;transition:opacity .2s}
        .tab-pill.act::after{opacity:1}
        .tab-pill:active{opacity:.7}

        /* Input */
        .voyage-input{appearance:none;transition:border-color .2s,box-shadow .2s;font-family:'DM Sans',sans-serif}
        .voyage-input:focus{outline:none}

        /* Buttons */
        .btn-plan{transition:all .2s;cursor:pointer;font-family:'DM Sans',sans-serif}
        .btn-plan:active:not(:disabled){transform:scale(.95);opacity:.85}
        .btn-plan:disabled{opacity:.35;cursor:not-allowed}

        /* Result cards */
        .r-card{border-radius:16px;overflow:hidden;margin-bottom:14px;transition:transform .18s,box-shadow .18s}
        .r-card:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,.1)}

        /* Shimmer loading */
        .load-shimmer{background:linear-gradient(90deg,#FED7AA 0%,#FFF 40%,#FED7AA 80%);background-size:200% auto;animation:shimmer 1.4s linear infinite}

        /* Carousel dots */
        .cdot{height:4px;border-radius:2px;cursor:pointer;transition:all .3s;background:rgba(255,255,255,.35)}
        .cdot.act{background:white}

        /* Stream cursor */
        .scursor{display:inline-block;width:2px;height:16px;vertical-align:middle;margin-left:2px;border-radius:2px;animation:cursor 1s step-end infinite}
      `}</style>

      {/* ── Ambient background ── */}
      <div style={{ position:'fixed',inset:0,zIndex:0,overflow:'hidden' }}>
        {/* Cycling travel photos — very subtle */}
        {HERO_POOL.map((src, i) => (
          <div key={i} style={{
            position:'absolute',inset:'-8%',
            backgroundImage:`url(${src})`,backgroundSize:'cover',backgroundPosition:'center',
            opacity: i===heroBgIdx ? (D?.09:.11) : 0,
            transition:'opacity 2.5s ease',
            animation:'bgdrift 28s ease-in-out infinite',animationDelay:`${i*1.2}s`,
            filter: D?'saturate(.45) brightness(.6)':'saturate(.7) brightness(1.08)',
          }} />
        ))}

        {/* Gradient overlay */}
        <div style={{
          position:'absolute',inset:0,
          background: D
            ? 'linear-gradient(160deg, rgba(18,13,10,.88) 0%, rgba(18,13,10,.72) 45%, rgba(18,13,10,.92) 100%)'
            : 'linear-gradient(160deg, rgba(255,253,249,.9) 0%, rgba(255,253,249,.72) 45%, rgba(255,253,249,.94) 100%)',
        }} />

        {/* Warm accent glow top-right */}
        <div style={{ position:'absolute',top:'-5%',right:'-5%',width:520,height:520,borderRadius:'50%',background:'radial-gradient(circle, rgba(249,115,22,.12) 0%, transparent 65%)',pointerEvents:'none' }} />
        {/* Cool accent glow bottom-left */}
        <div style={{ position:'absolute',bottom:'-8%',left:'-5%',width:420,height:420,borderRadius:'50%',background:'radial-gradient(circle, rgba(14,165,233,.09) 0%, transparent 65%)',pointerEvents:'none' }} />
      </div>

      {/* ── App shell ── */}
      <div style={{ position:'relative',zIndex:10,maxWidth:780,margin:'0 auto',padding:'0 0 100px' }}>

        {/* ── Sticky nav ── */}
        <nav style={{
          position:'sticky',top:0,zIndex:200,
          backdropFilter:'blur(24px) saturate(200%)',WebkitBackdropFilter:'blur(24px) saturate(200%)',
          background: D?'rgba(18,13,10,.82)':'rgba(255,253,249,.86)',
          borderBottom: D?'1px solid rgba(249,115,22,.12)':'1px solid rgba(249,115,22,.15)',
          padding:'11px 22px 9px',
        }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
            {/* Logo */}
            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
              <div style={{
                width:36,height:36,borderRadius:11,
                background:'linear-gradient(135deg, #F97316, #F7931E)',
                display:'flex',alignItems:'center',justifyContent:'center',
                boxShadow:'0 4px 14px rgba(249,115,22,.38)',
                fontSize:17,flexShrink:0,
              }}>✈</div>
              <div>
                <p style={{ margin:0,fontSize:16,fontWeight:700,color:D?'#FFF7ED':'#1C1410',letterSpacing:'-0.025em',fontFamily:"'Fraunces', serif" }}>Voyage</p>
                <p style={{ margin:0,fontSize:8.5,color:D?'rgba(255,237,213,.42)':'rgba(28,20,16,.4)',letterSpacing:'0.18em',fontWeight:600,textTransform:'uppercase' }}>AI Travel Companion</p>
              </div>
            </div>

            {/* Theme toggle */}
            <button onClick={() => setDark(!D)} style={{
              display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:999,
              border:`1.5px solid ${D?'rgba(249,115,22,.22)':'rgba(249,115,22,.25)'}`,
              background: D?'rgba(249,115,22,.1)':'rgba(249,115,22,.07)',
              cursor:'pointer',color:D?'#FB923C':'#EA580C',fontSize:11,fontWeight:700,
              letterSpacing:'0.07em',textTransform:'uppercase',fontFamily:'inherit',transition:'all .2s',
            }}>
              <span style={{ fontSize:14 }}>{D?'☀️':'🌙'}</span>
              {D?'Day':'Night'}
            </button>
          </div>
        </nav>

        {/* ── Hero header ── */}
        <div className="fu" style={{ padding:'44px 22px 0' }}>
          {/* Date chip */}
          <div style={{ display:'inline-flex',alignItems:'center',gap:7,padding:'5px 12px',borderRadius:999,background:D?'rgba(249,115,22,.12)':'rgba(249,115,22,.09)',border:D?'1px solid rgba(249,115,22,.2)':'1px solid rgba(249,115,22,.18)',marginBottom:18 }}>
            <span style={{ fontSize:11 }}>📅</span>
            <span style={{ fontSize:10,fontWeight:700,color:D?'#FB923C':'#EA580C',letterSpacing:'0.14em',textTransform:'uppercase' }}>
              {new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}
            </span>
          </div>

          {/* Main headline */}
          <h1 style={{ margin:'0 0 16px',color:D?'#FFF7ED':'#1C1410',letterSpacing:'-0.04em',lineHeight:.96 }}>
            <span style={{ display:'block',fontSize:50,fontWeight:900,fontFamily:"'Fraunces', serif" }}>Where are you</span>
            <span style={{ display:'block',fontSize:50,fontWeight:900,fontFamily:"'Fraunces', serif",fontStyle:'italic',
              background:'linear-gradient(135deg, #F97316 0%, #F7931E 40%, #EAB308 100%)',
              WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',
            }}>headed next?</span>
          </h1>
          <p style={{ margin:0,fontSize:15,color:D?'rgba(255,237,213,.55)':'rgba(28,20,16,.5)',lineHeight:1.65,maxWidth:400,fontWeight:400 }}>
            Describe your dream trip — full itinerary, local tips & budget in seconds.
          </p>
        </div>

        {/* ── Input card ── */}
        <div className="fu1" style={{
          margin:'22px 22px 0',borderRadius:20,
          background:D?'rgba(28,20,14,.96)':'#FFFFFF',
          border:D?'1.5px solid rgba(249,115,22,.18)':'1.5px solid rgba(249,115,22,.2)',
          boxShadow:D?'0 12px 44px rgba(0,0,0,.55)':'0 8px 32px rgba(249,115,22,.1)',
          overflow:'hidden',
        }}>
          <div style={{ display:'flex',alignItems:'center',gap:0,padding:'5px' }}>
            {/* Voice btn */}
            <button onClick={toggleVoice} style={{
              width:54,height:54,borderRadius:14,border:'none',
              background:isListening?'rgba(239,68,68,.1)':'transparent',
              cursor:'pointer',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center',
              flexShrink:0,transition:'all .2s',fontFamily:'inherit',
              color:isListening?'#F43F5E':D?'rgba(255,237,213,.4)':'rgba(28,20,16,.35)',
            }}>
              {isListening
                ? <span style={{ display:'block',width:12,height:12,borderRadius:'50%',background:'#F43F5E',animation:'recdot 1.3s ease-in-out infinite' }} />
                : '🎙'}
            </button>

            {/* Text input */}
            <input
              ref={inputRef} type="text"
              onChange={e => setTrip(e.target.value)}
              placeholder="7 days in Bali, beach & temples, medium budget…"
              className="voyage-input"
              style={{
                flex:1,height:54,
                border:`1.5px solid ${D?'rgba(249,115,22,.15)':'rgba(249,115,22,.18)'}`,
                borderRadius:14,
                background:D?'rgba(255,255,255,.04)':'rgba(255,253,249,.8)',
                color:D?'#FFF7ED':'#1C1410',fontSize:14,padding:'0 14px',
              }}
              onFocus={e => { e.target.style.borderColor='#F97316'; e.target.style.boxShadow='0 0 0 3px rgba(249,115,22,.14)' }}
              onBlur={e  => { e.target.style.borderColor=D?'rgba(249,115,22,.15)':'rgba(249,115,22,.18)'; e.target.style.boxShadow='none' }}
            />

            {/* Plan button */}
            <button onClick={() => { handleClick(); handlePlan() }} disabled={isLoading||!trip} className="btn-plan"
              style={{
                margin:'0 5px',height:46,paddingInline:22,borderRadius:13,border:'none',
                background:(!isLoading&&trip)?'linear-gradient(135deg, #F97316, #F7931E)':'rgba(249,115,22,.15)',
                color:(!isLoading&&trip)?'white':D?'rgba(249,115,22,.4)':'rgba(249,115,22,.4)',
                fontSize:12,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',
                flexShrink:0,
                boxShadow:(!isLoading&&trip)?'0 4px 18px rgba(249,115,22,.35)':'none',
              }}>
              {isLoading ? <span style={{ display:'block',width:14,height:14,borderRadius:'50%',border:'2px solid rgba(255,255,255,.3)',borderTopColor:'white',animation:'spin .7s linear infinite' }} /> : 'Plan →'}
            </button>
          </div>

          {(vapiError||isListening) && (
            <div style={{ padding:'4px 16px 10px',borderTop:D?'1px solid rgba(249,115,22,.1)':'1px solid rgba(249,115,22,.1)' }}>
              {vapiError   && <p style={{ margin:0,fontSize:12,color:'#F43F5E',fontWeight:500 }}>{vapiError}</p>}
              {isListening && <p style={{ margin:0,fontSize:12,color:'#F97316',fontWeight:600,letterSpacing:'0.04em' }}>◉ Listening… describe your trip</p>}
            </div>
          )}
        </div>

        {/* Loading bar */}
        {isLoading && !streamedText && (
          <div style={{ margin:'14px 22px 0',display:'flex',alignItems:'center',gap:8 }}>
            <div style={{ flex:1,height:3,borderRadius:99,background:D?'rgba(249,115,22,.12)':'rgba(249,115,22,.1)',overflow:'hidden' }}>
              <div className="load-shimmer" style={{ height:'100%',borderRadius:99,width:'60%' }} />
            </div>
            <span style={{ fontSize:10,color:D?'rgba(249,115,22,.5)':'rgba(249,115,22,.6)',fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',whiteSpace:'nowrap' }}>
              Crafting journey…
            </span>
          </div>
        )}

        {/* ── Popular destinations ── */}
        {!planData && !streamedText && (
          <div className="fu2" style={{ margin:'30px 22px 0' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16 }}>
              <h2 style={{ margin:0,fontSize:22,fontWeight:900,color:D?'#FFF7ED':'#1C1410',letterSpacing:'-0.025em',fontFamily:"'Fraunces', serif" }}>
                Popular
              </h2>
              <span style={{ fontSize:12,color:'#F97316',fontWeight:600,cursor:'pointer' }}>See all →</span>
            </div>
            <div className="dest-row">
              {POPULAR.map((d) => (
                <button key={d.name} onClick={() => handleDestClick(d.name,d.country,d.duration)} className="dest-card">
                  <img src={popImages[d.name]||d.fb} alt={d.name} />
                  {/* Gradient overlay */}
                  <div style={{ position:'absolute',inset:0,background:'linear-gradient(to top, rgba(0,0,0,.75) 0%, rgba(0,0,0,.05) 55%, transparent 100%)' }} />
                  {/* Tag */}
                  <div style={{ position:'absolute',top:10,left:10,padding:'2px 9px',borderRadius:999,fontSize:8.5,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',background:'rgba(249,115,22,.85)',backdropFilter:'blur(6px)',color:'white',border:'0.5px solid rgba(255,255,255,.2)' }}>{d.tag}</div>
                  {/* Info */}
                  <div style={{ position:'absolute',bottom:0,left:0,right:0,padding:'0 13px 13px' }}>
                    <p style={{ margin:0,color:'white',fontSize:15,fontWeight:700,lineHeight:1.15,fontFamily:"'Fraunces', serif" }}>{d.name}</p>
                    <p style={{ margin:'2px 0 6px',color:'rgba(255,255,255,.55)',fontSize:10 }}>{d.country}</p>
                    <span style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'3px 9px',borderRadius:999,fontSize:9,fontWeight:600,background:'rgba(255,255,255,.14)',border:'0.5px solid rgba(255,255,255,.22)',color:'rgba(255,255,255,.88)' }}>
                      {d.emoji} {d.duration}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Results panel ── */}
        {(streamedText || planData) && (
          <div className="fu2" style={{
            margin:'22px 22px 0',borderRadius:22,
            background:D?'rgba(22,15,10,.97)':'#FFFFFF',
            border:D?'1.5px solid rgba(249,115,22,.15)':'1.5px solid rgba(249,115,22,.18)',
            boxShadow:D?'0 16px 60px rgba(0,0,0,.65)':'0 10px 48px rgba(249,115,22,.1)',
            overflow:'hidden',
          }}>

            {/* Hero carousel */}
            {heroImages.length > 0 && (
              <div style={{ position:'relative',height:230 }}>
                <img src={heroImages[heroIdx]} alt="destination" style={{ width:'100%',height:230,objectFit:'cover',display:'block',transition:'opacity .4s' }} />
                {/* Gradient */}
                <div style={{ position:'absolute',inset:0,background:'linear-gradient(to top, rgba(0,0,0,.82) 0%, rgba(0,0,0,.06) 50%, transparent 100%)' }} />
                {/* Warm color wash */}
                <div style={{ position:'absolute',inset:0,background:'linear-gradient(135deg, rgba(249,115,22,.08), transparent 60%)' }} />
                {/* Title */}
                <div style={{ position:'absolute',bottom:16,left:18 }}>
                  <p style={{ margin:0,color:'white',fontSize:26,fontWeight:900,letterSpacing:'-0.03em',fontFamily:"'Fraunces', serif",fontStyle:'italic',textShadow:'0 2px 12px rgba(0,0,0,.55)' }}>
                    {extractKeyword(trip)}
                  </p>
                  <p style={{ margin:'3px 0 0',color:'rgba(255,255,255,.45)',fontSize:9.5,letterSpacing:'0.16em',textTransform:'uppercase',fontWeight:600 }}>
                    AI-crafted itinerary
                  </p>
                </div>
                {/* Arrows */}
                {heroImages.length > 1 && (
                  <>
                    <button onClick={() => setHeroIdx(i => (i-1+heroImages.length)%heroImages.length)} style={{ position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',width:30,height:30,borderRadius:999,background:'rgba(0,0,0,.45)',backdropFilter:'blur(6px)',border:'0.5px solid rgba(255,255,255,.2)',color:'white',fontSize:15,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit' }}>‹</button>
                    <button onClick={() => setHeroIdx(i => (i+1)%heroImages.length)} style={{ position:'absolute',right:11,top:'50%',transform:'translateY(-50%)',width:30,height:30,borderRadius:999,background:'rgba(0,0,0,.45)',backdropFilter:'blur(6px)',border:'0.5px solid rgba(255,255,255,.2)',color:'white',fontSize:15,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit' }}>›</button>
                  </>
                )}
                {/* Dots */}
                <div style={{ position:'absolute',bottom:16,right:15,display:'flex',gap:4 }}>
                  {heroImages.map((_,i) => (
                    <div key={i} onClick={() => setHeroIdx(i)} className={`cdot${i===heroIdx?' act':''}`} style={{ width:i===heroIdx?18:5 }} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Tab bar ── */}
            <div style={{
              background:D?'rgba(18,13,10,.6)':'rgba(255,253,249,.8)',
              borderBottom:D?'1px solid rgba(249,115,22,.1)':'1px solid rgba(249,115,22,.12)',
            }}>
              {/* Thin accent stripe at top */}
              <div style={{ height:2,background:'linear-gradient(90deg, #F97316, #F7931E, #EAB308, #22C55E, #0EA5E9)',opacity:.5 }} />
              <div style={{ display:'flex',alignItems:'stretch' }}>
                {[
                  { id:'stream'  as Tab, label:'Live',      icon:'◈', accent:'#F97316' },
                  { id:'plan'    as Tab, label:'Itinerary', icon:'⬡', accent:'#0EA5E9' },
                  { id:'research'as Tab, label:'Research',  icon:'◎', accent:'#22C55E' },
                  { id:'budget'  as Tab, label:'Budget',    icon:'◇', accent:'#EAB308' },
                ].map(tab => {
                  const isAct = activeTab === tab.id
                  return (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      className={`tab-pill${isAct?' act':''}`}
                      style={{ '--tacc': tab.accent, color: isAct ? tab.accent : D?'rgba(255,237,213,.35)':'rgba(28,20,16,.38)', background: isAct?(D?'rgba(255,255,255,.03)':'rgba(249,115,22,.03)'):'transparent' } as React.CSSProperties}>
                      <span style={{ fontSize:13,filter:isAct?`drop-shadow(0 0 6px ${tab.accent}99)`:'none',transition:'filter .25s' }}>{tab.icon}</span>
                      <span style={{ fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase' }}>{tab.label}</span>
                    </button>
                  )
                })}

                {/* PDF button */}
                {planData && (
                  <button onClick={() => generatePDF(extractKeyword(trip), planData)}
                    style={{ flexShrink:0,alignSelf:'center',margin:'0 10px',padding:'6px 12px',borderRadius:9,border:'1.5px solid rgba(249,115,22,.3)',background:'rgba(249,115,22,.08)',color:'#F97316',fontSize:9,fontWeight:700,cursor:'pointer',letterSpacing:'0.1em',textTransform:'uppercase',fontFamily:'inherit',display:'flex',alignItems:'center',gap:5 }}>
                    <span style={{ fontSize:11 }}>↓</span> PDF
                  </button>
                )}
              </div>
            </div>

            {/* ── Content ── */}
            <div key={activeTab} style={{ padding:'18px',maxHeight:580,overflowY:'auto',animation:'fadein .2s ease' }}>

              {/* ── Live stream ── */}
              {activeTab==='stream' && streamedText && (
                <div style={{
                  background:D?'rgba(249,115,22,.06)':'#FFF8F0',
                  borderRadius:14,padding:20,
                  border:D?'1.5px solid rgba(249,115,22,.15)':'1.5px solid #FED7AA',
                }}>
                  <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:13 }}>
                    <div style={{ width:7,height:7,borderRadius:'50%',background:'#F97316',animation:'recdot 1.3s ease-in-out infinite' }} />
                    <span style={{ fontSize:9.5,fontWeight:700,color:'#F97316',letterSpacing:'0.18em',textTransform:'uppercase' }}>Live Generation</span>
                  </div>
                  <p style={{ margin:0,fontSize:15,lineHeight:1.88,whiteSpace:'pre-wrap',color:D?'rgba(255,237,213,.85)':'#1C1410',letterSpacing:'0.008em',fontWeight:400 }}>
                    {stripMarkdown(streamedText)}
                    <span className="scursor" style={{ background:'#F97316' }} />
                  </p>
                </div>
              )}

              {/* ── Plan — vibrant note cards ── */}
              {activeTab==='plan' && planData && (
                <div>
                  {parsePlan(planData.plan).map((s, i) => {
                    const pal = getDayPalette(i)
                    const isDayCard = /^day\s*\d+/i.test(s.title)
                    const dayNum = s.title.match(/\d+/)?.[0]
                    return (
                      <div key={i} className="r-card cardpop" style={{
                        background: D?`rgba(255,255,255,.04)`:pal.bg,
                        border:D?`1.5px solid rgba(255,255,255,.07)`:`1.5px solid ${pal.border}22`,
                        borderLeft:D?`3px solid ${pal.border}`:`3px solid ${pal.border}`,
                        animationDelay:`${i*.05}s`,
                      }}>
                        {/* Section image */}
                        {sectionImages[i] && (
                          <div style={{ position:'relative',height:118,overflow:'hidden' }}>
                            <img src={sectionImages[i]} alt={s.title} style={{ width:'100%',height:118,objectFit:'cover',display:'block' }} />
                            <div style={{ position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,.4),transparent)' }} />
                          </div>
                        )}
                        <div style={{ padding:'14px 17px' }}>
                          {s.title && (
                            <div style={{ display:'flex',alignItems:'center',gap:9,marginBottom:9 }}>
                              {isDayCard && dayNum ? (
                                <div style={{
                                  minWidth:38,height:38,borderRadius:11,flexShrink:0,
                                  background:D?`rgba(255,255,255,.06)`:pal.bg,
                                  border:D?`1.5px solid ${pal.border}55`:`1.5px solid ${pal.border}`,
                                  display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                                  boxShadow:D?'none':`0 2px 8px ${pal.border}22`,
                                }}>
                                  <span style={{ fontSize:6.5,fontWeight:700,color:pal.label,letterSpacing:'0.1em',textTransform:'uppercase',lineHeight:1 }}>DAY</span>
                                  <span style={{ fontSize:16,fontWeight:900,color:D?pal.border:pal.label,lineHeight:1,fontFamily:"'Fraunces', serif" }}>{dayNum}</span>
                                </div>
                              ) : (
                                <span style={{ display:'inline-flex',alignItems:'center',justifyContent:'center',width:24,height:24,borderRadius:7,background:D?`rgba(255,255,255,.06)`:pal.bg,fontSize:12,flexShrink:0 }}>💡</span>
                              )}
                              <p style={{ margin:0,fontSize:isDayCard?14.5:10.5,fontWeight:700,color:D?`rgba(255,255,255,.88)`:pal.label,letterSpacing:isDayCard?'-0.01em':'0.08em',textTransform:isDayCard?'none':'uppercase',fontFamily:isDayCard?"'Fraunces', serif":'inherit',lineHeight:1.2 }}>
                                {isDayCard
                                  ? (s.title.replace(/^day\s*\d+[:\-–—]?\s*/i,'').trim() || `Day ${dayNum}`)
                                  : s.title}
                              </p>
                            </div>
                          )}
                          <p style={{ margin:0,fontSize:14,lineHeight:1.85,color:D?'rgba(255,240,220,.72)':pal.text,whiteSpace:'pre-wrap',fontWeight:400,letterSpacing:'0.008em' }}>
                            {s.body}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── Research — teal/green note cards ── */}
              {activeTab==='research' && planData && (
                <div>
                  {parsePlan(planData.research).map((s, i) => (
                    <div key={i} className="r-card cardpop" style={{
                      background:D?'rgba(20,184,166,.06)':'#F0FDFA',
                      border:D?'1.5px solid rgba(20,184,166,.15)':'1.5px solid #99F6E4',
                      borderLeft:'3px solid #14B8A6',
                      animationDelay:`${i*.05}s`,
                    }}>
                      <div style={{ padding:'14px 17px' }}>
                        {s.title && (
                          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:9 }}>
                            <span style={{ fontSize:13 }}>🔍</span>
                            <p style={{ margin:0,fontSize:10,fontWeight:700,color:D?'#2DD4BF':'#0F766E',letterSpacing:'0.1em',textTransform:'uppercase' }}>{s.title}</p>
                          </div>
                        )}
                        <p style={{ margin:0,fontSize:14,lineHeight:1.85,color:D?'rgba(204,251,241,.72)':'#134E4A',whiteSpace:'pre-wrap',fontWeight:400,letterSpacing:'0.008em' }}>{s.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Budget ── */}
              {activeTab==='budget' && planData && (
                <div>
                  {planData.budget && typeof planData.budget === 'object' ? (
                    <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:13 }}>
                      {Object.entries(planData.budget).map(([key,val],i) => (
                        <div key={i} className="cardpop" style={{
                          borderRadius:16,
                          background:D?'rgba(234,179,8,.07)':'#FFFBEB',
                          border:D?'1.5px solid rgba(234,179,8,.2)':'1.5px solid #FDE68A',
                          padding:'17px 20px',
                          position:'relative',overflow:'hidden',
                          animationDelay:`${i*.06}s`,
                        }}>
                          <div style={{ position:'absolute',top:-10,right:-10,width:60,height:60,borderRadius:'50%',background:'rgba(234,179,8,.08)' }} />
                          <p style={{ margin:'0 0 8px',fontSize:9.5,fontWeight:700,color:D?'rgba(253,224,71,.6)':'#92400E',letterSpacing:'0.13em',textTransform:'uppercase' }}>{key}</p>
                          <p style={{ margin:0,fontSize:28,fontWeight:900,color:D?'#FCD34D':'#D97706',letterSpacing:'-0.03em',fontFamily:"'Fraunces', serif" }}>
                            {typeof val === 'number' ? `$${Number(val).toLocaleString()}` : String(val)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : planData.budget && typeof planData.budget === 'string' ? (
                    <div>
                      {parsePlan(planData.budget).map((s, i) => (
                        <div key={i} className="r-card cardpop" style={{
                          background:D?'rgba(234,179,8,.06)':'#FFFBEB',
                          border:D?'1.5px solid rgba(234,179,8,.15)':'1.5px solid #FDE68A',
                          borderLeft:'3px solid #EAB308',
                          animationDelay:`${i*.05}s`,
                        }}>
                          <div style={{ padding:'14px 17px' }}>
                            {s.title && (
                              <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:9 }}>
                                <span style={{ fontSize:13 }}>💰</span>
                                <p style={{ margin:0,fontSize:10,fontWeight:700,color:D?'#FCD34D':'#92400E',letterSpacing:'0.1em',textTransform:'uppercase' }}>{s.title}</p>
                              </div>
                            )}
                            <p style={{ margin:0,fontSize:14,lineHeight:1.85,color:D?'rgba(254,249,195,.72)':'#451A03',whiteSpace:'pre-wrap',fontWeight:400,letterSpacing:'0.008em' }}>{s.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ borderRadius:14,background:D?'rgba(234,179,8,.06)':'#FFFBEB',border:D?'1.5px solid rgba(234,179,8,.15)':'1.5px solid #FDE68A',padding:'16px 18px' }}>
                      <p style={{ margin:0,fontSize:14,lineHeight:1.75,color:D?'rgba(253,224,71,.6)':'#92400E',fontWeight:400 }}>Budget estimates are included in your itinerary. Check the Plan tab for day-by-day cost breakdowns.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <p style={{ textAlign:'center',fontSize:10,marginTop:28,color:D?'rgba(249,115,22,.2)':'rgba(249,115,22,.3)',letterSpacing:'0.1em',fontWeight:600,textTransform:'uppercase' }}>
          Voyage · Powered by AI
        </p>
      </div>
    </div>
  )
}