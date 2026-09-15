
export const availableSkills = [
  {
    id: 'tavily_search',
    name: 'Tavily Web Search (MCP)',
    description: 'Provide real-time internet search and deep research capabilities using Tavily MCP Server. Ideal for gathering latest market data and competitor info.',
    icon: 'tool',
    capabilities: [
      { id: 'tavily_search', name: 'Real-time Search', description: 'Deep web research using Tavily API.' }
    ]
  },
  {
    id: 'brainstorming',
    name: 'Brainstorming Workflow',
    description: 'Use when starting any conversation or when the user asks to build a new feature. Activates before writing code to refine ideas through questions and explore alternatives.',
    icon: 'tool',
    capabilities: [
      { id: 'brainstorming', name: 'Core Instructions', description: 'Includes the core instructions for this skill in the system prompt.' }
    ]
  },
  {
    id: 'playwright',
    name: 'Playwright MCP',
    description: 'A Model Context Protocol (MCP) server that provides browser automation capabilities using Playwright. This server enables LLMs to interact with web pages through structured accessibility snapshots, bypassing the need for screenshots or visually-tuned models.',
    icon: 'microsoft',
    capabilities: [
      { id: 'browser_drag', name: 'browser_drag', description: 'Perform drag and drop between two elements' },
      { id: 'browser_tabs', name: 'browser_tabs', description: 'List, create, close, or select a browser tab.' },
      { id: 'browser_type', name: 'browser_type', description: 'Type text into editable element' },
      { id: 'browser_click', name: 'browser_click', description: 'Perform click on a web page' },
      { id: 'browser_close', name: 'browser_close', description: 'Close the page' },
    ]
  },
  {
    id: 'blender',
    name: 'Blender MCP',
    description: 'Enables natural language control of Blender for 3D modeling and animation.',
    icon: 'blender',
    capabilities: [
        { id: 'render_scene', name: 'render_scene', description: 'Render the current scene' },
        { id: 'create_object', name: 'create_object', description: 'Create a new 3D object' }
    ]
  },
  {
    id: 'phoenix',
    name: 'Phoenix MCP',
    description: 'Provides a unified interface for AI observability and evaluation.',
    icon: 'phoenix',
    capabilities: [
        { id: 'log_trace', name: 'log_trace', description: 'Log a trace to Phoenix' }
    ]
  },
  {
    id: 'aws_cdk',
    name: 'CDK MCP Server',
    description: 'Integration for AWS Cloud Development Kit.',
    icon: 'aws',
    capabilities: []
  },
  {
    id: 'bedrock',
    name: 'Bedrock KB Retrieval',
    description: 'Bridge to access Amazon Bedrock Knowledge Bases.',
    icon: 'aws',
    capabilities: []
  },
  {
    id: 'aws_docs',
    name: 'AWS Documentation',
    description: 'Provides tools to access AWS documentation.',
    icon: 'aws',
    capabilities: []
  },
  {
    id: 'browser_tools',
    name: 'Browser Tools MCP',
    description: 'A Model Context Protocol server for browser interactions.',
    icon: 'browser',
    capabilities: []
  }
];
