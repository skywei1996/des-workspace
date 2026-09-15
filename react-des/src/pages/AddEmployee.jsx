import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

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

const AddSiliconWorker = () => {
  const navigate = useNavigate();
  
  // Form State
  const [name, setName] = useState('Silicon');
  const [description, setDescription] = useState('Silicon description');
  const [mode, setMode] = useState('Auto');
  const [model, setModel] = useState('Auto');
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
  const [skills, setSkills] = useState({
    search: false,
    browser: false
  });

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

  const handleSave = () => {
    // Logic to save the employee would go here
    console.log('Saving Silicon Worker:', { name, description, mode, model, instruction, skills, longTermMemory });
    navigate('/silicon-workforce');
  };

  return (
    <div className="h-screen overflow-hidden bg-white flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-gray-200 flex items-center justify-between px-8 bg-white sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-900">New Silicon Talent</h1>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-sm"
          >
            Save
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 py-8 grid grid-cols-12 gap-12">
          
          {/* Left Column - Basic Information */}
          <div className="col-span-5 space-y-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Basic Information</h2>
            
            {/* Avatar Upload - Compact Horizontal Strip */}
            <div className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl flex items-center gap-4 mb-6 relative group cursor-pointer hover:border-gray-300 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-200 via-purple-200 to-blue-200 flex items-center justify-center shadow-inner shrink-0">
                 <Icons.Edit className="w-4 h-4 text-gray-600 opacity-50 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="text-sm text-gray-500 font-medium">Click to upload avatar</span>
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
                  <option>GPT-4</option>
                  <option>Claude 3.5 Sonnet</option>
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
                  <button className="w-full py-3 border border-gray-200 rounded-xl text-sm text-gray-400 flex items-center justify-start px-4 hover:bg-gray-50 transition-colors">
                    <Icons.Plus className="w-4 h-4 mr-2" />
                    Add
                  </button>
                </div>

                {/* Knowledge */}
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 mb-4">Knowledge</h2>
                  <button className="w-full py-3 border border-gray-200 rounded-xl text-sm text-gray-400 flex items-center justify-start px-4 hover:bg-gray-50 transition-colors">
                    <Icons.Plus className="w-4 h-4 mr-2" />
                    Select Knowledge Base
                  </button>
                </div>

                {/* Memory */}
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 mb-4">Memory</h2>
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
