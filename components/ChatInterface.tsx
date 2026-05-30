'use client';
import { useState, useEffect, useRef } from 'react';
import Vapi from '@vapi-ai/web';

type PlanData = { plan: string; research: string; budget: string | Record<string, unknown> } | null;
type Tab = 'plan' | 'research' | 'budget';

// --- CLEAN & VIBRANT THEME TOKENS ---
const c = {
  bg: '#F8FAFC',        // Soft off-white
  surface: '#FFFFFF',   // Pure white paper
  border: '#E2E8F0',    // Light slate border
  text: '#1E293B',      // High contrast slate (Better than pure black)
  textSec: '#64748B',   // Soft gray
  accent: '#3B82F6',    // Vibrant blue
  gridGap: '24px',
};

function stripMarkdown(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '').replace(/`(.*?)`/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/^[-*]\s/gm, '• ').trim();
}

function parsePlan(text: string): { title: string; body: string }[] {
  if (!text || typeof text !== 'string') return [];
  const clean = stripMarkdown(text);
  const lines = clean.split('\n').filter(l => l.trim());
  const sections: { title: string; body: string }[] = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const line of lines) {
    const isHeader = /^(day\s*\d+|overview|budget|tip|arrival|departure|getting there|accommodation|food|transport|total)/i.test(line.trim());
    if (isHeader) {
      if (current) sections.push({ title: current.title, body: current.lines.join('\n') });
      current = { title: line.trim(), lines: [] };
    } else if (current) {
      current.lines.push(line.trim());
    }
  }
  if (current) sections.push({ title: current.title, body: current.lines.join('\n') });
  return sections;
}

export default function ChatInterface() {
  const [planData, setPlanData] = useState<PlanData>(null);
  const [activeTab, setActiveTab] = useState<Tab>('plan');
  const [isTyping, setIsTyping] = useState(false);

  const parsedSections = planData ? parsePlan(planData.plan) : [];

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: c.bg, 
      color: c.text, 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      paddingBottom: '120px' 
    }}>
      {/* --- HEADER --- */}
      <header style={{ 
        padding: '20px', 
        background: c.surface, 
        borderBottom: `1px solid ${c.border}`,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        justifyContent: 'center',
        gap: '12px'
      }}>
        {['plan', 'research', 'budget'].map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t as Tab)}
            style={{
              padding: '8px 24px',
              borderRadius: '20px',
              border: 'none',
              background: activeTab === t ? c.accent : 'transparent',
              color: activeTab === t ? 'white' : c.textSec,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </header>

      {/* --- CONTENT GRID --- */}
      <main style={{ maxWidth: '1200px', margin: '40px auto', padding: '0 20px' }}>
        {parsedSections.length > 0 ? (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
            gap: c.gridGap 
          }}>
            {parsedSections.map((s, i) => {
              const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];
              const accent = colors[i % colors.length];
              
              return (
                <div key={i} style={{
                  background: c.surface,
                  borderRadius: '16px',
                  padding: '24px',
                  border: `1px solid ${c.border}`,
                  borderTop: `6px solid ${accent}`,
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <h3 style={{ 
                    margin: 0, 
                    fontSize: '13px', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.1em', 
                    color: accent,
                    fontWeight: 800 
                  }}>
                    {s.title}
                  </h3>
                  <p style={{ 
                    margin: 0, 
                    fontSize: '16px', 
                    lineHeight: '1.75', 
                    color: c.text, 
                    whiteSpace: 'pre-wrap' 
                  }}>
                    {s.body}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginTop: '100px', color: c.textSec }}>
            <h2 style={{ fontWeight: 400 }}>Where are we heading today?</h2>
            <p>Start a conversation to generate your notes.</p>
          </div>
        )}
      </main>

      {/* --- FLOATING INPUT BAR --- */}
      <div style={{
        position: 'fixed',
        bottom: 30,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '90%',
        maxWidth: '600px',
        background: 'white',
        padding: '12px 24px',
        borderRadius: '30px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        border: `1px solid ${c.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <input 
          placeholder="Talk to your travel companion..." 
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: '16px' }}
        />
        <button style={{ 
          background: c.accent, 
          color: 'white', 
          border: 'none', 
          padding: '8px 20px', 
          borderRadius: '20px',
          fontWeight: 600
        }}>
          Send
        </button>
      </div>
    </div>
  );
}