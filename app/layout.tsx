import type { Metadata } from 'next'
import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Voyage — AI Travel Companion',
  description: 'Plan your perfect trip with AI',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased`}>

          {/* Fixed nav — z-index 9999 so it's always above ChatInterface background */}
          <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}
            className="flex justify-end items-center px-6 py-3 gap-3 bg-black/20 backdrop-blur-md border-b border-white/10">
            <Show when="signed-out">
              <SignInButton>
                <button className="px-4 py-2 text-xs font-semibold tracking-widest uppercase rounded-full border border-white/30 text-white hover:bg-white/10 transition-all cursor-pointer">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton>
                <button className="px-4 py-2 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white hover:bg-white/30 transition-all cursor-pointer">
                  Sign Up
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </header>

          {/* Push content below fixed nav */}
          <main style={{ paddingTop: '56px' }}>
            {children}
          </main>

        </body>
      </html>
    </ClerkProvider>
  )
}