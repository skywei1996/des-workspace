# Backend Agent Architecture Redesign

## 1. Goal

Refactor the current backend agent flow into a clear, production-oriented architecture with explicit roles:

- Dispatcher Agent
- Clarifier Agent
- Plan Agent
- Step Executor
- Persistent Run State

The main objective is to stop mixing routing, planning, execution, workflow handling, and group-collaboration logic inside one large module.


## 2. Current Problems In The Codebase

### 2.1 Planning contract is inconsistent

- `backend/app/agents/task_planner_agent.py` instructs the model to output a JSON list of strings.
- `backend/app/mcp_server.py` expects the planner to return a JSON object with:
  - `execution_mode`
  - `selected_skills`
  - `plan_steps`
  - `reasoning`
  - `clarifying_question`

This mismatch makes planner output unstable and forces downstream fallback parsing.

### 2.2 Routing and execution are mixed together

`backend/app/mcp_server.py` currently contains:

- direct-response routing
- planning routing
- workflow execution
- step execution
- debate mode
- collaboration mode
- pause and resume handling

This makes the module too large and prevents a clean orchestration model.

### 2.3 The execution path loses structured plan metadata

The planner already produces structured fields such as:

- `selected_skill_key`
- `candidate_skill_keys`
- `selected_skill_type`

But `/execute_plan` still executes `plan: List[str]`, which throws away the planner's structured decision and turns execution back into prompt-only orchestration.

### 2.4 Clarification is treated as a skill hint instead of a first-class routing outcome

The system currently allows pre-plan clarification only when certain loaded skill hints match brainstorming-like behavior. That is too implicit.

Clarification should be a first-class dispatcher outcome, not an optional side effect of a skill inventory.

### 2.5 AgentManager is still biased toward an older report-generation architecture

The current `AgentManager` still centers on:

- `FrameworkAgent`
- `TaskCompositionAgent`
- `FileAgent`
- a general `Assistant`

This is not the right abstraction for a general product agent architecture.

### 2.6 State is spread across multiple overlapping tables

Current runtime state is distributed across:

- `WorkflowRun`
- `WorkflowStepRun`
- `TaskProgress`
- `Todo`
- `ChatMessage`

Without a single source of truth, state drift will appear over time.


## 3. Recommended Target Architecture

### 3.1 Core Principles

1. LLMs decide and plan.
2. Code executes and persists state.
3. Clarification is explicit.
4. Runs and step runs are the source of truth.
5. Group modes are specializations of routing, not separate ad hoc stacks.


### 3.2 Logical Components

#### Dispatcher Agent

Responsibility:

- Analyze the latest turn in context.
- Decide whether the turn should:
  - clarify
  - direct answer
  - direct skill execution
  - plan
  - resume existing run
  - enter debate mode
  - enter collaboration mode

Output:

```json
{
  "mode": "clarify | direct_answer | direct_skill | plan | resume_run | group_debate | group_collaboration",
  "reasoning": "...",
  "selected_skill_key": null,
  "requires_user_input": false,
  "existing_run_id": null,
  "clarifying_questions": []
}
```


#### Clarifier Agent

Responsibility:

- Ask only the smallest set of high-information questions required to proceed.
- Use brainstorming-style requirement clarification.
- Never create a plan.
- Never execute tools directly.

Input sources:

- current user message
- recent chat history
- employee persona and action guide
- dispatcher decision context

This agent should reuse the behavioral intent of the existing `skills/brainstorming/SKILL.md`.


#### Plan Agent

Responsibility:

- Transform a clarified request into a structured execution plan.
- Assign step executor types.
- Bind the best skill or workflow when applicable.

The plan agent must never execute steps.


#### Step Executor

Responsibility:

- Execute one step deterministically.
- Prefer code-level execution for tools, MCP, and workflows.
- Only use LLM freeform execution for purely cognitive steps such as analysis, synthesis, rewriting, or drafting.

The Step Executor is not a planning agent.


#### Run Service

Responsibility:

- Persist top-level run state.
- Advance state machine transitions.
- Manage approval, pause, resume, feedback, cancel.


## 4. Routing Rules

### 4.1 Decision order

The dispatcher should evaluate in the following order:

1. Is there an unfinished run for this chat that should be resumed?
2. Is the current request blocked by missing required information?
3. Can the request be handled as a direct answer?
4. Can the request be satisfied by a single skill or workflow call?
5. Does it require explicit planning?
6. Does the request require debate or collaboration instead of single-agent handling?


### 4.2 Direct answer

Use direct answer when the task is lightweight and does not need a visible step-by-step execution model.

