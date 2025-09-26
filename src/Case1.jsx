import React, { useState, useEffect, useRef } from 'react';
import './Case1.css';
import { generateAIResponse, loadSensorStates, getSensorContext } from './api/openai';
import LogManager from './utils/logManager';
import LogPanel from './components/LogPanel';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';

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
  const [voiceMode, setVoiceMode] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const chatViewRef = useRef(null);
  const prevS2Ref = useRef(sensors.s2);

  // 音声認識と音声合成のフック
  const {
    isListening,
    transcript,
    error: speechError,
    startListening,
    stopListening,
    clearTranscript,
    isSupported: isSpeechRecognitionSupported
  } = useSpeechRecognition();

  const {
    isSpeaking,
    speak,
    stop: stopSpeaking,
    isSupported: isSpeechSynthesisSupported
  } = useSpeechSynthesis();

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

  const processUserMessage = async (userInput, currentSensors) => {
    // 最新のセンサー状態を使用
    const sensorContext = getSensorContext(currentSensors || sensors, sensorStates);

    // 会話履歴を準備（role, contentの形式に変換）
    // ただし、センサー状態に関する言及は除外する
    const conversationHistory = messages.map(msg => ({
      role: msg.role,
      content: msg.text
    })).slice(-5); // 直近5件に制限して、過去の状態の影響を減らす

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
      // 最新のセンサー状態を明示的に渡す
      const reply = await processUserMessage(msg, sensors);

      const assistantMessage = {
        role: 'assistant',
        text: reply,
        timestamp: new Date().toISOString(),
        sensorState: { ...sensors }
      };
      setMessages(prev => [...prev, assistantMessage]);

      // AIレスポンスをログに記録
      logManager.current.logChatMessage('assistant', reply, sensors);

      // 音声モードの場合は読み上げ
      if (voiceMode && isSpeechSynthesisSupported) {
        speak(reply);
      }
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

  // 音声入力の処理
  useEffect(() => {
    if (transcript && voiceMode) {
      // 音声認識のテキストを表示
      setInputText(transcript);
    }
  }, [transcript, voiceMode]);

  // 音声モードの切り替え
  const toggleVoiceMode = () => {
    if (voiceMode) {
      // 音声モードをOFF
      stopListening();
      stopSpeaking();
      setVoiceMode(false);
    } else {
      // 音声モードをON
      setVoiceMode(true);
    }
  };

  // マイクボタンの処理
  const handleMicButton = () => {
    if (isListening) {
      // 録音停止
      stopListening();

      // テキストがある場合のみ送信（重複送信を防ぐ）
      if (inputText && inputText.trim() && !isSending) {
        setIsSending(true);

        // 少し遅延を入れて送信（音声認識の最終処理を待つ）
        setTimeout(() => {
          handleSend();
          clearTranscript();
          setInputText('');

          // 送信完了後にフラグをリセット
          setTimeout(() => {
            setIsSending(false);
          }, 1000);
        }, 100);
      } else {
        // テキストがない場合はクリアのみ
        clearTranscript();
        setInputText('');
      }
    } else {
      // 録音開始前にクリア
      clearTranscript();
      setInputText('');
      setIsSending(false);
      // AIの音声を停止
      stopSpeaking();
      startListening();
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
          {voiceMode && isSpeechRecognitionSupported ? (
            <div className="voice-input-container" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', padding: '10px' }}>
              <button
                className={`mic-button ${isListening ? 'listening' : ''}`}
                onClick={handleMicButton}
                disabled={isSending || isLoading}
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  backgroundColor: isSending ? '#999' : (isListening ? '#ff4444' : '#4a9eff'),
                  border: 'none',
                  color: 'white',
                  cursor: isSending ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: isListening ? 'pulse 1.5s infinite' : 'none',
                  opacity: isSending ? 0.6 : 1
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              </button>
              <div style={{ flex: 1 }}>
                {isListening ? (
                  <div>
                    <div style={{ color: '#ff4444', fontWeight: 'bold' }}>🔴 録音中...</div>
                    {transcript && (
                      <div style={{ marginTop: '5px', color: '#333' }}>{transcript}</div>
                    )}
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
                      話し終わったら、もう一度マイクボタンをタップしてください
                    </div>
                  </div>
                ) : transcript ? (
                  <div>
                    <div style={{ color: '#333' }}>{transcript}</div>
                    <div style={{ fontSize: '12px', color: '#4a9eff', marginTop: '5px' }}>
                      送信中...
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#999' }}>
                    マイクボタンをタップして話してください
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}

          {/* 音声モード切り替えボタン */}
          <button
            className="voice-toggle-button"
            onClick={toggleVoiceMode}
            disabled={!isSpeechRecognitionSupported || !isSpeechSynthesisSupported}
            title={voiceMode ? 'テキスト入力に切り替え' : '音声入力に切り替え'}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: voiceMode ? '#28a745' : '#6c757d',
              border: 'none',
              color: 'white',
              cursor: isSpeechRecognitionSupported ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '10px',
              opacity: isSpeechRecognitionSupported ? 1 : 0.5
            }}
          >
            {voiceMode ? (
              // テキスト入力アイコン（キーボード）
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
                <line x1="6" y1="8" x2="6" y2="8"></line>
                <line x1="10" y1="8" x2="10" y2="8"></line>
                <line x1="14" y1="8" x2="14" y2="8"></line>
                <line x1="18" y1="8" x2="18" y2="8"></line>
                <line x1="8" y1="12" x2="8" y2="12"></line>
                <line x1="12" y1="12" x2="12" y2="12"></line>
                <line x1="16" y1="12" x2="16" y2="12"></line>
                <rect x="7" y="16" width="10" height="0.01"></rect>
              </svg>
            ) : (
              // マイクアイコン（音声入力）
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
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