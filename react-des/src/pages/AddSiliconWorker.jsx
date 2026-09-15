import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { availableSkills as mockAvailableSkills } from '../data/mockSkills';
import { API_BASE } from '../config/api';
import { loadKnowledgeBases } from '../utils/knowledgeBaseStorage';

const MODEL_STORAGE_KEY = 'des-model-configurations';
const CHAT_HISTORY_INDEX_KEY = 'des-chat-history-index';
const WORKFLOW_STORAGE_KEY = 'des-workflows';
const INITIAL_WORKFLOWS = [{
  id: 'workflow-demo-1',
  name: '短视频分镜脚本生成',
  description: '根据主题生成短视频分镜、台词和拍摄建议。',
  status: 'published',
}];

const loadWorkflows = () => {
  try {
    const stored = window.localStorage.getItem(WORKFLOW_STORAGE_KEY);
    return stored ? JSON.parse(stored) : INITIAL_WORKFLOWS;
  } catch {
    return INITIAL_WORKFLOWS;
  }
};

const clearStaleChatHistoryForEmployee = (employeeId) => {
  if (typeof window === 'undefined' || employeeId === null || employeeId === undefined) return;

  try {
    const raw = window.localStorage.getItem(CHAT_HISTORY_INDEX_KEY);
    const entries = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(entries)) return;

    const nextEntries = entries.filter((entry) => (
      entry?.type !== 'member' || String(entry.activeMember || '') !== String(employeeId)
    ));
    window.localStorage.setItem(CHAT_HISTORY_INDEX_KEY, JSON.stringify(nextEntries));
  } catch (error) {
    console.error('Failed to clear stale employee chat history:', error);
  }
};

const loadConfiguredModels = () => [];

// --- Icons (SVG Components) ---
const Icons = {
  Brain: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  ),
  Search: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  Globe: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  Edit: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  Plus: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  ChevronDown: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m6 9 6 6 6-6"/>
    </svg>
  ),
  Lightning: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>
  ),
  MessageSquare: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  ),
  Check: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  ),
  Trash: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  ),
  Sparkles: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M19 3v4" />
      <path d="M21 5h-4" />
      <path d="M5 16v3" />
      <path d="M6.5 17.5h-3" />
    </svg>
  ),
};

const KNOWLEDGE_DOCUMENT_STATUS_META = {
  processed: {
    label: 'Processed',
    badgeClass: 'border border-emerald-100 bg-emerald-50 text-emerald-700',
    helperText: 'Ready for employee retrieval.',
  },
  processing: {
    label: 'Processing',
    badgeClass: 'border border-amber-100 bg-amber-50 text-amber-700',
    helperText: 'Processing is still running. This document cannot be assigned yet.',
  },
  pending: {
    label: 'Pending',
    badgeClass: 'border border-slate-200 bg-slate-100 text-slate-600',
    helperText: 'Queued for processing. This document cannot be assigned yet.',
  },
  failed: {
    label: 'Failed',
    badgeClass: 'border border-rose-100 bg-rose-50 text-rose-700',
    helperText: 'Processing failed. Please fix the document before assigning it.',
  },
  unavailable: {
    label: 'Unavailable',
    badgeClass: 'border border-gray-200 bg-gray-100 text-gray-600',
    helperText: 'This document is no longer available in the current catalog.',
  },
};

const getKnowledgeDocumentStatusMeta = (status) => {
  return KNOWLEDGE_DOCUMENT_STATUS_META[status] || KNOWLEDGE_DOCUMENT_STATUS_META.unavailable;
};

const getInitials = (value = '') => {
  const initials = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return initials || 'KB';
};

const getAvatarInitial = (value = '') => {
  const normalized = String(value || '').trim();
  return normalized ? normalized.slice(0, 1).toUpperCase() : 'S';
};

const DEFAULT_AVATAR_OPTIONS = [
  '/Pic/2.JPG',
  '/Pic/3.JPG',
  '/Pic/4.JPG',
  '/Pic/5.JPG',
  '/Pic/6.jpg',
  '/Pic/7.jpg',
];

const DEFAULT_CORE_SKILLS = Object.freeze({
  search: false,
  browser: false,
});

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeCoreSkillPreferences = (value = {}) => ({
  search: Boolean(value?.search),
  browser: Boolean(value?.browser),
});

const extractCoreSkillsFromActionGuide = (actionGuide) => {
  if (!isPlainObject(actionGuide)) {
    return { ...DEFAULT_CORE_SKILLS };
  }

  const preferences = isPlainObject(actionGuide.preferences) ? actionGuide.preferences : {};
  const coreSkills = isPlainObject(preferences.core_skills) ? preferences.core_skills : {};

  return normalizeCoreSkillPreferences({
    search: preferences.search_enabled ?? coreSkills.search,
    browser: preferences.browser_enabled ?? coreSkills.browser,
  });
};

const extractSubAgentIdsFromActionGuide = (actionGuide) => {
  if (!isPlainObject(actionGuide) || !isPlainObject(actionGuide.preferences)) return [];
  return Array.isArray(actionGuide.preferences.sub_agent_ids)
    ? actionGuide.preferences.sub_agent_ids.map((id) => String(id)).filter(Boolean)
    : [];
};

const mergeActionGuideWithCoreSkills = (actionGuide, coreSkills, subAgentIds = []) => {
  const normalizedCoreSkills = normalizeCoreSkillPreferences(coreSkills);
  const nextPreferences = {
    search_enabled: normalizedCoreSkills.search,
    browser_enabled: normalizedCoreSkills.browser,
    core_skills: normalizedCoreSkills,
    sub_agent_ids: subAgentIds,
  };

  if (isPlainObject(actionGuide)) {
    const existingPreferences = isPlainObject(actionGuide.preferences) ? actionGuide.preferences : {};
    return {
      ...actionGuide,
      preferences: {
        ...existingPreferences,
        ...nextPreferences,
      },
    };
  }

  return {
    instructions: actionGuide ?? null,
    preferences: nextPreferences,
  };
};

// --- Reusable Components ---

const Toggle = ({ checked, onChange }) => (
  <button 
    type="button"
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}
    onClick={() => onChange(!checked)}
  >
    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
  </button>
);

const SkillCard = ({ icon: Icon, title, description, checked, onChange, colorClass }) => (
  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4 mb-3 hover:shadow-md transition-shadow duration-200">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-white ${colorClass}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div className="flex-1">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-medium text-gray-900 text-sm">{title}</h3>
        <Toggle checked={checked} onChange={onChange} />
      </div>
      <p className="text-xs text-gray-400 leading-relaxed">{description}</p>
    </div>
  </div>
);

