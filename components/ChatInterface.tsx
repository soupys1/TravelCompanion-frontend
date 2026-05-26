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

type DaySection = {
  dayNum: number | null
  title: string
  subtitle: string
  items: { icon: string; label: string; detail: string }[]
  raw: string
}

function parseDaySections(text: string): DaySection[] {
  if (!text || typeof text !== 'string') return []

  const guessIcon = (t: string): string => {
    const s = t.toLowerCase()
    if (/breakfast|lunch|dinner|eat|food|restaur|café|cafe|cuisine|meal|snack/.test(s)) return '🍽'
    if (/hotel|stay|accommod|hostel|resort|airbnb|check.?in|check.?out/.test(s)) return '🏨'
    if (/flight|airport|depart|arriv|fly|airline/.test(s)) return '✈️'
    if (/train|bus|metro|subway|transit|transport|taxi|uber|tuk/.test(s)) return '🚆'
    if (/museum|gallery|exhibit|art|histor/.test(s)) return '🏛'
    if (/beach|ocean|sea|swim|snorkel|surf/.test(s)) return '🏖'
    if (/hike|trek|trail|mountain|climb|nature|park|forest/.test(s)) return '🥾'
    if (/temple|shrine|mosque|church|worship|spiritual/.test(s)) return '⛩'
    if (/shop|market|mall|souvenir|bazaar/.test(s)) return '🛍'
    if (/tip|note|advice|recommend|important|visa|currency|weather/.test(s)) return '💡'
    if (/evening|night|bar|club|cocktail|sunset/.test(s)) return '🌆'
    if (/morning|sunrise|early/.test(s)) return '🌅'
    return '📍'
  }

  // Step 1: pre-split on "Day N" even if it appears mid-line (AI often runs them together)
  const clean = stripMarkdown(text)
  // Insert newlines before every "Day N" occurrence so they become proper line breaks
  const normalised = clean
    .replace(/\.\s+(Day\s+\d+)/gi, '.\n$1')   // "...area. Day 2:" → split
    .replace(/([^.\n])\s+(Day\s+\d+\b)/gi, '$1\n$2') // "...area Day 2:" → split

  const lines = normalised.split('\n').map(l => l.trim()).filter(Boolean)
  const days: DaySection[] = []
  let cur: DaySection | null = null

  const flush = () => { if (cur) days.push(cur) }

  const isDayHeader  = (l: string) => /^day\s*\d+/i.test(l)
  const isOtherHeader = (l: string) =>
    /^(overview|arrival|departure|getting there|accommodation|transport|flight|tips?|notes?|total|summary)/i.test(l)

  const addLine = (line: string) => {
    if (!cur) return
    // Bullet point lines
    const isBullet = line.startsWith('•')
    const content  = isBullet ? line.replace(/^•\s*/, '') : line
    // "Label: detail" split (label must be short)
    const colonM = content.match(/^([^:]{2,32}):\s*(.+)$/)
    const dashM  = content.match(/^(.+?)\s*[—\-–]\s*(.+)$/)
    if (colonM) {
      cur.items.push({ icon: guessIcon(content), label: colonM[1].trim(), detail: colonM[2].trim() })
    } else if (isBullet && dashM) {
      cur.items.push({ icon: guessIcon(content), label: dashM[1].trim(), detail: dashM[2].trim() })
    } else if (isBullet || line.length < 80) {
      cur.items.push({ icon: guessIcon(content), label: content, detail: '' })
    } else {
      // Long prose → raw
      cur.raw += (cur.raw ? '\n' : '') + line
    }
  }

  for (const line of lines) {
    if (isDayHeader(line)) {
      flush()
      const dayMatch = line.match(/day\s*(\d+)/i)
      const dayNum   = dayMatch ? parseInt(dayMatch[1]) : null
      const subtitle = line.replace(/^day\s*\d+[:\-–—]?\s*/i, '').trim()
      cur = { dayNum, title: line, subtitle, items: [], raw: '' }
    } else if (isOtherHeader(line)) {
      flush()
      cur = { dayNum: null, title: line, subtitle: '', items: [], raw: '' }
    } else {
      addLine(line)
    }
  }
  flush()

  // If nothing parsed as days, fall back: treat every sentence as a bullet under one block
  if (days.length === 0) {
    const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean]
    return [{ dayNum: null, title: 'Itinerary', subtitle: '', raw: '',
      items: sentences.map(s => ({ icon: guessIcon(s), label: s.trim(), detail: '' })) }]
  }

  return days
}

function extractKeyword(text: string): string {
  return text.split(',')[0].trim().replace(/\d+\s*(days?|nights?)\s*(in|to)\s*/i, '').trim()
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `${r},${g},${b}`
}

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

// Background images per tab — shown as a contextual strip under the tab bar
const TAB_BG: Record<Tab, string> = {
  stream:   'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1400&q=80',
  plan:     'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1400&q=80',
  research: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1400&q=80',
  budget:   'https://images.unsplash.com/photo-1554224154-22dec7ec8818?w=1400&q=80',
}

