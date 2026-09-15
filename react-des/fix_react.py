import re
import os

filepath = 'src/pages/ChatWorkspace.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    text = f.read()

pattern1 = re.compile(r'(const response = await reasonerRef\.current\.thinkSequentially\(combinedMessage, memberId, chatIdRef\.current\);)\s*const planText =.*?const aiResponseText = Here is my updated plan:[^]+;', re.DOTALL)

def repl1(m):
    return '''const response = await reasonerRef.current.thinkSequentially(combinedMessage, memberId, chatIdRef.current);

              if (response.clarifying_question && (!response.plan || response.plan.length === 0)) {
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1] = { type: 'ai', text: response.clarifying_question };
                  return newMsgs;
                });
                saveMessage('assistant', response.clarifying_question, memberId, 'text');
                setExecutionState('idle');
                return;
              }

              const planText = response.plan && response.plan.length > 0
                ? response.plan.map((step, idx) => ${idx + 1}. ).join('\\n')
                : "未生成明确的步骤。";

              const aiResponseText = 这是我更新后的计划：\\n\\n\\n\\n我们是否继续？（回复“好的”、“ok”确认，或者提出修改意见）;'''

text = pattern1.sub(repl1, text)

pattern2 = re.compile(r"(const response = await reasonerRef\.current\.thinkSequentially\(message, memberId, chatIdRef\.current\);)\s*// Format plan as text\s*const planText =.*?const aiResponseText = Here is my proposed plan:[^]+;", re.DOTALL)

def repl2(m):
    return '''const response = await reasonerRef.current.thinkSequentially(message, memberId, chatIdRef.current);

      if (response.clarifying_question && (!response.plan || response.plan.length === 0)) {
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1] = { type: 'ai', text: response.clarifying_question };
          return newMsgs;
        });
        saveMessage('assistant', response.clarifying_question, memberId, 'text');
        setExecutionState('idle');
        setIsProcessing(false);
        return;
      }

      // Format plan as text
      const planText = response.plan && response.plan.length > 0
        ? response.plan.map((step, idx) => ${idx + 1}. ).join('\\n')
        : "未生成明确的步骤。";

      const aiResponseText = 这是我提议的计划：\\n\\n\\n\\n我们是否继续？（回复“好的”、“ok”确认，或者提出修改意见）;'''

text = pattern2.sub(repl2, text)

text = text.replace('Thinking... Generating a plan for you.', '思考中... 正在为您规划，请稍候。')
text = text.replace('Thinking... Re-evaluating based on your feedback.', '思考中... 正在根据您的反馈重新规划。')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)

print('Edited successfully')
