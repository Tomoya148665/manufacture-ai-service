import React, { useState, useEffect, useRef } from 'react';
import './Case1.css';
import { generateAIResponse, loadSensorStates, getSensorContext } from './api/openai';
import LogManager from './utils/logManager';
import LogPanel from './components/LogPanel';

const SENSOR_STATUS = {
  NORMAL: '正常',
  ABNORMAL: '異常'
};

function Lamp({ status }) {
  const isNormal = status === SENSOR_STATUS.NORMAL;
  return (
    <div
      className="lamp"
      style={{ backgroundColor: isNormal ? '#C9CDD2' : '#E64A4A' }}
    />
  );
}

function SensorPanel({ sensors, onSensorChange }) {
  return (
    <div className="panel left-panel">
      <h2 className="panel-title">センサー・PLC側</h2>

      <div className="sensor-status-grid">
        <Lamp status={sensors.s1} />
        <span className="sensor-label">センサー1　{sensors.s1}</span>

        <Lamp status={sensors.s2} />
        <span className="sensor-label">センサー2　{sensors.s2}</span>
      </div>

      <div className="middle-section">
        <div className="button-section">
          <p className="subtle-label">センサー状態変更ボタン</p>
          <div className="button-row">
            <button
              className="pill-button"
              onClick={() => onSensorChange('s1', SENSOR_STATUS.NORMAL)}
            >
              センサー1<br/>正常
            </button>
            <button
              className="pill-button"
              onClick={() => onSensorChange('s1', SENSOR_STATUS.ABNORMAL)}
            >
              センサー1<br/>異常
            </button>
            <button
              className="pill-button"
              onClick={() => onSensorChange('s2', SENSOR_STATUS.NORMAL)}
            >
              センサー2<br/>正常
            </button>
            <button
              className="pill-button"
              onClick={() => onSensorChange('s2', SENSOR_STATUS.ABNORMAL)}
            >
              センサー2<br/>異常
            </button>
          </div>
        </div>
      </div>

      <div className="spacer"></div>
    </div>
  );
}

function ChatPanel({ sensors, logManager }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [showBanner, setShowBanner] = useState(false);
  const [sensorStates, setSensorStates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatViewRef = useRef(null);
  const prevS2Ref = useRef(sensors.s2);

  useEffect(() => {
    const loadCSV = async () => {
      const states = await loadSensorStates('/sensor_states.csv');
      setSensorStates(states);
    };
    loadCSV();
  }, []);

  useEffect(() => {
    if (prevS2Ref.current !== SENSOR_STATUS.ABNORMAL &&
        sensors.s2 === SENSOR_STATUS.ABNORMAL) {
      setShowBanner(true);
    }

    if (sensors.s2 === SENSOR_STATUS.NORMAL) {
      setShowBanner(false);
    } else if (sensors.s2 === SENSOR_STATUS.ABNORMAL) {
      setShowBanner(true);
    }

    prevS2Ref.current = sensors.s2;
  }, [sensors.s2]);

  useEffect(() => {
    if (chatViewRef.current) {
      chatViewRef.current.scrollTop = chatViewRef.current.scrollHeight;
    }
  }, [messages]);

  const processUserMessage = async (userInput) => {
    const sensorContext = getSensorContext(sensors, sensorStates);

    // 会話履歴を準備（role, contentの形式に変換）
    const conversationHistory = messages.map(msg => ({
      role: msg.role,
      content: msg.text
    }));

    const aiResponse = await generateAIResponse(userInput, sensorContext, conversationHistory);
    return aiResponse;
  };

  const handleSend = async () => {
    const msg = inputText.trim();
    if (!msg || isLoading) return;

    const userMessage = {
      role: 'user',
      text: msg,
      timestamp: new Date().toISOString(),
      sensorState: { ...sensors }
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    // チャットメッセージをログに記録
    logManager.current.logChatMessage('user', msg, sensors);

    try {
      const reply = await processUserMessage(msg);

      const assistantMessage = {
        role: 'assistant',
        text: reply,
        timestamp: new Date().toISOString(),
        sensorState: { ...sensors }
      };
      setMessages(prev => [...prev, assistantMessage]);

      // AIレスポンスをログに記録
      logManager.current.logChatMessage('assistant', reply, sensors);
    } catch (error) {
      console.error('Error generating response:', error);
      const errorMessage = {
        role: 'assistant',
        text: 'エラーが発生しました。もう一度お試しください。',
        timestamp: new Date().toISOString(),
        sensorState: { ...sensors }
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getMessagePrefix = (role) => {
    switch(role) {
      case 'user': return '👤';
      case 'assistant': return '🤖';
      case 'system': return '⚠️';
      default: return '';
    }
  };

  return (
    <div className="panel right-panel">
      <h2 className="panel-title">AIシステム側</h2>

      <div className="ai-status">
        <div>センサー1　{sensors.s1}</div>
        <div>センサー2　{sensors.s2}</div>
      </div>

      {showBanner && (
        <div className="alert-banner">
          パレタイジング異常です
        </div>
      )}

      <p className="subtle-label">AIチャット画面</p>

      <div className="chat-frame">
        <div className="chat-view" ref={chatViewRef}>
          {messages.map((msg, idx) => (
            <div key={idx} className="chat-message">
              <span className="message-prefix">{getMessagePrefix(msg.role)}</span>
              <span style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</span>
            </div>
          ))}
        </div>

        <div className="chat-input-row">
          <textarea
            className="chat-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="メッセージを入力（Ctrl+Enterで送信）"
            rows="2"
            disabled={isLoading}
          />
          <button className="send-button" onClick={handleSend} disabled={isLoading}>
            {isLoading ? (
              <span>...</span>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Case1() {
  const [sensors, setSensors] = useState({
    s1: SENSOR_STATUS.NORMAL,
    s2: SENSOR_STATUS.NORMAL
  });
  const [showLogPanel, setShowLogPanel] = useState(false);
  const logManagerRef = useRef(new LogManager());

  const handleSensorChange = (sensorKey, status) => {
    // 現在の状態を取得
    const currentStatus = sensors[sensorKey];

    // 状態が変更された場合のみ更新とログ記録
    if (currentStatus !== status) {
      // ログに記録（setSensorsの外で実行）
      logManagerRef.current.logSensorChange(
        sensorKey,
        currentStatus,
        status
      );

      // 状態を更新
      setSensors(prev => ({
        ...prev,
        [sensorKey]: status
      }));
    }
  };

  return (
    <div className="case1-app">
      <div className="case1-header">
        <h1 className="case1-title">センサー/PLC × AIチャット</h1>
        <button
          className="log-button"
          onClick={() => setShowLogPanel(true)}
          style={{
            position: 'absolute',
            right: '20px',
            top: '50%',
            transform: 'translateY(-50%)',
            padding: '8px 20px',
            backgroundColor: '#4a9eff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          ログ管理
        </button>
      </div>

      <div className="case1-container">
        <SensorPanel
          sensors={sensors}
          onSensorChange={handleSensorChange}
        />
        <div className="divider"></div>
        <ChatPanel sensors={sensors} logManager={logManagerRef} />
      </div>

      <LogPanel
        logManager={logManagerRef}
        isVisible={showLogPanel}
        onClose={() => setShowLogPanel(false)}
      />
    </div>
  );
}

export default Case1;