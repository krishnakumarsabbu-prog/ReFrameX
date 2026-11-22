import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Sparkles, X, Minimize2, Maximize2, Send, Bot, User, Trash2,
  Download, Settings2, RefreshCw, ChevronDown, Check, ArrowRight,
  HelpCircle, ShieldCheck, Zap, Layers, AlertCircle, Copy, CheckCheck,
  PanelRightClose, PanelRightOpen, Cpu,
} from 'lucide-react';
import { api, type ChatMessage, type Application } from '@/api/client';
import { getGroqApiKey, setGroqApiKey, createGroqClient } from '../../../backend/app/engine/GroqEngine';
import MarkdownContent from './MarkdownContent';

interface StoredMessage extends ChatMessage {
  id: string;
  timestamp: string;
  model?: string;
  latency_ms?: number;
  citations?: string[];
}

interface PageContextMeta {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  prompts: string[];
}

const PAGE_METAS: Record<string, PageContextMeta> = {
  overview: {
    id: 'overview',
    label: 'Application Overview Cockpit',
    shortLabel: 'Overview',
    color: 'from-blue-600 to-indigo-600',
    badgeBg: 'bg-blue-50 border-blue-200',
    badgeText: 'text-blue-700',
    prompts: [
      'Explain why Migration Complexity is scored at 49% and what drives it',
      'Give me an Executive Summary of modernization readiness for the CIO',
      'What are the top 3 critical risks and missing copybooks?',
      'Which components are ready for microservice extraction to OpenShift?',
    ],
  },
  complexity: {
    id: 'complexity',
    label: 'Complexity Assessment & Rules',
    shortLabel: 'Complexity',
    color: 'from-amber-500 to-orange-500',
    badgeBg: 'bg-amber-50 border-amber-200',
    badgeText: 'text-amber-800',
    prompts: [
      'How does the hyperbolic saturating normalization formula work?',
      'Which fired rules added the highest complexity weight?',
      'Explain the Banking & Business Logic domain score breakdown',
      'What are the limitations recorded in this assessment run?',
    ],
  },
  dependencies: {
    id: 'dependencies',
    label: 'Dependency Intelligence & Graph',
    shortLabel: 'Dependencies',
    color: 'from-teal-500 to-emerald-600',
    badgeBg: 'bg-teal-50 border-teal-200',
    badgeText: 'text-teal-800',
    prompts: [
      'Are there any circular dependencies between programs and copybooks?',
      'Identify all Single Points of Failure (SPoF) in the call graph',
      'Which component has the highest downstream blast radius?',
      'How should we decouple shared copybooks before refactoring?',
    ],
  },
  evidence: {
    id: 'evidence',
    label: 'Clinical Evidence Explorer & Auditor',
    shortLabel: 'Evidence',
    color: 'from-purple-600 to-indigo-600',
    badgeBg: 'bg-purple-50 border-purple-200',
    badgeText: 'text-purple-800',
    prompts: [
      'Where did static AST rules and the LLM semantic auditor dissent?',
      'Explain the difference between Inferred and Evidence-based findings',
      'Show line-level citations for missing copybook references',
      'How does clinical evidence integrity affect assessment confidence?',
    ],
  },
  artifacts: {
    id: 'artifacts',
    label: 'Artifact Inventory & Ingestion',
    shortLabel: 'Artifacts',
    color: 'from-blue-600 to-teal-500',
    badgeBg: 'bg-indigo-50 border-indigo-200',
    badgeText: 'text-indigo-800',
    prompts: [
      'Summarize the artifact categories and parsing support levels',
      'Are there any EBCDIC encoding or fixed record length hints?',
      'Which artifacts encountered warnings during AST extraction?',
      'How do I upload custom JCL or copybook libraries for analysis?',
    ],
  },
  recommendations: {
    id: 'recommendations',
    label: 'Refactoring Recommendations & Roadmap',
    shortLabel: 'Roadmap',
    color: 'from-emerald-600 to-teal-600',
    badgeBg: 'bg-emerald-50 border-emerald-200',
    badgeText: 'text-emerald-800',
    prompts: [
      'Walk me through the 6-phase modernization roadmap in detail',
      'Why are certain components recommended to Retain on Mainframe?',
      'What are prerequisites for extracting batch jobs into microservices?',
      'Compare Good Refactoring Candidates vs Requires Further Analysis',
    ],
  },
  risks: {
    id: 'risks',
    label: 'Unknowns & Risk Register',
    shortLabel: 'Risks',
    color: 'from-rose-500 to-red-600',
    badgeBg: 'bg-rose-50 border-rose-200',
    badgeText: 'text-rose-800',
    prompts: [
      'List all High severity risks and suggested remediations',
      'What evidence is missing and how does it penalize confidence?',
      'Explain the Evidence Integrity Principle: missing != simple',
      'What specialist reviews are recommended for unverified assumptions?',
    ],
  },
  simulator: {
    id: 'simulator',
    label: 'Refactoring Impact Simulator',
    shortLabel: 'Simulator',
    color: 'from-fuchsia-600 to-pink-600',
    badgeBg: 'bg-pink-50 border-pink-200',
    badgeText: 'text-pink-800',
    prompts: [
      'Simulate extracting LOAN-SERV into a Spring Boot service',
      'Compare Refactor in Place vs Extract to Distributed Service',
      'What is the blast radius on upstream callers if we extract DB2 logic?',
      'How are shared database tables impacted by hypothetical extraction?',
    ],
  },
  reports: {
    id: 'reports',
    label: 'Assessment Reports & Governance',
    shortLabel: 'Reports',
    color: 'from-slate-700 to-slate-900',
    badgeBg: 'bg-slate-100 border-slate-300',
    badgeText: 'text-slate-800',
    prompts: [
      'Draft an executive briefing for the CIO from this report',
      'Explain the AI governance & non-delegation policy',
      'Summarize measured business-value metrics and parser coverage',
      'How does ReFrameX guarantee clinical audit trails for regulatory compliance?',
    ],
  },
  compare: {
    id: 'compare',
    label: 'Application Comparison',
    shortLabel: 'Compare',
    color: 'from-blue-600 to-purple-600',
    badgeBg: 'bg-blue-50 border-blue-200',
    badgeText: 'text-blue-800',
    prompts: [
      'Compare the complexity balance between Application A and B',
      'Which application has higher readiness for cloud migration?',
      'Explain the radar chart delta across the 8 domains',
      'Compare artifact and dependency counts between both applications',
    ],
  },
  intelligence: {
    id: 'intelligence',
    label: 'Application Intelligence & AST',
    shortLabel: 'Intelligence',
    color: 'from-indigo-600 to-blue-600',
    badgeBg: 'bg-indigo-50 border-indigo-200',
    badgeText: 'text-indigo-800',
    prompts: [
      'What technologies are extracted across the components?',
      'Show the distribution between static calls and dynamic calls',
      'Explain parser coverage for full extract vs detect only',
      'Which components have detected SQL and CICS statements?',
    ],
  },
  'evidence-improvement': {
    id: 'evidence-improvement',
    label: 'Evidence Improvement Workflow',
    shortLabel: 'Improvement',
    color: 'from-emerald-600 to-indigo-600',
    badgeBg: 'bg-emerald-50 border-emerald-200',
    badgeText: 'text-emerald-800',
    prompts: [
      'How does adding copybooks improve assessment confidence?',
      'Explain before/after score delta when new evidence is ingested',
      'Why does complexity only change where new evidence reveals true complexity?',
      'Show evidence gaps resolved across assessment versions',
    ],
  },
  dashboard: {
    id: 'dashboard',
    label: 'Portfolio Modernization Dashboard',
    shortLabel: 'Portfolio',
    color: 'from-indigo-600 to-blue-600',
    badgeBg: 'bg-indigo-50 border-indigo-200',
    badgeText: 'text-indigo-800',
    prompts: [
      'Give me an overview of all applications across the portfolio',
      'Which applications have the highest complexity vs readiness?',
      'What are the aggregate portfolio risk points?',
      'Recommend the sequencing order for modernizing these applications',
    ],
  },
  catalog: {
    id: 'catalog',
    label: 'Application Portfolio Catalog',
    shortLabel: 'Catalog',
    color: 'from-blue-600 to-indigo-600',
    badgeBg: 'bg-blue-50 border-blue-200',
    badgeText: 'text-blue-800',
    prompts: [
      'Compare modernizability across all applications in the catalog',
      'Which application should we migrate first as Wave 1 pilot?',
      'How many total components and batch jobs are in the catalog?',
      'Identify cross-application shared dependencies and databases',
    ],
  },
};

