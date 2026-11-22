import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Boxes, CheckCircle2, Columns3, Contrast, FileSearch,
  FileText, FlaskConical, Gauge, GitBranch, ImagePlus, Lightbulb, ScrollText,
  Settings, Sparkles, SwatchBook, ShieldCheck, Cpu, Terminal, Loader2, type LucideIcon,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { useTheme, type WallpaperId } from '@/hooks/useTheme';
import { moduleDescriptions } from '@/mock-data';
import { api, type LLMStatus } from '@/api/client';
import { getGroqApiKey, setGroqApiKey } from '../../backend/app/engine/GroqEngine';

interface PlaceholderPageProps {
  moduleId: string;
}

const wallpaperOptions: { id: WallpaperId; label: string; description: string; swatches: string[] }[] = [
  { id: 'warm-studio', label: 'SoftGlass Pro (Default)', description: 'Warm light-gray canvas (#E9EAEC) with refined white surfaces and subtle lime highlights', swatches: ['#E9EAEC', '#FAFAFA', '#C5F45A'] },
  { id: 'sand-dune', label: 'Alabaster Minimal', description: 'Porcelain white surfaces with subtle neutral borders and charcoal typography', swatches: ['#F1F2F3', '#FFFFFF', '#202124'] },
  { id: 'slate-dusk', label: 'Studio Warm Gray', description: 'Layered warm neutrals with balanced contrast and crisp borders', swatches: ['#E9EAEC', '#F1F2F3', '#777D83'] },
  { id: 'teal-mist', label: 'Frosted Glass Clean', description: 'Frosted glassmorphism with subtle highlights and soft ambient shadows', swatches: ['#E9EAEC', '#FFFFFF', '#C5F45A'] },
];

const moduleIcons: Record<string, LucideIcon> = {
  applications: Boxes,
  artifacts: FileSearch,
  intelligence: Sparkles,
  dependencies: GitBranch,
  complexity: Gauge,
  evidence: ScrollText,
  risks: AlertTriangle,
  recommendations: Lightbulb,
  simulator: FlaskConical,
  reports: FileText,
  compare: Columns3,
};

export default function PlaceholderPage({ moduleId }: PlaceholderPageProps) {
  const navigate = useNavigate();
  const info = moduleDescriptions[moduleId];
  if (!info) return null;

  if (moduleId === 'settings') return <SettingsPage />;

  const Icon = moduleIcons[moduleId] ?? Boxes;

  return (
    <>
      <PageHeader title={info.title} breadcrumb={['ReframeX', info.title]} />
      <EmptyState
        icon={<Icon size={28} />}
        title={info.title}
        summary={info.summary}
        phase={info.phase}
        bullets={info.bullets}
        action={
          <button onClick={() => navigate('/')} className="px-5 py-2.5 rounded-xl bg-[#202124] text-white text-xs font-medium hover:bg-black transition-colors shadow-sm">
            Back to Dashboard
          </button>
        }
      />
    </>
  );
}

