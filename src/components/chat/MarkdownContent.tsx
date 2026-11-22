import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Info, AlertTriangle, Lightbulb, ShieldAlert, FileCode } from 'lucide-react';
import MermaidDiagram from './MermaidDiagram';

interface MarkdownContentProps {
  content: string;
}

export default function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="prose-chat text-xs leading-relaxed text-slate-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Code blocks & inline code
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match && !String(children).includes('\n');
            const codeText = String(children).replace(/\n$/, '');

            if (isInline) {
              return (
                <code
                  className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-indigo-700 border border-slate-200"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            const language = match ? match[1].toLowerCase() : 'code';
            const trimmedCode = codeText.trim();
            const looksLikeMermaid =
              language === 'mermaid' ||
              language === 'diagram' ||
              /^(?:graph\s+(?:TD|TB|BT|RL|LR)|flowchart\s+(?:TD|TB|BT|RL|LR)|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline)/i.test(trimmedCode);

            if (looksLikeMermaid) {
              return <MermaidDiagram code={trimmedCode} />;
            }

            return <CodeBlock language={language} code={codeText} />;
          },

          // GFM Tables
          table({ children }) {
            return (
              <div className="my-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return (
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                {children}
              </thead>
            );
          },
          th({ children }) {
            return <th className="px-3.5 py-2 font-semibold text-slate-800">{children}</th>;
          },
          td({ children }) {
            return (
              <td className="px-3.5 py-2 border-t border-slate-100 text-slate-700 text-xs">
                {children}
              </td>
            );
          },
          tr({ children }) {
            return (
              <tr className="hover:bg-slate-50/70 transition-colors even:bg-slate-50/30">
                {children}
              </tr>
            );
          },

          // Headings
          h1({ children }) {
            return <h1 className="mt-4 mb-2 text-base font-bold text-slate-900 border-b border-slate-100 pb-1">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="mt-3.5 mb-1.5 text-sm font-bold text-slate-900">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="mt-3 mb-1 text-xs font-bold uppercase tracking-wider text-indigo-900">{children}</h3>;
          },
          h4({ children }) {
            return <h4 className="mt-2.5 mb-1 text-xs font-semibold text-slate-800">{children}</h4>;
          },

          // Blockquotes / Callout Alerts
          blockquote({ children }) {
            return <CalloutBlock>{children}</CalloutBlock>;
          },

          // Paragraphs with inline evidence badge recognition
          p({ children }) {
            return <p className="mb-2.5 last:mb-0 leading-relaxed">{renderWithBadges(children)}</p>;
          },

          // Lists
          ul({ children }) {
            return <ul className="mb-2.5 space-y-1 pl-4 list-disc marker:text-indigo-500">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="mb-2.5 space-y-1 pl-4 list-decimal marker:text-indigo-600 font-medium">{children}</ol>;
          },
          li({ children }) {
            return <li className="pl-1 leading-relaxed text-slate-700">{children}</li>;
          },

          // Links
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-indigo-600 hover:text-indigo-800 underline underline-offset-2 transition-colors"
              >
                {children}
              </a>
            );
          },

          hr() {
            return <hr className="my-3 border-slate-200" />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-slate-800 shadow-2xs">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100/90 px-3.5 py-1.5 text-[11px] font-mono text-slate-600">
        <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-indigo-700">
          <FileCode size={13} /> {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
          title="Copy code"
        >
          {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-[11px] leading-relaxed text-slate-800 bg-slate-50">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function CalloutBlock({ children }: { children: React.ReactNode }) {
  // Convert children to text to inspect alert type
  const text = extractText(children);
  const isWarning = text.includes('[!WARNING]') || text.includes('[!CAUTION]');
  const isTip = text.includes('[!TIP]');
  const isImportant = text.includes('[!IMPORTANT]');

  let style = 'border-blue-400 bg-blue-50/60 text-blue-950';
  let icon = <Info size={15} className="text-blue-600 shrink-0 mt-0.5" />;
  let title = 'Note';

  if (isWarning) {
    style = 'border-amber-400 bg-amber-50/70 text-amber-950';
    icon = <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />;
    title = 'Warning';
  } else if (isTip) {
    style = 'border-emerald-400 bg-emerald-50/70 text-emerald-950';
    icon = <Lightbulb size={15} className="text-emerald-600 shrink-0 mt-0.5" />;
    title = 'Tip';
  } else if (isImportant) {
    style = 'border-rose-400 bg-rose-50/70 text-rose-950';
    icon = <ShieldAlert size={15} className="text-rose-600 shrink-0 mt-0.5" />;
    title = 'Important';
  }

  return (
    <div className={`my-3 flex items-start gap-2.5 rounded-xl border-l-4 p-3 shadow-2xs ${style}`}>
      {icon}
      <div className="flex-1 text-xs leading-relaxed">
        <span className="font-bold mr-1.5 uppercase tracking-wide text-[10px]">{title}:</span>
        {children}
      </div>
    </div>
  );
}

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (React.isValidElement(node) && node.props && (node.props as any).children) {
    return extractText((node.props as any).children);
  }
  return '';
}

function renderWithBadges(children: React.ReactNode): React.ReactNode {
  if (typeof children !== 'string') return children;

  const parts = children.split(/(\[(?:Evidence-based|Inferred|Assumed|Unknown|Green|Amber|Red|High|Medium|Low)\])/g);
  if (parts.length === 1) return children;

  return parts.map((part, i) => {
    switch (part) {
      case '[Evidence-based]':
      case '[Green]':
        return (
          <span key={i} className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.2 font-mono text-[10px] font-bold text-emerald-800 mx-1">
            Evidence-based
          </span>
        );
      case '[Inferred]':
        return (
          <span key={i} className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.2 font-mono text-[10px] font-bold text-blue-800 mx-1">
            Inferred
          </span>
        );
      case '[Assumed]':
      case '[Amber]':
        return (
          <span key={i} className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.2 font-mono text-[10px] font-bold text-amber-800 mx-1">
            Assumed
          </span>
        );
      case '[Unknown]':
      case '[Red]':
        return (
          <span key={i} className="inline-flex items-center rounded-md border border-purple-200 bg-purple-50 px-1.5 py-0.2 font-mono text-[10px] font-bold text-purple-800 mx-1">
            Unknown
          </span>
        );
      default:
        return part;
    }
  });
}
