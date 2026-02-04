import React, { useState } from 'react';
import { KeyInput } from './components/KeyInput';
import { SessionInput } from './components/SessionInput';
import { ActivateButton } from './components/ActivateButton';
import { LogConsole, LogEntry } from './components/LogConsole';
import { checkKey, activateKey, checkStatus } from './services/api';

function App() {
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
      
      // Parse sessionJson to ensure it's valid, but send as string if that's what API expects
      // The PRD says "API expects user field to be string or object".
      // We will try to parse it to validate, but send the raw string or parsed object.
      // Let's send the raw string first as per "user inserts as text".
      // Actually, axios will serialize object if we pass object. 
      // Let's try to parse it to ensure validity, then pass the PARSED object to activateKey.
      let sessionData;
      try {
        // Validate JSON format
        sessionData = JSON.parse(sessionJson);
      } catch (e) {
        throw new Error('Неверный формат JSON сессии.');
      }

      // API expects the user field to be a JSON string, not an object
      const activationResult = await activateKey(cdkKey, JSON.stringify(sessionData));
      const taskId = activationResult; // API returns the UUID string directly
      
      if (!taskId) {
        throw new Error('Не получен taskId от запроса активации.');
      }
      addLog(`Запрос отправлен. ID задачи: ${taskId}`, 'success');

      // Step 3: Poll Status
      addLog('Ожидание активации...', 'info');
      let isPending = true;
      let attempts = 0;
      const maxAttempts = 60; // Timeout after ~2 minutes
      
      while (isPending && attempts < maxAttempts) {
        await sleep(2000); // Wait 2 seconds
        attempts++;
        
        const statusResult = await checkStatus(taskId);
        console.log('Polling status:', statusResult); // Log for debugging
        
        if (!statusResult.pending) {
          isPending = false;
          if (statusResult.success) {
            addLog('Успешно активировано!', 'success');
          } else {
            const errorMsg = statusResult.message || 'Активация не удалась с неизвестной ошибкой.';
            // Sometimes the API returns success: false but with a message explaining why
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
        console.log('Error Response:', error.response);
        if (error.response.data) {
           // Try to extract meaningful message from response data
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

export default App;
