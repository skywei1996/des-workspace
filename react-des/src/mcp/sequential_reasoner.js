import { MCPClient } from './client';

export class SequentialReasoner {
  constructor() {
    this.client = new MCPClient();
    this.automationSetupMode = false;
  }

  setAutomationSetupMode(enabled) {
    this.automationSetupMode = enabled;
  }

  async answerDirectly(userInput, employeeId = null, chatId = null, automationSetup = false) {
    try {
      const response = await this.client.answerDirect(userInput, employeeId, chatId, automationSetup);
      return response;
    } catch (error) {
      console.error("Direct Answer Failed:", error);
      throw error;
    }
  }

  async generateImage(payload) {
    try {
      const response = await this.client.generateImage(payload);
      return response;
    } catch (error) {
      console.error("Generate Image Failed:", error);
      throw error;
    }
  }

  async groupDebate(payload) {
    try {
      const response = await this.client.groupDebate(payload);
      return response;
    } catch (error) {
      console.error("Group Debate Failed:", error);
      throw error;
    }
  }

  async groupCollaboration(payload) {
    try {
      const response = await this.client.groupCollaboration(payload);
      return response;
    } catch (error) {
      console.error("Group Collaboration Failed:", error);
      throw error;
    }
  }
}

