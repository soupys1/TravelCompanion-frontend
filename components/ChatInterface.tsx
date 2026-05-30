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

// Day number color palette — bright, distinct
const DAY_COLORS = [
  { bg: '#eff6ff', border: '#3b82f6', dot: '#2563eb', label: '#1d4ed8' },
  { bg: '#fdf4ff', border: '#a855f7', dot: '#9333ea', label: '#7e22ce' },
  { bg: '#fff7ed', border: '#f97316', dot: '#ea580c', label: '#c2410c' },
  { bg: '#f0fdf4', border: '#22c55e', dot: '#16a34a', label: '#15803d' },
  { bg: '#fef2f2', border: '#f43f5e', dot: '#e11d48', label: '#be123c' },
  { bg: '#fffbeb', border: '#f59e0b', dot: '#d97706', label: '#b45309' },
  { bg: '#ecfdf5', border: '#10b981', dot: '#059669', label: '#047857' },
]

function getDayColor(i: number) { return DAY_COLORS[i % DAY_COLORS.length] }

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
  { name: 'Tokyo',        country: 'Japan',      tag: 'City',      duration: '7 days', fb: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&q=80' },
  { name: 'Bali',         country: 'Indonesia',  tag: 'Beach',     duration: '5 days', fb: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&q=80' },
  { name: 'Paris',        country: 'France',     tag: 'Culture',   duration: '4 days', fb: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&q=80' },
  { name: 'Santorini',    country: 'Greece',     tag: 'Beach',     duration: '5 days', fb: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=400&q=80' },
  { name: 'New York',     country: 'USA',        tag: 'City',      duration: '5 days', fb: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400&q=80' },
  { name: 'Kyoto',        country: 'Japan',      tag: 'Culture',   duration: '4 days', fb: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&q=80' },
  { name: 'Maldives',     country: 'South Asia', tag: 'Beach',     duration: '6 days', fb: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=400&q=80' },
  { name: 'Machu Picchu', country: 'Peru',       tag: 'Adventure', duration: '7 days', fb: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?w=400&q=80' },
]

function generatePDF(destination: string, planData: PlanData) {
  if (!planData) return
  const sections = parsePlan(planData.plan)
  const budgetSections = typeof planData.budget === 'string' ? parsePlan(planData.budget) : []
  const researchSections = parsePlan(planData.research)

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${destination} — Voyage Itinerary</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; color: #1a1a2e; background: #fff; }
    .cover { background: linear-gradient(135deg, #0f0c29, #302b63, #24243e); color: white; padding: 60px 48px 48px; }
    .cover-tag { font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.5); margin-bottom: 12px; }
    .cover-title { font-family: 'Playfair Display', serif; font-size: 52px; font-weight: 800; line-height: 1; margin-bottom: 8px; }
    .cover-sub { font-size: 14px; color: rgba(255,255,255,0.55); margin-bottom: 24px; }
    .cover-meta { display: flex; gap: 20px; }
    .cover-badge { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 999px; padding: 5px 14px; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.8); }
    .accent-bar { height: 4px; background: linear-gradient(90deg, #3b82f6, #a855f7, #22c55e); }
    .content { padding: 40px 48px; }
    .section { margin-bottom: 36px; }
    .section-title { font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #3b82f6; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1.5px solid #e8eaf6; }
    .day-block { margin-bottom: 14px; padding: 16px 20px; background: #f8f9ff; border-radius: 12px; border-left: 3px solid #3b82f6; }
    .day-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #2563eb; margin-bottom: 4px; }
    .day-body { font-size: 13px; line-height: 1.8; color: #374151; white-space: pre-wrap; }
    .budget-block { margin-bottom: 12px; padding: 14px 18px; background: #fffbeb; border-radius: 10px; border-left: 3px solid #f59e0b; }
    .budget-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #d97706; margin-bottom: 4px; }
    .budget-body { font-size: 13px; line-height: 1.8; color: #374151; white-space: pre-wrap; }
    .research-block { margin-bottom: 12px; padding: 14px 18px; background: #f0fdf4; border-radius: 10px; border-left: 3px solid #22c55e; }
    .research-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #16a34a; margin-bottom: 4px; }
    .research-body { font-size: 13px; line-height: 1.8; color: #374151; white-space: pre-wrap; }
    .footer { text-align: center; padding: 24px; font-size: 10px; color: #9ca3af; letter-spacing: 0.1em; text-transform: uppercase; border-top: 1px solid #e8eaf6; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="cover">
    <div class="cover-tag">Voyage · AI Travel Planner</div>
    <div class="cover-title">${destination}</div>
    <div class="cover-sub">Your personalised AI-crafted itinerary</div>
    <div class="cover-meta">
      <div class="cover-badge">✈ Trip Plan</div>
      <div class="cover-badge">📅 ${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div>
    </div>
  </div>
  <div class="accent-bar"></div>
  <div class="content">
    <div class="section">
      <div class="section-title">Day-by-Day Itinerary</div>
      ${sections.map(s => `<div class="day-block">${s.title ? `<div class="day-label">${s.title}</div>` : ''}<div class="day-body">${s.body.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div></div>`).join('')}
    </div>
    ${budgetSections.length > 0 ? `<div class="section"><div class="section-title">Budget Breakdown</div>${budgetSections.map(s => `<div class="budget-block">${s.title ? `<div class="budget-label">${s.title}</div>` : ''}<div class="budget-body">${s.body.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div></div>`).join('')}</div>` : ''}
    ${researchSections.length > 0 ? `<div class="section"><div class="section-title">Research & Tips</div>${researchSections.map(s => `<div class="research-block">${s.title ? `<div class="research-label">${s.title}</div>` : ''}<div class="research-body">${s.body.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div></div>`).join('')}</div>` : ''}
  </div>
  <div class="footer">Voyage · AI Travel Planner · Generated ${new Date().toLocaleDateString()}</div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  const win  = window.open(url, '_blank')
  if (!win) {
    const a = document.createElement('a')
    a.href = url; a.download = `${destination}-itinerary.html`; a.click()
  }
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
      setPlanData(await res.json())
      setActiveTab('plan')
    } catch (e) { console.error(e) }
    finally { setIsLoading(false) }
  }

  function handleDestClick(name: string, country: string, duration: string) {
    const q = `${duration} in ${name}, ${country}, medium budget`
    setTrip(q); if (inputRef.current) inputRef.current.value = q
  }

  const D = dark
  if (!mounted) return <div style={{ minHeight:'100vh', background:'#f8faff' }} />

  // ── Design tokens — bright, easy on eyes ──
  const c = {
    bg:        D ? '#0e0e18'                : '#f8faff',
    surface:   D ? 'rgba(20,20,34,0.96)'   : 'rgba(255,255,255,0.97)',
    surfaceHi: D ? 'rgba(26,26,44,0.99)'   : '#ffffff',
    border:    D ? 'rgba(255,255,255,0.08)': 'rgba(59,130,246,0.12)',
    borderHi:  D ? 'rgba(255,255,255,0.13)': 'rgba(59,130,246,0.2)',
    text:      D ? '#f0f0ff'               : '#1e1e3a',
    textSec:   D ? 'rgba(240,240,255,0.52)': '#64748b',
    textTert:  D ? 'rgba(240,240,255,0.24)': '#94a3b8',
    accent:    D ? '#60a5fa'               : '#2563eb',
    accentGlow:D ? 'rgba(96,165,250,0.18)' : 'rgba(37,99,235,0.1)',
    accentSoft:D ? 'rgba(96,165,250,0.08)' : 'rgba(37,99,235,0.06)',
    violet:    D ? '#c084fc'               : '#9333ea',
    green:     D ? '#4ade80'               : '#16a34a',
    amber:     D ? '#fbbf24'               : '#d97706',
    red:       '#f43f5e',
    // Note card colors for light mode
    noteBlue:  '#eff6ff',
    notePurple:'#faf5ff',
    noteGreen: '#f0fdf4',
    noteAmber: '#fffbeb',
  }

  const tabs: { id: Tab; label: string; icon: string; accent: string }[] = [
    { id:'stream',   label:'Live',      icon:'◈', accent: D?'#60a5fa':'#2563eb' },
    { id:'plan',     label:'Itinerary', icon:'⬡', accent: D?'#c084fc':'#9333ea' },
    { id:'research', label:'Research',  icon:'◎', accent: D?'#4ade80':'#16a34a' },
    { id:'budget',   label:'Budget',    icon:'◇', accent: D?'#fbbf24':'#d97706' },
  ]

  return (
    <div style={{ fontFamily:"-apple-system,'SF Pro Display',BlinkMacSystemFont,'Helvetica Neue',sans-serif", minHeight:'100vh', background:c.bg, transition:'background 0.5s', position:'relative', overflow:'hidden' }}>
      <style>{`
        *{box-sizing:border-box}
        .blur-xl{backdrop-filter:saturate(180%) blur(24px);-webkit-backdrop-filter:saturate(180%) blur(24px)}

        @keyframes floatbg{0%,100%{transform:scale(1.05) translateY(0)}50%{transform:scale(1.09) translateY(-12px)}}
        @keyframes up0{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes blinkcur{0%,49%{opacity:1}50%,100%{opacity:0}}
        @keyframes pulserec{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.8)}}
        @keyframes shimmer{0%,100%{opacity:0.3}50%{opacity:1}}
        @keyframes slideIn{from{opacity:0;transform:translateX(6px)}to{opacity:1;transform:translateX(0)}}
        @keyframes notepop{from{opacity:0;transform:translateY(10px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}

        .aup {animation:up0 0.48s cubic-bezier(0.25,0.46,0.45,0.94) both}
        .aup1{animation:up0 0.48s cubic-bezier(0.25,0.46,0.45,0.94) 0.07s both}
        .aup2{animation:up0 0.48s cubic-bezier(0.25,0.46,0.45,0.94) 0.14s both}
        .shimmer{animation:shimmer 1.2s ease-in-out infinite}
        .recdot{animation:pulserec 1.3s ease-in-out infinite}
        .cursor{display:inline-block;width:2px;height:15px;vertical-align:middle;margin-left:2px;border-radius:1px;animation:blinkcur 1s step-end infinite}
        .tabcontent{animation:slideIn 0.22s ease both}
        .note-card{animation:notepop 0.3s ease both}

        .dest-scroll{display:flex;gap:12px;overflow-x:auto;padding-bottom:10px;scrollbar-width:none;-ms-overflow-style:none}
        .dest-scroll::-webkit-scrollbar{display:none}
        .dest-pill{flex-shrink:0;position:relative;width:148px;height:188px;border-radius:18px;overflow:hidden;cursor:pointer;border:none;padding:0;transition:transform 0.22s cubic-bezier(0.25,0.46,0.45,0.94),box-shadow 0.22s}
        .dest-pill:hover{transform:translateY(-4px) scale(1.03)}
        .dest-pill:active{transform:scale(0.97)}
        .dest-pill img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.45s}
        .dest-pill:hover img{transform:scale(1.08)}

        .tab-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:10px 6px 8px;border:none;cursor:pointer;font-family:inherit;background:transparent;border-bottom:2.5px solid transparent;transition:all 0.22s}
        .tab-btn.act{border-bottom-color:var(--tacc)}
        .tab-btn:active{opacity:0.7}

        .ios-inp{appearance:none;transition:border-color 0.2s,box-shadow 0.2s}
        .ios-inp:focus{outline:none}
        .ios-btn:active:not([disabled]){opacity:0.7;transform:scale(0.96)}
        button[disabled]{opacity:0.35!important;cursor:not-allowed!important}

        .cdot{height:4px;border-radius:2px;cursor:pointer;transition:all 0.3s;background:rgba(255,255,255,0.3)}
        .cdot.act{background:white}

        /* Note card */
        .note{border-radius:14px;overflow:hidden;margin-bottom:12px;border:1.5px solid;transition:box-shadow 0.2s}
        .note:hover{box-shadow:0 4px 20px rgba(0,0,0,0.08)}

        /* Stream text */
        .stream-text{font-size:15px;line-height:1.9;letter-spacing:0.01em}

        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(150,150,200,0.18);border-radius:2px}
      `}</style>

      {/* ── Background ── */}
      <div style={{ position:'fixed',inset:0,zIndex:0,overflow:'hidden' }}>
        {HERO_POOL.map((src, i) => (
          <div key={i} style={{
            position:'absolute',inset:'-10%',
            backgroundImage:`url(${src})`,backgroundSize:'cover',backgroundPosition:'center',
            opacity: i === heroBgIdx ? (D ? 0.1 : 0.12) : 0,
            transition:'opacity 2.2s ease',
            animation:'floatbg 22s ease-in-out infinite',animationDelay:`${i*0.7}s`,
            filter: D ? 'saturate(0.4) brightness(0.7)' : 'saturate(0.8) brightness(1.1)',
          }} />
        ))}
        <div style={{
          position:'absolute',inset:0,
          background: D
            ? 'linear-gradient(160deg,rgba(14,14,24,0.82) 0%,rgba(14,14,24,0.6) 50%,rgba(14,14,24,0.88) 100%)'
            : 'linear-gradient(160deg,rgba(248,250,255,0.85) 0%,rgba(248,250,255,0.65) 50%,rgba(248,250,255,0.9) 100%)',
        }} />
        {/* Soft orbs */}
        <div style={{ position:'absolute',top:'6%',right:'8%',width:400,height:400,borderRadius:'50%',background:`radial-gradient(circle,${c.accentGlow},transparent 65%)`,pointerEvents:'none' }} />
        <div style={{ position:'absolute',bottom:'12%',left:'5%',width:320,height:320,borderRadius:'50%',background:D?'radial-gradient(circle,rgba(192,132,252,0.07),transparent 65%)':'radial-gradient(circle,rgba(147,51,234,0.04),transparent 65%)',pointerEvents:'none' }} />
      </div>

      {/* ── Shell ── */}
      <div style={{ position:'relative',zIndex:10,maxWidth:760,margin:'0 auto',padding:'0 0 80px' }}>

        {/* ── Nav ── */}
        <div className="blur-xl" style={{
          position:'sticky',top:0,zIndex:100,
          background: D ? 'rgba(14,14,24,0.82)' : 'rgba(248,250,255,0.88)',
          borderBottom:`1px solid ${c.border}`,
          padding:'12px 22px 10px',
        }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
              <div style={{ width:34,height:34,borderRadius:10,background:`linear-gradient(135deg,${c.accent},${c.violet})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16 }}>✈</div>
              <div>
                <p style={{ margin:0,fontSize:15,fontWeight:800,color:c.text,letterSpacing:'-0.02em' }}>Voyage</p>
                <p style={{ margin:0,fontSize:9,color:c.textSec,letterSpacing:'0.14em',fontWeight:600,textTransform:'uppercase' }}>AI Travel Planner</p>
              </div>
            </div>
            <button onClick={() => setDark(!D)} style={{ display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:999,border:`1.5px solid ${c.borderHi}`,background: D?'rgba(96,165,250,0.08)':'rgba(37,99,235,0.06)',cursor:'pointer',color:c.accent,fontSize:11,fontWeight:700,letterSpacing:'0.07em',textTransform:'uppercase',fontFamily:'inherit',transition:'all 0.2s' }}>
              <span style={{ fontSize:13 }}>{D ? '☀️' : '🌙'}</span>
              {D ? 'Day' : 'Night'}
            </button>
          </div>
        </div>

        {/* ── Hero ── */}
        <div className="aup" style={{ padding:'36px 22px 0' }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:10 }}>
            <div style={{ width:20,height:2,background:`linear-gradient(90deg,${c.accent},${c.violet})`,borderRadius:2 }} />
            <p style={{ margin:0,fontSize:10,fontWeight:700,color:c.accent,letterSpacing:'0.18em',textTransform:'uppercase' }}>
              {new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}
            </p>
          </div>
          <h1 style={{ margin:'0 0 14px',fontSize:44,fontWeight:800,color:c.text,letterSpacing:'-0.035em',lineHeight:1.06 }}>
            Where are you<br/>
            <span style={{ background:`linear-gradient(135deg,${c.accent},${c.violet})`,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text' }}>headed next?</span>
          </h1>
          <p style={{ margin:0,fontSize:15,color:c.textSec,lineHeight:1.65,maxWidth:420,fontWeight:400 }}>
            Describe your dream trip — get a full itinerary, local tips & budget in seconds.
          </p>
        </div>

        {/* ── Input card ── */}
        <div className="aup1" style={{ margin:'20px 22px 0',borderRadius:18,background:c.surfaceHi,border:`1.5px solid ${c.borderHi}`,boxShadow: D?'0 8px 40px rgba(0,0,0,0.45)':'0 4px 24px rgba(37,99,235,0.08)',overflow:'hidden' }}>
          <div style={{ display:'flex',alignItems:'center',gap:0,padding:'5px' }}>
            <button onClick={toggleVoice} style={{ width:52,height:52,borderRadius:12,border:'none',background:isListening?'rgba(244,63,94,0.08)':'transparent',cursor:'pointer',fontSize:19,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:isListening?c.red:c.textSec,transition:'all 0.2s',fontFamily:'inherit' }}>
              {isListening ? <span className="recdot" style={{ display:'block',width:11,height:11,borderRadius:'50%',background:c.red }} /> : '🎙'}
            </button>
            <input
              ref={inputRef} type="text"
              onChange={e => setTrip(e.target.value)}
              placeholder="7 days in Bali, beach & temples, medium budget…"
              className="ios-inp"
              style={{ flex:1,height:52,border:`1.5px solid ${c.border}`,borderRadius:12,background: D?'rgba(255,255,255,0.03)':'rgba(248,250,255,0.8)',color:c.text,fontSize:14,padding:'0 13px',fontFamily:'inherit' }}
              onFocus={e => { e.target.style.borderColor=c.accent; e.target.style.boxShadow=`0 0 0 3px ${c.accentGlow}` }}
              onBlur={e  => { e.target.style.borderColor=c.border;  e.target.style.boxShadow='none' }}
            />
            <button onClick={() => { handleClick(); handlePlan() }} disabled={isLoading||!trip} className="ios-btn"
              style={{ margin:'0 4px',height:44,paddingInline:20,borderRadius:11,border:'none',background:isLoading||!trip?c.border:`linear-gradient(135deg,${c.accent},${c.violet})`,color:'white',fontSize:12,fontWeight:700,cursor:'pointer',letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:'inherit',flexShrink:0,transition:'all 0.2s',boxShadow:(!isLoading&&trip)?`0 4px 18px ${c.accentGlow}`:'none' }}>
              {isLoading ? '···' : 'Plan →'}
            </button>
          </div>
          {(vapiError || isListening) && (
            <div style={{ padding:'4px 16px 10px',borderTop:`1px solid ${c.border}` }}>
              {vapiError   && <p style={{ margin:0,fontSize:12,color:c.red,fontWeight:500 }}>{vapiError}</p>}
              {isListening && <p style={{ margin:0,fontSize:12,color:c.accent,fontWeight:600,letterSpacing:'0.04em' }}>◉ Listening… describe your trip</p>}
            </div>
          )}
        </div>

        {/* Loading */}
        {isLoading && !streamedText && (
          <div style={{ display:'flex',alignItems:'center',gap:6,padding:'16px 26px' }}>
            {[0,0.15,0.3].map((d,i) => (
              <div key={i} className="shimmer" style={{ width:8,height:8,borderRadius:'50%',background:c.accent,animationDelay:d+'s' }} />
            ))}
            <span style={{ fontSize:11,color:c.textSec,fontWeight:600,marginLeft:6,letterSpacing:'0.1em',textTransform:'uppercase' }}>Crafting your journey</span>
          </div>
        )}

        {/* ── Popular destinations ── */}
        {!planData && !streamedText && (
          <div className="aup2" style={{ margin:'26px 22px 0' }}>
            <div style={{ display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:14 }}>
              <p style={{ margin:0,fontSize:19,fontWeight:800,color:c.text,letterSpacing:'-0.02em' }}>Popular</p>
              <p style={{ margin:0,fontSize:12,color:c.accent,fontWeight:600,cursor:'pointer' }}>See all</p>
            </div>
            <div className="dest-scroll">
              {POPULAR.map(d => (
                <button key={d.name} onClick={() => handleDestClick(d.name,d.country,d.duration)} className="dest-pill" style={{ boxShadow: D?'0 6px 28px rgba(0,0,0,0.55)':'0 4px 18px rgba(37,99,235,0.1)' }}>
                  <img src={popImages[d.name]||d.fb} alt={d.name} />
                  <div style={{ position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,0.78) 0%,rgba(0,0,0,0.02) 55%,transparent 100%)' }} />
                  <div style={{ position:'absolute',top:10,left:10,padding:'2px 8px',borderRadius:999,fontSize:8,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)',border:'0.5px solid rgba(255,255,255,0.18)',color:'white' }}>{d.tag}</div>
                  <div style={{ position:'absolute',bottom:0,left:0,right:0,padding:'0 12px 12px' }}>
                    <p style={{ margin:0,color:'white',fontSize:14,fontWeight:700,lineHeight:1.2 }}>{d.name}</p>
                    <p style={{ margin:'2px 0 6px',color:'rgba(255,255,255,0.5)',fontSize:10 }}>{d.country}</p>
                    <div style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:999,fontSize:9,fontWeight:600,background:'rgba(255,255,255,0.12)',border:'0.5px solid rgba(255,255,255,0.2)',color:'rgba(255,255,255,0.85)' }}>📅 {d.duration}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {(streamedText || planData) && (
          <div className="aup2" style={{ margin:'20px 22px 0',borderRadius:20,background:c.surface,border:`1.5px solid ${c.borderHi}`,boxShadow: D?'0 12px 56px rgba(0,0,0,0.6)':'0 8px 40px rgba(37,99,235,0.08)',overflow:'hidden' }}>

            {/* Hero carousel */}
            {heroImages.length > 0 && (
              <div style={{ position:'relative',height:222 }}>
                <img src={heroImages[heroIdx]} alt="destination" style={{ width:'100%',height:222,objectFit:'cover',display:'block',transition:'opacity 0.35s' }} />
                <div style={{ position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,0.82) 0%,rgba(0,0,0,0.04) 52%,transparent 100%)' }} />
                <div style={{ position:'absolute',bottom:14,left:16 }}>
                  <p style={{ margin:0,color:'white',fontSize:24,fontWeight:800,letterSpacing:'-0.025em',textShadow:'0 2px 10px rgba(0,0,0,0.6)' }}>{extractKeyword(trip)}</p>
                  <p style={{ margin:'2px 0 0',color:'rgba(255,255,255,0.45)',fontSize:9,letterSpacing:'0.14em',textTransform:'uppercase',fontWeight:700 }}>AI-crafted itinerary</p>
                </div>
                {heroImages.length > 1 && (
                  <>
                    <button onClick={() => setHeroIdx(i => (i-1+heroImages.length)%heroImages.length)} style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',width:28,height:28,borderRadius:999,background:'rgba(0,0,0,0.45)',backdropFilter:'blur(6px)',border:'0.5px solid rgba(255,255,255,0.2)',color:'white',fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit' }}>‹</button>
                    <button onClick={() => setHeroIdx(i => (i+1)%heroImages.length)} style={{ position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',width:28,height:28,borderRadius:999,background:'rgba(0,0,0,0.45)',backdropFilter:'blur(6px)',border:'0.5px solid rgba(255,255,255,0.2)',color:'white',fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit' }}>›</button>
                  </>
                )}
                <div style={{ position:'absolute',bottom:14,right:14,display:'flex',gap:4 }}>
                  {heroImages.map((_,i) => (
                    <div key={i} onClick={() => setHeroIdx(i)} className={`cdot${i===heroIdx?' act':''}`} style={{ width: i===heroIdx ? 18 : 5 }} />
                  ))}
                </div>
              </div>
            )}

            {/* Tab bar */}
            <div style={{ background: D?'rgba(14,14,24,0.6)':'rgba(248,250,255,0.7)',borderBottom:`1px solid ${c.border}` }}>
              <div style={{ display:'flex',alignItems:'stretch' }}>
                {tabs.map(tab => {
                  const isAct = activeTab === tab.id
                  return (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      className={`tab-btn${isAct?' act':''}`}
                      style={{ '--tacc': tab.accent, color: isAct ? tab.accent : c.textSec, background: isAct?(D?'rgba(255,255,255,0.03)':'rgba(37,99,235,0.03)'):'transparent' } as React.CSSProperties}>
                      <span style={{ fontSize:13,filter:isAct?`drop-shadow(0 0 5px ${tab.accent}88)`:'none',transition:'filter 0.25s' }}>{tab.icon}</span>
                      <span style={{ fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase' }}>{tab.label}</span>
                    </button>
                  )
                })}
                {planData && (
                  <button onClick={() => generatePDF(extractKeyword(trip), planData)} style={{ flexShrink:0,alignSelf:'center',margin:'0 10px',padding:'6px 13px',borderRadius:8,border:`1.5px solid ${c.accent}`,background:c.accentSoft,color:c.accent,fontSize:9,fontWeight:700,cursor:'pointer',letterSpacing:'0.1em',textTransform:'uppercase',fontFamily:'inherit',display:'flex',alignItems:'center',gap:5,transition:'all 0.2s' }}>
                    <span style={{ fontSize:12 }}>↓</span> PDF
                  </button>
                )}
              </div>
            </div>

            {/* Tab content */}
            <div className="tabcontent" key={activeTab} style={{ padding:'16px',maxHeight:560,overflowY:'auto' }}>

              {/* ── Live stream ── */}
              {activeTab==='stream' && streamedText && (
                <div style={{ background: D?'rgba(96,165,250,0.05)':'#eff6ff',borderRadius:14,padding:20,border:`1.5px solid ${D?'rgba(96,165,250,0.15)':'#bfdbfe'}` }}>
                  <div style={{ display:'flex',alignItems:'center',gap:7,marginBottom:12 }}>
                    <div className="shimmer" style={{ width:7,height:7,borderRadius:'50%',background:c.accent }} />
                    <span style={{ fontSize:10,fontWeight:700,color:c.accent,letterSpacing:'0.18em',textTransform:'uppercase' }}>Live Generation</span>
                  </div>
                  <p className="stream-text" style={{ color:c.text,margin:0,whiteSpace:'pre-wrap' }}>
                    {stripMarkdown(streamedText)}
                    <span className="cursor" style={{ background:c.accent }} />
                  </p>
                </div>
              )}

              {/* ── Plan — note cards ── */}
              {activeTab==='plan' && planData && (
                <div>
                  {parsePlan(planData.plan).map((s, i) => {
                    const clr = getDayColor(i)
                    const isDayCard = /^day\s*\d+/i.test(s.title)
                    const dayMatch = s.title.match(/\d+/)
                    return (
                      <div key={i} className="note note-card" style={{
                        borderColor: D ? 'rgba(255,255,255,0.08)' : clr.border,
                        background: D ? 'rgba(26,26,44,0.95)' : clr.bg,
                        animationDelay: `${i * 0.04}s`,
                      }}>
                        {/* Section image */}
                        {sectionImages[i] && (
                          <div style={{ position:'relative',height:120 }}>
                            <img src={sectionImages[i]} alt={s.title} style={{ width:'100%',height:120,objectFit:'cover',display:'block' }} />
                            <div style={{ position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,0.45),transparent)' }} />
                          </div>
                        )}
                        <div style={{ padding:'14px 16px' }}>
                          {s.title && (
                            <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:10 }}>
                              {isDayCard && dayMatch ? (
                                <div style={{ width:36,height:36,borderRadius:10,flexShrink:0,background:D?`rgba(255,255,255,0.06)`:clr.border+'22',border:`1.5px solid ${D?'rgba(255,255,255,0.12)':clr.border}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center' }}>
                                  <span style={{ fontSize:7,fontWeight:700,color:D?clr.border:clr.label,letterSpacing:'0.1em',textTransform:'uppercase',lineHeight:1 }}>DAY</span>
                                  <span style={{ fontSize:15,fontWeight:800,color:D?clr.border:clr.label,lineHeight:1 }}>{dayMatch[0]}</span>
                                </div>
                              ) : (
                                <div style={{ width:8,height:8,borderRadius:'50%',background:D?clr.border:clr.dot,flexShrink:0,marginTop:1 }} />
                              )}
                              <p style={{ margin:0,fontSize:isDayCard?14:11,fontWeight:700,color:D?'rgba(240,240,255,0.9)':clr.label,letterSpacing:isDayCard?'-0.01em':'0.08em',textTransform:isDayCard?'none':'uppercase' }}>
                                {isDayCard ? s.title.replace(/^day\s*\d+[:\-–—]?\s*/i,'').trim() || s.title : s.title}
                              </p>
                            </div>
                          )}
                          <p style={{ margin:0,fontSize:14,lineHeight:1.82,color:D?'rgba(240,240,255,0.78)':'#374151',whiteSpace:'pre-wrap',fontWeight:400,letterSpacing:'0.005em' }}>
                            {s.body}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── Research — note cards ── */}
              {activeTab==='research' && planData && (
                <div>
                  {parsePlan(planData.research).map((s, i) => (
                    <div key={i} className="note note-card" style={{
                      borderColor: D?'rgba(255,255,255,0.08)':'#bbf7d0',
                      background: D?'rgba(26,44,34,0.9)':'#f0fdf4',
                      animationDelay: `${i * 0.04}s`,
                    }}>
                      <div style={{ padding:'14px 16px' }}>
                        {s.title && (
                          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:8 }}>
                            <div style={{ width:7,height:7,borderRadius:'50%',background:D?'#4ade80':'#16a34a',flexShrink:0 }} />
                            <p style={{ margin:0,fontSize:10,fontWeight:700,color:D?'#4ade80':'#15803d',letterSpacing:'0.1em',textTransform:'uppercase' }}>{s.title}</p>
                          </div>
                        )}
                        <p style={{ margin:0,fontSize:14,lineHeight:1.82,color:D?'rgba(240,255,240,0.78)':'#166534',whiteSpace:'pre-wrap',fontWeight:400 }}>{s.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Budget ── */}
              {activeTab==='budget' && planData && (
                <div>
                  {planData.budget && typeof planData.budget === 'object' ? (
                    <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
                      {Object.entries(planData.budget).map(([key,val],i) => (
                        <div key={i} className="note-card" style={{ borderRadius:14,background:D?'rgba(44,34,0,0.8)':'#fffbeb',border:`1.5px solid ${D?'rgba(251,191,36,0.2)':'#fde68a'}`,padding:'16px 18px' }}>
                          <p style={{ margin:'0 0 8px',fontSize:10,fontWeight:700,color:D?'#fbbf24':'#92400e',letterSpacing:'0.12em',textTransform:'uppercase' }}>{key}</p>
                          <p style={{ margin:0,fontSize:26,fontWeight:800,color:D?'#fbbf24':'#d97706',letterSpacing:'-0.02em' }}>
                            {typeof val === 'number' ? `$${Number(val).toLocaleString()}` : String(val)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : planData.budget && typeof planData.budget === 'string' ? (
                    <div>
                      {parsePlan(planData.budget).map((s, i) => (
                        <div key={i} className="note note-card" style={{
                          borderColor: D?'rgba(251,191,36,0.15)':'#fde68a',
                          background: D?'rgba(44,34,0,0.6)':'#fffbeb',
                          animationDelay: `${i * 0.04}s`,
                        }}>
                          <div style={{ padding:'14px 16px' }}>
                            {s.title && (
                              <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:8 }}>
                                <div style={{ width:7,height:7,borderRadius:'50%',background:D?'#fbbf24':'#d97706',flexShrink:0 }} />
                                <p style={{ margin:0,fontSize:10,fontWeight:700,color:D?'#fbbf24':'#92400e',letterSpacing:'0.1em',textTransform:'uppercase' }}>{s.title}</p>
                              </div>
                            )}
                            <p style={{ margin:0,fontSize:14,lineHeight:1.82,color:D?'rgba(255,251,235,0.78)':'#78350f',whiteSpace:'pre-wrap',fontWeight:400 }}>{s.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ borderRadius:14,background:D?'rgba(20,20,34,0.96)':'#fffbeb',border:`1.5px solid ${D?'rgba(251,191,36,0.15)':'#fde68a'}`,padding:16 }}>
                      <p style={{ margin:0,fontSize:14,lineHeight:1.75,color:D?'rgba(251,191,36,0.7)':'#92400e' }}>Budget estimates are included in your itinerary. Check the Plan tab for day-by-day cost breakdowns.</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}

        <p style={{ textAlign:'center',fontSize:10,marginTop:26,color:c.textTert,letterSpacing:'0.08em',fontWeight:600,textTransform:'uppercase' }}>
          Voyage · Powered by AI
        </p>
      </div>
    </div>
  )
}