Examples:

- greetings
- explanation requests
- summary requests
- lightweight transformation
- short recommendation


### 4.3 Direct skill execution

Use direct skill execution when all of the following are true:

1. The task is essentially one atomic operation.
2. Required parameters are already present.
3. The selected skill or workflow is sufficient by itself.
4. No user-visible multi-step approval is needed.

Examples:

- one search
- one image labeling task
- one MCP action with complete parameters
- one workflow invocation that already encapsulates the business process


### 4.4 Clarify

Use clarify only when the missing information is blocking.

Valid reasons:

- missing target entity for a write action
- missing time range for a scheduling or execution action
- missing output format when it materially changes the final deliverable
- missing participant scope for group collaboration
- missing constraints required to make the plan safe or useful

Do not ask clarifying questions for optional details that can be reasonably assumed.


### 4.5 Plan

Use plan when the task has one or more of the following characteristics:

- multiple dependent steps
- multiple artifacts
- intermediate analysis required before delivery
- explicit approval desired before execution
- final deliverable is clearly not a single atomic operation


### 4.6 Group debate vs group collaboration

- Use debate when the task requires multiple viewpoints.
- Use collaboration when the task requires cross-role execution with handoff.
- Do not interpret internal tool calls as multi-agent collaboration.


## 5. Recommended Plan Schema

The current `PlanStep` should be expanded into a stable execution contract.

```json
{
  "run_type": "single_plan",
  "requires_approval": true,
  "steps": [
    {
      "id": "step_1",
      "title": "明确研究范围",
      "goal": "得到清晰的研究范围、竞品范围和最终交付格式",
      "executor_type": "clarify | answer | skill | workflow | human_approval",
      "selected_skill_key": "brainstorming",
      "candidate_skill_keys": ["brainstorming"],
      "depends_on": [],
      "needs_confirmation": false,
      "success_criteria": "研究范围和交付要求明确",
      "artifact_key": "task_scope",
      "fallback_policy": "ask_user"
    }
  ]
}
```


## 6. Recommended API Design

The frontend should not decide whether to call planning or direct-answer endpoints first. The backend should provide one unified turn entrypoint.

### 6.1 Unified turn endpoint

`POST /agent/turns`

Request:

```json
{
  "chat_id": 123,
  "employee_id": 7,
  "message": "帮我做一份竞品分析，并给出合作建议",
  "group_id": null
}
```

Possible response forms:

```json
{
  "mode": "clarify",
  "questions": [
    "你希望覆盖哪些竞品？",
    "最终输出是汇报提纲还是完整初稿？"
  ]
}
```

```json
{
  "mode": "direct_answer",
  "answer": "..."
}
```

```json
{
  "mode": "direct_skill",
  "run_id": 456,
  "result": "..."
}
```

```json
{
  "mode": "plan",
  "run_id": 456,
  "requires_approval": true,
  "steps": []
}
```


### 6.2 Run detail endpoint

`GET /agent/runs/{run_id}`

Returns:

- run status
- current step
- step outputs
- waiting reason
- approval state


### 6.3 Approval endpoint

`POST /agent/runs/{run_id}/approve`

Used for:

- approving a plan
- approving the next step
- approving execution continuation after review points


### 6.4 Feedback endpoint

`POST /agent/runs/{run_id}/feedback`

Used for:

- correcting a step output
- requesting rerun of the current step
- adding missing constraints during execution


### 6.5 Step execution endpoint

`POST /agent/runs/{run_id}/steps/{step_id}/execute`

This may be called automatically by the backend or manually by the frontend.


### 6.6 Cancel endpoint

`POST /agent/runs/{run_id}/cancel`


## 7. Recommended Persistent Data Model

### 7.1 New or refactored top-level entities

#### AgentRun

Suggested fields:

- `id`
- `chat_id`
- `employee_id`
- `group_id`
- `mode`
- `status`
- `current_step_id`
- `pause_reason`
- `decision_snapshot`
- `context_data`
- `created_at`
- `updated_at`


#### AgentStepRun

Suggested fields:

- `id`
- `run_id`
- `step_id`
- `step_index`
- `title`
- `goal`
- `executor_type`
- `selected_skill_key`
- `status`
- `input_data`
- `output_data`
- `needs_confirmation`
- `pause_payload`
- `created_at`
- `updated_at`


### 7.2 Source of truth rule

`AgentRun` and `AgentStepRun` should be the source of truth.

The following should become derived or projection-style entities:

- `TaskProgress`
- `Todo`
- approval cards in chat history