export default function ReFrameXChatBot() {
  const location = useLocation();

  // State
  const [isOpen, setIsOpen] = useState(false);
  const [isDocked, setIsDocked] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Model & Key config
  const [selectedModel, setSelectedModel] = useState<string>('llama-3.3-70b-versatile');
  const [customApiKey, setCustomApiKey] = useState<string>(getGroqApiKey());
  const [keySavedToast, setKeySavedToast] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  // Applications & Scope Context
  const [allApps, setAllApps] = useState<Application[]>([]);
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const [scopeMode, setScopeMode] = useState<'app' | 'portfolio'>('app');

  // Messages per page: Record<page_id, StoredMessage[]>
  const [historyByPage, setHistoryByPage] = useState<Record<string, StoredMessage[]>>(() => {
    try {
      const saved = localStorage.getItem('reframex_chat_history');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Determine current page context from pathname
  const pageContext = useMemo(() => {
    const path = location.pathname.toLowerCase();
    if (path === '/' || path.includes('dashboard')) return 'dashboard';
    if (path === '/applications') return 'catalog';
    if (path.includes('overview')) return 'overview';
    if (path.includes('complexity') || path.includes('assessment')) return 'complexity';
    if (path.includes('dependencies') || path.includes('graph')) return 'dependencies';
    if (path.includes('evidence-improvement')) return 'evidence-improvement';
    if (path.includes('evidence')) return 'evidence';
    if (path.includes('artifacts')) return 'artifacts';
    if (path.includes('recommendations')) return 'recommendations';
    if (path.includes('risks')) return 'risks';
    if (path.includes('simulator')) return 'simulator';
    if (path.includes('reports')) return 'reports';
    if (path.includes('compare')) return 'compare';
    if (path.includes('intelligence')) return 'intelligence';
    return 'dashboard';
  }, [location.pathname]);

  const pageMeta = PAGE_METAS[pageContext] || PAGE_METAS.overview;
  const currentMessages = historyByPage[pageContext] || [];

  // Persist history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('reframex_chat_history', JSON.stringify(historyByPage));
    } catch {
      // ignore
    }
  }, [historyByPage]);

  // Sync application selection based on route, localStorage, or fallback
  const syncAppSelection = useCallback((apps: Application[]) => {
    setAllApps(apps);
    if (apps.length === 0) return;

    const path = location.pathname.toLowerCase();
    const isGlobalPage = path === '/' || path === '/dashboard' || path === '/applications' || path === '/compare';

    // 1. Check if route has an explicit application ID: /applications/:id/...
    const routeMatch = location.pathname.match(/\/applications\/([a-zA-Z0-9_-]+)/);
    const routeId = routeMatch ? routeMatch[1] : null;

    if (routeId && routeId !== 'overview') {
      const match = apps.find((a) => a.id === routeId);
      if (match) {
        setActiveApp(match);
        setScopeMode('app');
        localStorage.setItem('reframex_active_app_id', match.id);
        return;
      }
    }

    // 2. Check localStorage for user-selected app
    const savedAppId = localStorage.getItem('reframex_active_app_id');
    if (savedAppId === 'portfolio') {
      setActiveApp(null);
      setScopeMode('portfolio');
      return;
    }
    if (savedAppId) {
      const match = apps.find((a) => a.id === savedAppId);
      if (match) {
        if (isGlobalPage && localStorage.getItem('reframex_user_explicit_app') !== 'true') {
          setActiveApp(null);
          setScopeMode('portfolio');
        } else {
          setActiveApp(match);
          setScopeMode('app');
        }
        return;
      }
    }

    // 3. Fallback based on page
    if (isGlobalPage) {
      setActiveApp(null);
      setScopeMode('portfolio');
    } else {
      const active = apps.find((a) => a.is_active) ?? apps[0];
      setActiveApp(active || null);
      setScopeMode('app');
    }
  }, [location.pathname]);

  useEffect(() => {
    api.listApplications()
      .then((apps) => {
        syncAppSelection(apps);
      })
      .catch(() => {});
  }, [syncAppSelection]);

  // Listen for app change events from elsewhere in the portal
  useEffect(() => {
    function handleAppChanged(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.appId && allApps.length > 0) {
        if (detail.appId === 'portfolio') {
          setScopeMode('portfolio');
          setActiveApp(null);
        } else {
          const match = allApps.find((a) => a.id === detail.appId);
          if (match) {
            setActiveApp(match);
            setScopeMode('app');
          }
        }
      }
    }
    window.addEventListener('reframex-app-changed', handleAppChanged);
    return () => window.removeEventListener('reframex-app-changed', handleAppChanged);
  }, [allApps]);

  function handleSwitchAppScope(targetValue: string) {
    if (targetValue === 'portfolio') {
      setScopeMode('portfolio');
      setActiveApp(null);
      localStorage.setItem('reframex_active_app_id', 'portfolio');
      localStorage.setItem('reframex_user_explicit_app', 'false');
      window.dispatchEvent(new CustomEvent('reframex-app-changed', { detail: { appId: 'portfolio' } }));
    } else {
      const chosen = allApps.find((a) => a.id === targetValue);
      if (chosen) {
        setScopeMode('app');
        setActiveApp(chosen);
        localStorage.setItem('reframex_active_app_id', chosen.id);
        localStorage.setItem('reframex_user_explicit_app', 'true');
        window.dispatchEvent(new CustomEvent('reframex-app-changed', { detail: { appId: chosen.id } }));
      }
    }
  }

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentMessages, isOpen, loading]);

  // Global shortcut: Ctrl+J or Cmd+J to toggle chat, plus custom event listeners
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    function handleToggle() {
      setIsOpen((prev) => !prev);
    }
    function handleOpen() {
      setIsOpen(true);
    }
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('toggle-reframex-chat', handleToggle);
    window.addEventListener('open-reframex-chat', handleOpen);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('toggle-reframex-chat', handleToggle);
      window.removeEventListener('open-reframex-chat', handleOpen);
    };
  }, []);

  // Send message
  async function handleSend(textToSend?: string) {
    const messageText = (textToSend || input).trim();
    if (!messageText || loading) return;

    setInput('');

    const userMessage: StoredMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newThread = [...currentMessages, userMessage];
    setHistoryByPage((prev) => ({
      ...prev,
      [pageContext]: newThread,
    }));

    setLoading(true);
    const start = performance.now();

    try {
      let replyText = '';
      let providerName = 'ReFrameX Migration Engine';
      let modelName = 'ReFrameX Neural Engine';

      const apiKey = customApiKey.trim();

      // 1. Try direct Groq if key exists
      if (apiKey && selectedModel !== 'offline') {
        try {
          const appScopeTitle = scopeMode === 'portfolio' ? 'Enterprise Portfolio (All Applications)' : `application '${activeApp?.name || 'Sabbu'}'`;
          const systemMsg = `You are the ReFrameX AI Copilot, an expert in legacy mainframe modernization (COBOL, CICS, DB2, JCL, BMS, RACF) to cloud target architectures (Red Hat OpenShift, Kubernetes, Spring Boot microservices, Kafka, PostgreSQL).
You are answering queries about ${appScopeTitle} in the context of the '${pageMeta.label}' view.
Format your answer with rich GitHub Flavored Markdown, tables, and evidence citations.`;

          const groq = createGroqClient(apiKey);
          const completion = await groq.chat.completions.create({
            model: selectedModel,
            messages: [
              { role: 'system', content: systemMsg },
              ...newThread.slice(-6).map((m) => ({ role: m.role, content: m.content })),
            ],
            temperature: 0.2,
            max_tokens: 1400,
          });

          replyText = completion.choices[0]?.message?.content || '';
          providerName = 'Enterprise AI';
          modelName = `Enterprise AI (${selectedModel})`;
        } catch {
          // fallback to backend
        }
      }

      // 2. If no reply yet, invoke backend /api/chat
      if (!replyText) {
        const resp = await api.chat({
          application_id: scopeMode === 'portfolio' ? 'portfolio' : activeApp?.id,
          page_context: pageContext,
          messages: newThread.slice(-8).map((m) => ({ role: m.role, content: m.content })),
          api_key_override: apiKey || undefined,
          model_override: selectedModel !== 'offline' ? selectedModel : undefined,
        });
        replyText = resp.reply;
        providerName = resp.provider === 'enterprise_llm' ? 'Enterprise AI' : 'ReFrameX Intelligence Engine';
        modelName = resp.model;
      }

      const elapsed = Math.round(performance.now() - start);

      const assistantMessage: StoredMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: modelName,
        latency_ms: elapsed,
        citations: [activeApp?.name ? `App: ${activeApp.name}` : '', `View: ${pageMeta.shortLabel}`].filter(Boolean),
      };

      setHistoryByPage((prev) => ({
        ...prev,
        [pageContext]: [...newThread, assistantMessage],
      }));
    } catch (err: any) {
      const errorMessage: StoredMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `### ⚠️ Notice\n\nUnable to reach inference engine: ${err?.message || 'Network timeout'}. Please try again or switch to ReFrameX Neural Engine.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: 'Error',
      };
      setHistoryByPage((prev) => ({
        ...prev,
        [pageContext]: [...newThread, errorMessage],
      }));
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleClearSession() {
    setHistoryByPage((prev) => ({
      ...prev,
      [pageContext]: [],
    }));
  }

  function handleSaveKey() {
    setGroqApiKey(customApiKey);
    setKeySavedToast(true);
    setTimeout(() => setKeySavedToast(false), 2500);
  }

  async function handleTestKey() {
    setTestStatus('Testing connectivity...');
    try {
      const res = await api.testLLMConnection('openai_compatible');
      if (res && res.status === 'healthy') {
        setTestStatus(`Connected (${res.latency_ms}ms)`);
      } else {
        setTestStatus('Connected to ReFrameX Local Engine');
      }
    } catch {
      setTestStatus('ReFrameX Local Engine Ready');
    }
    setTimeout(() => setTestStatus(null), 3000);
  }

  function handleExportTranscript() {
    if (currentMessages.length === 0) return;
    const lines = [
      `# ReFrameX AI Copilot Transcript`,
      `**Application:** ${activeApp?.name || 'Sabbu'}`,
      `**Context View:** ${pageMeta.label}`,
      `**Date:** ${new Date().toLocaleString()}`,
      `\n---\n`,
    ];
    currentMessages.forEach((m) => {
      const speaker = m.role === 'user' ? '### User' : `### ReFrameX AI Copilot (${m.model || 'ReFrameX AI'})`;
      lines.push(`${speaker} [${m.timestamp}]\n\n${m.content}\n\n---\n`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ReFrameX_AI_Chat_${pageContext}_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Floating trigger button when closed - sleek compact branded icon
  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-blue-600 text-white shadow-xl shadow-indigo-600/35 hover:shadow-indigo-600/55 hover:scale-105 active:scale-95 transition-all duration-200 border border-indigo-400/40"
          title="Open ReFrameX AI Copilot (Ctrl+J)"
          aria-label="Open ReFrameX AI Copilot"
        >
          {/* Live indicator dot */}
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 ring-2 ring-white"></span>
          </span>

          <Sparkles size={21} className="text-amber-300 transition-transform duration-200 group-hover:rotate-12 group-hover:scale-110" />

          {/* Micro hover tooltip */}
          <div className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-xl border border-indigo-400/30 bg-indigo-950/95 px-2.5 py-1 text-[11px] font-semibold text-white shadow-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <span>ReFrameX AI Copilot</span>
            <span className="ml-1.5 font-mono text-[9px] text-indigo-300 border border-indigo-400/40 rounded px-1 py-0.2">Ctrl+J</span>
          </div>
        </button>
      </div>
    );
  }

  // Outer container class based on docked / maximized / floating
  const containerClasses = isDocked
    ? 'fixed top-14 bottom-0 right-0 z-40 w-full sm:w-[480px] lg:w-[540px] border-l border-slate-200 bg-white shadow-2xl flex flex-col transition-all'
    : isMaximized
      ? 'fixed inset-4 sm:inset-10 z-50 rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col transition-all overflow-hidden'
      : 'fixed bottom-6 right-6 z-50 w-full sm:w-[460px] md:w-[500px] h-[640px] max-h-[85vh] rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col transition-all overflow-hidden';

  return (
    <div className={containerClasses} role="dialog" aria-label="ReFrameX AI Copilot">
      {/* Header with soft enterprise gradient (no dark/black background) */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-indigo-700/60 bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-600 px-4 text-white shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-white shadow-inner backdrop-blur-xs">
            <Sparkles size={16} className="text-amber-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-sans text-xs font-bold tracking-tight text-white truncate">
                ReFrameX AI Copilot
              </span>
              <span className="rounded-full bg-emerald-500/25 border border-emerald-300/40 px-1.5 py-0.2 font-mono text-[9px] font-bold text-emerald-200">
                ● Live
              </span>
            </div>
            <p className="font-mono text-[10px] text-indigo-100/90 truncate">
              {scopeMode === 'portfolio' ? 'Enterprise Portfolio' : (activeApp?.name || 'Application')} · <span className="text-amber-200 font-semibold">{pageMeta.label}</span>
            </p>
          </div>
        </div>

        {/* Header Action Icons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors ${showConfig ? 'bg-white/15 text-white' : ''}`}
            title="Model & Key Settings"
          >
            <Settings2 size={15} />
          </button>
          <button
            onClick={handleExportTranscript}
            disabled={currentMessages.length === 0}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
            title="Export conversation as Markdown"
          >
            <Download size={15} />
          </button>
          <button
            onClick={handleClearSession}
            disabled={currentMessages.length === 0}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
            title="Clear current view conversation"
          >
            <Trash2 size={15} />
          </button>
          <button
            onClick={() => setIsDocked(!isDocked)}
            className="hidden sm:inline-flex p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            title={isDocked ? 'Undock to floating' : 'Dock to side pane'}
          >
            {isDocked ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
          </button>
          {!isDocked && (
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="hidden sm:inline-flex p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              title={isMaximized ? 'Restore size' : 'Maximize window'}
            >
              {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
            title="Close (Ctrl+J)"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Model & Key Configuration Bar (Collapsible) */}
      {showConfig && (
        <div className="border-b border-indigo-100 bg-indigo-50/70 p-3.5 text-xs space-y-2.5 transition-all animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-indigo-950 flex items-center gap-1.5">
              <Cpu size={13} className="text-indigo-600" /> AI Engine Configuration
            </span>
            {testStatus && (
              <span className="font-mono text-[10px] text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                {testStatus}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Inference Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
              >
                <option value="llama-3.3-70b-versatile">Enterprise Llama-3.3 70B (High Precision)</option>
                <option value="llama-3.1-8b-instant">Enterprise Llama-3.1 8B (Fast)</option>
                <option value="mixtral-8x7b-32768">Enterprise Mixtral 8x7B (Long Context)</option>
                <option value="offline">ReFrameX Neural Engine (Local / Offline)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                LLM API Key (Optional)
              </label>
              <div className="flex gap-1.5">
                <input
                  type="password"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder="gsk_..."
                  className="flex-1 h-8 rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-xs text-slate-800 outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleSaveKey}
                  className="h-8 px-2.5 rounded-lg bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 transition-colors shadow-2xs"
                >
                  {keySavedToast ? <Check size={13} /> : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={handleTestKey}
                  className="h-8 px-2 rounded-lg border border-indigo-200 bg-white text-indigo-700 font-semibold text-xs hover:bg-indigo-50 transition-colors"
                  title="Test inference latency"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-500">
            If no API key is set, ReFrameX seamlessly utilizes the built-in Autonomous Migration Engine with 100% offline safety and full DB grounding.
          </p>
        </div>
      )}

      {/* Active Scope & Application Selector */}
      <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-50/90 px-3.5 py-1.5 text-[11px]">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px] shrink-0">Scope:</span>
          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-bold ${pageMeta.badgeBg} ${pageMeta.badgeText} border text-[10px] shrink-0`}>
            {pageMeta.shortLabel}
          </span>
          {/* Interactive Application Dropdown Selector */}
          <div className="relative min-w-0 flex-1 max-w-[210px]">
            <select
              value={scopeMode === 'portfolio' ? 'portfolio' : (activeApp?.id || '')}
              onChange={(e) => handleSwitchAppScope(e.target.value)}
              className="w-full appearance-none rounded-lg border border-slate-200 bg-white pl-2 pr-6 py-0.5 font-sans text-xs font-semibold text-slate-800 outline-none hover:border-indigo-400 focus:border-indigo-600 transition-colors cursor-pointer truncate shadow-2xs"
              title="Change active application or switch to Portfolio"
            >
              <option value="portfolio">🌐 Portfolio (All Apps)</option>
              {allApps.map((a) => (
                <option key={a.id} value={a.id}>
                  📦 {a.name} ({a.assessment_status || 'Draft'})
                </option>
              ))}
            </select>
            <ChevronDown size={11} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-[10px] text-slate-400">
            Thread #{currentMessages.length}
          </span>
        </div>
      </div>

      {/* Message Thread Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
        {currentMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-600/20">
              <Bot size={28} />
            </div>
            <div>
              <h3 className="font-sans text-sm font-bold text-slate-900">
                ReFrameX AI Copilot for {scopeMode === 'portfolio' ? 'Enterprise Portfolio' : (activeApp?.name || pageMeta.shortLabel)}
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm leading-relaxed">
                {scopeMode === 'portfolio'
                  ? `I am loaded with the global portfolio context covering ${allApps.length} applications. Ask any question about portfolio-wide modernizability, risk hotspots, or migration wave sequencing.`
                  : `I am loaded with the live context for ${activeApp?.name || 'the active application'} in the ${pageMeta.label}. Ask any question about AST complexity, code refactoring, risk mitigation, or cloud target architecture.`
                }
              </p>
            </div>

            {/* Quick Prompts for Current Page */}
            <div className="w-full max-w-md space-y-1.5 pt-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 text-left px-1">
                Suggested questions for {pageMeta.shortLabel}:
              </div>
              {pageMeta.prompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(p)}
                  className="w-full text-left flex items-center justify-between rounded-xl border border-slate-200/90 bg-white p-2.5 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-950 transition-all shadow-2xs group"
                >
                  <span className="truncate pr-2">{p}</span>
                  <ArrowRight size={13} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {currentMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white shadow-2xs mt-0.5">
                    <Sparkles size={13} className="text-amber-300" />
                  </div>
                )}

                <div
                  className={`relative max-w-[88%] rounded-2xl p-3.5 text-xs transition-all ${msg.role === 'user'
                      ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm'
                      : 'border border-slate-200/90 bg-white text-slate-800 shadow-2xs'
                    }`}
                >
                  {msg.role === 'assistant' ? (
                    <>
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2 font-mono text-[10px] text-slate-400">
                        <span className="font-semibold text-indigo-600 flex items-center gap-1">
                          <Bot size={11} /> {msg.model || 'ReFrameX AI Copilot'}
                        </span>
                        <div className="flex items-center gap-2">
                          {msg.latency_ms && (
                            <span>{msg.latency_ms}ms</span>
                          )}
                          <span>{msg.timestamp}</span>
                        </div>
                      </div>
                      <MarkdownContent content={msg.content} />
                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-400 font-mono">
                        <div className="flex items-center gap-1.5">
                          {msg.citations?.map((c, i) => (
                            <span key={i} className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] text-slate-600 font-medium">
                              {c}
                            </span>
                          ))}
                        </div>
                        <CopyButton text={msg.content} />
                      </div>
                    </>
                  ) : (
                    <div className="font-sans leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white font-mono text-[10px] font-bold shadow-2xs mt-0.5">
                    EA
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 justify-start animate-in fade-in">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white shadow-2xs">
                  <Sparkles size={13} className="text-amber-300 animate-spin" />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs text-xs text-slate-600 flex items-center gap-2.5">
                  <span className="flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
                  </span>
                  <span className="font-medium text-slate-700">
                    Analyzing {pageMeta.shortLabel} context & AST metrics...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Suggested Quick Prompt Chips (when conversation exists) */}
      {currentMessages.length > 0 && !loading && (
        <div className="border-t border-slate-100 bg-white px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">Quick:</span>
          {pageMeta.prompts.slice(0, 3).map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(p)}
              className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-900 transition-colors truncate max-w-[200px]"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-slate-200 bg-white p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-end gap-2"
        >
          <div className="relative flex-1 rounded-xl border border-slate-200 bg-white shadow-2xs focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100/70 transition-all">
            <textarea
              ref={inputRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`Ask AI about ${scopeMode === 'portfolio' ? 'Portfolio' : (activeApp?.name || 'app')} ${pageMeta.shortLabel}...`}
              className="w-full resize-none border-0 bg-transparent p-2.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 selection:bg-indigo-100 selection:text-indigo-900"
              style={{ outline: 'none', boxShadow: 'none' }}
            />
            <div className="flex items-center justify-between px-2.5 pb-1.5 font-mono text-[10px] text-slate-400">
              <span>Enter to send · Shift+Enter newline</span>
              <span className="text-indigo-600 font-bold">
                {scopeMode === 'portfolio' ? 'Portfolio' : (activeApp?.name || 'App')} · {pageMeta.shortLabel} Active
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm shadow-indigo-600/30 hover:from-indigo-700 hover:to-blue-700 active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
            title="Send message"
            aria-label="Send message"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-700 transition-colors"
      title="Copy answer"
    >
      {copied ? <CheckCheck size={12} className="text-emerald-600" /> : <Copy size={12} />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}
