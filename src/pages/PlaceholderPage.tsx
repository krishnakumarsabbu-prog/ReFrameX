import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Boxes, CheckCircle2, Columns3, Contrast, FileSearch,
  FileText, FlaskConical, Gauge, GitBranch, ImagePlus, Lightbulb, ScrollText,
  Settings, Sparkles, SwatchBook, type LucideIcon,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { useTheme, type WallpaperId } from '@/hooks/useTheme';
import { moduleDescriptions } from '@/mock-data';

interface PlaceholderPageProps {
  moduleId: string;
}

const wallpaperOptions: { id: WallpaperId; label: string; description: string; swatches: string[] }[] = [
  { id: 'warm-studio', label: 'Signal Desk', description: 'Cool slate, clear cyan, and deep navy', swatches: ['#5B9DAE', '#E7EFF5', '#65AAA6'] },
  { id: 'sand-dune', label: 'Paper Trail', description: 'Quiet green-grey with soft blue', swatches: ['#718F8B', '#EFF3F0', '#A9C3C4'] },
  { id: 'slate-dusk', label: 'Slate Terminal', description: 'Cool steel and blue-grey', swatches: ['#557E9A', '#DCE5ED', '#5F9A9B'] },
  { id: 'teal-mist', label: 'Blueprint Mist', description: 'Subtle teal with clean mist', swatches: ['#438F91', '#EAF3F5', '#8FBDBA'] },
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
          <button onClick={() => navigate('/')} className="px-5 py-2.5 rounded-pill bg-ink text-white text-sm font-medium hover:bg-ink/90 transition-colors">
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
        <section className="glass rounded-bento p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <SwatchBook size={18} className="text-accent" />
                <h2 className="text-lg font-semibold text-ink">Appearance</h2>
              </div>
              <p className="text-sm text-ink-muted max-w-xl leading-relaxed">Choose a low-distraction slate and cyan backdrop for reviewing architecture, evidence, and migration risks. Your choice is stored only in this browser.</p>
            </div>
            <span className="px-2.5 py-1 rounded-pill bg-accent-soft text-accent text-xs font-medium">Local only</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {wallpaperOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setWallpaper(option.id)}
                className={`text-left rounded-tile p-4 border transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 ${wallpaper === option.id ? 'border-accent shadow-[0_0_0_2px_rgb(var(--accent-rgb)/0.22)]' : 'border-white/45 hover:border-white/80'} bg-white/20`}
              >
                <div className="h-20 rounded-2xl mb-3 overflow-hidden" style={{ background: `linear-gradient(135deg, ${option.swatches[0]}, ${option.swatches[1]} 50%, ${option.swatches[2]})` }} />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-ink">{option.label}</div>
                    <div className="text-xs text-ink-muted mt-1">{option.description}</div>
                  </div>
                  {wallpaper === option.id && <CheckCircle2 size={18} className="text-accent shrink-0" />}
                </div>
              </button>
            ))}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`text-left rounded-tile p-4 border transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 ${wallpaper === 'custom' ? 'border-accent shadow-[0_0_0_2px_rgb(var(--accent-rgb)/0.22)]' : 'border-dashed border-white/60 hover:border-white'} bg-white/20`}
            >
              <div className="h-20 rounded-2xl mb-3 flex items-center justify-center bg-white/25 border border-white/30">
                <ImagePlus size={24} className="text-ink-soft" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-ink">Use my own image</div>
                  <div className="text-xs text-ink-muted mt-1">Selected locally, never uploaded</div>
                </div>
                {wallpaper === 'custom' && <CheckCircle2 size={18} className="text-accent shrink-0" />}
              </div>
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleCustomImage(event.target.files?.[0])} />
        </section>

        <section className="glass rounded-bento p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-2">
            <Contrast size={18} className="text-accent" />
            <h2 className="text-lg font-semibold text-ink">Accessibility</h2>
          </div>
          <p className="text-sm text-ink-muted leading-relaxed">Use the contrast control in the top bar to switch to solid surfaces and disable the ambient background shapes.</p>
        </section>
      </div>
    </>
  );
}