`ChatMessage` should remain user-facing conversation state, not the authoritative runtime state machine.


## 8. Recommended File Structure Refactor

### 8.1 Keep existing routers thin

Existing routers should become thin wrappers around services.

### 8.2 Add the following modules

Suggested backend structure:

```text
backend/app/
  agents/
    dispatcher_agent.py
    clarifier_agent.py
    plan_agent.py
    assistant_agent.py
  services/
    dispatcher_service.py
    planning_service.py
    clarification_service.py
    run_service.py
    step_execution_service.py
    group_routing_service.py
    approval_service.py
  routers/
    agent_turns.py
    agent_runs.py
```


### 8.3 Responsibility mapping

#### `agents/dispatcher_agent.py`

- Model-facing routing prompt
- Returns `DispatchDecision`


#### `agents/clarifier_agent.py`

- Model-facing clarification prompt
- Returns a small set of questions


#### `agents/plan_agent.py`

- Model-facing plan generation prompt
- Returns stable structured step schema


#### `services/dispatcher_service.py`

- Entry point for `/agent/turns`
- Loads context
- Checks unfinished runs
- Calls dispatcher agent
- Fans out to direct answer, direct skill, clarify, or plan flows


#### `services/run_service.py`

- create run
- resume run
- advance run
- cancel run
- serialize run detail


#### `services/step_execution_service.py`

- execute one step
- execute deterministic skill or workflow
- call assistant for cognitive steps only
- write outputs back to run context


#### `routers/agent_turns.py`

- unified `POST /agent/turns`


#### `routers/agent_runs.py`

- `GET /agent/runs/{id}`
- `POST /agent/runs/{id}/approve`
- `POST /agent/runs/{id}/feedback`
- `POST /agent/runs/{id}/cancel`


## 9. Changes Recommended For Existing Files

### 9.1 `backend/app/agents/task_planner_agent.py`

Change the output contract so it matches the backend parser.

Current direction should be replaced with:

- return JSON object
- include `execution_mode`
- include `plan_steps`
- include `clarifying_question`
- do not return list-only output


### 9.2 `backend/app/agent_manager.py`

Replace the current report-oriented agent registry with a general orchestration registry.

Target registry:

- DispatcherAgent
- ClarifierAgent
- PlanAgent
- AssistantAgent
- Step execution utilities

The following agents should no longer be central to generic orchestration:

- `FrameworkAgent`
- `TaskCompositionAgent`

They may remain as specialized skills or optional specialist agents if still needed.


### 9.3 `backend/app/mcp_server.py`

Split the file incrementally.

Migration target:

- keep compatibility routes temporarily
- move internal routing logic into services
- reduce the module to compatibility entrypoints plus group-mode legacy wrappers


### 9.4 `backend/app/routers/workflow_runs.py`

Either:

- keep as workflow-specific runtime support, or
- fold into the generalized `agent_runs` abstraction if workflows become a step executor type inside the unified run model


## 10. Migration Plan

### Phase 1: Stabilize contracts

1. Fix planner output schema.
2. Introduce `DispatchDecision` schema.
3. Stop executing plain `List[str]` plans.


### Phase 2: Introduce unified dispatcher path

1. Add `/agent/turns`.
2. Add dispatcher service.
3. Route old `/generate_plan` and `/answer_direct` internally through dispatcher service.


### Phase 3: Introduce generalized run state

1. Add `AgentRun` and `AgentStepRun`.
2. Migrate current step execution and approval flow to run-based state.
3. Make `confirm_step` a real state transition.


### Phase 4: Shrink the large orchestration module

1. Move direct-answer flow into `dispatcher_service.py`.
2. Move plan generation into `planning_service.py`.
3. Move step execution into `step_execution_service.py`.
4. Leave `mcp_server.py` as a thin compatibility layer until frontend migration is complete.


### Phase 5: Add evaluation coverage

Build routing evals for:

- `clarify`
- `direct_answer`
- `direct_skill`
- `plan`
- `resume_run`
- `group_debate`
- `group_collaboration`

Also add contract tests for:

- planner JSON validity
- approval transitions
- feedback rerun transitions
- deterministic execution of skill and workflow steps


## 11. Final Recommendation

The most reasonable solution for this codebase is not to add more freeform agents.

The correct move is to introduce:

1. one strong dispatcher,
2. one explicit clarifier built around brainstorming-style clarification,
3. one pure plan agent,
4. one deterministic step executor,
5. one run-based state machine as the truth source.

This matches mainstream production agent architecture better than a large all-in-one prompt router and is much easier to make stable.