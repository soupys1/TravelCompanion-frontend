'use client'

import { useUser } from "@clerk/nextjs"
import ChatInterface from "@/components/ChatInterface"
import LandingPage from "@/components/LandingPage"

export default function page() {
  const { isSignedIn, isLoaded } = useUser()

  if (!isLoaded) return <div style={{ minHeight:'100vh', background:'#080810' }} />
  if (!isSignedIn) return <LandingPage />

  return <ChatInterface />
}