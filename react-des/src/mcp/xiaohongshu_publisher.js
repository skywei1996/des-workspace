/**
 * Xiaohongshu Publisher Skill Definition
 */

import axios from 'axios';

// 1. Skill Metadata & Schema
export const XiaohongshuPublisherSkill = {
  id: 'xiaohongshu_publisher',
  name: 'Xiaohongshu Publisher',
  category: 'Content / Social Media',
  description: 'Generate Xiaohongshu-style content drafts and optionally assist with publishing.',
  
  // 2. Input Schema
  inputSchema: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description: 'Primary topic or subject of the content'
      },
      tone: {
        type: 'string',
        description: 'Desired tone of voice (e.g., "story", "emotional", "professional")',
        default: 'story'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of relevant hashtags'
      },
      publish_mode: {
        type: 'string',
        enum: ['draft', 'auto'],
        description: 'Mode of operation: "draft" for generation only, "auto" for direct publishing',
        default: 'draft'
      },
      session: {
        type: 'object',
        description: 'Auth credentials (only required for auto mode)',
        optional: true
      }
    },
    required: ['topic', 'tags']
  },

  // 3. Output Schema
  outputSchema: {
    type: 'object',
    properties: {
      draft: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          content: { type: 'string' },
          images: { type: 'array', items: { type: 'string' } }
        }
      },
      publish_result: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          note_url: { type: 'string', format: 'uri' }
        },
        optional: true
      }
    }
  }
};

// 4. Execute Handler
export const executeHandler = async (input) => {
  const { topic, tone, tags, publish_mode, session } = input;

  // Step 1: Content Generation (Mocking LLM/Image Gen Service call)
  const draft = await generateContent(topic, tone, tags);

  if (publish_mode === 'draft') {
    return {
      draft: draft
    };
  }

  if (publish_mode === 'auto') {
    if (!session) {
      throw new Error('Session credentials required for auto publishing mode.');
    }

    // Step 2: Auto Publishing (Mocking External API call)
    const publishResult = await publishToXiaohongshu(draft, session);

    return {
      draft: draft,
      publish_result: publishResult
    };
  }

  throw new Error(`Invalid publish_mode: ${publish_mode}`);
};

// --- Helper Functions (Simulating Backend/External Services) ---

async function generateContent(topic, tone, tags) {
  // Simulator: In production this would call your Python/FastAPI backend
  console.log(`[XHSPublisher] Generating content for topic: "${topic}" with tone: "${tone}"...`);
  
  // Simulated Network Delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  return {
    title: `✨My Secrets to ${topic} | ${tone.charAt(0).toUpperCase() + tone.slice(1)} Vibes`,
    content: `Here’s strictly sharing my experience with ${topic}!\n\nDetails below ⬇️\n\n... (generated content based on ${tone} tone) ...\n\n#${tags.join(' #')}`,
    images: [
      `https://fake-image-gen.service/xhs/${encodeURIComponent(topic)}/cover.png`,
      `https://fake-image-gen.service/xhs/${encodeURIComponent(topic)}/detail1.png`
    ]
  };
}

async function publishToXiaohongshu(draft, session) {
  console.log(`[XHSPublisher] Publishing to Xiaohongshu...`);
  
  // Simulated Network Delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Simulated API Call
  // const response = await axios.post('https://api.external-service.com/xhs/publish', {
  //   content: draft,
  //   auth: session
  // });

  return {
    status: 'success',
    note_url: `https://xiaohongshu.com/discovery/item/mock_id_${Date.now()}`
  };
}

// 5. Registration Helper (Example)
export const registerSkill = (registry) => {
  if (registry && typeof registry.register === 'function') {
    registry.register(XiaohongshuPublisherSkill.id, {
      schema: XiaohongshuPublisherSkill,
      handler: executeHandler
    });
    console.log(`Skill registered: ${XiaohongshuPublisherSkill.name}`);
  } else {
    console.warn('Skill registry not found or invalid.');
  }
};
