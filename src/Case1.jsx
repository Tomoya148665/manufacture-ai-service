import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import './Case1.css';
import { generateAIResponse, loadSensorStates, getSensorContext } from './api/openai';
import LogManager from './utils/logManager';
import LogPanel from './components/LogPanel';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import { transcribeBlob, synthesizeSpeech, playAudioBlob } from './utils/audioClient';

const SENSOR_STATUS = {
  NORMAL: '正常',
  ABNORMAL: '異常'
};

function Lamp({ status }) {
  const isNormal = status === SENSOR_STATUS.NORMAL;
  return (
    <div
      className={`lamp ${isNormal ? 'normal' : 'abnormal'}`}
      style={{
        backgroundColor: isNormal ? '#4CAF50' : '#E64A4A',
        boxShadow: isNormal
          ? '0 0 20px rgba(76, 175, 80, 0.8), inset 0 0 10px rgba(255, 255, 255, 0.3)'
          : '0 0 20px rgba(230, 74, 74, 0.8), inset 0 0 10px rgba(255, 255, 255, 0.3)',
        animation: isNormal ? 'pulseGreen 2s infinite' : 'pulseRed 2s infinite'
      }}
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
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const chatViewRef = useRef(null);
  const prevS2Ref = useRef(sensors.s2);

  // 音声認識と音声合成のフック
  const {
    isListening,
    transcript,
    finalTranscript,
    interimTranscript,
    isSilent,
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
    // どちらか片方でも異常になったらアラートを表示
    if (sensors.s1 === SENSOR_STATUS.ABNORMAL || sensors.s2 === SENSOR_STATUS.ABNORMAL) {
      setShowBanner(true);
    } else {
      setShowBanner(false);
    }

    prevS2Ref.current = sensors.s2;
  }, [sensors.s1, sensors.s2]);

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
    console.log('📤 handleSend呼び出し');
    console.log('📝 送信メッセージ:', msg);
    console.log('🔄 isLoading:', isLoading);
    console.log('🎤 voiceMode:', voiceMode);

    if (!msg || isLoading) {
      console.log('⚠️ 送信キャンセル: メッセージ空またはLoading中');
      return;
    }

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
      console.log('🤖 AIレスポンスを取得中...');
      const reply = await processUserMessage(msg, sensors);
      console.log('✅ AIレスポンス取得完了:', reply);

      const assistantMessage = {
        role: 'assistant',
        text: reply,
        timestamp: new Date().toISOString(),
        sensorState: { ...sensors }
      };
      setMessages(prev => [...prev, assistantMessage]);

      // AIレスポンスをログに記録
      logManager.current.logChatMessage('assistant', reply, sensors);

      if (voiceMode) {
        console.log('🔊 音声モード: AIレスポンスを読み上げます');
        try {
          // OpenAI TTSを優先的に使用
          console.log('🌐 OpenAI TTSを使用します');
          const audioBlob = await synthesizeSpeech(reply);
          playAudioBlob(audioBlob);
          console.log('✅ OpenAI音声再生開始');
        } catch (e) {
          console.error('❌ OpenAI TTS エラー:', e);
          // OpenAI TTSが失敗した場合、ブラウザAPIにフォールバック
          console.log('🔄 ブラウザAPIにフォールバックします');
          if (isSpeechSynthesisSupported) {
            speak(reply);
            console.log('✅ 音声合成開始 (ブラウザAPI)');
          } else {
            console.error('❌ 音声合成が利用できません');
          }
        }
      } else {
        console.log('🔇 テキストモード: 音声合成をスキップ');
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
    console.log('🎯 transcript変更検出:', transcript);
    console.log('🎯 voiceMode:', voiceMode);
    console.log('🎯 isListening:', isListening);

    if (transcript && voiceMode) {
      // 音声認識のテキストを表示
      console.log('📝 音声認識テキストを入力欄に設定:', transcript);
      setInputText(transcript);
    }
  }, [transcript, voiceMode]);

  // 沈黙検出による自動送信
  useEffect(() => {
    if (isSilent && finalTranscript && voiceMode && !isLoading && isListening) {
      console.log('🔇 沈黙を検出、自動送信を実行');
      console.log('📝 送信テキスト:', finalTranscript);

      // 自動送信を実行
      const sendMessage = async () => {
        const msg = finalTranscript.trim();
        if (msg) {
          // 入力欄にテキストを設定
          setInputText(msg);

          // メッセージを送信
          await handleSend();

          // トランスクリプトをクリア
          clearTranscript();
          setInputText('');

          // 音声認識を継続（会話を継続）
          console.log('🔄 音声認識を継続');
        }
      };

      sendMessage();
    }
  }, [isSilent, finalTranscript, voiceMode, isLoading, isListening]);

  // 音声モードの切り替え
  const toggleVoiceMode = () => {
    console.log('🔄 音声モード切替');
    console.log('現在のvoiceMode:', voiceMode);
    console.log('isSpeechRecognitionSupported:', isSpeechRecognitionSupported);
    console.log('isSpeechSynthesisSupported:', isSpeechSynthesisSupported);

    if (voiceMode) {
      // 音声モードをOFF
      console.log('📴 音声モードをOFFにします');
      stopListening();
      stopSpeaking();
      setVoiceMode(false);
    } else {
      // 音声モードをON
      console.log('📱 音声モードをONにします');
      setVoiceMode(true);
    }
  };

  // マイクボタンの処理（Web Speech API 優先、非対応時はMediaRecorderでサーバSTT）
  const handleMicButton = async () => {
    console.log('🔘 マイクボタンクリック');
    console.log('isSpeechRecognitionSupported:', isSpeechRecognitionSupported);
    console.log('isListening:', isListening);
    console.log('voiceMode:', voiceMode);

    if (isSpeechRecognitionSupported) {
      if (isListening) {
        console.log('⏹️ 会話を終了します');
        stopListening();
        // 最終的なテキストがあれば送信
        if (finalTranscript && finalTranscript.trim()) {
          setInputText(finalTranscript);
          await handleSend();
          clearTranscript();
          setInputText('');
        }
      } else {
        console.log('🎤 会話を開始します');
        clearTranscript();
        setInputText('');
        setIsSending(false);
        stopSpeaking();
        await startListening();
      }
      return;
    }

    if (!isRecording) {
      clearTranscript();
      setInputText('');
      setIsSending(false);
      stopSpeaking();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
        const mr = new MediaRecorder(stream, { mimeType });
        recordedChunksRef.current = [];
        mr.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        mr.onstop = async () => {
          try {
            const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
            const text = await transcribeBlob(blob, 'audio/webm');
            if (text && !isSending) {
              setInputText(text);
              setIsSending(true);
              setTimeout(async () => {
                await handleSend();
                setInputText('');
                setTimeout(() => setIsSending(false), 1000);
              }, 50);
            }
          } catch (err) {
            console.error('Transcription error:', err);
          } finally {
            stream.getTracks().forEach(t => t.stop());
            mediaRecorderRef.current = null;
          }
        };
        mediaRecorderRef.current = mr;
        mr.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Mic access error:', err);
      }
    } else {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== 'inactive') {
        mr.stop();
      }
      setIsRecording(false);
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

      {/* AI状態カード */}
      <div className="ai-status-card">
        <div className="ai-status-header">
          <div className="ai-status-indicator">
            <div className="ai-status-dot"></div>
            <span>AI稼働中</span>
          </div>
        </div>

        <div className="sensor-status-row">
          <div className={`sensor-card ${sensors.s1 === '正常' ? 'normal' : 'abnormal'}`}>
            <div className="sensor-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div className="sensor-info">
              <span className="sensor-name">センサー1</span>
              <span className="sensor-value">{sensors.s1}</span>
            </div>
          </div>

          <div className={`sensor-card ${sensors.s2 === '正常' ? 'normal' : 'abnormal'}`}>
            <div className="sensor-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div className="sensor-info">
              <span className="sensor-name">センサー2</span>
              <span className="sensor-value">{sensors.s2}</span>
            </div>
          </div>
        </div>

      </div>

      {showBanner && (
        <div className="alert-banner-enhanced">
          <div className="alert-icon-pulse">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
          </div>
          <div className="alert-content">
            <div className="alert-title">異常検知</div>
            <div className="alert-message">パレタイジング異常が発生しています</div>
          </div>
          <div className="alert-timestamp">{new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      )}

      <p className="subtle-label">AIチャット画面</p>

      <div className="chat-frame">
        {/* 音声機能のサポート状況やエラー表示 */}
        {(!isSpeechRecognitionSupported || !isSpeechSynthesisSupported) && (
          <div style={{ color: '#b94a48', background: '#f2dede', border: '1px solid #ebccd1', borderRadius: '4px', padding: '8px 10px', marginBottom: '8px', fontSize: '13px' }}>
            音声機能が利用できません。Chrome/Edge の最新バージョンで、HTTPS もしくは localhost からアクセスし、マイク権限を許可してください。
          </div>
        )}
        {speechError && (
          <div style={{ color: '#b94a48', background: '#f2dede', border: '1px solid #ebccd1', borderRadius: '4px', padding: '8px 10px', marginBottom: '8px', fontSize: '13px' }}>
            {speechError}
          </div>
        )}
        <div className="chat-view" ref={chatViewRef}>
          {messages.map((msg, idx) => (
            <div key={idx} className={`message-wrapper ${msg.role}`}>
              <div className={`message-bubble ${msg.role}`}>
                <div className="message-header">
                  <span className="message-role">
                    {msg.role === 'user' ? '👤 あなた' : '🤖 AI'}
                  </span>
                  <span className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="message-content">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="chat-input-row">
          {voiceMode ? (
            <div className="voice-input-container" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', padding: '10px' }}>
              <button
                className={`mic-button ${isListening || isRecording ? 'listening' : ''}`}
                onClick={handleMicButton}
                disabled={isSending || isLoading}
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  backgroundColor: isSending ? '#999' : ((isListening || isRecording) ? '#ff4444' : '#4a9eff'),
                  border: 'none',
                  color: 'white',
                  cursor: isSending ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: (isListening || isRecording) ? 'pulse 1.5s infinite' : 'none',
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
                {(isListening || isRecording) ? (
                  <div>
                    <div style={{ color: '#ff4444', fontWeight: 'bold' }}>🔴 録音中...</div>
                    {isListening && transcript && (
                      <div style={{ marginTop: '5px', color: '#333' }}>{transcript}</div>
                    )}
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
                      話し終わったら、もう一度マイクボタンをタップしてください
                    </div>
                  </div>
                ) : (isListening && transcript) ? (
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
