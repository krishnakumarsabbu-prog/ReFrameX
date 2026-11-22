import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sliders,
  Filter,
  Code2,
  FileText,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { api, RuleAuditItem, RuleAuditResponse } from '../api/client';

interface RuleAuditModalProps {
  appId: string;
  appName: string;
  onClose: () => void;
}

export default function RuleAuditModal({ appId, appName, onClose }: RuleAuditModalProps) {
  const [data, setData] = useState<RuleAuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'fired' | 'evaluated_not_fired' | 'inapplicable'>('all');
  const [measureFilter, setMeasureFilter] = useState<'all' | 'complexity' | 'confidence' | 'readiness'>('all');
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchAudit = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getRuleAudit(appId);
        if (active) {
          setData(res);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to fetch rule audit');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    fetchAudit();
    return () => { active = false; };
  }, [appId]);

  const filteredRules = useMemo(() => {
    if (!data) return [];
    return data.rules.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (measureFilter !== 'all' && r.measure !== measureFilter) return false;
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesId = r.rule_id.toLowerCase().includes(query);
        const matchesDesc = r.description.toLowerCase().includes(query);
        const matchesCond = r.detection_condition.toLowerCase().includes(query);
        const matchesDomain = r.domain.toLowerCase().includes(query);
        const matchesReason = r.reason.toLowerCase().includes(query);
        return matchesId || matchesDesc || matchesCond || matchesDomain || matchesReason;
      }
      return true;
    });
  }, [data, statusFilter, measureFilter, searchTerm]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-[#E3E5E7] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E3E5E7] px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                Rule Explainability Trace
              </span>
              <span className="text-xs text-[#777D83]">Ruleset {data?.ruleset_version ?? 'v2.1'}</span>
            </div>
            <h2 className="mt-1 text-lg font-bold text-[#202124]">
              Assessment Rule Audit: {appName}
            </h2>
            <p className="text-xs text-[#777D83]">
              Trace why each rule fired, was evaluated but did not fire, or was marked inapplicable.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#777D83] transition-colors hover:bg-[#F1F2F3] hover:text-[#202124]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Stats strip */}
        {data && (
          <div className="grid grid-cols-4 gap-3 border-b border-[#E3E5E7] bg-[#F9FAFB] px-6 py-3">
            <div className="flex flex-col">
              <span className="text-[11px] font-medium text-[#777D83]">Total Rules</span>
              <span className="text-base font-bold text-[#202124]">{data.total_rules}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-medium text-emerald-700">Fired</span>
              <span className="text-base font-bold text-emerald-700">{data.fired_rules_count}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-medium text-amber-700">Did Not Fire</span>
              <span className="text-base font-bold text-amber-700">
                {data.applicable_rules_count - data.fired_rules_count}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-medium text-slate-600">Inapplicable</span>
              <span className="text-base font-bold text-slate-700">{data.inapplicable_rules_count}</span>
            </div>
          </div>
        )}

        {/* Filters and search bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E3E5E7] px-6 py-3">
          <div className="flex items-center gap-2">
            {/* Status tabs */}
            <div className="inline-flex rounded-xl bg-[#F1F2F3] p-1 text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                  statusFilter === 'all' ? 'bg-white text-[#202124] shadow-xs' : 'text-[#777D83] hover:text-[#202124]'
                }`}
              >
                All ({data?.total_rules ?? 0})
              </button>
              <button
                onClick={() => setStatusFilter('fired')}
                className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                  statusFilter === 'fired' ? 'bg-emerald-600 text-white shadow-xs' : 'text-[#777D83] hover:text-[#202124]'
                }`}
              >
                Fired ({data?.fired_rules_count ?? 0})
              </button>
              <button
                onClick={() => setStatusFilter('evaluated_not_fired')}
                className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                  statusFilter === 'evaluated_not_fired' ? 'bg-amber-600 text-white shadow-xs' : 'text-[#777D83] hover:text-[#202124]'
                }`}
              >
                Not Fired ({(data?.applicable_rules_count ?? 0) - (data?.fired_rules_count ?? 0)})
              </button>
              <button
                onClick={() => setStatusFilter('inapplicable')}
                className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                  statusFilter === 'inapplicable' ? 'bg-slate-700 text-white shadow-xs' : 'text-[#777D83] hover:text-[#202124]'
                }`}
              >
                Inapplicable ({data?.inapplicable_rules_count ?? 0})
              </button>
            </div>

            {/* Measure filter */}
            <select
              value={measureFilter}
              onChange={(e) => setMeasureFilter(e.target.value as any)}
              className="h-8 rounded-lg border border-[#E3E5E7] bg-white px-2.5 text-xs font-medium text-[#202124] outline-none"
            >
              <option value="all">All Measures</option>
              <option value="complexity">Complexity</option>
              <option value="confidence">Confidence</option>
              <option value="readiness">Readiness</option>
            </select>
          </div>

          {/* Search box */}
          <div className="relative w-64">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#777D83]" />
            <input
              type="text"
              placeholder="Search rule ID, condition..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 w-full rounded-lg border border-[#E3E5E7] bg-white pl-8 pr-3 text-xs outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 size={32} className="animate-spin text-indigo-600" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
              <AlertTriangle size={16} className="mb-1 inline" /> {error}
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center text-[#777D83]">
              <Filter size={32} className="mb-2 opacity-50" />
              <p className="text-sm font-medium">No rules match the current filter</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRules.map((rule) => {
                const isExpanded = expandedRule === rule.rule_id;
                const statusBadge =
                  rule.status === 'fired' ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 size={12} /> Fired ({rule.firings_count})
                    </span>
                  ) : rule.status === 'evaluated_not_fired' ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      <XCircle size={12} /> Did Not Fire
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      <HelpCircle size={12} /> Inapplicable
                    </span>
                  );

                return (
                  <div
                    key={rule.rule_id}
                    className="rounded-xl border border-[#E3E5E7] bg-white p-4 transition-all hover:border-[#D1D5DB] hover:shadow-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#202124]">
                          {rule.rule_id}
                        </span>
                        <span className="rounded bg-[#F1F2F3] px-2 py-0.5 text-[10px] font-medium text-[#4B5563]">
                          {rule.measure}
                        </span>
                        <span className="rounded bg-[#F1F2F3] px-2 py-0.5 text-[10px] font-medium text-[#4B5563]">
                          {rule.domain}
                        </span>
                        <span className="rounded bg-[#F1F2F3] px-2 py-0.5 text-[10px] font-medium text-[#4B5563]">
                          Weight: {rule.weight}
                        </span>
                      </div>
                      <div>{statusBadge}</div>
                    </div>

                    <p className="mt-2 text-xs font-medium text-[#202124]">{rule.description}</p>

                    {/* Explainability reason */}
                    <div className={`mt-2.5 rounded-lg border p-2.5 text-xs ${
                      rule.status === 'fired'
                        ? 'border-emerald-200 bg-emerald-50/50 text-emerald-950'
                        : rule.status === 'evaluated_not_fired'
                        ? 'border-amber-200 bg-amber-50/40 text-amber-950'
                        : 'border-slate-200 bg-slate-50/50 text-slate-800'
                    }`}>
                      <div className="font-semibold text-[11px] uppercase tracking-wider opacity-75 mb-0.5">
                        Audit Reason:
                      </div>
                      <div>{rule.reason}</div>
                    </div>

                    {/* Condition toggler */}
                    <div className="mt-3 flex items-center justify-between border-t border-[#F1F2F3] pt-2.5">
                      <div className="flex items-center gap-2">
                        <Code2 size={13} className="text-[#777D83]" />
                        <code className="text-[11px] font-mono text-[#4B5563] truncate max-w-lg">
                          {rule.detection_condition}
                        </code>
                      </div>
                      <button
                        onClick={() => setExpandedRule(isExpanded ? null : rule.rule_id)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        {isExpanded ? 'Hide Details' : 'View Clauses'}
                      </button>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-3 rounded-lg border border-[#E3E5E7] bg-[#F9FAFB] p-3 text-xs">
                        <div className="mb-2 font-semibold text-[#202124]">Sub-Clause Evaluations:</div>
                        <div className="space-y-1.5 font-mono text-[11px]">
                          {rule.clause_evaluations.map((c, i) => (
                            <div key={i} className="flex items-center gap-2">
                              {c.passed ? (
                                <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                              ) : (
                                <XCircle size={12} className="text-amber-600 shrink-0" />
                              )}
                              <span className={c.passed ? 'text-[#202124]' : 'text-[#777D83]'}>
                                {c.clause}
                              </span>
                            </div>
                          ))}
                        </div>

                        {rule.evidence_snippets.length > 0 && (
                          <div className="mt-3 border-t border-[#E3E5E7] pt-2">
                            <div className="mb-1 font-semibold text-[#202124]">Evidence Snippets:</div>
                            <div className="space-y-1 font-mono text-[10px] text-[#4B5563]">
                              {rule.evidence_snippets.map((snip, idx) => (
                                <div key={idx} className="rounded bg-white p-1.5 border border-[#E3E5E7]">
                                  {snip}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#E3E5E7] px-6 py-3 text-xs text-[#777D83]">
          <span>
            Showing {filteredRules.length} of {data?.total_rules ?? 0} rules
          </span>
          <button
            onClick={onClose}
            className="rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] px-4 py-2 font-semibold text-[#202124] hover:bg-[#E3E5E7]"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
}