// Cycling hero backgrounds for the landing page
const HERO_POOL = [
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600&q=85',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1600&q=85',
  'https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=1600&q=85',
  'https://images.unsplash.com/photo-1488085061387-422e29b40080?w=1600&q=85',
]

const POPULAR = [
  { name: 'Tokyo',     country: 'Japan',     tag: 'City',    fb: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&q=80' },
  { name: 'Bali',      country: 'Indonesia', tag: 'Beach',   fb: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&q=80' },
  { name: 'Paris',     country: 'France',    tag: 'Culture', fb: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&q=80' },
  { name: 'Santorini', country: 'Greece',    tag: 'Beach',   fb: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=400&q=80' },
  { name: 'New York',  country: 'USA',       tag: 'City',    fb: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400&q=80' },
  { name: 'Kyoto',     country: 'Japan',     tag: 'Culture', fb: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&q=80' },
]

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
  const [pdfLoading, setPdfLoading]       = useState(false)
  const inputRef    = useRef<HTMLInputElement>(null)
  const resultsRef  = useRef<HTMLDivElement>(null)
  const vapiRef     = useRef<InstanceType<typeof Vapi> | null>(null)

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
        setIsListening(false)
        setVapiError('Voice unavailable — check your Vapi public key')
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
    if (!vapiRef.current) { setVapiError('Vapi key missing in .env.local'); return }
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
    } catch (e) { console.error(e) }
    finally { setIsLoading(false) }
  }

  async function downloadPDF() {
    if (!planData) return
    setPdfLoading(true)
    try {
      const { default: html2pdf } = await import('html2pdf.js')
      const el = resultsRef.current
      if (!el) return
      await html2pdf().set({
        margin: [10, 10],
        filename: `${extractKeyword(trip)}-itinerary.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: dark ? '#080810' : '#f0f4f8' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).from(el).save()
    } catch { alert('Install html2pdf.js: npm install html2pdf.js') }
    finally { setPdfLoading(false) }
  }

  function handleDestClick(name: string, country: string) {
    const q = `7 days in ${name}, ${country}, medium budget`
    setTrip(q); if (inputRef.current) inputRef.current.value = q
  }

  const D = dark
  if (!mounted) return <div style={{ minHeight:'100vh', background: D ? '#080810' : '#f0f4f8' }} />

  // Design tokens
  const c = {
    bg:        D ? '#080810'               : '#f0f4f8',
    surface:   D ? 'rgba(14,14,24,0.94)'   : 'rgba(255,255,255,0.9)',
    surfaceHi: D ? 'rgba(22,22,38,0.97)'   : 'rgba(255,255,255,0.98)',
    border:    D ? 'rgba(255,255,255,0.07)': 'rgba(0,0,0,0.08)',
    borderHi:  D ? 'rgba(255,255,255,0.13)': 'rgba(0,0,0,0.13)',
    text:      D ? '#ececff'               : '#08080f',
    textSec:   D ? 'rgba(236,236,255,0.5)' : 'rgba(8,8,15,0.48)',
    textTert:  D ? 'rgba(236,236,255,0.24)': 'rgba(8,8,15,0.22)',
    accent:    D ? '#22d3ee'               : '#0284c7',
    accentGlow:D ? 'rgba(34,211,238,0.18)' : 'rgba(2,132,199,0.12)',
    accentSoft:D ? 'rgba(34,211,238,0.07)' : 'rgba(2,132,199,0.06)',
    violet:    D ? '#a78bfa'               : '#7c3aed',
    green:     D ? '#4ade80'               : '#16a34a',
    amber:     D ? '#fbbf24'               : '#d97706',
    red:               '#f43f5e',
  }

  // Tab definitions with futuristic accents
  const tabs: { id: Tab; label: string; glyph: string; accent: string; desc: string }[] = [
    { id:'stream',   label:'Live',      glyph:'◈', accent:'#22d3ee', desc:'Streaming output' },
    { id:'plan',     label:'Itinerary', glyph:'⬡', accent:'#a78bfa', desc:'Day-by-day plan' },
    { id:'research', label:'Research',  glyph:'◎', accent:'#4ade80', desc:'Insider tips' },
    { id:'budget',   label:'Budget',    glyph:'◇', accent:'#fbbf24', desc:'Cost breakdown' },
  ]
  const activeTabMeta = tabs.find(t => t.id === activeTab)!

  return (
    <div style={{ fontFamily:"-apple-system,'SF Pro Display',BlinkMacSystemFont,'Helvetica Neue',sans-serif", minHeight:'100vh', background:c.bg, transition:'background 0.6s', position:'relative', overflow:'hidden' }}>
      <style>{`
        *{box-sizing:border-box}
        .blur-xl{backdrop-filter:saturate(200%);-webkit-backdrop-filter:saturate(200%)}
        .blur-lg{backdrop-filter:saturate(160%);-webkit-backdrop-filter:saturate(160%)}

        @keyframes up0{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadein{from{opacity:0}to{opacity:1}}
        @keyframes floatbg{0%,100%{transform:scale(1.04) translateY(0px)}50%{transform:scale(1.08) translateY(-14px)}}
        @keyframes blinkcur{0%,49%{opacity:1}50%,100%{opacity:0}}
        @keyframes pulserec{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.45;transform:scale(0.82)}}
        @keyframes shimmer{0%,100%{opacity:0.28}50%{opacity:1}}
        @keyframes glowpulse{0%,100%{opacity:0.55}50%{opacity:1}}
        @keyframes scanline{0%{top:-2px}100%{top:calc(100% + 2px)}}
        @keyframes tabslide{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
        @keyframes bgfade{from{opacity:0}to{opacity:1}}

        .aup{animation:up0 0.48s cubic-bezier(0.25,0.46,0.45,0.94) both}
        .aup1{animation:up0 0.48s cubic-bezier(0.25,0.46,0.45,0.94) 0.08s both}
        .aup2{animation:up0 0.48s cubic-bezier(0.25,0.46,0.45,0.94) 0.16s both}
        .aup3{animation:up0 0.48s cubic-bezier(0.25,0.46,0.45,0.94) 0.24s both}

        .shimmer{animation:shimmer 1.15s ease-in-out infinite}
        .recdot{animation:pulserec 1.25s ease-in-out infinite}
        .cursor{display:inline-block;width:2px;height:15px;vertical-align:middle;margin-left:2px;border-radius:1px;animation:blinkcur 1s step-end infinite}
        .glow{animation:glowpulse 2s ease-in-out infinite}

        /* Futuristic tab — parallelogram clip */
        .ftab{
          position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
          padding:11px 8px 9px;border:none;cursor:pointer;font-family:inherit;
          clip-path:polygon(10px 0%,100% 0%,calc(100% - 10px) 100%,0% 100%);
          transition:all 0.28s cubic-bezier(0.25,0.46,0.45,0.94);
          background:transparent;
          overflow:hidden;
        }
        .ftab .scanbar{
          position:absolute;left:0;right:0;height:1.5px;
          background:linear-gradient(90deg,transparent,var(--tacc),transparent);
          opacity:0;pointer-events:none;
        }
        .ftab.act .scanbar{opacity:0.8;animation:scanline 2s linear infinite}
        .ftab::after{
          content:'';position:absolute;inset:0;
          clip-path:polygon(10px 0%,100% 0%,calc(100% - 10px) 100%,0% 100%);
          border:1px solid transparent;
          transition:border-color 0.28s;
          pointer-events:none;
        }
        .ftab.act::after{border-color:var(--tacc)}

        .dest-card{position:relative;border-radius:14px;overflow:hidden;cursor:pointer;border:none;padding:0;text-align:left;transition:transform 0.22s cubic-bezier(0.25,0.46,0.45,0.94),box-shadow 0.22s}
        .dest-card:hover{transform:translateY(-3px) scale(1.025)}
        .dest-card:active{transform:scale(0.97)}
        .dest-card img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.45s}
        .dest-card:hover img{transform:scale(1.07)}

        .ios-inp{appearance:none;transition:border-color 0.2s,box-shadow 0.2s}
        .ios-inp:focus{outline:none}

        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(150,150,200,0.16);border-radius:2px}

        .cdot{height:4px;border-radius:2px;cursor:pointer;transition:all 0.3s cubic-bezier(0.25,0.46,0.45,0.94);background:rgba(255,255,255,0.32)}
        .cdot.act{background:white}

        .seccard{border-radius:14px;overflow:hidden;margin-bottom:10px;border:0.5px solid;transition:border-color 0.3s}

        .ios-btn:active:not([disabled]){opacity:0.72;transform:scale(0.96)}
        button[disabled]{opacity:0.38!important;cursor:not-allowed!important}
      `}</style>

      {/* ── Cycling background images ── */}
      <div style={{ position:'fixed',inset:0,zIndex:0,overflow:'hidden' }}>
        {HERO_POOL.map((src, i) => (
          <div key={i} style={{
            position:'absolute',inset:'-10%',
            backgroundImage:`url(${src})`,
            backgroundSize:'cover',backgroundPosition:'center',
            opacity: i === heroBgIdx ? (D ? 0.16 : 0.2) : 0,
            transition:'opacity 2s ease',
            animation:'floatbg 20s ease-in-out infinite',
            animationDelay:`${i*0.6}s`,
            filter: D ? 'saturate(0.6) brightness(0.85)' : 'saturate(1.15) brightness(1.05)',
            willChange:'transform,opacity',
          }} />
        ))}

        {/* Dark/light overlay */}
        <div style={{
          position:'absolute',inset:0,
          background: D
            ? 'linear-gradient(145deg,rgba(8,8,16,0.76) 0%,rgba(8,8,16,0.58) 45%,rgba(8,8,16,0.84) 100%)'
            : 'linear-gradient(145deg,rgba(240,244,248,0.76) 0%,rgba(240,244,248,0.58) 45%,rgba(240,244,248,0.84) 100%)',
        }} />

        {/* Grid mesh */}
        <div style={{
          position:'absolute',inset:0,
          backgroundImage: D
            ? 'linear-gradient(rgba(34,211,238,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,0.022) 1px,transparent 1px)'
            : 'linear-gradient(rgba(0,0,0,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.022) 1px,transparent 1px)',
          backgroundSize:'56px 56px',
          pointerEvents:'none',
        }} />

        {/* Ambient orbs */}
        <div style={{ position:'absolute',top:'8%',right:'10%',width:400,height:400,borderRadius:'50%',
          background:`radial-gradient(circle,${c.accentGlow},transparent 68%)`,pointerEvents:'none' }} />
        <div style={{ position:'absolute',bottom:'12%',left:'6%',width:320,height:320,borderRadius:'50%',
          background: D ? 'radial-gradient(circle,rgba(167,139,250,0.06),transparent 68%)' : 'radial-gradient(circle,rgba(124,58,237,0.04),transparent 68%)',
          pointerEvents:'none' }} />
      </div>

      {/* ── App shell ── */}
      <div style={{ position:'relative',zIndex:10,maxWidth:760,margin:'0 auto',padding:'0 0 80px' }}>

        {/* ── Nav ── */}
        <div className="blur-xl" style={{
          position:'sticky',top:0,zIndex:100,
          background: D ? 'rgba(8,8,16,0.8)' : 'rgba(240,244,248,0.84)',
          borderBottom:`0.5px solid ${c.border}`,
          padding:'11px 22px 9px',
        }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
              {/* Hexagon logo */}
              <svg width="32" height="32" viewBox="0 0 32 32" style={{ flexShrink:0 }}>
                <polygon points="16,2 30,9 30,23 16,30 2,23 2,9" fill="none" stroke={c.accent} strokeWidth="1.4" opacity="0.85" />
                <text x="16" y="21" textAnchor="middle" fontSize="13" fill={c.accent}>✈</text>
              </svg>
              <div>
                <p style={{ margin:0,fontSize:15,fontWeight:700,color:c.text,letterSpacing:'-0.01em' }}>Voyage</p>
                <p style={{ margin:0,fontSize:9,color:c.textSec,letterSpacing:'0.12em',fontWeight:600,textTransform:'uppercase' }}>AI Travel Planner</p>
              </div>
            </div>

            <button
              onClick={() => setDark(!D)}
              className="ios-btn"
              style={{ display:'flex',alignItems:'center',gap:7,padding:'7px 14px',borderRadius:999,border:`0.5px solid ${c.borderHi}`,background: D ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',cursor:'pointer',color:c.textSec,fontSize:11,fontWeight:600,letterSpacing:'0.07em',textTransform:'uppercase',fontFamily:'inherit',transition:'all 0.22s' }}
            >
              <span style={{ fontSize:13 }}>{D ? '☀️' : '🌙'}</span>
              {D ? 'Day' : 'Night'}
            </button>
          </div>
        </div>

        {/* ── Hero ── */}
        <div className="aup" style={{ padding:'36px 22px 0' }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:10 }}>
            <div style={{ width:22,height:1,background:c.accent,opacity:0.8 }} />
            <p style={{ margin:0,fontSize:10,fontWeight:700,color:c.accent,letterSpacing:'0.16em',textTransform:'uppercase' }}>
              {new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}
            </p>
          </div>

          <h1 style={{ margin:'0 0 14px',fontSize:46,fontWeight:800,color:c.text,letterSpacing:'-0.035em',lineHeight:1.04 }}>
            Where are you<br/>
            <span style={{ color:c.accent,position:'relative',display:'inline-block' }}>
              headed next?
              <svg style={{ position:'absolute',bottom:-5,left:0,width:'100%',height:5,overflow:'visible' }} preserveAspectRatio="none">
                <line x1="0" y1="2.5" x2="100%" y2="2.5" stroke={c.accent} strokeWidth="1.5" strokeDasharray="5 4" opacity="0.55" />
              </svg>
            </span>
          </h1>

          <p style={{ margin:0,fontSize:15,color:c.textSec,fontWeight:400,lineHeight:1.62,maxWidth:430 }}>
            Speak or type your dream trip — AI builds a personalised itinerary with photos, research & budget.
          </p>
        </div>

        {/* ── Input card ── */}
        <div className="aup1" style={{
          margin:'22px 22px 0',borderRadius:18,
          background:c.surfaceHi,
          border:`0.5px solid ${c.borderHi}`,
          boxShadow: D ? `0 8px 40px rgba(0,0,0,0.55),0 0 0 0.5px ${c.accentSoft}` : '0 8px 40px rgba(0,0,0,0.09)',
          overflow:'hidden',
        }}>
          <div style={{ display:'flex',alignItems:'center',gap:0,padding:'5px' }}>
            <button
              onClick={toggleVoice}
              className="ios-btn"
              style={{ width:54,height:54,borderRadius:13,border:'none',background: isListening ? 'rgba(244,63,94,0.1)' : 'transparent',cursor:'pointer',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color: isListening ? c.red : c.textSec,transition:'all 0.2s' }}
            >
              {isListening
                ? <span className="recdot" style={{ display:'block',width:12,height:12,borderRadius:'50%',background:c.red }} />
                : '🎙'}
            </button>

            <input
              ref={inputRef}
              type="text"
              onChange={e => setTrip(e.target.value)}
              placeholder="7 days in Bali, beach & temples, medium budget…"
              className="ios-inp"
              style={{ flex:1,height:54,border:`1px solid ${c.border}`,borderRadius:13,background: D ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',color:c.text,fontSize:15,padding:'0 14px',fontFamily:'inherit' }}
              onFocus={e => { e.target.style.borderColor=c.accent; e.target.style.boxShadow=`0 0 0 3px ${c.accentGlow}` }}
              onBlur={e  => { e.target.style.borderColor=c.border;  e.target.style.boxShadow='none' }}
            />

            <button
              onClick={() => { handleClick(); handlePlan() }}
              disabled={isLoading || !trip}
              className="ios-btn"
              style={{ margin:'0 4px',height:46,paddingInline:22,borderRadius:12,border:`0.5px solid ${c.accent}`,background: D ? 'rgba(34,211,238,0.12)' : 'rgba(2,132,199,0.09)',color:c.accent,fontSize:13,fontWeight:700,cursor:'pointer',letterSpacing:'0.07em',textTransform:'uppercase',fontFamily:'inherit',flexShrink:0,transition:'all 0.2s',boxShadow:(!isLoading&&trip)?`0 0 18px ${c.accentGlow}`:'none' }}
            >
              {isLoading ? '···' : 'Plan →'}
            </button>
          </div>

          {(vapiError || isListening) && (
            <div style={{ padding:'5px 16px 10px',borderTop:`0.5px solid ${c.border}` }}>
              {vapiError   && <p style={{ margin:0,fontSize:12,color:c.red,fontWeight:500 }}>{vapiError}</p>}
              {isListening && <p style={{ margin:0,fontSize:12,color:c.accent,fontWeight:500,letterSpacing:'0.04em' }}>◉ Listening… describe your trip</p>}
            </div>
          )}
        </div>

        {/* ── Loading ── */}
        {isLoading && !streamedText && (
          <div style={{ display:'flex',alignItems:'center',gap:6,padding:'16px 26px' }}>
            {[0,0.15,0.3].map((d,i) => (
              <div key={i} className="shimmer" style={{ width:7,height:7,borderRadius:'50%',background:c.accent,animationDelay:d+'s' }} />
            ))}
            <span style={{ fontSize:11,color:c.textSec,fontWeight:600,marginLeft:6,letterSpacing:'0.1em',textTransform:'uppercase' }}>Crafting your journey</span>
          </div>
        )}

        {/* ── Popular destinations ── */}
        {!planData && !streamedText && (
          <div className="aup2" style={{ margin:'28px 22px 0' }}>
            <div style={{ display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:14 }}>
              <p style={{ margin:0,fontSize:20,fontWeight:700,color:c.text,letterSpacing:'-0.02em' }}>Popular</p>
              <p style={{ margin:0,fontSize:13,color:c.accent,fontWeight:600,cursor:'pointer' }}>See all</p>
            </div>

            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10 }}>
              {POPULAR.map((d, idx) => (
                <button key={d.name} onClick={() => handleDestClick(d.name, d.country)} className="dest-card" style={{ height: idx < 2 ? 168 : 124, boxShadow: D ? '0 4px 24px rgba(0,0,0,0.55)' : '0 4px 24px rgba(0,0,0,0.13)' }}>
                  <img src={popImages[d.name] || d.fb} alt={d.name} />
                  <div style={{ position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,0.72) 0%,rgba(0,0,0,0.03) 54%,transparent 100%)' }} />
                  {/* HUD corner */}
                  <div style={{ position:'absolute',top:0,right:0,width:20,height:20,borderTop:`1.5px solid ${c.accent}`,borderRight:`1.5px solid ${c.accent}`,borderRadius:'0 14px 0 0',opacity:0.65 }} />
                  <div style={{ position:'absolute',bottom:0,left:0,padding:'0 12px 12px' }}>
                    <p style={{ margin:0,color:'white',fontSize:14,fontWeight:700,textShadow:'0 1px 6px rgba(0,0,0,0.5)' }}>{d.name}</p>
                    <p style={{ margin:'1px 0 0',color:'rgba(255,255,255,0.52)',fontSize:10,fontWeight:500 }}>{d.country}</p>
                  </div>
                  <div style={{ position:'absolute',top:10,left:10,padding:'2px 9px',borderRadius:999,fontSize:9,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)',border:'0.5px solid rgba(255,255,255,0.2)',color:'white' }}>{d.tag}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {(streamedText || planData) && (
          <div ref={resultsRef} className="aup2" style={{
            margin:'20px 22px 0',borderRadius:20,
            background:c.surface,
            border:`0.5px solid ${c.borderHi}`,
            boxShadow: D ? '0 10px 50px rgba(0,0,0,0.65)' : '0 10px 50px rgba(0,0,0,0.1)',
            overflow:'hidden',
          }}>

            {/* Hero carousel */}
            {heroImages.length > 0 && (
              <div style={{ position:'relative',height:224 }}>
                <img src={heroImages[heroIdx]} alt="destination" style={{ width:'100%',height:224,objectFit:'cover',display:'block',transition:'opacity 0.38s' }} />
                <div style={{ position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,0.8) 0%,rgba(0,0,0,0.06) 50%,transparent 100%)' }} />

                {/* HUD corners */}
                {(['tl','tr','bl','br'] as const).map(p => (
                  <div key={p} style={{ position:'absolute',
                    top: p[0]==='t' ? 13 : 'auto', bottom: p[0]==='b' ? 13 : 'auto',
                    left: p[1]==='l' ? 13 : 'auto', right: p[1]==='r' ? 13 : 'auto',
                    width:16,height:16,
                    borderTop:    p[0]==='t' ? `1.5px solid ${c.accent}` : 'none',
                    borderBottom: p[0]==='b' ? `1.5px solid ${c.accent}` : 'none',
                    borderLeft:   p[1]==='l' ? `1.5px solid ${c.accent}` : 'none',
                    borderRight:  p[1]==='r' ? `1.5px solid ${c.accent}` : 'none',
                    opacity:0.7,
                  }} />
                ))}

                <div style={{ position:'absolute',bottom:15,left:17 }}>
                  <p style={{ margin:0,color:'white',fontSize:25,fontWeight:800,letterSpacing:'-0.02em',textShadow:'0 2px 12px rgba(0,0,0,0.7)' }}>{extractKeyword(trip)}</p>
                  <p style={{ margin:'2px 0 0',color:'rgba(255,255,255,0.48)',fontSize:9,letterSpacing:'0.12em',textTransform:'uppercase',fontWeight:700 }}>AI-crafted itinerary</p>
                </div>

                {heroImages.length > 1 && (
                  <>
                    <button onClick={() => setHeroIdx(i => (i-1+heroImages.length)%heroImages.length)} style={{ position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',width:30,height:30,borderRadius:999,background:'rgba(0,0,0,0.42)',backdropFilter:'blur(6px)',border:'0.5px solid rgba(255,255,255,0.18)',color:'white',fontSize:15,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit' }}>‹</button>
                    <button onClick={() => setHeroIdx(i => (i+1)%heroImages.length)} style={{ position:'absolute',right:11,top:'50%',transform:'translateY(-50%)',width:30,height:30,borderRadius:999,background:'rgba(0,0,0,0.42)',backdropFilter:'blur(6px)',border:'0.5px solid rgba(255,255,255,0.18)',color:'white',fontSize:15,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit' }}>›</button>
                  </>
                )}
                <div style={{ position:'absolute',bottom:15,right:15,display:'flex',gap:5 }}>
                  {heroImages.map((_,i) => (
                    <div key={i} onClick={() => setHeroIdx(i)} className={`cdot${i===heroIdx?' act':''}`} style={{ width: i===heroIdx ? 20 : 6 }} />
                  ))}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════
                FUTURISTIC TABS
            ═══════════════════════════════════ */}
            <div style={{ position:'relative',background: D ? 'rgba(8,8,16,0.6)' : 'rgba(240,244,248,0.55)' }}>
              {/* Top accent line */}
              <div style={{ position:'absolute',top:0,left:0,right:0,height:'1px',background:`linear-gradient(90deg,transparent 0%,${c.accent}66 30%,${c.accent}99 50%,${c.accent}66 70%,transparent 100%)` }} />

              <div style={{ display:'flex',gap:2,padding:'8px 10px 0',alignItems:'flex-end' }}>
                {tabs.map(tab => {
                  const isAct = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`ftab${isAct?' act':''} ios-btn`}
                      style={{
                        '--tacc': tab.accent,
                        color: isAct ? tab.accent : c.textSec,
                        background: isAct
                          ? `rgba(${hexToRgb(tab.accent)},${D?0.12:0.08})`
                          : 'transparent',
                      } as React.CSSProperties}
                    >
                      <div className="scanbar" />
                      <span style={{ fontSize:14,lineHeight:1,filter: isAct ? `drop-shadow(0 0 6px ${tab.accent}88)` : 'none',transition:'filter 0.3s' }}>{tab.glyph}</span>
                      <span style={{ fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase' }}>{tab.label}</span>
                    </button>
                  )
                })}

                {/* PDF */}
                {planData && (
                  <button onClick={downloadPDF} disabled={pdfLoading} className="ios-btn"
                    style={{ flexShrink:0,alignSelf:'center',marginLeft:4,marginBottom:4,padding:'6px 12px',borderRadius:8,border:`0.5px solid ${c.accent}`,background:c.accentSoft,color:c.accent,fontSize:9,fontWeight:700,cursor:'pointer',letterSpacing:'0.1em',textTransform:'uppercase',fontFamily:'inherit',display:'flex',alignItems:'center',gap:4 }}>
                    {pdfLoading?'⏳':'↓'} PDF
                  </button>
                )}
              </div>

              {/* Bottom accent line */}
              <div style={{ height:'0.5px',background:`linear-gradient(90deg,transparent,${c.borderHi},transparent)`,marginTop:8 }} />
            </div>

            {/* Tab context image strip */}
            {planData && (
              <div style={{ position:'relative',height:68,overflow:'hidden' }}>
                {tabs.map(tab => (
                  <div key={tab.id} style={{
                    position:'absolute',inset:0,
                    backgroundImage:`url(${TAB_BG[tab.id]})`,
                    backgroundSize:'cover',backgroundPosition:`center ${tab.id==='budget'?'40%':'50%'}`,
                    opacity: activeTab===tab.id ? 1 : 0,
                    transition:'opacity 0.55s ease',
                  }} />
                ))}
                {/* Overlay */}
                <div style={{ position:'absolute',inset:0,background: D
                  ? 'linear-gradient(to bottom,rgba(8,8,16,0.25),rgba(8,8,16,0.88))'
                  : 'linear-gradient(to bottom,rgba(255,255,255,0.15),rgba(240,244,248,0.92))'
                }} />
                {/* Label row */}
                <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',paddingLeft:18,gap:10 }}>
                  <span className="glow" style={{ fontSize:17,color:activeTabMeta.accent,filter:`drop-shadow(0 0 8px ${activeTabMeta.accent}66)` }}>{activeTabMeta.glyph}</span>
                  <div>
                    <p style={{ margin:0,fontSize:10,fontWeight:700,color:activeTabMeta.accent,letterSpacing:'0.14em',textTransform:'uppercase' }}>{activeTabMeta.label}</p>
                    <p style={{ margin:0,fontSize:9,color:c.textSec,letterSpacing:'0.06em',fontWeight:500 }}>{activeTabMeta.desc}</p>
                  </div>
                  <div style={{ flex:1,height:'0.5px',background:`linear-gradient(90deg,${activeTabMeta.accent}55,transparent)`,marginLeft:4 }} />
                </div>
              </div>
            )}

            {/* Content */}
            <div style={{ padding:'14px',maxHeight:520,overflowY:'auto' }}>

              {/* Live stream */}
              {activeTab==='stream' && streamedText && (
                <div style={{ background: D ? 'rgba(34,211,238,0.05)' : 'rgba(2,132,199,0.04)',borderRadius:12,padding:16,border:`0.5px solid ${c.accent}44` }}>
                  <div style={{ display:'flex',alignItems:'center',gap:7,marginBottom:12 }}>
                    <div className="shimmer" style={{ width:7,height:7,borderRadius:'50%',background:c.accent }} />
                    <span style={{ fontSize:9,fontWeight:700,color:c.accent,letterSpacing:'0.16em',textTransform:'uppercase' }}>Live Generation</span>
                  </div>
                  <p style={{ fontSize:15,lineHeight:1.85,whiteSpace:'pre-wrap',color:c.text,margin:0 }}>
                    {stripMarkdown(streamedText)}
                    <span className="cursor" style={{ background:c.accent }} />
                  </p>
                </div>
              )}

              {/* Plan */}
              {activeTab==='plan' && planData && (() => {
                const days = parseDaySections(planData.plan)
                const numbered = days.filter(d => d.dayNum !== null)
                const other    = days.filter(d => d.dayNum === null)
                const renderDay = (d: DaySection, i: number) => (
                  <div key={i} style={{ marginBottom:14, position:'relative' }}>
                    {/* Day header row */}
                    <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:8 }}>
                      {d.dayNum !== null ? (
                        <div style={{
                          width:38,height:38,borderRadius:10,flexShrink:0,
                          background:`linear-gradient(135deg,${c.violet}22,${c.violet}44)`,
                          border:`1px solid ${c.violet}66`,
                          display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                        }}>
                          <span style={{ fontSize:7,fontWeight:700,color:c.violet,letterSpacing:'0.1em',textTransform:'uppercase',lineHeight:1 }}>DAY</span>
                          <span style={{ fontSize:16,fontWeight:800,color:c.violet,lineHeight:1 }}>{d.dayNum}</span>
                        </div>
                      ) : (
                        <div style={{
                          width:38,height:38,borderRadius:10,flexShrink:0,
                          background:`linear-gradient(135deg,${c.accent}22,${c.accent}44)`,
                          border:`1px solid ${c.accent}66`,
                          display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,
                        }}>💡</div>
                      )}
                      <div style={{ flex:1,minWidth:0 }}>
                        {d.dayNum !== null
                          ? <p style={{ margin:0,fontSize:15,fontWeight:700,color:c.text,letterSpacing:'-0.01em' }}>
                              {d.subtitle || `Day ${d.dayNum}`}
                            </p>
                          : <p style={{ margin:0,fontSize:12,fontWeight:700,color:c.accent,letterSpacing:'0.1em',textTransform:'uppercase' }}>{d.title}</p>
                        }
                      </div>
                      {/* Photo thumbnail if available */}
                      {sectionImages[i] && (
                        <div style={{ width:48,height:38,borderRadius:8,overflow:'hidden',flexShrink:0 }}>
                          <img src={sectionImages[i]} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }} />
                        </div>
                      )}
                    </div>

                    {/* Activity items */}
                    {d.items.length > 0 && (
                      <div style={{
                        marginLeft:48,
                        borderLeft:`1.5px solid ${c.border}`,
                        paddingLeft:14,
                        display:'flex',flexDirection:'column',gap:0,
                      }}>
                        {d.items.map((item, j) => (
                          <div key={j} style={{
                            position:'relative',
                            padding:'9px 10px 9px 14px',
                            borderRadius:10,
                            background: j%2===0 ? (D?'rgba(255,255,255,0.025)':'rgba(0,0,0,0.018)') : 'transparent',
                            marginBottom:2,
                          }}>
                            {/* Timeline dot */}
                            <div style={{
                              position:'absolute',left:-7,top:'50%',transform:'translateY(-50%)',
                              width:11,height:11,borderRadius:'50%',
                              background:c.bg,
                              border:`1.5px solid ${c.border}`,
                              display:'flex',alignItems:'center',justifyContent:'center',
                            }}>
                              <div style={{ width:5,height:5,borderRadius:'50%',background:c.violet }} />
                            </div>

                            <div style={{ display:'flex',alignItems:'baseline',gap:8,flexWrap:'wrap' }}>
                              <span style={{ fontSize:14 }}>{item.icon}</span>
                              <span style={{ fontSize:13,fontWeight:600,color:c.text }}>{item.label}</span>
                              {item.detail && (
                                <span style={{ fontSize:12,color:c.textSec,lineHeight:1.5 }}>— {item.detail}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Raw prose fallback */}
                    {d.raw && (
                      <div style={{ marginLeft:48,paddingLeft:14,borderLeft:`1.5px solid ${c.border}` }}>
                        <p style={{ margin:0,fontSize:13,lineHeight:1.8,color:c.textSec,whiteSpace:'pre-wrap' }}>{d.raw}</p>
                      </div>
                    )}

                    {/* Divider */}
                    {i < days.length-1 && (
                      <div style={{ height:'0.5px',background:c.border,marginTop:12,marginLeft:48 }} />
                    )}
                  </div>
                )
                return (
                  <div>
                    {/* Numbered days */}
                    {numbered.map((d,i) => renderDay(d,i))}
                    {/* Non-day sections (tips, overview etc) */}
                    {other.length > 0 && (
                      <div style={{ marginTop:4 }}>
                        <div style={{ height:'0.5px',background:c.border,marginBottom:14 }} />
                        {other.map((d,i) => renderDay(d, numbered.length+i))}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Research */}
              {activeTab==='research' && planData && (
                <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                  {parsePlan(planData.research).map((s,i) => (
                    <div key={i} className="seccard" style={{ borderColor:c.border }}>
                      <div style={{ padding:'12px 14px',background:c.surfaceHi }}>
                        {s.title && <p style={{ margin:'0 0 6px',fontSize:9,fontWeight:700,color:c.green,letterSpacing:'0.12em',textTransform:'uppercase' }}>{s.title}</p>}
                        <p style={{ margin:0,fontSize:14,lineHeight:1.8,color:c.text,whiteSpace:'pre-wrap' }}>{s.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Budget */}
              {activeTab==='budget' && planData && (
                <div>
                  {planData.budget && typeof planData.budget === 'object' ? (
                    <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
                      {Object.entries(planData.budget).map(([key,val],i) => (
                        <div key={i} style={{ borderRadius:14,background:c.surfaceHi,border:`0.5px solid ${c.border}`,padding:'16px 18px',position:'relative',overflow:'hidden' }}>
                          <div style={{ position:'absolute',top:0,right:0,width:32,height:32,borderTop:`1.5px solid ${c.amber}`,borderRight:`1.5px solid ${c.amber}`,borderRadius:'0 14px 0 0',opacity:0.5 }} />
                          <p style={{ margin:'0 0 8px',fontSize:9,fontWeight:700,color:c.textSec,letterSpacing:'0.12em',textTransform:'uppercase' }}>{key}</p>
                          <p style={{ margin:0,fontSize:26,fontWeight:700,color:c.amber,letterSpacing:'-0.02em',filter:`drop-shadow(0 0 8px ${c.amber}44)` }}>
                            {typeof val === 'number' ? `$${Number(val).toLocaleString()}` : String(val)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : planData.budget && typeof planData.budget === 'string' ? (
                    <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                      {parsePlan(planData.budget).map((s,i) => (
                        <div key={i} className="seccard" style={{ borderColor:c.border }}>
                          <div style={{ padding:'12px 14px',background:c.surfaceHi }}>
                            {s.title && <p style={{ margin:'0 0 6px',fontSize:9,fontWeight:700,color:c.amber,letterSpacing:'0.12em',textTransform:'uppercase' }}>{s.title}</p>}
                            <p style={{ margin:0,fontSize:14,lineHeight:1.8,color:c.text,whiteSpace:'pre-wrap' }}>{s.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ borderRadius:14,background:c.surfaceHi,border:`0.5px solid ${c.border}`,padding:16 }}>
                      <p style={{ margin:0,fontSize:14,lineHeight:1.7,color:c.textSec }}>Budget estimates are included in your itinerary. Check the Itinerary tab for day-by-day cost breakdowns.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <p style={{ textAlign:'center',fontSize:10,marginTop:28,color:c.textTert,letterSpacing:'0.08em',fontWeight:600,textTransform:'uppercase' }}>
          Voyage · Powered by AI
        </p>
      </div>
    </div>
  )
}