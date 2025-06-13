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

// Features Section Component
function Features() {
  return (
    <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-gray-100 dark:bg-gray-800">
      <div className="container px-4 md:px-6">
        <div className="grid items-center gap-6 lg:grid-cols-[1fr_500px] lg:gap-12 xl:grid-cols-[1fr_550px]">
          <div className="flex flex-col justify-center space-y-4">
            <div className="space-y-2">
              <div className="inline-block rounded-lg bg-gray-200 px-3 py-1 text-sm dark:bg-gray-700">Key Features</div>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Everything you need to maintain trust.</h2>
              <p className="max-w-[600px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                From real-time status updates to detailed incident reports, StatusTrack provides the tools to keep your users informed and your team aligned.
              </p>
            </div>
            <ul className="grid gap-2 py-4">
              <li>
                <CheckIcon className="mr-2 inline-block h-4 w-4" />
                Customizable Status Pages
              </li>
              <li>
                <CheckIcon className="mr-2 inline-block h-4 w-4" />
                Real-time Incident Updates
              </li>
              <li>
                <CheckIcon className="mr-2 inline-block h-4 w-4" />
                Subscriber Notifications
              </li>
            </ul>
          </div>
          <img
            src="/placeholder.svg"
            width="550"
            height="310"
            alt="Features"
            className="mx-auto aspect-video overflow-hidden rounded-xl object-cover object-center sm:w-full lg:order-last"
          />
        </div>
      </div>
    </section>
  );
}

// Status Overview Section Component
function StatusOverview() {
  return (
    <section className="w-full py-12 md:py-24 lg:py-32">
      <div className="container grid items-center justify-center gap-4 px-4 text-center md:px-6">
        <div className="space-y-3">
          <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight">Current System Status</h2>
          <p className="mx-auto max-w-[600px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
            A quick overview of our services. For more details, visit our full status page.
          </p>
        </div>
        <div className="w-full max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-lg border shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">All Systems Operational</h3>
            <div className="text-green-500 flex items-center">
              <CheckIcon className="h-5 w-5 mr-1" />
              <span>Operational</span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Website & API</span>
              <span className="text-green-500">Operational</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Authentication Service</span>
              <span className="text-green-500">Operational</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Database Cluster</span>
              <span className="text-green-500">Operational</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Footer Component
function Footer() {
  return (
    <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
      <p className="text-xs text-gray-500 dark:text-gray-400">&copy; 2024 StatusTrack. All rights reserved.</p>
      <nav className="sm:ml-auto flex gap-4 sm:gap-6">
        <Link href="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
          Terms of Service
        </Link>
        <Link href="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
          Privacy
        </Link>
      </nav>
    </footer>
  );
}

// Icon Components
function MountainIcon(props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
    </svg>
  );
}

function XIcon(props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function MenuIcon(props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

function CheckIcon(props: JSX.IntrinsicAttributes & SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

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
