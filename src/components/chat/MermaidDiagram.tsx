import React, { useEffect, useState, useRef, useId } from 'react';
import mermaid from 'mermaid';
import {
  Code, Eye, Copy, Check, ZoomIn, ZoomOut, RotateCcw,
  Maximize2, Minimize2, Download, AlertCircle, Sparkles
} from 'lucide-react';

interface MermaidDiagramProps {
  code: string;
}

// Initialize mermaid with soft enterprise theme matching ReFrameX
mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'base',
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
  themeVariables: {
    primaryColor: '#EEF2FF',
    primaryTextColor: '#1E293B',
    primaryBorderColor: '#6366F1',
    lineColor: '#64748B',
    secondaryColor: '#ECFDF5',
    secondaryTextColor: '#065F46',
    secondaryBorderColor: '#10B981',
    tertiaryColor: '#FEF3C7',
    tertiaryTextColor: '#92400E',
    tertiaryBorderColor: '#F59E0B',
    mainBkg: '#FFFFFF',
    nodeBorder: '#6366F1',
    clusterBkg: '#F8FAFC',
    clusterBorder: '#CBD5E1',
    titleColor: '#0F172A',
    edgeLabelBackground: '#FFFFFF',
    fontSize: '12px',
  },
});

function sanitizeMermaid(raw: string): string {
  let cleaned = raw.trim();
  // Strip any accidental markdown fences
  cleaned = cleaned.replace(/^```(?:mermaid)?\s*/i, '').replace(/```\s*$/, '').trim();

  // Normalize excessive arrow dashes like ---> to -->
  cleaned = cleaned.replace(/---+>/g, '-->');
  cleaned = cleaned.replace(/---\|/g, '--|');

  // If missing diagram declaration at start, prepend default graph LR
  if (!/^(?:graph\s+|flowchart\s+|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline)/i.test(cleaned)) {
    cleaned = `graph LR\n${cleaned}`;
  }

  // Ensure subgraph titles with spaces are properly quoted if not already:
  cleaned = cleaned.replace(/^(\s*subgraph\s+)([^"\[\]\n\r]+)$/gm, (match, prefix, title) => {
    const t = title.trim();
    if (t.includes(' ') && !t.startsWith('"')) {
      return `${prefix}"${t}"`;
    }
    return match;
  });

  return cleaned;
}

export default function MermaidDiagram({ code }: MermaidDiagramProps) {
  const uniqueId = useId().replace(/:/g, '');
  const containerId = `reframex-mermaid-${uniqueId}`;
  
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'diagram' | 'code'>('diagram');
  const [copied, setCopied] = useState(false);
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  const cleanCode = sanitizeMermaid(code);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const renderId = `m-${uniqueId}-${Date.now()}`;

    mermaid
      .render(renderId, cleanCode)
      .then(({ svg }) => {
        if (!isMounted) return;
        setSvgHtml(svg);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Mermaid rendering failed:', err);
        setError(err?.message || 'Syntax error in Mermaid diagram');
        setViewMode('code');
        setLoading(false);
      });

    return () => {
      isMounted = false;
      // Clean up any stray error elements created by mermaid in DOM
      const el = document.getElementById(renderId);
      if (el) el.remove();
    };
  }, [cleanCode, uniqueId]);

  function handleCopy() {
    navigator.clipboard.writeText(cleanCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadSvg() {
    if (!svgHtml) return;
    const blob = new Blob([svgHtml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reframex-diagram-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className={`my-3 overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-2xs transition-all ${
        isFullscreen ? 'fixed inset-4 z-50 flex flex-col bg-white shadow-2xl border-slate-300' : ''
      }`}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-indigo-50/80 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-slate-50 px-3.5 py-2">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 shadow-2xs">
            <Sparkles size={12} />
          </span>
          <span className="font-sans text-[11px] font-bold text-slate-800">
            Architecture Diagram
          </span>

          {/* Diagram / Code Toggle */}
          <div className="ml-2 flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-[10px] font-semibold text-slate-600">
            <button
              onClick={() => setViewMode('diagram')}
              className={`flex items-center gap-1 rounded-md px-2 py-0.5 transition-colors ${
                viewMode === 'diagram'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              <Eye size={11} />
              <span>Diagram</span>
            </button>
            <button
              onClick={() => setViewMode('code')}
              className={`flex items-center gap-1 rounded-md px-2 py-0.5 transition-colors ${
                viewMode === 'code'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              <Code size={11} />
              <span>Code</span>
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 text-[11px] text-slate-500">
          {viewMode === 'diagram' && svgHtml && (
            <>
              {/* Zoom Controls */}
              <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 mr-1">
                <button
                  onClick={() => setScale((s) => Math.min(2, s + 0.15))}
                  className="rounded p-1 hover:bg-slate-100 text-slate-600"
                  title="Zoom In"
                >
                  <ZoomIn size={12} />
                </button>
                <span className="px-1 text-[10px] font-mono font-medium text-slate-500 min-w-[32px] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={() => setScale((s) => Math.max(0.6, s - 0.15))}
                  className="rounded p-1 hover:bg-slate-100 text-slate-600"
                  title="Zoom Out"
                >
                  <ZoomOut size={12} />
                </button>
                <button
                  onClick={() => setScale(1)}
                  className="rounded p-1 hover:bg-slate-100 text-slate-600"
                  title="Reset Zoom"
                >
                  <RotateCcw size={12} />
                </button>
              </div>

              {/* Download SVG */}
              <button
                onClick={handleDownloadSvg}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-100 transition-colors shadow-2xs"
                title="Download SVG diagram"
              >
                <Download size={11} />
                <span className="hidden sm:inline">SVG</span>
              </button>
            </>
          )}

          {/* Copy Mermaid Code */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-100 transition-colors shadow-2xs"
            title="Copy Mermaid Code"
          >
            {copied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen((f) => !f)}
            className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100 transition-colors shadow-2xs"
            title={isFullscreen ? 'Exit Fullscreen' : 'View Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      {viewMode === 'diagram' ? (
        <div
          ref={containerRef}
          className="relative min-h-[160px] overflow-auto bg-[#FAFAFC] p-4 flex items-center justify-center select-none"
          style={{ maxHeight: isFullscreen ? 'calc(100vh - 80px)' : '420px' }}
        >
          {loading && !svgHtml && (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-slate-400">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              <span className="font-mono text-[11px]">Rendering Architecture Diagram...</span>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-2 py-6 text-rose-600">
              <AlertCircle size={20} />
              <span className="text-xs font-semibold">Could not render diagram preview</span>
              <p className="max-w-md text-center font-mono text-[10px] text-slate-500">{error}</p>
              <button
                onClick={() => setViewMode('code')}
                className="mt-1 text-xs font-semibold text-indigo-600 underline"
              >
                View raw Mermaid source
              </button>
            </div>
          )}

          {!loading && !error && svgHtml && (
            <div
              className="transition-transform duration-150 origin-center max-w-full flex justify-center [&>svg]:max-w-full [&>svg]:h-auto"
              style={{ transform: `scale(${scale})` }}
              dangerouslySetInnerHTML={{ __html: svgHtml }}
            />
          )}
        </div>
      ) : (
        /* Raw Code View */
        <div className="overflow-hidden border-t border-slate-200 bg-slate-50 p-3.5 text-slate-800">
          <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-slate-800">
            <code>{cleanCode}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
