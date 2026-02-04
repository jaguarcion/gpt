import React, { useState } from 'react';
import { KeyInput } from '../components/KeyInput';
import { SessionInput } from '../components/SessionInput';
import { ActivateButton } from '../components/ActivateButton';
import { LogConsole, LogEntry } from '../components/LogConsole';
import { checkKey, activateKey, checkStatus } from '../services/api';

export function Home() {
  const [cdkKey, setCdkKey] = useState('');
  const [sessionJson, setSessionJson] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleActivate = async () => {
    if (!cdkKey.trim()) {
      addLog('Ошибка: Требуется CDK-ключ', 'error');
      return;
    }
    if (!sessionJson.trim()) {
      addLog('Ошибка: Требуется JSON сессии', 'error');
      return;
    }

    setIsLoading(true);
    setLogs([]); // Clear previous logs
    addLog('Запуск процесса активации...', 'info');

    try {
      // Step 1: Check Key
      addLog(`Проверка ключа: ${cdkKey}...`, 'info');
      const checkResult = await checkKey(cdkKey);
      
      if (checkResult.used) {
        throw new Error('Ключ уже использован.');
      }
      addLog('Ключ действителен.', 'success');

      // Step 2: Request Activation
      addLog('Отправка запроса на активацию...', 'info');
      
      let sessionData;
      try {
        sessionData = JSON.parse(sessionJson);
      } catch (e) {
        throw new Error('Неверный формат JSON сессии.');
      }

      const activationResult = await activateKey(cdkKey, JSON.stringify(sessionData));
      const taskId = activationResult; 
      
      if (!taskId) {
        throw new Error('Не получен taskId от запроса активации.');
      }
      addLog(`Запрос отправлен. ID задачи: ${taskId}`, 'success');

      // Step 3: Poll Status
      addLog('Ожидание активации...', 'info');
      let isPending = true;
      let attempts = 0;
      const maxAttempts = 60; 
      
      while (isPending && attempts < maxAttempts) {
        await sleep(2000); 
        attempts++;
        
        const statusResult = await checkStatus(taskId);
        
        if (!statusResult.pending) {
          isPending = false;
          if (statusResult.success) {
            addLog('Успешно активировано!', 'success');
          } else {
            const errorMsg = statusResult.message || 'Активация не удалась с неизвестной ошибкой.';
            throw new Error(errorMsg);
          }
        } else {
          addLog(`Статус: В ожидании... (Попытка ${attempts}/${maxAttempts})`, 'info');
        }
      }

      if (isPending) {
        throw new Error('Время ожидания активации истекло. Пожалуйста, проверьте статус вручную позже.');
      }

    } catch (error: any) {
      console.error('Activation error:', error);
      let errorMessage = error.message || 'Произошла неизвестная ошибка';

      if (error.response) {
        if (error.response.data) {
           if (typeof error.response.data === 'string') {
             errorMessage = error.response.data;
           } else {
             errorMessage = error.response.data.message || 
                            error.response.data.error || 
                            JSON.stringify(error.response.data);
           }
        }
        errorMessage += ` (Статус: ${error.response.status})`;
      }
      
      addLog(`Ошибка: ${errorMessage}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 shadow-xl backdrop-blur-sm space-y-6">
          <KeyInput 
            value={cdkKey} 
            onChange={setCdkKey} 
            disabled={isLoading} 
          />
          
          <SessionInput 
            value={sessionJson} 
            onChange={setSessionJson} 
            disabled={isLoading} 
          />

          <ActivateButton 
            onClick={handleActivate} 
            isLoading={isLoading} 
            disabled={!cdkKey || !sessionJson}
          />
        </div>

        <LogConsole logs={logs} />
      </div>
    </div>
  );
}
