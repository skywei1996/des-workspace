import React, { useState } from 'react';
import { useLanguage } from '../i18n';

const TodoListManager = ({ todos, collapsed, onToggleCollapse }) => {
  const { t } = useLanguage();

  if (!Array.isArray(todos) || todos.length === 0) return null;

  return (
    <div className="mx-6 mb-4 bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div 
        className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={onToggleCollapse}
      >
        <h4 className="text-sm font-semibold text-gray-900">{t('todos.title')}</h4>
        <span className={`text-xs text-gray-600 transition-transform ${collapsed ? '-rotate-90' : ''}`}>▼</span>
      </div>
      <div className={`transition-all overflow-hidden ${collapsed ? 'max-h-0' : 'max-h-[200px]'}`}>
        <div className="p-3 max-h-[200px] overflow-y-auto">
          {todos.map((todo) => (
            <div
              key={todo.id}
              className={`flex items-start gap-2.5 px-3 py-2 mb-1.5 rounded-lg transition-colors ${todo.level === 1 ? 'ml-6 bg-amber-50 hover:bg-amber-100/70 border border-amber-100' : 'bg-gray-50 hover:bg-gray-100'}`}
            >
              {todo.status === 'completed' ? (
                <div className="w-4 h-4 mt-0.5 bg-green-500 border-2 border-green-500 rounded flex items-center justify-center text-white text-[10px] flex-shrink-0">✓</div>
              ) : todo.status === 'in-progress' ? (
                <div className="w-4 h-4 mt-0.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
              ) : (
                <div className="w-4 h-4 mt-0.5 border-2 border-gray-300 rounded flex-shrink-0"></div>
              )}
              <div className="flex-1 min-w-0">
                {todo.level === 1 ? (
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">{t('todos.workflow')}</div>
                ) : null}
                <div className={`text-[13px] leading-relaxed ${todo.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                  {todo.text}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const CurrentTasksCard = ({ todos }) => {
  const { t } = useLanguage();

  if (todos.length === 0) return null;

  const actionableTodos = todos.filter((todo) => !todo.hiddenFromSummary);
  const completedCount = actionableTodos.filter((todo) => todo.status === 'completed').length;

  return (
    <div className="bg-white rounded-lg border border-gray-200 mb-3 overflow-hidden hover:shadow-md transition-all">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <div className="text-sm font-semibold text-gray-800">{t('todos.currentTasks')}</div>
        <div className="text-[11px] px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
          {completedCount}/{actionableTodos.length} {t('todos.done')}
        </div>
      </div>
      <div className="px-4 py-3">
        {todos.map((todo) => (
          <div key={todo.id} className={`flex items-start gap-2 mb-2 last:mb-0 ${todo.level === 1 ? 'ml-4' : ''}`}>
            <div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${
              todo.status === 'completed' ? 'bg-green-500' : 
              todo.status === 'in-progress' ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
            }`} />
            <div className="min-w-0">
              {todo.level === 1 ? (
                <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">{t('todos.workflow')}</div>
              ) : null}
              <div className={`text-xs leading-relaxed ${todo.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                {todo.text}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TodoListManager;
