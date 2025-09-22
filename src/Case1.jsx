import React, { useState, useEffect, useRef } from 'react';
import './Case1.css';

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

function ChatPanel({ sensors }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [showBanner, setShowBanner] = useState(false);
  const chatViewRef = useRef(null);
  const prevS2Ref = useRef(sensors.s2);

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
    const normalizedInput = userInput.replace('　', ' ').toLowerCase();

    if (sensors.s2 === SENSOR_STATUS.ABNORMAL) {
      if (normalizedInput.includes('何が発生') ||
          normalizedInput.includes('何が起き')) {
        return 'パレタイジングエラーにより自動停止しました。';
      }

      if (normalizedInput.includes('どうしたら') ||
          normalizedInput.includes('どうすれば') ||
          normalizedInput.includes('対処')) {
        return 'センサー2の信号が確認できません。センサー2の状態を確認してください。';
      }
    }

    if (sensors.s2 === SENSOR_STATUS.ABNORMAL && sensors.s1 === SENSOR_STATUS.ABNORMAL) {
      return 'センサー1とセンサー2が異常です。原因切り分けのため、配線・位置ズレ・汚れをご確認ください。';
    }

    if (sensors.s2 === SENSOR_STATUS.ABNORMAL) {
      return 'センサー2が異常です。原因切り分けのため、配線・位置ズレ・汚れをご確認ください。';
    }

    if (sensors.s1 === SENSOR_STATUS.ABNORMAL) {
      return 'センサー1が異常です。原因切り分けのため、配線・位置ズレ・汚れをご確認ください。';
    }

    return '現在、全センサーは正常です。';
  };

  const handleSend = async () => {
    const msg = inputText.trim();
    if (!msg) return;

    const userMessage = {
      role: 'user',
      text: msg,
      timestamp: new Date().toISOString(),
      sensorState: { ...sensors }
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');

    const reply = await processUserMessage(msg);

    setTimeout(() => {
      const assistantMessage = {
        role: 'assistant',
        text: reply,
        timestamp: new Date().toISOString(),
        sensorState: { ...sensors }
      };
      setMessages(prev => [...prev, assistantMessage]);
    }, 300);
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
              <span>{msg.text}</span>
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
          />
          <button className="send-button" onClick={handleSend}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
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

  const handleSensorChange = (sensorKey, status) => {
    setSensors(prev => ({
      ...prev,
      [sensorKey]: status
    }));
  };

  return (
    <div className="case1-app">
      <div className="case1-header">
        <h1 className="case1-title">センサー/PLC × AIチャット</h1>
      </div>

      <div className="case1-container">
        <SensorPanel
          sensors={sensors}
          onSensorChange={handleSensorChange}
        />
        <div className="divider"></div>
        <ChatPanel sensors={sensors} />
      </div>
    </div>
  );
}

export default Case1;