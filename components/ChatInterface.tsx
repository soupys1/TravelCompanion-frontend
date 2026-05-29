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
  const clean = stripMarkdown(text)
  const normalised = clean
    .replace(/\.\s+(Day\s+\d+)/gi, '.\n$1')
    .replace(/([^.\n])\s+(Day\s+\d+\b)/gi, '$1\n$2')
  const lines = normalised.split('\n').map(l => l.trim()).filter(Boolean)
  const days: DaySection[] = []
  let cur: DaySection | null = null
  const flush = () => { if (cur) days.push(cur) }
  const isDayHeader   = (l: string) => /^day\s*\d+/i.test(l)
  const isOtherHeader = (l: string) =>
    /^(overview|arrival|departure|getting there|accommodation|transport|flight|tips?|notes?|total|summary)/i.test(l)
  const addLine = (line: string) => {
    if (!cur) return
    const isBullet = line.startsWith('•')
    const content  = isBullet ? line.replace(/^•\s*/, '') : line
    const colonM = content.match(/^([^:]{2,32}):\s*(.+)$/)
    const dashM  = content.match(/^(.+?)\s*[—\-–]\s*(.+)$/)
    if (colonM) {
      cur.items.push({ icon: guessIcon(content), label: colonM[1].trim(), detail: colonM[2].trim() })
    } else if (isBullet && dashM) {
      cur.items.push({ icon: guessIcon(content), label: dashM[1].trim(), detail: dashM[2].trim() })
    } else if (isBullet || line.length < 80) {
      cur.items.push({ icon: guessIcon(content), label: content, detail: '' })
    } else {
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
  { name: 'Tokyo',     country: 'Japan',     tag: 'City',    duration: '7 days', fb: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&q=80' },
  { name: 'Bali',      country: 'Indonesia', tag: 'Beach',   duration: '5 days', fb: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&q=80' },
  { name: 'Paris',     country: 'France',    tag: 'Culture', duration: '4 days', fb: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&q=80' },
  { name: 'Santorini', country: 'Greece',    tag: 'Beach',   duration: '5 days', fb: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=400&q=80' },
  { name: 'New York',  country: 'USA',       tag: 'City',    duration: '5 days', fb: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400&q=80' },
  { name: 'Kyoto',     country: 'Japan',     tag: 'Culture', duration: '4 days', fb: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&q=80' },
  { name: 'Maldives',  country: 'South Asia',tag: 'Beach',   duration: '6 days', fb: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=400&q=80' },
  { name: 'Machu Picchu', country: 'Peru',  tag: 'Adventure',duration:'7 days', fb: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?w=400&q=80' },
]

// ── PDF generation — pure browser print, no library needed ──────────────────
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
    .cover { background: linear-gradient(135deg, #0f0c29, #302b63, #24243e); color: white; padding: 60px 48px 48px; min-height: 220px; position: relative; }
    .cover-tag { font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.5); margin-bottom: 12px; }
    .cover-title { font-family: 'Playfair Display', serif; font-size: 52px; font-weight: 800; line-height: 1; margin-bottom: 8px; }
    .cover-sub { font-size: 14px; color: rgba(255,255,255,0.55); margin-bottom: 24px; }
    .cover-meta { display: flex; gap: 20px; }
    .cover-badge { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 999px; padding: 5px 14px; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.8); }
    .accent-bar { height: 4px; background: linear-gradient(90deg, #22d3ee, #a78bfa, #4ade80); }
    .content { padding: 40px 48px; }
    .section { margin-bottom: 36px; }
    .section-title { font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #22d3ee; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #e8eaf6; }
    .day-block { margin-bottom: 20px; padding: 16px 20px; background: #f8f9ff; border-radius: 12px; border-left: 3px solid #a78bfa; }
    .day-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #7c3aed; margin-bottom: 4px; }
    .day-title { font-size: 16px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px; }
    .day-body { font-size: 13px; line-height: 1.75; color: #4a4a6a; white-space: pre-wrap; }
    .budget-block { margin-bottom: 12px; padding: 14px 18px; background: #fffbf0; border-radius: 10px; border-left: 3px solid #f59e0b; }
    .budget-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #d97706; margin-bottom: 4px; }
    .budget-body { font-size: 13px; line-height: 1.75; color: #4a4a6a; white-space: pre-wrap; }
    .research-block { margin-bottom: 12px; padding: 14px 18px; background: #f0fdf4; border-radius: 10px; border-left: 3px solid #22c55e; }
    .research-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #16a34a; margin-bottom: 4px; }
    .research-body { font-size: 13px; line-height: 1.75; color: #4a4a6a; white-space: pre-wrap; }
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
      <div class="section-title">⬡ Day-by-Day Itinerary</div>
      ${sections.map(s => `
        <div class="day-block">
          ${s.title ? `<div class="day-label">${s.title}</div>` : ''}
          <div class="day-body">${s.body.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
        </div>`).join('')}
    </div>

    ${budgetSections.length > 0 ? `
    <div class="section">
      <div class="section-title">◇ Budget Breakdown</div>
      ${budgetSections.map(s => `
        <div class="budget-block">
          ${s.title ? `<div class="budget-label">${s.title}</div>` : ''}
          <div class="budget-body">${s.body.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
        </div>`).join('')}
    </div>` : ''}

    ${researchSections.length > 0 ? `
    <div class="section">
      <div class="section-title">◎ Research & Tips</div>
      ${researchSections.map(s => `
        <div class="research-block">
          ${s.title ? `<div class="research-label">${s.title}</div>` : ''}
          <div class="research-body">${s.body.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
        </div>`).join('')}
    </div>` : ''}

  </div>
  <div class="footer">Voyage · AI Travel Planner · Generated ${new Date().toLocaleDateString()}</div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  const win  = window.open(url, '_blank')
  if (!win) {
    // fallback: direct download
    const a = document.createElement('a')
    a.href = url
    a.download = `${destination}-itinerary.html`
    a.click()
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
  const inputRef   = useRef<HTMLInputElement>(null)
  const vapiRef    = useRef<InstanceType<typeof Vapi> | null>(null)

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
      setActiveTab('plan')
    } catch (e) { console.error(e) }
    finally { setIsLoading(false) }
  }

  function handleDestClick(name: string, country: string, duration: string) {
    const q = `${duration} in ${name}, ${country}, medium budget`
    setTrip(q); if (inputRef.current) inputRef.current.value = q
  }

  const D = dark
  if (!mounted) return <div style={{ minHeight:'100vh', background: D ? '#080810' : '#f4f5f9' }} />

  const c = {
    bg:        D ? '#080810'               : '#f4f5f9',
    surface:   D ? 'rgba(14,14,26,0.95)'   : 'rgba(255,255,255,0.92)',
    surfaceHi: D ? 'rgba(20,20,36,0.98)'   : 'rgba(255,255,255,0.99)',
    border:    D ? 'rgba(255,255,255,0.07)': 'rgba(0,0,0,0.07)',
    borderHi:  D ? 'rgba(255,255,255,0.12)': 'rgba(0,0,0,0.12)',
    text:      D ? '#eeeeff'               : '#0d0d1a',
    textSec:   D ? 'rgba(238,238,255,0.48)': 'rgba(13,13,26,0.46)',
    textTert:  D ? 'rgba(238,238,255,0.22)': 'rgba(13,13,26,0.2)',
    accent:    D ? '#22d3ee'               : '#0284c7',
    accentGlow:D ? 'rgba(34,211,238,0.16)' : 'rgba(2,132,199,0.1)',
    accentSoft:D ? 'rgba(34,211,238,0.07)' : 'rgba(2,132,199,0.05)',
    violet:    D ? '#a78bfa'               : '#7c3aed',
    green:     D ? '#4ade80'               : '#16a34a',
    amber:     D ? '#fbbf24'               : '#d97706',
    red:               '#f43f5e',
  }

  const tabs: { id: Tab; label: string; icon: string; accent: string; desc: string }[] = [
    { id:'stream',   label:'Live',      icon:'◈', accent:'#22d3ee', desc:'Streaming output' },
    { id:'plan',     label:'Itinerary', icon:'⬡', accent:'#a78bfa', desc:'Day-by-day plan'  },
    { id:'research', label:'Research',  icon:'◎', accent:'#4ade80', desc:'Insider tips'     },
    { id:'budget',   label:'Budget',    icon:'◇', accent:'#fbbf24', desc:'Cost breakdown'   },
  ]

  return (
    <div style={{
      fontFamily:"-apple-system,'SF Pro Display',BlinkMacSystemFont,'Helvetica Neue',sans-serif",
      minHeight:'100vh', background:c.bg, transition:'background 0.5s', position:'relative', overflow:'hidden',
    }}>
      <style>{`
        *{box-sizing:border-box}

        @keyframes floatbg{0%,100%{transform:scale(1.05) translateY(0)}50%{transform:scale(1.09) translateY(-12px)}}
        @keyframes up0{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes blinkcur{0%,49%{opacity:1}50%,100%{opacity:0}}
        @keyframes pulserec{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.8)}}
        @keyframes shimmer{0%,100%{opacity:0.25}50%{opacity:1}}
        @keyframes glowpulse{0%,100%{opacity:0.5}50%{opacity:1}}
        @keyframes slideIn{from{opacity:0;transform:translateX(8px)}to{opacity:1;transform:translateX(0)}}

        .aup {animation:up0 0.5s cubic-bezier(0.25,0.46,0.45,0.94) both}
        .aup1{animation:up0 0.5s cubic-bezier(0.25,0.46,0.45,0.94) 0.07s both}
        .aup2{animation:up0 0.5s cubic-bezier(0.25,0.46,0.45,0.94) 0.14s both}
        .aup3{animation:up0 0.5s cubic-bezier(0.25,0.46,0.45,0.94) 0.21s both}
        .shimmer{animation:shimmer 1.2s ease-in-out infinite}
        .recdot{animation:pulserec 1.3s ease-in-out infinite}
        .cursor{display:inline-block;width:2px;height:14px;vertical-align:middle;margin-left:2px;border-radius:1px;animation:blinkcur 1s step-end infinite}
        .glow{animation:glowpulse 2.2s ease-in-out infinite}
        .tabcontent{animation:slideIn 0.25s ease both}

        /* Destination horizontal scroll */
        .dest-scroll{
          display:flex;gap:12px;overflow-x:auto;padding-bottom:10px;
          scrollbar-width:none;-ms-overflow-style:none;
        }
        .dest-scroll::-webkit-scrollbar{display:none}

        .dest-pill{
          flex-shrink:0;position:relative;width:150px;height:190px;
          border-radius:18px;overflow:hidden;cursor:pointer;border:none;padding:0;
          transition:transform 0.22s cubic-bezier(0.25,0.46,0.45,0.94),box-shadow 0.22s;
        }
        .dest-pill:hover{transform:translateY(-4px) scale(1.03)}
        .dest-pill:active{transform:scale(0.97)}
        .dest-pill img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.45s}
        .dest-pill:hover img{transform:scale(1.08)}

        /* Tab bar */
        .tab-btn{
          flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
          gap:3px;padding:10px 6px 8px;border:none;cursor:pointer;font-family:inherit;
          background:transparent;border-bottom:2px solid transparent;
          transition:all 0.22s cubic-bezier(0.25,0.46,0.45,0.94);
          position:relative;
        }
        .tab-btn.act{border-bottom-color:var(--tacc)}
        .tab-btn:active{opacity:0.7}

        .ios-inp{appearance:none;transition:border-color 0.2s,box-shadow 0.2s}
        .ios-inp:focus{outline:none}
        .ios-btn:active:not([disabled]){opacity:0.7;transform:scale(0.96)}
        button[disabled]{opacity:0.35!important;cursor:not-allowed!important}

        .seccard{border-radius:14px;overflow:hidden;margin-bottom:10px;border:0.5px solid}

        .cdot{height:4px;border-radius:2px;cursor:pointer;transition:all 0.3s;background:rgba(255,255,255,0.3)}
        .cdot.act{background:white}

        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(150,150,200,0.15);border-radius:2px}
      `}</style>

      {/* ── Background ── */}
      <div style={{ position:'fixed',inset:0,zIndex:0,overflow:'hidden' }}>
        {HERO_POOL.map((src, i) => (
          <div key={i} style={{
            position:'absolute',inset:'-10%',
            backgroundImage:`url(${src})`,
            backgroundSize:'cover',backgroundPosition:'center',
            opacity: i === heroBgIdx ? (D ? 0.13 : 0.16) : 0,
            transition:'opacity 2.2s ease',
            animation:'floatbg 22s ease-in-out infinite',
            animationDelay:`${i*0.7}s`,
            filter: D ? 'saturate(0.5) brightness(0.8)' : 'saturate(1.1) brightness(1.05)',
            willChange:'transform,opacity',
          }} />
        ))}
        {/* Overlay — NO grid */}
        <div style={{
          position:'absolute',inset:0,
          background: D
            ? 'linear-gradient(160deg,rgba(8,8,16,0.78) 0%,rgba(8,8,16,0.55) 50%,rgba(8,8,16,0.85) 100%)'
            : 'linear-gradient(160deg,rgba(244,245,249,0.8) 0%,rgba(244,245,249,0.6) 50%,rgba(244,245,249,0.88) 100%)',
        }} />
        {/* Soft ambient orbs only */}
        <div style={{ position:'absolute',top:'5%',right:'8%',width:450,height:450,borderRadius:'50%',
          background:`radial-gradient(circle,${c.accentGlow},transparent 65%)`,pointerEvents:'none' }} />
        <div style={{ position:'absolute',bottom:'10%',left:'4%',width:350,height:350,borderRadius:'50%',
          background: D ? 'radial-gradient(circle,rgba(167,139,250,0.05),transparent 65%)' : 'radial-gradient(circle,rgba(124,58,237,0.03),transparent 65%)',
          pointerEvents:'none' }} />
      </div>

      {/* ── Shell ── */}
      <div style={{ position:'relative',zIndex:10,maxWidth:760,margin:'0 auto',padding:'0 0 80px' }}>

        {/* ── Nav ── */}
        <div style={{
          position:'sticky',top:0,zIndex:100,
          backdropFilter:'blur(20px) saturate(180%)',
          WebkitBackdropFilter:'blur(20px) saturate(180%)',
          background: D ? 'rgba(8,8,16,0.82)' : 'rgba(244,245,249,0.86)',
          borderBottom:`0.5px solid ${c.border}`,
          padding:'12px 22px 10px',
        }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
              <svg width="30" height="30" viewBox="0 0 32 32" style={{ flexShrink:0 }}>
                <polygon points="16,2 30,9 30,23 16,30 2,23 2,9" fill="none" stroke={c.accent} strokeWidth="1.5" opacity="0.9" />
                <text x="16" y="21" textAnchor="middle" fontSize="13" fill={c.accent}>✈</text>
              </svg>
              <div>
                <p style={{ margin:0,fontSize:15,fontWeight:700,color:c.text,letterSpacing:'-0.02em' }}>Voyage</p>
                <p style={{ margin:0,fontSize:9,color:c.textSec,letterSpacing:'0.14em',fontWeight:600,textTransform:'uppercase' }}>AI Travel Planner</p>
              </div>
            </div>
            <button
              onClick={() => setDark(!D)}
              style={{ display:'flex',alignItems:'center',gap:6,padding:'7px 13px',borderRadius:999,
                border:`0.5px solid ${c.borderHi}`,
                background: D ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                cursor:'pointer',color:c.textSec,fontSize:11,fontWeight:600,
                letterSpacing:'0.07em',textTransform:'uppercase',fontFamily:'inherit',transition:'all 0.2s' }}
            >
              <span style={{ fontSize:13 }}>{D ? '☀️' : '🌙'}</span>
              {D ? 'Day' : 'Night'}
            </button>
          </div>
        </div>

        {/* ── Hero ── */}
        <div className="aup" style={{ padding:'38px 22px 0' }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:10 }}>
            <div style={{ width:20,height:1.5,background:c.accent,opacity:0.9,borderRadius:1 }} />
            <p style={{ margin:0,fontSize:10,fontWeight:700,color:c.accent,letterSpacing:'0.18em',textTransform:'uppercase' }}>
              {new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}
            </p>
          </div>
          <h1 style={{ margin:'0 0 12px',fontSize:44,fontWeight:800,color:c.text,letterSpacing:'-0.035em',lineHeight:1.05 }}>
            Where are you<br/>
            <span style={{ color:c.accent }}>headed next?</span>
          </h1>
          <p style={{ margin:0,fontSize:14,color:c.textSec,lineHeight:1.65,maxWidth:420 }}>
            Describe your dream trip — get a full itinerary, local tips & budget in seconds.
          </p>
        </div>

        {/* ── Input card ── */}
        <div className="aup1" style={{
          margin:'20px 22px 0',borderRadius:18,
          background:c.surfaceHi,
          border:`0.5px solid ${c.borderHi}`,
          boxShadow: D
            ? `0 8px 40px rgba(0,0,0,0.5),0 0 0 0.5px ${c.accentSoft}`
            : '0 4px 24px rgba(0,0,0,0.07)',
          overflow:'hidden',
        }}>
          <div style={{ display:'flex',alignItems:'center',gap:0,padding:'5px' }}>
            <button
              onClick={toggleVoice}
              style={{ width:52,height:52,borderRadius:12,border:'none',
                background: isListening ? 'rgba(244,63,94,0.1)' : 'transparent',
                cursor:'pointer',fontSize:19,display:'flex',alignItems:'center',justifyContent:'center',
                flexShrink:0,color: isListening ? c.red : c.textSec,transition:'all 0.2s',fontFamily:'inherit' }}
            >
              {isListening
                ? <span className="recdot" style={{ display:'block',width:11,height:11,borderRadius:'50%',background:c.red }} />
                : '🎙'}
            </button>
            <input
              ref={inputRef}
              type="text"
              onChange={e => setTrip(e.target.value)}
              placeholder="7 days in Bali, beach & temples, medium budget…"
              className="ios-inp"
              style={{ flex:1,height:52,border:`1px solid ${c.border}`,borderRadius:12,
                background: D ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
                color:c.text,fontSize:14,padding:'0 13px',fontFamily:'inherit' }}
              onFocus={e => { e.target.style.borderColor=c.accent; e.target.style.boxShadow=`0 0 0 3px ${c.accentGlow}` }}
              onBlur={e  => { e.target.style.borderColor=c.border;  e.target.style.boxShadow='none' }}
            />
            <button
              onClick={() => { handleClick(); handlePlan() }}
              disabled={isLoading || !trip}
              style={{ margin:'0 4px',height:44,paddingInline:20,borderRadius:11,
                border:`0.5px solid ${c.accent}`,
                background: D ? 'rgba(34,211,238,0.12)' : 'rgba(2,132,199,0.08)',
                color:c.accent,fontSize:12,fontWeight:700,cursor:'pointer',
                letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:'inherit',flexShrink:0,
                transition:'all 0.2s',
                boxShadow:(!isLoading&&trip)?`0 0 16px ${c.accentGlow}`:'none' }}
            >
              {isLoading ? '···' : 'Plan →'}
            </button>
          </div>
          {(vapiError || isListening) && (
            <div style={{ padding:'4px 16px 10px',borderTop:`0.5px solid ${c.border}` }}>
              {vapiError   && <p style={{ margin:0,fontSize:12,color:c.red,fontWeight:500 }}>{vapiError}</p>}
              {isListening && <p style={{ margin:0,fontSize:12,color:c.accent,fontWeight:500 }}>◉ Listening…</p>}
            </div>
          )}
        </div>

        {/* ── Loading ── */}
        {isLoading && (
          <div style={{ display:'flex',alignItems:'center',gap:6,padding:'14px 26px' }}>
            {[0,0.15,0.3].map((d,i) => (
              <div key={i} className="shimmer" style={{ width:6,height:6,borderRadius:'50%',background:c.accent,animationDelay:d+'s' }} />
            ))}
            <span style={{ fontSize:11,color:c.textSec,fontWeight:600,marginLeft:5,letterSpacing:'0.1em',textTransform:'uppercase' }}>
              Crafting your journey
            </span>
          </div>
        )}

        {/* ── Popular destinations — horizontal scroll ── */}
        {!planData && !streamedText && (
          <div className="aup2" style={{ margin:'28px 0 0' }}>
            <div style={{ display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:14,padding:'0 22px' }}>
              <p style={{ margin:0,fontSize:19,fontWeight:700,color:c.text,letterSpacing:'-0.02em' }}>Popular</p>
              <p style={{ margin:0,fontSize:12,color:c.textSec,fontWeight:500 }}>{POPULAR.length} destinations</p>
            </div>

            <div className="dest-scroll" style={{ padding:'4px 22px 12px' }}>
              {POPULAR.map((d) => (
                <button
                  key={d.name}
                  onClick={() => handleDestClick(d.name, d.country, d.duration)}
                  className="dest-pill"
                  style={{ boxShadow: D ? '0 6px 28px rgba(0,0,0,0.6)' : '0 4px 18px rgba(0,0,0,0.12)' }}
                >
                  <img src={popImages[d.name] || d.fb} alt={d.name} />
                  {/* Gradient */}
                  <div style={{ position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,0.78) 0%,rgba(0,0,0,0.02) 55%,transparent 100%)' }} />
                  {/* Tag chip */}
                  <div style={{
                    position:'absolute',top:10,left:10,
                    padding:'2px 8px',borderRadius:999,fontSize:8,fontWeight:700,
                    letterSpacing:'0.08em',textTransform:'uppercase',
                    background:'rgba(0,0,0,0.42)',backdropFilter:'blur(8px)',
                    border:'0.5px solid rgba(255,255,255,0.18)',color:'white',
                  }}>{d.tag}</div>
                  {/* Info */}
                  <div style={{ position:'absolute',bottom:0,left:0,right:0,padding:'0 12px 13px' }}>
                    <p style={{ margin:0,color:'white',fontSize:14,fontWeight:700,lineHeight:1.2 }}>{d.name}</p>
                    <p style={{ margin:'2px 0 6px',color:'rgba(255,255,255,0.5)',fontSize:10 }}>{d.country}</p>
                    <div style={{
                      display:'inline-flex',alignItems:'center',gap:4,
                      padding:'3px 8px',borderRadius:999,fontSize:9,fontWeight:600,
                      background:'rgba(255,255,255,0.12)',border:'0.5px solid rgba(255,255,255,0.22)',
                      color:'rgba(255,255,255,0.85)',
                    }}>
                      📅 {d.duration}
                    </div>
                  </div>
                  {/* Corner accent */}
                  <div style={{ position:'absolute',top:0,right:0,width:18,height:18,
                    borderTop:`1.5px solid ${c.accent}`,borderRight:`1.5px solid ${c.accent}`,
                    borderRadius:'0 18px 0 0',opacity:0.6 }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {(streamedText || planData) && (
          <div className="aup2" style={{
            margin:'20px 22px 0',borderRadius:20,
            background:c.surface,
            border:`0.5px solid ${c.borderHi}`,
            boxShadow: D ? '0 12px 56px rgba(0,0,0,0.7)' : '0 8px 40px rgba(0,0,0,0.09)',
            overflow:'hidden',
          }}>

            {/* Hero carousel */}
            {heroImages.length > 0 && (
              <div style={{ position:'relative',height:220 }}>
                <img src={heroImages[heroIdx]} alt="destination"
                  style={{ width:'100%',height:220,objectFit:'cover',display:'block',transition:'opacity 0.35s' }} />
                <div style={{ position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,0.82) 0%,rgba(0,0,0,0.04) 52%,transparent 100%)' }} />
                {/* Corner brackets */}
                {(['tl','tr','bl','br'] as const).map(p => (
                  <div key={p} style={{ position:'absolute',
                    top: p[0]==='t' ? 12 : 'auto', bottom: p[0]==='b' ? 12 : 'auto',
                    left: p[1]==='l' ? 12 : 'auto', right: p[1]==='r' ? 12 : 'auto',
                    width:14,height:14,
                    borderTop:    p[0]==='t' ? `1.5px solid ${c.accent}` : 'none',
                    borderBottom: p[0]==='b' ? `1.5px solid ${c.accent}` : 'none',
                    borderLeft:   p[1]==='l' ? `1.5px solid ${c.accent}` : 'none',
                    borderRight:  p[1]==='r' ? `1.5px solid ${c.accent}` : 'none',
                    opacity:0.75,
                  }} />
                ))}
                <div style={{ position:'absolute',bottom:14,left:16 }}>
                  <p style={{ margin:0,color:'white',fontSize:24,fontWeight:800,letterSpacing:'-0.025em',textShadow:'0 2px 10px rgba(0,0,0,0.6)' }}>
                    {extractKeyword(trip)}
                  </p>
                  <p style={{ margin:'2px 0 0',color:'rgba(255,255,255,0.45)',fontSize:9,letterSpacing:'0.14em',textTransform:'uppercase',fontWeight:700 }}>
                    AI-crafted itinerary
                  </p>
                </div>
                {heroImages.length > 1 && (
                  <>
                    <button onClick={() => setHeroIdx(i => (i-1+heroImages.length)%heroImages.length)}
                      style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',width:28,height:28,borderRadius:999,background:'rgba(0,0,0,0.45)',backdropFilter:'blur(6px)',border:'0.5px solid rgba(255,255,255,0.2)',color:'white',fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit' }}>‹</button>
                    <button onClick={() => setHeroIdx(i => (i+1)%heroImages.length)}
                      style={{ position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',width:28,height:28,borderRadius:999,background:'rgba(0,0,0,0.45)',backdropFilter:'blur(6px)',border:'0.5px solid rgba(255,255,255,0.2)',color:'white',fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit' }}>›</button>
                  </>
                )}
                <div style={{ position:'absolute',bottom:14,right:14,display:'flex',gap:4 }}>
                  {heroImages.map((_,i) => (
                    <div key={i} onClick={() => setHeroIdx(i)} className={`cdot${i===heroIdx?' act':''}`} style={{ width: i===heroIdx ? 18 : 5 }} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Tab bar ── */}
            <div style={{
              background: D ? 'rgba(8,8,16,0.55)' : 'rgba(244,245,249,0.6)',
              borderBottom:`0.5px solid ${c.border}`,
            }}>
              <div style={{ display:'flex',alignItems:'stretch' }}>
                {tabs.map(tab => {
                  const isAct = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`tab-btn${isAct?' act':''}`}
                      style={{
                        '--tacc': tab.accent,
                        color: isAct ? tab.accent : c.textSec,
                        background: isAct
                          ? D ? `rgba(255,255,255,0.03)` : `rgba(0,0,0,0.02)`
                          : 'transparent',
                      } as React.CSSProperties}
                    >
                      <span style={{ fontSize:13,filter: isAct ? `drop-shadow(0 0 5px ${tab.accent}88)` : 'none',transition:'filter 0.25s' }}>{tab.icon}</span>
                      <span style={{ fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase' }}>{tab.label}</span>
                    </button>
                  )
                })}

                {/* PDF button */}
                {planData && (
                  <button
                    onClick={() => generatePDF(extractKeyword(trip), planData)}
                    style={{ flexShrink:0,alignSelf:'center',margin:'0 10px',
                      padding:'6px 13px',borderRadius:8,
                      border:`0.5px solid ${c.accent}`,background:c.accentSoft,
                      color:c.accent,fontSize:9,fontWeight:700,cursor:'pointer',
                      letterSpacing:'0.1em',textTransform:'uppercase',fontFamily:'inherit',
                      display:'flex',alignItems:'center',gap:5,transition:'all 0.2s',
                    }}
                  >
                    <span style={{ fontSize:12 }}>↓</span> PDF
                  </button>
                )}
              </div>
            </div>

            {/* ── Tab content ── */}
            <div className="tabcontent" key={activeTab} style={{ padding:'16px',maxHeight:540,overflowY:'auto' }}>

              {/* Live stream */}
              {activeTab==='stream' && streamedText && (
                <div style={{ background: D ? 'rgba(34,211,238,0.04)' : 'rgba(2,132,199,0.03)',borderRadius:12,padding:16,border:`0.5px solid ${c.accent}33` }}>
                  <div style={{ display:'flex',alignItems:'center',gap:7,marginBottom:10 }}>
                    <div className="shimmer" style={{ width:6,height:6,borderRadius:'50%',background:c.accent }} />
                    <span style={{ fontSize:9,fontWeight:700,color:c.accent,letterSpacing:'0.18em',textTransform:'uppercase' }}>Live Generation</span>
                  </div>
                  <p style={{ fontSize:14,lineHeight:1.85,whiteSpace:'pre-wrap',color:c.text,margin:0 }}>
                    {stripMarkdown(streamedText)}
                    <span className="cursor" style={{ background:c.accent }} />
                  </p>
                </div>
              )}

              {/* Plan */}
              {activeTab==='plan' && planData && (() => {
                const days     = parseDaySections(planData.plan)
                const numbered = days.filter(d => d.dayNum !== null)
                const other    = days.filter(d => d.dayNum === null)
                const renderDay = (d: DaySection, i: number) => (
                  <div key={i} style={{ marginBottom:14 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:8 }}>
                      {d.dayNum !== null ? (
                        <div style={{
                          width:40,height:40,borderRadius:11,flexShrink:0,
                          background:`linear-gradient(135deg,${c.violet}20,${c.violet}40)`,
                          border:`1px solid ${c.violet}55`,
                          display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                        }}>
                          <span style={{ fontSize:7,fontWeight:700,color:c.violet,letterSpacing:'0.1em',textTransform:'uppercase',lineHeight:1 }}>DAY</span>
                          <span style={{ fontSize:16,fontWeight:800,color:c.violet,lineHeight:1 }}>{d.dayNum}</span>
                        </div>
                      ) : (
                        <div style={{ width:40,height:40,borderRadius:11,flexShrink:0,background:`linear-gradient(135deg,${c.accent}20,${c.accent}40)`,border:`1px solid ${c.accent}55`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16 }}>💡</div>
                      )}
                      <div style={{ flex:1,minWidth:0 }}>
                        {d.dayNum !== null
                          ? <p style={{ margin:0,fontSize:14,fontWeight:700,color:c.text,letterSpacing:'-0.01em' }}>{d.subtitle || `Day ${d.dayNum}`}</p>
                          : <p style={{ margin:0,fontSize:11,fontWeight:700,color:c.accent,letterSpacing:'0.1em',textTransform:'uppercase' }}>{d.title}</p>}
                      </div>
                      {sectionImages[i] && (
                        <div style={{ width:46,height:36,borderRadius:8,overflow:'hidden',flexShrink:0 }}>
                          <img src={sectionImages[i]} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }} />
                        </div>
                      )}
                    </div>
                    {d.items.length > 0 && (
                      <div style={{ marginLeft:50,borderLeft:`1.5px solid ${c.border}`,paddingLeft:13,display:'flex',flexDirection:'column',gap:1 }}>
                        {d.items.map((item, j) => (
                          <div key={j} style={{ position:'relative',padding:'8px 10px 8px 12px',borderRadius:9,background: j%2===0?(D?'rgba(255,255,255,0.02)':'rgba(0,0,0,0.015)'):'transparent',marginBottom:1 }}>
                            <div style={{ position:'absolute',left:-6,top:'50%',transform:'translateY(-50%)',width:10,height:10,borderRadius:'50%',background:c.bg,border:`1.5px solid ${c.border}`,display:'flex',alignItems:'center',justifyContent:'center' }}>
                              <div style={{ width:4,height:4,borderRadius:'50%',background:c.violet }} />
                            </div>
                            <div style={{ display:'flex',alignItems:'baseline',gap:7,flexWrap:'wrap' }}>
                              <span style={{ fontSize:13 }}>{item.icon}</span>
                              <span style={{ fontSize:13,fontWeight:600,color:c.text }}>{item.label}</span>
                              {item.detail && <span style={{ fontSize:12,color:c.textSec }}>— {item.detail}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {d.raw && (
                      <div style={{ marginLeft:50,paddingLeft:13,borderLeft:`1.5px solid ${c.border}` }}>
                        <p style={{ margin:0,fontSize:13,lineHeight:1.8,color:c.textSec,whiteSpace:'pre-wrap' }}>{d.raw}</p>
                      </div>
                    )}
                    {i < days.length-1 && <div style={{ height:'0.5px',background:c.border,marginTop:12,marginLeft:50 }} />}
                  </div>
                )
                return (
                  <div>
                    {numbered.map((d,i) => renderDay(d,i))}
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
                <div style={{ display:'flex',flexDirection:'column',gap:9 }}>
                  {parsePlan(planData.research).map((s,i) => (
                    <div key={i} className="seccard" style={{ borderColor:c.border }}>
                      <div style={{ padding:'12px 14px',background:c.surfaceHi }}>
                        {s.title && <p style={{ margin:'0 0 5px',fontSize:9,fontWeight:700,color:c.green,letterSpacing:'0.12em',textTransform:'uppercase' }}>{s.title}</p>}
                        <p style={{ margin:0,fontSize:13,lineHeight:1.8,color:c.text,whiteSpace:'pre-wrap' }}>{s.body}</p>
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
                          <p style={{ margin:'0 0 6px',fontSize:9,fontWeight:700,color:c.textSec,letterSpacing:'0.12em',textTransform:'uppercase' }}>{key}</p>
                          <p style={{ margin:0,fontSize:24,fontWeight:700,color:c.amber,letterSpacing:'-0.02em' }}>
                            {typeof val === 'number' ? `$${Number(val).toLocaleString()}` : String(val)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : planData.budget && typeof planData.budget === 'string' ? (
                    <div style={{ display:'flex',flexDirection:'column',gap:9 }}>
                      {parsePlan(planData.budget).map((s,i) => (
                        <div key={i} className="seccard" style={{ borderColor:c.border }}>
                          <div style={{ padding:'12px 14px',background:c.surfaceHi }}>
                            {s.title && <p style={{ margin:'0 0 5px',fontSize:9,fontWeight:700,color:c.amber,letterSpacing:'0.12em',textTransform:'uppercase' }}>{s.title}</p>}
                            <p style={{ margin:0,fontSize:13,lineHeight:1.8,color:c.text,whiteSpace:'pre-wrap' }}>{s.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ borderRadius:14,background:c.surfaceHi,border:`0.5px solid ${c.border}`,padding:16 }}>
                      <p style={{ margin:0,fontSize:13,lineHeight:1.7,color:c.textSec }}>Budget estimates are included in your itinerary.</p>
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