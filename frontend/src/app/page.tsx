"use client";

import Link from "next/link";
import { useState, SVGProps, JSX } from "react";
import { useUser } from '@auth0/nextjs-auth0/client';

// Main Home Component
export default function Home() {
  return (
    <div className="flex flex-col min-h-[100dvh] bg-background text-foreground">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <Features />
        <StatusOverview />
      </main>
      <Footer />
    </div>
  );
}

// Header Component
function Header() {
  const { user } = useUser();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="px-4 lg:px-6 h-16 flex items-center justify-between border-b bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
      <Link href="#" className="flex items-center gap-2" prefetch={false}>
        <MountainIcon className="h-6 w-6" />
        <span className="font-bold text-xl text-primary">StatusTrack</span>
      </Link>
      <nav className="hidden lg:flex gap-4 sm:gap-6">
        {user ? (
          <AuthNavLinks />
        ) : (
          <GuestNavLinks />
        )}
      </nav>
      <button className="lg:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
        {isMenuOpen ? <XIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
        <span className="sr-only">Toggle navigation menu</span>
      </button>
      {isMenuOpen && (
        <div className="lg:hidden absolute top-16 left-0 w-full bg-background border-t z-50">
          <nav className="flex flex-col items-center gap-4 p-4">
            {user ? <AuthNavLinks /> : <GuestNavLinks />}
          </nav>
        </div>
      )}
    </header>
  );
}

// Navigation links for guest users
function GuestNavLinks() {
  return null;
}

// Navigation links for authenticated users
function AuthNavLinks() {
  return (
    <>
      <Link
        href="/admin/dashboard/services"
        className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        prefetch={false}
      >
        Dashboard
      </Link>
      <a
        href="/api/auth/logout"
        className="inline-flex h-10 items-center justify-center rounded-lg border border-input bg-background px-6 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        Log Out
      </a>
    </>
  );
}

// Hero Section Component
function HeroSection() {
  return (
    <section className="relative w-full py-20 md:py-32 lg:py-40 xl:py-56">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/10" />
      <div className="container px-4 md:px-6 relative">
        <div className="flex flex-col items-center space-y-8 text-center">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold tracking-tighter sm:text-6xl md:text-7xl lg:text-8xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80">
              StatusTrack
            </h1>
            <p className="mx-auto max-w-[800px] text-xl text-gray-600 dark:text-gray-400">
              Real-time service monitoring, incident management, and team collaboration in one powerful platform.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/api/auth/login?returnTo=/admin/dashboard/services"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-8 text-sm font-medium text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              Log In
            </a>
            <a
              href="/api/auth/login?returnTo=/admin/dashboard/services"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-primary bg-background px-8 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              Sign Up
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// Features Section
function Features() {
  return (
    <section id="features" className="py-20 bg-gray-50 dark:bg-gray-900">
      <div className="container px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Key Features</h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Everything you need to manage your services and incidents effectively
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard
            icon={<ServicesIcon className="w-12 h-12" />}
            title="Service Management"
            description="Easily manage and monitor all your services with real-time status updates"
          />
          <FeatureCard
            icon={<IncidentsIcon className="w-12 h-12" />}
            title="Incident Management"
            description="Track, manage, and communicate about incidents efficiently"
          />
          <FeatureCard
            icon={<TeamsIcon className="w-12 h-12" />}
            title="Team Collaboration"
            description="Work together seamlessly with team management and notifications"
          />
          <FeatureCard
            icon={<PublicIcon className="w-12 h-12" />}
            title="Public Status Page"
            description="Keep your customers informed with a customizable status page"
          />
        </div>
      </div>
    </section>
  );
}

// Status Overview Section
function StatusOverview() {
  return (
    <section className="py-20 bg-white dark:bg-gray-800">
      <div className="container px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Current Status</h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Real-time overview of all services
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          <StatusCard
            serviceName="API Service"
            status="operational"
            description="All systems are operating normally"
          />
          <StatusCard
            serviceName="Database"
            status="degraded"
            description="Performance is slightly below normal"
          />
          <StatusCard
            serviceName="Web Server"
            status="operational"
            description="All systems are operating normally"
          />
          <StatusCard
            serviceName="Cache Service"
            status="operational"
            description="All systems are operating normally"
          />
        </div>
      </div>
    </section>
  );
}

// Feature Card Component
function FeatureCard({ icon, title, description }: { icon: JSX.Element; title: string; description: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  );
}

// Status Card Component
type ServiceStatus = 'operational' | 'degraded' | 'major';

function StatusCard({ serviceName, status, description }: { serviceName: string; status: ServiceStatus; description: string }) {
  const statusColors = {
    operational: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    degraded: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
    major: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">{serviceName}</h3>
        <span className={`${statusColors[status]} px-3 py-1 rounded-full text-sm font-medium`}>{status}</span>
      </div>
      <p className="text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  );
}

// Footer Component
function Footer() {
  return (
    <footer className="bg-gray-50 dark:bg-gray-900 py-12">
      <div className="container px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xl font-semibold mb-4">StatusTrack</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Your all-in-one platform for service monitoring and incident management
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-4">Quick Links</h3>
            <nav className="space-y-2">
              <Link href="/" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                Home
              </Link>
              <Link href="/admin/dashboard" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                Dashboard
              </Link>
              <Link href="/docs" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                Documentation
              </Link>
            </nav>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-4">Legal</h3>
            <nav className="space-y-2">
              <Link href="/terms" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                Terms of Service
              </Link>
              <Link href="/privacy" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors">
                Privacy Policy
              </Link>
            </nav>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-500">&copy; {new Date().getFullYear()} StatusTrack. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

// SVG Icons
function MountainIcon(props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
    </svg>
  );
}

function MenuIcon(props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

function XIcon(props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ServicesIcon(props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function IncidentsIcon(props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function TeamsIcon(props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function PublicIcon(props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
  );
}
