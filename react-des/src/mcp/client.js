import axios from 'axios';
import { buildApiUrl } from '../config/api';

export class MCPClient {
  constructor(endpoint = buildApiUrl('/mcp')) {
    this.endpoint = endpoint;
    this.apiBase = buildApiUrl('');
  }

  async generateImage(payload) {
    try {
      const response = await axios.post(`${this.apiBase}/images/generate`, payload);
      return response.data;
    } catch (error) {
      console.error("Image generation failed:", error);
      throw error;
    }
  }

  async turn(prompt, employeeId = null, chatId = null, autoExecuteDirect = true, automationSetup = false) {
    try {
      const response = await axios.post(`${this.apiBase}/agent/turns`, {
        chat_id: chatId,
        user_message: prompt,
        employee_id: employeeId ? parseInt(employeeId, 10) : null,
        auto_execute_direct: autoExecuteDirect,
        automation_setup: automationSetup,
      });
      return response.data;
    } catch (error) {
      console.error("Agent turn Failed:", error);
      throw error;
    }
  }

  async answerDirect(prompt, employeeId = null, chatId = null, automationSetup = false) {
    try {
      const response = await axios.post(`${this.endpoint}/answer_direct`, {
        chat_id: chatId,
        user_message: prompt,
        employee_id: employeeId ? parseInt(employeeId) : null,
        automation_setup: automationSetup,
      });
      return response.data;
    } catch (error) {
      console.error("MCP answerDirect Failed:", error);
      throw error;
    }
  }

  async uploadChatFile(chatId, file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(`${this.apiBase}/chats/${chatId}/uploads`, formData);
    return response.data;
  }

  async startAnswerDirectRun(prompt, employeeId = null, chatId = null, automationSetup = false, uploadIds = [], fullAccess = false) {
    const response = await axios.post(`${this.endpoint}/answer_direct/runs`, {
      chat_id: chatId,
      user_message: prompt,
      employee_id: employeeId ? parseInt(employeeId, 10) : null,
      automation_setup: automationSetup,
      upload_ids: uploadIds,
      full_access: fullAccess,
    });
    return response.data;
  }

  async getAnswerDirectRun(runId) {
    const response = await axios.get(`${this.endpoint}/answer_direct/runs/${runId}`);
    return response.data;
  }

  async approveAnswerDirectRun(runId, approved) {
    const response = await axios.post(`${this.endpoint}/answer_direct/runs/${runId}/approval`, {
      approved,
    });
    return response.data;
  }

  async groupDebate(payload) {
    try {
      const response = await axios.post(`${this.endpoint}/group_debate`, payload);
      return response.data;
    } catch (error) {
      console.error("MCP groupDebate Failed:", error);
      throw error;
    }
  }

  async groupCollaboration(payload) {
    try {
      const response = await axios.post(`${this.endpoint}/group_collaboration`, payload);
      return response.data;
    } catch (error) {
      console.error("MCP groupCollaboration Failed:", error);
      throw error;
    }
  }

  async executeStep(stepContent, chatId, feedback = "", stepIndex = null, planStep = null, planContext = null, fullAccess = false) {
    try {
      const response = await axios.post(`${this.endpoint}/execute_step`, {
        chat_id: chatId,
        step_content: stepContent,
        user_feedback: feedback,
        step_index: stepIndex,
        plan_step: planStep,
        plan_context: planContext,
        full_access: fullAccess,
      });
      return response.data;
    } catch (error) {
      console.error("MCP executeStep Failed:", error);
      throw error;
    }
  }

  async getWorkflowRun(runId) {
    try {
      const response = await axios.get(`${this.apiBase}/workflow-runs/${runId}`);
      return response.data;
    } catch (error) {
      console.error('Get workflow run Failed:', error);
      throw error;
    }
  }

  async getWorkspaceFileContent(path) {
    try {
      const response = await axios.get(`${this.apiBase}/workspace/files/content`, {
        params: { path },
      });
      return response.data;
    } catch (error) {
      console.error('Get workspace file content Failed:', error);
      throw error;
    }
  }

  getWorkspaceFileDownloadUrl(path, options = {}) {
    const query = new URLSearchParams({ path });
    if (options.download) {
      query.set('download', '1');
    }
    return `${this.apiBase}/workspace/files/download?${query.toString()}`;
  }

  async startWorkflowRun(payload) {
    try {
      const response = await axios.post(`${this.apiBase}/workflow-runs/start`, payload);
      return response.data;
    } catch (error) {
      console.error('Start workflow run Failed:', error);
      throw error;
    }
  }

  async executeWorkflowRun(runId) {
    try {
      const response = await axios.post(`${this.apiBase}/workflow-runs/${runId}/execute`);
      return response.data;
    } catch (error) {
      console.error('Execute workflow run Failed:', error);
      throw error;
    }
  }

  async resumeWorkflowRun(runId, payload) {
    try {
      const response = await axios.post(`${this.apiBase}/workflow-runs/${runId}/resume`, payload);
      return response.data;
    } catch (error) {
      console.error('Resume workflow run Failed:', error);
      throw error;
    }
  }

  async continueWorkflowRun(runId, payload) {
    try {
      const response = await axios.post(`${this.apiBase}/workflow-runs/${runId}/continue`, payload);
      return response.data;
    } catch (error) {
      console.error('Continue workflow run Failed:', error);
      throw error;
    }
  }

  async cancelWorkflowRun(runId) {
    try {
      const response = await axios.post(`${this.apiBase}/workflow-runs/${runId}/cancel`);
      return response.data;
    } catch (error) {
      console.error('Cancel workflow run Failed:', error);
      throw error;
    }
  }

  async confirmStep(confirmationId, feedback = null) {
    // Not implemented in backend yet, but keeping for compatibility
    console.warn("confirmStep not implemented in backend");
    return { status: "confirmed" };
  }
}

