import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MCPClient } from './client';


vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));


describe('MCPClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls /agent/turns for turn requests', async () => {
    axios.post.mockResolvedValue({ data: { mode: 'plan' } });
    const client = new MCPClient();

    const result = await client.turn('请规划任务', 12, 34, true);

    expect(axios.post).toHaveBeenCalledWith('/agent/turns', {
      chat_id: 34,
      user_message: '请规划任务',
      employee_id: 12,
      auto_execute_direct: true,
    });
    expect(result).toEqual({ mode: 'plan' });
  });

  it('calls workflow run execute endpoint', async () => {
    axios.post.mockResolvedValue({ data: { status: 'completed' } });
    const client = new MCPClient();

    const result = await client.executeWorkflowRun(101);

    expect(axios.post).toHaveBeenCalledWith('/workflow-runs/101/execute');
    expect(result).toEqual({ status: 'completed' });
  });

  it('calls workflow run continue endpoint with payload', async () => {
    axios.post.mockResolvedValue({ data: { status: 'paused' } });
    const client = new MCPClient();

    const payload = {
      approved: null,
      user_input: '补充范围',
      feedback: '补充范围',
    };
    const result = await client.continueWorkflowRun(202, payload);

    expect(axios.post).toHaveBeenCalledWith('/workflow-runs/202/continue', payload);
    expect(result).toEqual({ status: 'paused' });
  });

  it('calls plan approval endpoint with payload', async () => {
    axios.post.mockResolvedValue({ data: { decision: 'approved' } });
    const client = new MCPClient();

    const payload = {
      chat_id: 34,
      employee_id: 12,
      user_message: '好的，开始执行',
      workflow_run_id: 88,
    };
    const result = await client.approvePlan(payload);

    expect(axios.post).toHaveBeenCalledWith('/agent/plan-approval', payload);
    expect(result).toEqual({ decision: 'approved' });
  });

  it('calls workflow run get endpoint', async () => {
    axios.get.mockResolvedValue({ data: { id: 303 } });
    const client = new MCPClient();

    const result = await client.getWorkflowRun(303);

    expect(axios.get).toHaveBeenCalledWith('/workflow-runs/303');
    expect(result).toEqual({ id: 303 });
  });

  it('starts a direct run with full access enabled', async () => {
    axios.post.mockResolvedValue({ data: { id: 'run-1', status: 'queued' } });
    const client = new MCPClient();

    const result = await client.startAnswerDirectRun('生成文件', 12, 34, false, ['upload-1'], true);

    expect(axios.post).toHaveBeenCalledWith('/mcp/answer_direct/runs', {
      chat_id: 34,
      user_message: '生成文件',
      employee_id: 12,
      automation_setup: false,
      upload_ids: ['upload-1'],
      full_access: true,
    });
    expect(result).toEqual({ id: 'run-1', status: 'queued' });
  });

  it('executes a planned step with full access enabled', async () => {
    axios.post.mockResolvedValue({ data: { status: 'completed' } });
    const client = new MCPClient();

    await client.executeStep('读取并整理文件', 34, '', 0, null, { step_outputs: {} }, true);

    expect(axios.post).toHaveBeenCalledWith('/mcp/execute_step', {
      chat_id: 34,
      step_content: '读取并整理文件',
      user_feedback: '',
      step_index: 0,
      plan_step: null,
      plan_context: { step_outputs: {} },
      full_access: true,
    });
  });
});