function SettingsPage() {
  const { wallpaper, setWallpaper, setCustomWallpaper } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleCustomImage(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setCustomWallpaper(reader.result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <>
      <PageHeader title="Settings" breadcrumb={['ReframeX', 'Settings']} />
      <div className="space-y-5 max-w-4xl">
        <section className="rounded-2xl border border-[#E3E5E7] bg-white p-6 sm:p-8 shadow-[0_4px_16px_rgba(25,30,35,0.04)]">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <SwatchBook size={18} className="text-[#202124]" />
                <h2 className="text-lg font-medium text-[#202124]">Appearance</h2>
              </div>
              <p className="text-sm text-[#777D83] max-w-xl leading-relaxed">Choose a low-distraction neutral canvas for reviewing architecture, evidence, and migration risks. Your choice is stored only in this browser.</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[#F1F2F3] text-[#777D83] border border-[#E3E5E7] text-xs font-medium">Local only</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {wallpaperOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setWallpaper(option.id)}
                className={`text-left rounded-2xl p-4 border transition-all duration-200 hover:-translate-y-0.5 ${wallpaper === option.id
                    ? 'border-[#202124] bg-[#FAFAFA] shadow-[0_4px_16px_rgba(25,30,35,0.06)]'
                    : 'border-[#E3E5E7] bg-white hover:border-[#202124]/30'
                  }`}
              >
                <div className="h-20 rounded-xl mb-3 overflow-hidden border border-[#E3E5E7]" style={{ background: `linear-gradient(135deg, ${option.swatches[0]}, ${option.swatches[1]} 50%, ${option.swatches[2]})` }} />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[#202124]">{option.label}</div>
                    <div className="text-xs text-[#777D83] mt-1">{option.description}</div>
                  </div>
                  {wallpaper === option.id && <CheckCircle2 size={18} className="text-[#202124] shrink-0" />}
                </div>
              </button>
            ))}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`text-left rounded-2xl p-4 border transition-all duration-200 hover:-translate-y-0.5 ${wallpaper === 'custom'
                  ? 'border-[#202124] bg-[#FAFAFA] shadow-[0_4px_16px_rgba(25,30,35,0.06)]'
                  : 'border-dashed border-[#E3E5E7] bg-white hover:border-[#202124]/40'
                }`}
            >
              <div className="h-20 rounded-xl mb-3 flex items-center justify-center bg-[#F1F2F3] border border-[#E3E5E7]">
                <ImagePlus size={24} className="text-[#777D83]" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-[#202124]">Use my own image</div>
                  <div className="text-xs text-[#777D83] mt-1">Selected locally, never uploaded</div>
                </div>
                {wallpaper === 'custom' && <CheckCircle2 size={18} className="text-[#202124] shrink-0" />}
              </div>
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleCustomImage(event.target.files?.[0])} />
        </section>

        <section className="rounded-2xl border border-[#E3E5E7] bg-white p-6 sm:p-8 shadow-[0_4px_16px_rgba(25,30,35,0.04)]">
          <div className="flex items-center gap-2 mb-2">
            <Contrast size={18} className="text-[#202124]" />
            <h2 className="text-lg font-medium text-[#202124]">Accessibility</h2>
          </div>
          <p className="text-sm text-[#777D83] leading-relaxed">Use the contrast control in the top bar to switch to solid surfaces and disable any custom backdrop image.</p>
        </section>

        {/* AI Assistance (LLM Evaluation Layer - B8) */}
        <AIAssistanceSection />
      </div>
    </>
  );
}