const SkillSelectionModal = ({ isOpen, onClose, onSave, initialSelected, skills }) => {
  const getSkillId = (skill) => skill?.skill_key || skill?.id || null;
  const getCapabilityItems = (skill) => {
    if (Array.isArray(skill?.capabilities) && skill.capabilities.length > 0) {
      return skill.capabilities;
    }

    const skillId = getSkillId(skill);
    return skillId
      ? [{ id: skillId, name: skill.name, description: skill.description }]
      : [];
  };
  const [selectedSkillId, setSelectedSkillId] = useState(getSkillId(skills[0]));
  const [enabledCapabilities, setEnabledCapabilities] = useState(initialSelected || {});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEnabledCapabilities(initialSelected || {});
    }
  }, [isOpen, initialSelected]);

  useEffect(() => {
    if (!selectedSkillId && skills.length > 0) {
      setSelectedSkillId(getSkillId(skills[0]));
      return;
    }

    if (selectedSkillId && !skills.some((skill) => getSkillId(skill) === selectedSkillId) && skills.length > 0) {
      setSelectedSkillId(getSkillId(skills[0]));
    }
  }, [skills, selectedSkillId]);

  if (!isOpen) return null;

  const visibleSkills = skills.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const selectedSkill = skills.find(s => getSkillId(s) === selectedSkillId);
  const selectedCapabilityItems = selectedSkill ? getCapabilityItems(selectedSkill) : [];
  
  const toggleCapability = (capabilityId) => {
    setEnabledCapabilities(prev => ({
      ...prev,
      [capabilityId]: !prev[capabilityId]
    }));
  };

  const toggleSkill = (skill, checked) => {
    const capabilityItems = getCapabilityItems(skill);
    setEnabledCapabilities((previous) => {
      const next = { ...previous };
      capabilityItems.forEach((capability) => {
        next[capability.id] = checked;
      });
      return next;
    });
  };

  const isSkillSelected = (skill) => {
    const capabilityItems = getCapabilityItems(skill);
    return capabilityItems.length > 0 && capabilityItems.every((capability) => Boolean(enabledCapabilities[capability.id]));
  };

  const selectedSkillCount = skills.filter((skill) => isSkillSelected(skill)).length;

  const handleSave = () => {
    onSave(enabledCapabilities);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #d1d5db;
        }
      `}</style>
      <div className="bg-white text-gray-900 rounded-xl shadow-2xl w-[800px] h-[600px] flex flex-col overflow-hidden border border-gray-200 font-sans">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900">Skillsets</h2>
                <span className="text-gray-400 text-xs cursor-help border border-gray-300 rounded-full w-4 h-4 flex items-center justify-center">?</span>
            </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
            {/* Left Sidebar - List */}
            <div className="w-[300px] border-r border-gray-200 flex flex-col bg-gray-50">
                <div className="p-3 border-b border-gray-200">
                    <div className="relative">
                        <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Search" 
                            className="w-full bg-white text-sm text-gray-900 pl-9 pr-3 py-1.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder-gray-400"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {visibleSkills.map(skill => (
                        (() => {
                          const skillId = getSkillId(skill);
                          const isActive = selectedSkillId === skillId;
                          const isChecked = isSkillSelected(skill);

                          return (
                        <div 
                        key={skillId}
                        onClick={() => setSelectedSkillId(skillId)}
                        className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-white hover:shadow-sm transition-all ${isActive ? 'shadow-sm border-l-4 border-l-blue-600' : 'border-l-4 border-l-transparent'} ${isChecked ? 'bg-blue-50/60' : 'bg-transparent'}`}
                        >
                        <input
                            type="checkbox"
                            checked={isChecked}
                          onChange={(event) => toggleSkill(skill, event.target.checked)}
                            onClick={(event) => event.stopPropagation()}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden ${isActive || isChecked ? 'bg-blue-50 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>
                                <div className="text-xs font-bold">{skill.name.substring(0, 2)}</div>
                            </div>
                            <div className="overflow-hidden">
                          <div className={`text-sm font-medium truncate ${isActive || isChecked ? 'text-blue-600' : 'text-gray-900'}`}>{skill.name}</div>
                                <div className="text-xs text-gray-500 truncate">{skill.description}</div>
                            </div>
                        </div>
                          );
                        })()
                    ))}
                </div>
            </div>

            {/* Right Content - Details */}
            <div className="flex-1 flex flex-col bg-white">
                {selectedSkill ? (
                    <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                                <div className="text-sm font-bold">{selectedSkill.name.substring(0, 2)}</div>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">{selectedSkill.name}</h3>
                            </div>
                        </div>
                        
                        <p className="text-gray-600 text-sm mb-8 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">
                            {selectedSkill.description}
                        </p>

                        <div className="space-y-4">
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Capabilities</h4>
                          {selectedCapabilityItems.map(cap => (
                                <div key={cap.id} className="flex items-start gap-4 group p-3 rounded-xl border border-gray-100 hover:border-blue-100 hover:bg-blue-50/30 transition-all">
                                    <div className="mt-1 p-2 bg-white rounded-lg text-gray-400 shadow-sm group-hover:text-blue-500 transition-colors">
                                        <Icons.Edit className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-gray-900">{cap.name}</span>
                                            <button
                                              type="button"
                                              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${enabledCapabilities[cap.id] ? 'bg-blue-600' : 'bg-gray-200'}`}
                                              onClick={() => toggleCapability(cap.id)}
                                            >
                                              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabledCapabilities[cap.id] ? 'translate-x-4' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-500 leading-relaxed">{cap.description}</p>
                                    </div>
                                </div>
                            ))}
                          {selectedCapabilityItems.length === 0 && (
                                <div className="text-gray-400 text-sm italic flex flex-col items-center justify-center h-32 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                    <span>No tools listed for this skill.</span>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400 bg-gray-50/50">
                        <div className="text-center">
                            <Icons.Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p>Select a skill to view details</p>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
            <div />
            <div className="flex gap-3">
                <div className="self-center text-sm text-gray-500">
                  {selectedSkillCount} skills selected
                </div>
                <button 
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 rounded-lg transition-colors font-medium"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleSave}
                    className="px-6 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium shadow-sm shadow-blue-200"
                >
                    Confirm Selection
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

const KnowledgeSelectionModal = ({ isOpen, onClose, onSave, initialSelected, knowledgeBases }) => {
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState(knowledgeBases[0]?.id || null);
  const [selectedKnowledgeBaseIds, setSelectedKnowledgeBaseIds] = useState(initialSelected || {});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedKnowledgeBaseIds(initialSelected || {});
      setSearchQuery('');
    }
  }, [isOpen, initialSelected]);

  useEffect(() => {
    if (!selectedKnowledgeBaseId && knowledgeBases.length > 0) {
      setSelectedKnowledgeBaseId(knowledgeBases[0].id);
      return;
    }

    if (selectedKnowledgeBaseId && !knowledgeBases.some((knowledgeBase) => knowledgeBase.id === selectedKnowledgeBaseId) && knowledgeBases.length > 0) {
      setSelectedKnowledgeBaseId(knowledgeBases[0].id);
    }
  }, [knowledgeBases, selectedKnowledgeBaseId]);

  if (!isOpen) return null;

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleKnowledgeBases = knowledgeBases.filter((knowledgeBase) => {
    const availableDocuments = knowledgeBase.documents.filter((document) => document.status === 'processed');
    if (availableDocuments.length === 0) return false;

    if (!normalizedQuery) return true;

    return `${knowledgeBase.name} ${knowledgeBase.description}`.toLowerCase().includes(normalizedQuery);
  });

  const selectedKnowledgeBase = knowledgeBases.find((knowledgeBase) => knowledgeBase.id === selectedKnowledgeBaseId) || visibleKnowledgeBases[0] || null;
  const selectableKnowledgeBases = visibleKnowledgeBases;
  const isAllSelected = selectableKnowledgeBases.length > 0 && selectableKnowledgeBases.every((knowledgeBase) => Boolean(selectedKnowledgeBaseIds[knowledgeBase.id]));

  const toggleKnowledgeBase = (knowledgeBaseId) => {
    setSelectedKnowledgeBaseIds((previous) => ({
      ...previous,
      [knowledgeBaseId]: !previous[knowledgeBaseId],
    }));
  };

  const handleSelectAll = (checked) => {
    const nextSelected = { ...selectedKnowledgeBaseIds };
    selectableKnowledgeBases.forEach((knowledgeBase) => {
      nextSelected[knowledgeBase.id] = checked;
    });
    setSelectedKnowledgeBaseIds(nextSelected);
  };

  const handleSave = () => {
    onSave(selectedKnowledgeBaseIds);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #d1d5db;
        }
      `}</style>
      <div className="bg-white text-gray-900 rounded-xl shadow-2xl w-[920px] h-[640px] flex flex-col overflow-hidden border border-gray-200 font-sans">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">Knowledge Bases</h2>
            <span className="text-gray-400 text-xs border border-gray-300 rounded-full w-4 h-4 flex items-center justify-center" title="Only knowledge bases with processed content can be assigned to a digital employee.">?</span>
          </div>
          <div className="text-xs text-gray-500">Assign one or more knowledge bases to this worker</div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-[300px] border-r border-gray-200 flex flex-col bg-gray-50">
            <div className="p-3 border-b border-gray-200">
              <div className="relative">
                <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search knowledge bases"
                  className="w-full bg-white text-sm text-gray-900 pl-9 pr-3 py-1.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder-gray-400"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {visibleKnowledgeBases.map((knowledgeBase) => {
                const availableDocuments = knowledgeBase.documents.filter((document) => document.status === 'processed');
                const isActive = selectedKnowledgeBase?.id === knowledgeBase.id;
                const isSelected = Boolean(selectedKnowledgeBaseIds[knowledgeBase.id]);

                return (
                  <div
                    key={knowledgeBase.id}
                    onClick={() => setSelectedKnowledgeBaseId(knowledgeBase.id)}
                    className={`p-3 flex items-start gap-3 cursor-pointer hover:bg-white hover:shadow-sm transition-all ${isActive ? 'bg-white shadow-sm border-l-4 border-l-blue-600' : 'border-l-4 border-l-transparent'}`}
                  >
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleKnowledgeBase(knowledgeBase.id);
                      }}
                      className={`mt-1 h-5 w-5 shrink-0 rounded border flex items-center justify-center transition-colors ${isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-transparent'}`}
                      aria-label={`Select ${knowledgeBase.name}`}
                    >
                      <Icons.Check className="w-3 h-3" />
                    </button>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden ${isActive ? 'bg-blue-50 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>
                      <div className="text-xs font-bold">{getInitials(knowledgeBase.name)}</div>
                    </div>
                    <div className="overflow-hidden min-w-0">
                      <div className={`text-sm font-medium truncate ${isActive ? 'text-blue-600' : 'text-gray-900'}`}>{knowledgeBase.name}</div>
                      <div className="text-xs text-gray-500 truncate">{knowledgeBase.description}</div>
                      <div className="mt-1 text-[11px] text-gray-400">{availableDocuments.length} available documents</div>
                    </div>
                  </div>
                );
              })}
              {visibleKnowledgeBases.length === 0 && (
                <div className="h-full flex items-center justify-center px-6 text-center text-sm text-gray-400">
                  No knowledge bases matched your search.
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-white">
            {selectedKnowledgeBase ? (
              <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <div className="text-sm font-bold">{getInitials(selectedKnowledgeBase.name)}</div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{selectedKnowledgeBase.name}</h3>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-sm text-gray-700 leading-6">{selectedKnowledgeBase.description}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 bg-gray-50/50">
                <div className="text-center">
                  <Icons.Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Select a knowledge base to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <label className={`flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-gray-900 transition-colors ${selectableKnowledgeBases.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
            <input
              type="checkbox"
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={isAllSelected}
              onChange={(event) => handleSelectAll(event.target.checked)}
              disabled={selectableKnowledgeBases.length === 0}
            />
            Select all available knowledge bases
          </label>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200/50 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium shadow-sm shadow-blue-200"
            >
              Confirm Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const WorkflowSelectionModal = ({ isOpen, onClose, onSave, initialSelected, workflows }) => {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(initialSelected || null);
  const [activeWorkflowId, setActiveWorkflowId] = useState(initialSelected || workflows[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedWorkflowId(initialSelected || null);
      setActiveWorkflowId(initialSelected || workflows[0]?.id || null);
      setSearchQuery('');
    }
  }, [isOpen, initialSelected, workflows]);

  if (!isOpen) return null;

  const publishedWorkflows = workflows.filter((workflow) => workflow.status === 'published');
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleWorkflows = publishedWorkflows.filter((workflow) => (
    !normalizedQuery || `${workflow.name} ${workflow.description || ''}`.toLowerCase().includes(normalizedQuery)
  ));
  const activeWorkflow = publishedWorkflows.find((workflow) => workflow.id === activeWorkflowId)
    || visibleWorkflows[0]
    || null;

  const handleSave = () => {
    onSave(selectedWorkflowId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="flex h-[600px] w-full max-w-[800px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white font-sans text-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 p-4">
          <div>
            <h2 className="text-base font-semibold">添加工作流</h2>
            <p className="mt-1 text-xs text-gray-500">一个数字员工最多添加一条已发布工作流</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-200 hover:text-gray-900">取消</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex w-[300px] flex-col border-r border-gray-200 bg-gray-50">
            <div className="border-b border-gray-200 p-3">
              <div className="relative">
                <Icons.Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="搜索工作流"
                  className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-9 pr-3 text-sm outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="custom-scrollbar flex-1 overflow-y-auto">
              {visibleWorkflows.map((workflow) => {
                const isSelected = selectedWorkflowId === workflow.id;
                const isActive = activeWorkflow?.id === workflow.id;
                return (
                  <button
                    key={workflow.id}
                    type="button"
                    onClick={() => { setActiveWorkflowId(workflow.id); setSelectedWorkflowId(workflow.id); }}
                    className={`flex w-full items-start gap-3 border-l-4 p-3 text-left transition-all hover:bg-white ${isActive ? 'border-l-blue-600 bg-white shadow-sm' : 'border-l-transparent'} ${isSelected ? 'bg-blue-50/60' : ''}`}
                  >
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-transparent'}`}>
                      <Icons.Check className="h-3 w-3" />
                    </span>
                    <span className="min-w-0">
                      <span className={`block truncate text-sm font-medium ${isActive || isSelected ? 'text-blue-600' : 'text-gray-900'}`}>{workflow.name}</span>
                      <span className="mt-1 block truncate text-xs text-gray-500">{workflow.description || '暂无描述'}</span>
                    </span>
                  </button>
                );
              })}
              {visibleWorkflows.length === 0 && <div className="px-6 py-16 text-center text-sm text-gray-400">暂无已发布工作流</div>}
            </div>
          </div>

          <div className="flex flex-1 flex-col bg-white">
            {activeWorkflow ? (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icons.Lightning className="h-5 w-5" /></div>
                  <div><h3 className="text-lg font-bold">{activeWorkflow.name}</h3><span className="text-xs text-emerald-600">已发布</span></div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm leading-6 text-gray-700">{activeWorkflow.description || '暂无描述'}</div>
              </div>
            ) : <div className="flex flex-1 items-center justify-center text-sm text-gray-400">请选择一个工作流查看详情</div>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 p-4">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 hover:text-gray-900">取消</button>
          <button type="button" onClick={handleSave} disabled={!selectedWorkflowId} className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white shadow-sm shadow-blue-200 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300">确认添加</button>
        </div>
      </div>
    </div>
  );
};

const SubAgentMultiSelect = ({ employees, selectedIds, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const selectedEmployees = employees.filter((employee) => selectedIds.includes(String(employee.id)));
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleEmployees = employees.filter((employee) => (
    !normalizedQuery || `${employee.name} ${employee.role_title || ''} ${employee.description || ''}`.toLowerCase().includes(normalizedQuery)
  ));

  const toggleEmployee = (employeeId) => {
    const id = String(employeeId);
    onChange(selectedIds.includes(id) ? selectedIds.filter((selectedId) => selectedId !== id) : [...selectedIds, id]);
  };

  return (
    <div className="relative">
      <button type="button" onClick={() => setIsOpen((current) => !current)} className="flex min-h-[42px] w-full items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:border-gray-300">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {selectedEmployees.length > 0 ? selectedEmployees.map((employee) => (
            <span key={employee.id} className="inline-flex max-w-full items-center gap-1 rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-xs text-blue-700">
              <span className="max-w-[180px] truncate">{employee.name}</span>
              <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); toggleEmployee(employee.id); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); toggleEmployee(employee.id); } }} className="cursor-pointer text-blue-400 hover:text-blue-700">×</span>
            </span>
          )) : <span className="text-sm text-gray-400">选择子 Agent</span>}
        </div>
        <Icons.ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="border-b border-gray-100 p-2">
              <div className="relative">
                <Icons.Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onClick={(event) => event.stopPropagation()} placeholder="搜索 Agent 名称、角色" className="w-full rounded-md bg-gray-50 py-2 pl-8 pr-2 text-xs text-gray-700 outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {visibleEmployees.map((employee) => {
                const isSelected = selectedIds.includes(String(employee.id));
                return (
                  <button key={employee.id} type="button" onClick={() => toggleEmployee(employee.id)} className={`flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 ${isSelected ? 'bg-blue-50/60' : ''}`}>
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-transparent'}`}><Icons.Check className="h-3 w-3" /></span>
                    <span className="min-w-0"><span className="block truncate text-sm text-gray-800">{employee.name}</span><span className="block truncate text-xs text-gray-400">{employee.role_title || employee.description || '数字员工'}</span></span>
                  </button>
                );
              })}
              {visibleEmployees.length === 0 && <div className="px-4 py-8 text-center text-xs text-gray-400">暂无符合权限范围的 Agent</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const AvatarSelectionModal = ({ isOpen, onClose, onSave, currentAvatar }) => {
  const [selectedAvatar, setSelectedAvatar] = useState(currentAvatar || DEFAULT_AVATAR_OPTIONS[0]);

  useEffect(() => {
    if (isOpen) {
      setSelectedAvatar(currentAvatar || DEFAULT_AVATAR_OPTIONS[0]);
    }
  }, [isOpen, currentAvatar]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[560px] max-w-[92vw] rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Choose a profile image</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            Cancel
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 px-6 py-6 sm:grid-cols-4">
          {DEFAULT_AVATAR_OPTIONS.map((option, index) => {
            const isSelected = selectedAvatar === option;

            return (
              <button
                key={option}
                type="button"
                onClick={() => setSelectedAvatar(option)}
                className={`group overflow-hidden rounded-2xl border-2 bg-gray-50 transition-all ${isSelected ? 'border-blue-600 shadow-lg shadow-blue-100' : 'border-transparent hover:border-gray-300'}`}
                aria-label={`Select avatar ${index + 1}`}
              >
                <div className="aspect-square w-full overflow-hidden bg-gradient-to-br from-blue-50 via-white to-slate-100">
                  <img src={option} alt={`Avatar ${index + 1}`} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(selectedAvatar);
              onClose();
            }}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

const AddSiliconWorker = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const isEditMode = searchParams.get('mode') === 'edit';

  // Form State
  const [name, setName] = useState('Silicon');
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATAR_OPTIONS[0]);
  const [category, setCategory] = useState('HR');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [description, setDescription] = useState('');
  const [employeeDraftRequest, setEmployeeDraftRequest] = useState('');
  const [isGeneratingEmployeeDraft, setIsGeneratingEmployeeDraft] = useState(false);
  const [employeeDraftError, setEmployeeDraftError] = useState('');

  const handleAddTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleGenerateEmployeeDraft = async () => {
    const trimmedRequest = employeeDraftRequest.trim();
    if (trimmedRequest.length < 10) {
      setEmployeeDraftError('Please describe the employee in a bit more detail.');
      return;
    }

    setIsGeneratingEmployeeDraft(true);
    setEmployeeDraftError('');

    try {
      const response = await fetch(`${API_BASE}/ai-employees/generate-draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_description: trimmedRequest,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || `Failed to generate draft: ${response.status} ${response.statusText}`);
      }

      setName(data.name || 'Silicon');
      setCategory(data.role_title || 'HR');
      setDescription(data.description || '');
      setInstruction(data.persona_prompt || '');

      const suggestedTools = Array.isArray(data.tool_ids) ? data.tool_ids : [];
      if (suggestedTools.length > 0) {
        setSelectedExtendedSkills((previous) => {
          const next = { ...previous };
          suggestedTools.forEach((toolId) => {
            next[toolId] = true;
          });
          return next;
        });
      }
    } catch (error) {
      console.error('Failed to generate employee draft:', error);
      setEmployeeDraftError(error.message || 'Failed to generate employee draft.');
    } finally {
      setIsGeneratingEmployeeDraft(false);
    }
  };

  const [mode, setMode] = useState('Auto');
  const [model, setModel] = useState('Auto');
  const [availableModels, setAvailableModels] = useState(() => loadConfiguredModels());
  const [instruction, setInstruction] = useState(`# Role: Role Name
A one-sentence description of the role's overview and main responsibilities.

# Goals:
The role's work goals. If there are multiple goals, list them as bullet points, but it is recommended to focus on 1-2 goals.

# Skills:
1. Skill 1 required to achieve the goal
2. Skill 2 required to achieve the goal
3. Skill 3 required to achieve the goal

# Workflow:
1. Describe the first step of the role's workflow
2. Describe the second step of the role's workflow
3. Describe the third step of the role's workflow

# Output Format:
If there are specific requirements for the role's output format, emphasize them here and provide examples of the desired output format.

# Constraints:
* Describe constraint 1 that the role needs to follow during interaction
* Describe constraint 2 that the role needs to follow during interaction`);

  // Skills State
  const [skills, setSkills] = useState(() => ({ ...DEFAULT_CORE_SKILLS }));
  const [storedActionGuide, setStoredActionGuide] = useState(null);

  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [selectedExtendedSkills, setSelectedExtendedSkills] = useState({});
  const [availableSkills, setAvailableSkills] = useState([]);
  const [isKnowledgeModalOpen, setIsKnowledgeModalOpen] = useState(false);
  const [selectedKnowledgeBases, setSelectedKnowledgeBases] = useState({});
  const [availableKnowledgeBases, setAvailableKnowledgeBases] = useState(() => loadKnowledgeBases());
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);
  const [availableWorkflows, setAvailableWorkflows] = useState(() => loadWorkflows());
  const [selectedSubAgentIds, setSelectedSubAgentIds] = useState([]);
  const [availableSubAgents, setAvailableSubAgents] = useState([]);
  const [originalEmployee, setOriginalEmployee] = useState(null);

  const [longTermMemory, setLongTermMemory] = useState(false);
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);

  const modeOptions = [
    {
      id: 'Auto',
      icon: Icons.Lightning,
      label: 'Auto',
      description: 'Default using core skills and common extended skills(including search, PPT generation, image generation, etc.)'
    },
    {
      id: 'Chat',
      icon: Icons.MessageSquare,
      label: 'Chat',
      description: 'Quick chat mode, default using limited core skills(browser, search)'
    },
    {
      id: 'Custom',
      icon: Icons.Edit,
      label: 'Custom',
      description: 'Custom mode, support controlling core skills and extended skills separately'
    }
  ];

  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [accessScope, setAccessScope] = useState('org');
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [showToast, setShowToast] = useState(false);

  const knowledgeBaseCatalog = useMemo(() => {
    const nextCatalog = new Map();

    availableKnowledgeBases.forEach((knowledgeBase) => {
      const processedDocuments = knowledgeBase.documents.filter((document) => document.status === 'processed');

      if (processedDocuments.length === 0) {
        return;
      }

      nextCatalog.set(knowledgeBase.id, {
        ...knowledgeBase,
        processedDocumentCount: processedDocuments.length,
      });
    });

    return nextCatalog;
  }, [availableKnowledgeBases]);

  const selectedKnowledgeBaseList = useMemo(() => {
    return Object.keys(selectedKnowledgeBases)
      .filter((knowledgeBaseId) => Boolean(selectedKnowledgeBases[knowledgeBaseId]))
      .map((knowledgeBaseId) => {
        const matchedKnowledgeBase = knowledgeBaseCatalog.get(knowledgeBaseId);

        if (matchedKnowledgeBase) return matchedKnowledgeBase;

        return {
          id: knowledgeBaseId,
          name: knowledgeBaseId,
          description: 'This knowledge base is not in the current knowledge catalog, but it remains linked to the employee record.',
          processedDocumentCount: 0,
        };
      });
  }, [knowledgeBaseCatalog, selectedKnowledgeBases]);

  const publishedWorkflowCatalog = useMemo(() => availableWorkflows.filter((workflow) => workflow.status === 'published'), [availableWorkflows]);
  const selectedWorkflow = useMemo(() => (
    publishedWorkflowCatalog.find((workflow) => workflow.id === selectedWorkflowId)
    || availableWorkflows.find((workflow) => workflow.id === selectedWorkflowId)
    || null
  ), [availableWorkflows, publishedWorkflowCatalog, selectedWorkflowId]);

  const subAgentOptions = useMemo(() => availableSubAgents.filter((employee) => (
    String(employee.id) !== String(editId) && employee.status === 'active'
  )), [availableSubAgents, editId]);

  useEffect(() => {
    let isMounted = true;

    const applySkills = (nextSkills) => {
      if (!isMounted) return;
      setAvailableSkills(Array.isArray(nextSkills) ? nextSkills : []);
    };

    fetch(`${API_BASE}/skills/`)
      .then(res => res.json())
      .then(data => {
        const nextSkills = data?.data?.skills;
        if (Array.isArray(nextSkills) && nextSkills.length > 0) {
          applySkills(nextSkills);
          return;
        }

        applySkills(mockAvailableSkills);
      })
      .catch(err => {
        console.error('Failed to load skills:', err);
        applySkills(mockAvailableSkills);
      });

    const syncKnowledgeBases = () => {
      if (!isMounted) return;
      setAvailableKnowledgeBases(loadKnowledgeBases());
    };

    const syncWorkflows = () => {
      if (!isMounted) return;
      setAvailableWorkflows(loadWorkflows());
    };

    window.addEventListener('storage', syncKnowledgeBases);
    window.addEventListener('des:knowledge-bases-updated', syncKnowledgeBases);
    window.addEventListener('storage', syncWorkflows);
    window.addEventListener('des:workflows-updated', syncWorkflows);

    fetch(`${API_BASE}/model-configurations/`)
      .then((response) => response.ok ? response.json() : [])
      .then((items) => {
        if (!isMounted) return;
        setAvailableModels(Array.isArray(items) ? items.map((item) => String(item?.modelName || '').trim()).filter(Boolean) : []);
      })
      .catch((error) => console.error('Failed to load configured models:', error));

    fetch(`${API_BASE}/ai-employees/?limit=200`)
      .then((response) => response.ok ? response.json() : [])
      .then((items) => {
        if (!isMounted) return;
        setAvailableSubAgents(Array.isArray(items) ? items : []);
      })
      .catch((error) => console.error('Failed to load sub-agent candidates:', error));

    if (isEditMode && editId) {
      fetch(`${API_BASE}/ai-employees/${editId}`)
        .then(res => res.json())
        .then(data => {
          setOriginalEmployee(data);
          if (data.name) setName(data.name);
          setAvatarUrl(data.avatar_url || DEFAULT_AVATAR_OPTIONS[0]);
          if (data.role_title) setCategory(data.role_title);
          if (data.model) setModel(data.model);
          setDescription(data.description || '');
          if (data.persona_prompt) setInstruction(data.persona_prompt);
          setAccessScope(data.access_scope || 'org');
          setSelectedTeams(Array.isArray(data.access_teams) ? data.access_teams : []);
          setStoredActionGuide(data.action_guide ?? null);
          setSkills(extractCoreSkillsFromActionGuide(data.action_guide));
          setSelectedSubAgentIds(extractSubAgentIdsFromActionGuide(data.action_guide));

          if (data.tool_ids && Array.isArray(data.tool_ids)) {
            const loadedSkills = {};
            data.tool_ids.forEach(id => {
              loadedSkills[id] = true;
            });
            setSelectedExtendedSkills(loadedSkills);
          }

          if (data.knowledge_ids && Array.isArray(data.knowledge_ids)) {
            const loadedKnowledgeBases = {};
            data.knowledge_ids.forEach(id => {
              loadedKnowledgeBases[id] = true;
            });
            setSelectedKnowledgeBases(loadedKnowledgeBases);
          }

          if (data.workflow_ids && Array.isArray(data.workflow_ids)) {
            setSelectedWorkflowId(data.workflow_ids[0] || null);
          }
        })
        .catch(err => console.error("Failed to load employee:", err));
    }

    return () => {
      isMounted = false;
      window.removeEventListener('storage', syncKnowledgeBases);
      window.removeEventListener('des:knowledge-bases-updated', syncKnowledgeBases);
      window.removeEventListener('storage', syncWorkflows);
      window.removeEventListener('des:workflows-updated', syncWorkflows);
    };
  }, [isEditMode, editId]);

  const teams = ['HR', 'Engineering', 'Research', 'Product', 'Design', 'Marketing'];

  const toggleTeam = (team) => {
    if (selectedTeams.includes(team)) {
      setSelectedTeams(selectedTeams.filter(t => t !== team));
    } else {
      setSelectedTeams([...selectedTeams, team]);
    }
  };

  const buildEmployeePayload = (status) => {
    const tool_ids = Object.keys(selectedExtendedSkills).filter(id => selectedExtendedSkills[id]);
    const knowledge_ids = Object.keys(selectedKnowledgeBases).filter(id => selectedKnowledgeBases[id]);
    const workflow_ids = selectedWorkflowId ? [selectedWorkflowId] : [];
    const normalizedScope = accessScope === 'team' ? 'team' : accessScope === 'personal' ? 'personal' : 'org';

    return {
      name,
      status,
      role_title: category,
      model,
      avatar_url: avatarUrl || null,
      description,
      persona_prompt: instruction,
      tool_ids,
      knowledge_ids,
      workflow_ids,
      access_scope: normalizedScope,
      access_teams: normalizedScope === 'team' ? selectedTeams : [],
      version_group: originalEmployee?.version_group,
      source_employee_id: status === 'training' && originalEmployee?.status === 'active'
        ? originalEmployee.id
        : (originalEmployee?.source_employee_id || null),
      action_guide: mergeActionGuideWithCoreSkills(storedActionGuide, skills, selectedSubAgentIds),
      tags: tags || [],
    };
  };

  const persistEmployee = async (status) => {
    const payload = buildEmployeePayload(status);

    const shouldCreateDraftVersion = isEditMode && originalEmployee?.status === 'active' && status === 'training';
    const url = shouldCreateDraftVersion || !isEditMode
      ? `${API_BASE}/ai-employees/`
      : `${API_BASE}/ai-employees/${editId}`;
    const method = shouldCreateDraftVersion || !isEditMode ? 'POST' : 'PUT';

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.detail || `Failed to save: ${response.status} ${response.statusText}`);
    }

    if (method === 'POST') {
      clearStaleChatHistoryForEmployee(data?.id);
    }

    return data;
  };

  const handlePlayground = async () => {
    try {
      await persistEmployee('training');
      setShowToast(true);
      setTimeout(() => {
        navigate('/silicon-workmate');
      }, 1000);
    } catch (error) {
      console.error('Error saving silicon worker draft:', error);
      alert('Failed to save draft: ' + error.message);
    }
  };

  const handleActivate = async () => {
    try {
      await persistEmployee('active');
      setIsOnboardingModalOpen(false);
      navigate('/silicon-workmate');
    } catch (error) {
      console.error('Error saving silicon worker:', error);
      alert('Failed to save configuration: ' + error.message);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-white flex flex-col relative">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg z-[60] flex items-center gap-2 animate-fadeIn">
          <Icons.Check className="w-5 h-5 text-green-400" />
          <span>Saved successfully</span>
        </div>
      )}

      {/* Skill Selection Modal */}
      <SkillSelectionModal 
        isOpen={isSkillModalOpen} 
        onClose={() => setIsSkillModalOpen(false)} 
        onSave={(capabilities) => setSelectedExtendedSkills(capabilities)} 
        initialSelected={selectedExtendedSkills}
        skills={availableSkills}
      />

      <KnowledgeSelectionModal
        isOpen={isKnowledgeModalOpen}
        onClose={() => setIsKnowledgeModalOpen(false)}
        onSave={(knowledgeBaseIds) => setSelectedKnowledgeBases(knowledgeBaseIds)}
        initialSelected={selectedKnowledgeBases}
        knowledgeBases={availableKnowledgeBases}
      />

      <WorkflowSelectionModal
        isOpen={isWorkflowModalOpen}
        onClose={() => setIsWorkflowModalOpen(false)}
        onSave={setSelectedWorkflowId}
        initialSelected={selectedWorkflowId}
        workflows={availableWorkflows}
      />

      <AvatarSelectionModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        onSave={(nextAvatar) => setAvatarUrl(nextAvatar)}
        currentAvatar={avatarUrl}
      />

      {/* Onboarding Modal */}
      {isOnboardingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-[520px] p-8 transform transition-all scale-100 max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icons.Brain className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Worker Created Successfully!</h2>
              <p className="text-sm text-gray-500">Configure access and proceed with {name} worker</p>
            </div>

            {/* Access Scope Selection */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-3">Who can access this worker?</label>
              <div className="space-y-3">
                {/* 1. Organization */}
                <label className={`flex items-start p-3 border rounded-xl cursor-pointer transition-all ${accessScope === 'org' ? 'border-blue-500 bg-blue-50/30' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input 
                    type="radio" 
                    name="scope" 
                    value="org" 
                    checked={accessScope === 'org'} 
                    onChange={(e) => setAccessScope(e.target.value)} 
                    className="mt-1 mr-3 text-blue-600 focus:ring-blue-500" 
                  />
                  <div>
                    <div className="font-medium text-sm text-gray-900">Entire Organization</div>
                    <div className="text-xs text-gray-500 mt-0.5">Everyone in the organization can access</div>
                  </div>
                </label>

                {/* 2. Department/Team */}
                <div className={`border rounded-xl transition-all ${accessScope === 'team' ? 'border-blue-500 bg-blue-50/30' : 'border-gray-200 hover:border-gray-300'}`}>
                  <label className="flex items-start p-3 cursor-pointer">
                    <input 
                      type="radio" 
                      name="scope" 
                      value="team" 
                      checked={accessScope === 'team'} 
                      onChange={(e) => setAccessScope(e.target.value)} 
                      className="mt-1 mr-3 text-blue-600 focus:ring-blue-500" 
                    />
                    <div>
                      <div className="font-medium text-sm text-gray-900">Specific Teams</div>
                      <div className="text-xs text-gray-500 mt-0.5">Select teams that can access this worker</div>
                    </div>
                  </label>
                  
                  {accessScope === 'team' && (
                    <div className="px-3 pb-3 pl-9">
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {teams.map(team => (
                          <label key={team} className="flex items-center p-2 bg-white rounded border border-gray-200 cursor-pointer hover:bg-gray-50">
                            <input 
                              type="checkbox" 
                              checked={selectedTeams.includes(team)}
                              onChange={() => toggleTeam(team)}
                              className="rounded text-blue-600 focus:ring-blue-500 mr-2"
                            />
                            <span className="text-xs text-gray-700">{team}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Personal */}
                <label className={`flex items-start p-3 border rounded-xl cursor-pointer transition-all ${accessScope === 'personal' ? 'border-blue-500 bg-blue-50/30' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input 
                    type="radio" 
                    name="scope" 
                    value="personal" 
                    checked={accessScope === 'personal'} 
                    onChange={(e) => setAccessScope(e.target.value)} 
                    className="mt-1 mr-3 text-blue-600 focus:ring-blue-500" 
                  />
                  <div>
                    <div className="font-medium text-sm text-gray-900">Personal Only</div>
                    <div className="text-xs text-gray-500 mt-0.5">Only you can see and use this worker</div>
                  </div>
                </label>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-8">
              <button 
                onClick={() => setIsOnboardingModalOpen(false)}
                className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleActivate}
                className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="h-16 border-b border-gray-200 flex items-center justify-between px-8 bg-white sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-900">{isEditMode ? 'Edit Silicon Talent' : 'New Silicon Talent'}</h1>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handlePlayground}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors shadow-sm"
          >
            Playground
          </button>
          <button 
            onClick={() => setIsOnboardingModalOpen(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-sm"
          >
            Onboard
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 py-8 grid grid-cols-12 gap-12">
          
          {/* Left Column - Basic Information */}
          <div className="col-span-5 space-y-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Basic Information</h2>

            <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                  <Icons.Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">AI Common Employee</h3>
                      <p className="mt-1 text-xs leading-5 text-gray-500">Describe the employee you want, and AI will draft the name, category, description, instructions, and recommended skills.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateEmployeeDraft}
                      disabled={isGeneratingEmployeeDraft}
                      className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${isGeneratingEmployeeDraft ? 'cursor-not-allowed bg-blue-200 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                    >
                      {isGeneratingEmployeeDraft ? 'Generating...' : 'Auto Fill'}
                    </button>
                  </div>
                  <textarea
                    value={employeeDraftRequest}
                    onChange={(event) => setEmployeeDraftRequest(event.target.value)}
                    rows={4}
                    className="mt-3 w-full resize-none rounded-xl border border-white/80 bg-white/90 px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Example: I want a novel planning employee who can turn a rough story idea into a chapter outline, character arcs, and a stable world-setting brief."
                  />
                  {employeeDraftError ? (
                    <p className="mt-2 text-xs text-rose-600">{employeeDraftError}</p>
                  ) : (
                    <p className="mt-2 text-xs text-gray-500">The generated draft will overwrite the current name, category, description, and instructions fields.</p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Profile Image */}
            <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="h-20 w-20 overflow-hidden rounded-2xl bg-gradient-to-br from-pink-200 via-purple-200 to-blue-200 shadow-inner">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={name || 'Avatar preview'} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-white">
                      {getAvatarInitial(name)}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsAvatarModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
                >
                  <Icons.Edit className="h-4 w-4" />
                  Edit
                </button>
              </div>
            </div>

            {/* Silicon Name */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                placeholder="Enter name"
              />
            </div>

            {/* Category / Team */}
            <div className="space-y-1 relative">
              <label className="block text-xs font-medium text-gray-500">Category</label>
              
              <div 
                className="relative w-full bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-gray-300 transition-colors"
                onClick={() => {
                  setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
                  setCategorySearchQuery('');
                }}
              >
                <div className="px-3 py-2 flex items-center justify-between">
                  <span className="text-sm text-gray-900">{category}</span>
                  <Icons.ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </div>
              
              {isCategoryDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsCategoryDropdownOpen(false)} />
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-20 overflow-hidden">
                    <div className="p-2 border-b border-gray-100">
                       <div className="relative bg-gray-50 rounded-md">
                         <Icons.Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                         <input 
                           type="text" 
                           placeholder="Search category..." 
                           className="w-full bg-transparent text-gray-700 text-xs pl-8 py-1.5 focus:outline-none"
                           value={categorySearchQuery}
                           onChange={(e) => setCategorySearchQuery(e.target.value)}
                           onClick={(e) => e.stopPropagation()}
                           autoFocus
                         />
                       </div>
                    </div>
                    <div className="py-1 max-h-48 overflow-y-auto">
                      {[...teams, 'Personal', 'Sales']
                        .filter(t => t.toLowerCase().includes(categorySearchQuery.toLowerCase()))
                        .map((team) => (
                        <div 
                          key={team}
                          className={`px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center justify-between group ${category === team ? 'bg-blue-50/50' : ''}`}
                          onClick={() => {
                            setCategory(team);
                            setIsCategoryDropdownOpen(false);
                          }}
                        >
                          <span className={`text-sm ${category === team ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>{team}</span>
                          {category === team && (
                            <Icons.Check className="w-3.5 h-3.5 text-blue-600" />
                          )}
                        </div>
                      ))}
                      {[...teams, 'Personal', 'Sales']
                        .filter(t => t.toLowerCase().includes(categorySearchQuery.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-xs text-gray-400 text-center">No categories found</div>
                        )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Tags */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500">Tags</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map(tag => (
                  <span key={tag} className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-xs text-gray-600 border border-gray-200">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="ml-1.5 text-gray-400 hover:text-gray-600">×</button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                placeholder="Type and press Enter to add tags..."
              />
            </div>

            {/* Silicon Description */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow resize-none"
                placeholder="Enter description"
              />
            </div>

            {/* Mode */}
            <div className="space-y-1 relative">
              <label className="block text-xs font-medium text-gray-500">Mode</label>
              
              <div 
                className="relative w-full bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-gray-300 transition-colors"
                onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
              >
                <div className="px-3 py-2 flex items-center gap-2">
                  {(() => {
                    const SelectedIcon = modeOptions.find(opt => opt.id === mode)?.icon || Icons.Lightning;
                    return <SelectedIcon className="w-4 h-4 text-gray-500" />;
                  })()}
                  <span className="text-sm text-gray-900">{mode}</span>
                </div>
                <Icons.ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform ${isModeDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
              
              {isModeDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsModeDropdownOpen(false)} />
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-20 overflow-hidden">
                    <div className="p-2 border-b border-gray-100">
                       <div className="relative bg-gray-50 rounded-md">
                         <Icons.Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                         <input 
                           type="text" 
                           placeholder="Search..." 
                           className="w-full bg-transparent text-gray-700 text-xs pl-8 py-1.5 focus:outline-none"
                           onClick={(e) => e.stopPropagation()}
                         />
                       </div>
                    </div>
                    <div className="py-1 max-h-64 overflow-y-auto">
                      {modeOptions.map((option) => (
                        <div 
                          key={option.id}
                          className={`px-3 py-2.5 hover:bg-gray-50 cursor-pointer flex flex-col gap-1 group ${mode === option.id ? 'bg-blue-50/50' : ''}`}
                          onClick={() => {
                            setMode(option.id);
                            setIsModeDropdownOpen(false);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-gray-900">
                              <option.icon className={`w-4 h-4 ${mode === option.id ? 'text-blue-600' : 'text-gray-500'}`} />
                              <span className={`text-sm font-medium ${mode === option.id ? 'text-blue-600' : ''}`}>{option.label}</span>
                            </div>
                            {mode === option.id && (
                              <Icons.Check className="w-4 h-4 text-blue-600" />
                            )}
                          </div>
                          <div className="text-xs text-gray-500 pl-6 leading-relaxed">
                            {option.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              
              <p className="text-xs text-gray-400 mt-1">
                {modeOptions.find(opt => opt.id === mode)?.description}
              </p>
            </div>

            {/* AI Model */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500">Model</label>
              <div className="relative">
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer"
                >
                  <option>Auto</option>
                  {availableModels.map((modelName) => (
                    <option key={modelName} value={modelName}>{modelName}</option>
                  ))}
                </select>
                <Icons.ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Instruction */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-500">Instructions</label>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-mono text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow resize-none leading-relaxed"
                placeholder="Enter instructions..."
              />
            </div>
          </div>

          {/* Right Column - Skills & Knowledge */}
          <div className="col-span-7 space-y-8 pl-8 border-l border-gray-50">
            
            {/* Core Skills */}
            {mode !== 'Chat' && (
              <div>
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-gray-900">Core Skills</h2>
                  <p className="text-xs text-gray-400 mt-1">Covering reasoning, search, code execution, and browser automation</p>
                </div>
                
                <div className="space-y-3">
                  <SkillCard 
                    icon={Icons.Search}
                    title="Search"
                    description="Enables Silicon with network search skills to obtain the latest information and data"
                    checked={skills.search}
                    onChange={(val) => setSkills({...skills, search: val})}
                    colorClass="bg-blue-500"
                  />
                  <SkillCard 
                    icon={Icons.Globe}
                    title="Browser"
                    description="Enables Silicon with browser automation skills to complete web browsing and data extraction"
                    checked={skills.browser}
                    onChange={(val) => setSkills({...skills, browser: val})}
                    colorClass="bg-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Extended Skills */}
            {mode !== 'Chat' && (
              <>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 mb-4">Extended Skills</h2>
                  
                  {/* Display Selected Skills */}
                  <div className="space-y-3 mb-3">
                    {availableSkills.map(skill => {
                      const skillKey = skill.skill_key || skill.id;
                      const visibleCapabilities = Array.isArray(skill.capabilities) && skill.capabilities.length > 0
                        ? skill.capabilities.filter((cap) => selectedExtendedSkills[cap.id])
                        : (selectedExtendedSkills[skillKey]
                          ? [{ id: skillKey, name: skill.name, description: skill.description }]
                          : []);

                      if (visibleCapabilities.length === 0) return null;

                      return (
                        <div key={skillKey} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 text-xs font-bold">
                                    {getInitials(skill.name)}
                                </div>
                                <h3 className="font-medium text-gray-900 text-sm">{skill.name}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setIsSkillModalOpen(true)}
                                    className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
                                >
                                    <Icons.Edit className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => {
                                        const newSkills = { ...selectedExtendedSkills };
                                        if (Array.isArray(skill.capabilities) && skill.capabilities.length > 0) {
                                          skill.capabilities.forEach(cap => {
                                              delete newSkills[cap.id];
                                          });
                                        } else {
                                          delete newSkills[skillKey];
                                        }
                                        setSelectedExtendedSkills(newSkills);
                                    }}
                                    className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                                >
                                    <Icons.Trash className="w-4 h-4" />
                                </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 pl-11">
                            {visibleCapabilities.map(cap => (
                                <span key={cap.id} className="inline-flex items-center px-2 py-1 rounded-md bg-gray-50 text-xs text-gray-600 border border-gray-100">
                                    {cap.name}
                                </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button 
                    onClick={() => setIsSkillModalOpen(true)}
                    className="w-full py-3 border border-gray-200 rounded-xl text-sm text-gray-400 flex items-center justify-start px-4 hover:bg-gray-50 transition-colors"
                  >
                    <Icons.Plus className="w-4 h-4 mr-2" />
                    Add
                  </button>
                </div>

                {/* Knowledge */}
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 mb-4">Knowledge</h2>
                  <p className="text-xs text-gray-400 mb-3">Assign one or more knowledge bases to this worker.</p>

                  <div className="space-y-3 mb-3">
                    {selectedKnowledgeBaseList.map((knowledgeBase) => (
                      <div key={knowledgeBase.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2 gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">
                              {getInitials(knowledgeBase.name)}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-medium text-gray-900 text-sm truncate">{knowledgeBase.name}</h3>
                              <p className="text-xs text-gray-400">{knowledgeBase.processedDocumentCount} available document{knowledgeBase.processedDocumentCount > 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => setIsKnowledgeModalOpen(true)}
                              className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"
                            >
                              <Icons.Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedKnowledgeBases((previous) => {
                                  const nextSelected = { ...previous };
                                  delete nextSelected[knowledgeBase.id];
                                  return nextSelected;
                                });
                              }}
                              className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                            >
                              <Icons.Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p className="pl-11 text-xs text-gray-500 leading-6">{knowledgeBase.description}</p>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setIsKnowledgeModalOpen(true)}
                    className="w-full py-3 border border-gray-200 rounded-xl text-sm text-gray-400 flex items-center justify-start px-4 hover:bg-gray-50 transition-colors"
                  >
                    <Icons.Plus className="w-4 h-4 mr-2" />
                    {selectedKnowledgeBaseList.length > 0 ? 'Edit Knowledge Bases' : 'Select Knowledge Bases'}
                  </button>
                </div>

                {/* Workflow */}
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 mb-4">Workflow</h2>
                  <p className="text-xs text-gray-400 mb-3">为此数字员工添加一条已发布工作流。</p>

                  {selectedWorkflow && (
                    <div className="mb-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Icons.Lightning className="h-4 w-4" /></div>
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-medium text-gray-900">{selectedWorkflow.name}</h3>
                            <p className="mt-1 text-xs leading-5 text-gray-500">{selectedWorkflow.description || '暂无描述'}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button type="button" onClick={() => setIsWorkflowModalOpen(true)} title="替换工作流" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><Icons.Edit className="h-4 w-4" /></button>
                          <button type="button" onClick={() => setSelectedWorkflowId(null)} title="移除工作流" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"><Icons.Trash className="h-4 w-4" /></button>
                        </div>
                      </div>
                    </div>
                  )}

                  <button type="button" onClick={() => setIsWorkflowModalOpen(true)} className="flex w-full items-center justify-start rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-400 transition-colors hover:bg-gray-50">
                    <Icons.Plus className="mr-2 h-4 w-4" />
                    {selectedWorkflow ? '替换工作流' : '添加工作流'}
                  </button>
                  {publishedWorkflowCatalog.length === 0 && <p className="mt-2 text-xs text-amber-600">暂无已发布工作流，请先在工作流列表中发布。</p>}
                </div>

                {/* Sub Agents */}
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 mb-4">子 Agent</h2>
                  <p className="mb-3 text-xs text-gray-400">选择权限范围内的数字员工作为子 Agent，可多选。</p>
                  <SubAgentMultiSelect employees={subAgentOptions} selectedIds={selectedSubAgentIds} onChange={setSelectedSubAgentIds} />
                </div>

                {/* Memory */}
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 mb-4">Database</h2>
                  <button className="w-full py-3 border border-gray-200 rounded-xl text-sm text-gray-400 flex items-center justify-start px-4 hover:bg-gray-50 transition-colors">
                    <Icons.Plus className="w-4 h-4 mr-2" />
                    Select Database
                  </button>
                </div>

                {/* Long-term Memory */}
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 mb-4">Long-term Memory</h2>
                  <div className="flex items-center gap-3">
                    <Toggle checked={longTermMemory} onChange={setLongTermMemory} />
                    <span className="text-sm text-gray-600">Concurrent Index Generation:</span>
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      </main>
    </div>
  );
};

export default AddSiliconWorker;
