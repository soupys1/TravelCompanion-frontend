'use client';
import { SignInButton } from '@clerk/nextjs';

const c = {
  bg: '#FFFFFF',
  text: '#0F172A',
  textSec: '#475569',
  accent: '#2563EB',
  border: '#F1F5F9',
};

const FEATURES = [
  { title: 'Smart Planning', body: 'AI-curated routes based on your vibe.' },
  { title: 'Notes Layout', body: 'Read your itinerary like a clean travel journal.' },
  { title: 'Live Search', body: 'Real-time research on hotels and dining.' },
];

export default function LandingPage() {
  return (
    <div style={{ background: c.bg, color: c.text, minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* --- HERO SECTION --- */}
      <nav style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 900, fontSize: '20px', color: c.accent }}>NOMAD.ai</div>
        <SignInButton mode="modal">
          <button style={{ padding: '8px 20px', borderRadius: '8px', border: `1px solid ${c.border}`, background: 'white', cursor: 'pointer' }}>Sign In</button>
        </SignInButton>
      </nav>

      <section style={{ textAlign: 'center', padding: '100px 20px' }}>
        <h1 style={{ fontSize: '72px', fontWeight: 900, letterSpacing: '-0.05em', marginBottom: '24px' }}>
          Your travels, <br/><span style={{ color: c.accent }}>organized beautifully.</span>
        </h1>
        <p style={{ fontSize: '20px', color: c.textSec, maxWidth: '600px', margin: '0 auto 40px', lineHeight: 1.6 }}>
          Stop scrolling through messy threads. Get your travel plans in a clean, note-like grid that’s easy to read and act on.
        </p>
        <SignInButton mode="modal">
          <button style={{
            background: c.accent,
            color: 'white',
            padding: '18px 40px',
            borderRadius: '12px',
            fontSize: '18px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)'
          }}>
            Get Started Free
          </button>
        </SignInButton>
      </section>

      {/* --- GRID SECTION --- */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '60px 20px' }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '30px' 
        }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              padding: '32px',
              borderRadius: '24px',
              background: '#F8FAFC',
              border: `1px solid ${c.border}`,
              transition: 'transform 0.2s'
            }}>
              <div style={{ width: '40px', height: '40px', background: c.accent, borderRadius: '10px', marginBottom: '20px' }} />
              <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>{f.title}</h3>
              <p style={{ color: c.textSec, lineHeight: 1.6 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer style={{ textAlign: 'center', padding: '60px 20px', color: c.textSec, borderTop: `1px solid ${c.border}` }}>
        © 2026 Nomad AI. Designed for explorers.
      </footer>
    </div>
  );
}