function AIAssistanceSection() {
  const [status, setStatus] = useState<LLMStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [apiKey, setApiKey] = useState(getGroqApiKey());
  const [savedKeyMsg, setSavedKeyMsg] = useState(false);

  useEffect(() => {
    api.getLLMStatus()
      .then((s) => setStatus(s))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  async function handleTest(provider?: string) {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testLLMConnection(provider);
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ status: 'error', error: e.message });
    } finally {
      setTesting(false);
    }
  }

  function handleSaveKey() {
    setGroqApiKey(apiKey);
    setSavedKeyMsg(true);
    setTimeout(() => setSavedKeyMsg(false), 2500);
  }

  return (
    <section className="rounded-2xl border border-[#E3E5E7] bg-white p-6 sm:p-8 shadow-[0_4px_16px_rgba(25,30,35,0.04)]">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Cpu size={18} className="text-[#202124]" />
            <h2 className="text-lg font-medium text-[#202124]">AI Assistance & Evaluation Layer</h2>
          </div>
          <p className="text-sm text-[#777D83] max-w-xl leading-relaxed">
            Configure secondary LLM verification and evaluation harness. When disabled, zero external network calls are made. All AI outputs are labeled strictly as &quot;AI-assisted (Inferred)&quot;.
          </p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${status?.enabled ? 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]/60' : 'bg-[#F1F2F3] text-[#777D83] border-[#E3E5E7]'}`}>
          {status?.enabled ? 'Enabled' : 'Disabled (Safe Mode)'}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-[#777D83]">
          <Loader2 size={16} className="animate-spin text-[#202124]" /> Loading configuration...
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-[#E3E5E7] bg-[#FAFAFA] p-3.5">
              <span className="text-[10px] uppercase font-mono text-[#A0A4A8]">Provider</span>
              <p className="font-mono font-medium text-[#202124] mt-0.5">{status?.provider ?? 'openai_compatible'}</p>
            </div>
            <div className="rounded-xl border border-[#E3E5E7] bg-[#FAFAFA] p-3.5">
              <span className="text-[10px] uppercase font-mono text-[#A0A4A8]">Model</span>
              <p className="font-mono font-medium text-[#202124] mt-0.5">{status?.model ?? 'llama-3.3-70b-versatile'}</p>
            </div>
            <div className="rounded-xl border border-[#E3E5E7] bg-[#FAFAFA] p-3.5">
              <span className="text-[10px] uppercase font-mono text-[#A0A4A8]">Send Mode</span>
              <p className="font-mono font-medium text-[#202124] mt-0.5">{status?.send_mode ?? 'snippets (5-10 lines)'}</p>
            </div>
            <div className="rounded-xl border border-[#E3E5E7] bg-[#FAFAFA] p-3.5">
              <span className="text-[10px] uppercase font-mono text-[#A0A4A8]">Data Minimization / Redaction</span>
              <p className="font-mono font-medium text-[#065F46] mt-0.5">
                {status?.redact ? 'Enabled (IPs, Emails, Secrets, COBOL seq)' : 'Disabled'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#E3E5E7] bg-[#FAFAFA] p-3.5 text-xs">
            <span className="text-[10px] uppercase font-mono text-[#A0A4A8]">Allowed Hostnames</span>
            <p className="font-mono text-[#777D83] mt-0.5">{status?.allowed_hosts.join(', ') || 'api.groq.com, localhost'}</p>
          </div>

          {/* Enterprise LLM Key Entry */}
          <div className="rounded-xl border border-[#E3E5E7] bg-[#FAFAFA] p-4 space-y-2">
            <label className="text-xs font-medium text-[#202124] block">
              Enterprise LLM API Key (Local Browser / Direct Inference)
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="gsk_..."
                className="flex-1 rounded-xl border border-[#E3E5E7] bg-white px-3.5 py-2 font-mono text-xs text-[#202124] outline-none focus:border-[#202124] transition-colors shadow-sm"
              />
              <button
                type="button"
                onClick={handleSaveKey}
                className="px-4 py-2 rounded-xl bg-[#202124] text-white text-xs font-medium hover:bg-black transition-colors shadow-sm"
              >
                Save
              </button>
            </div>
            {savedKeyMsg && <span className="text-xs text-[#065F46] font-medium">Saved to local storage</span>}
          </div>

          {/* Test connection buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleTest()}
              disabled={testing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E3E5E7] bg-white text-xs font-medium text-[#202124] hover:bg-[#FAFAFA] hover:border-[#202124]/40 transition-colors shadow-sm disabled:opacity-50"
            >
              {testing && <Loader2 size={13} className="animate-spin text-[#202124]" />}
              Test Configured Provider
            </button>
            <button
              type="button"
              onClick={() => handleTest('mock')}
              disabled={testing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E3E5E7] bg-white text-xs font-medium text-[#202124] hover:bg-[#FAFAFA] hover:border-[#202124]/40 transition-colors shadow-sm disabled:opacity-50"
            >
              Test Offline Mock
            </button>
          </div>

          {testResult && (
            <div className="rounded-xl border border-[#E3E5E7] bg-[#202124] p-4 font-mono text-[11px] text-[#FAFAFA] overflow-x-auto shadow-sm">
              <pre>{JSON.stringify(testResult, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
