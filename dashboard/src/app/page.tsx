import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Activity, Clock, AlertTriangle, FileText, Bell, Shield } from 'lucide-react';

const features = [
  {
    icon: Activity,
    title: 'Quality Score',
    description: 'A-F grades based on latency, jitter, packet loss, DNS resolution, and bufferbloat measurements.',
  },
  {
    icon: Clock,
    title: '24/7 Monitoring',
    description: 'Continuous measurements every 30 seconds with historical tracking and trend analysis.',
  },
  {
    icon: AlertTriangle,
    title: 'Anomaly Detection',
    description: 'Automatic pattern recognition detects recurring issues like evening ISP congestion.',
  },
  {
    icon: FileText,
    title: 'ISP Report Cards',
    description: 'Generate PDF evidence reports with graphs and data to hold your ISP accountable.',
  },
  {
    icon: Bell,
    title: 'Smart Alerts',
    description: 'Get notified via webhook, Discord, or email when your connection quality drops.',
  },
  {
    icon: Shield,
    title: 'Self-Hosted',
    description: 'Run on your own infrastructure. Your monitoring data never leaves your network.',
  },
];

export default async function LandingPage() {
  const session = await auth();
  if (session) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero */}
      <div className="flex flex-col items-center justify-center px-6 pt-32 pb-20">
        <div className="flex items-center gap-3 mb-6">
          <Activity size={40} className="text-blue-500" />
          <h1 className="text-5xl font-bold tracking-tight">NetPulse</h1>
        </div>
        <p className="text-xl text-gray-400 max-w-2xl text-center mb-4">
          Know exactly how good your internet really is. Continuous monitoring, anomaly detection, and ISP accountability — all self-hosted.
        </p>
        <p className="text-gray-500 max-w-xl text-center mb-10">
          Not just speed tests. NetPulse measures latency, jitter, packet loss, DNS resolution, and bufferbloat 24/7 to give you a true picture of your connection quality.
        </p>
        <Link
          href="/login"
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-lg transition-colors"
        >
          Get Started
        </Link>
      </div>

      {/* Features Grid */}
      <div className="max-w-5xl mx-auto px-6 pb-32">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors"
            >
              <Icon size={28} className="text-blue-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">{title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 text-center text-gray-500 text-sm">
        <p>Built with Go, Next.js, PostgreSQL + TimescaleDB</p>
        <p className="mt-1">Open source ISP quality monitoring</p>
      </footer>
    </div>
  );
}
