import React, { useState } from 'react'
import Sidebar from '../components/Sidebar'

const WorkerMarket = () => {
  const [activeTab, setActiveTab] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  
  const categories = ['All', 'HR', 'Sales', 'Designer', 'Engineering', 'Marketing']

  const marketAgents = {
    HR: [
      {
        id: 'hr-1',
        name: 'Talent Scout Pro',
        role: 'Recruitment Specialist',
        description: 'Expert in sourcing candidates, screening resumes, and initial outreach.',
        avatar: '/Pic/3.JPG',
        status: 'active',
        team: 'HR'
      },
      {
        id: 'hr-2',
        name: 'Culture Guardian',
        role: 'HR Generalist',
        description: 'Focuses on employee engagement, feedback surveys, and team building activities.',
        avatar: '/Pic/4.JPG',
        status: 'active',
        team: 'HR'
      },
      {
        id: 'hr-3',
        name: 'Compliance Officer',
        role: 'HR Compliance',
        description: 'Ensures all HR practices meet legal standards and company policies.',
        avatar: '/Pic/2.JPG',
        status: 'active',
        team: 'HR'
      }
    ],
    Sales: [
      {
        id: 'sales-1',
        name: 'Lead Generator X',
        role: 'SDR',
        description: 'Automates cold outreach and qualifies leads for your sales team.',
        avatar: '/Pic/5.JPG',
        status: 'active',
        team: 'Sales'
      },
      {
        id: 'sales-2',
        name: 'Deal Closer',
        role: 'Account Executive',
        description: 'Assists in negotiation, contract preparation, and closing deals.',
        avatar: '/Pic/6.jpg',
        status: 'active',
        team: 'Sales'
      },
      {
        id: 'sales-3',
        name: 'Sales Analyst',
        role: 'Sales Ops',
        description: 'Analyzes sales data, forecasts trends, and optimizes sales processes.',
        avatar: '/Pic/2.JPG',
        status: 'active',
        team: 'Sales'
      }
    ],
    Designer: [
      {
        id: 'des-1',
        name: 'UI Wizard',
        role: 'UI Designer',
        description: 'Creates stunning user interfaces and design systems.',
        avatar: '/Pic/2.JPG',
        status: 'active',
        team: 'Designer'
      },
      {
        id: 'des-2',
        name: 'Brand Architect',
        role: 'Brand Designer',
        description: 'Develops brand identity, logos, and visual guidelines.',
        avatar: '/Pic/3.JPG',
        status: 'active',
        team: 'Designer'
      },
      {
        id: 'des-3',
        name: 'Motion Master',
        role: 'Motion Designer',
        description: 'Creates engaging animations and motion graphics for web and mobile.',
        avatar: '/Pic/5.JPG',
        status: 'active',
        team: 'Designer'
      }
    ],
    Engineering: [
        {
            id: 'eng-1',
            name: 'Full Stack Dev',
            role: 'Senior Engineer',
            description: 'Capable of handling both frontend and backend development tasks.',
            avatar: '/Pic/5.JPG',
            status: 'active',
            team: 'Engineering'
        },
        {
            id: 'eng-2',
            name: 'DevOps Master',
            role: 'DevOps Engineer',
            description: 'Manages CI/CD pipelines, cloud infrastructure, and deployment.',
            avatar: '/Pic/4.JPG',
            status: 'active',
            team: 'Engineering'
        },
        {
            id: 'eng-3',
            name: 'QA Automation',
            role: 'QA Engineer',
            description: 'Writes automated tests to ensure software quality and reliability.',
            avatar: '/Pic/6.jpg',
            status: 'active',
            team: 'Engineering'
        }
    ],
    Marketing: [
        {
            id: 'mkt-1',
            name: 'Content Strategist',
            role: 'Content Manager',
            description: 'Plans and executes content marketing strategies across channels.',
            avatar: '/Pic/6.jpg',
            status: 'active',
            team: 'Marketing'
        },
        {
            id: 'mkt-2',
            name: 'Social Media Bot',
            role: 'Social Media Manager',
            description: 'Schedules posts, engages with followers, and analyzes metrics.',
            avatar: '/Pic/2.JPG',
            status: 'active',
            team: 'Marketing'
        },
        {
            id: 'mkt-3',
            name: 'SEO Specialist',
            role: 'SEO Expert',
            description: 'Optimizes website content and structure for search engines.',
            avatar: '/Pic/3.JPG',
            status: 'active',
            team: 'Marketing'
        }
    ]
  }

  const getFilteredWorkers = () => {
    const workers = activeTab === 'All' 
        ? Object.values(marketAgents).flat() 
        : marketAgents[activeTab]

    if (!searchQuery) return workers

    const lowerQuery = searchQuery.toLowerCase()
    return workers.filter(worker => 
        worker.name.toLowerCase().includes(lowerQuery) ||
        worker.role.toLowerCase().includes(lowerQuery) ||
        worker.description.toLowerCase().includes(lowerQuery)
    )
  }

  return (
    <div className="flex h-screen bg-[#f7f8fc]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-8 py-5">
          <h1 className="text-2xl font-bold text-gray-900">Silicon Talents</h1>
        </header>
        
        <main className="flex-1 p-8 overflow-y-auto">
            {/* Tabs & Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto">
                    {categories.map(category => (
                        <button
                            key={category}
                            onClick={() => setActiveTab(category)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                                activeTab === category
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>

                <div className="relative">
                    <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input 
                        type="text" 
                        placeholder="Search Silicon Talents..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-full md:w-64"
                    />
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {getFilteredWorkers()?.map(worker => (
                    <div 
                        key={worker.id}
                        className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 group cursor-pointer relative"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex-1 pr-4">
                                <div className="flex items-center mb-1">
                                    <h3 className="text-base font-bold text-gray-900 mr-2">{worker.name}</h3>
                                    <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <p className="text-xs text-gray-500 line-clamp-2 h-8">{worker.description}</p>
                            </div>
                            <img 
                                src={worker.avatar} 
                                alt={worker.name}
                                className="w-12 h-12 rounded-lg object-cover shadow-sm flex-shrink-0"
                            />
                        </div>
                        
                        <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                    {worker.role}
                                </span>
                            </div>
                            <button className="text-xs font-medium text-white bg-black px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
                                Chat
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </main>
      </div>
    </div>
  )
}

export default WorkerMarket
