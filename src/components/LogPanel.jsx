import React, { useState, useEffect } from 'react';
import './LogPanel.css';

function LogPanel({ logManager, isVisible, onClose }) {
  const [logSummary, setLogSummary] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');

  useEffect(() => {
    if (isVisible && logManager) {
      const summary = logManager.current.getLogSummary();
      setLogSummary(summary);
    }
  }, [isVisible, logManager]);

  if (!isVisible) return null;

  const handleDownload = (format) => {
    logManager.current.downloadLogs(format);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('ja-JP');
  };

  return (
    <div className="log-panel-overlay">
      <div className="log-panel">
        <div className="log-panel-header">
          <h2>ログ管理パネル</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="log-panel-tabs">
          <button
            className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            サマリー
          </button>
          <button
            className={`tab ${activeTab === 'sensor' ? 'active' : ''}`}
            onClick={() => setActiveTab('sensor')}
          >
            センサーログ
          </button>
          <button
            className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            チャットログ
          </button>
        </div>

        <div className="log-panel-content">
          {activeTab === 'summary' && logSummary && (
            <div className="log-summary">
              <h3>セッション情報</h3>
              <div className="summary-item">
                <span className="label">セッションID:</span>
                <span className="value">{logSummary.sessionId}</span>
              </div>
              <div className="summary-item">
                <span className="label">開始時刻:</span>
                <span className="value">{formatTime(logSummary.startTime)}</span>
              </div>
              <div className="summary-item">
                <span className="label">最終アクティビティ:</span>
                <span className="value">{formatTime(logSummary.lastActivity)}</span>
              </div>
              <div className="summary-item">
                <span className="label">センサー状態変更:</span>
                <span className="value">{logSummary.sensorChangeCount} 回</span>
              </div>
              <div className="summary-item">
                <span className="label">チャットメッセージ:</span>
                <span className="value">{logSummary.chatMessageCount} 件</span>
              </div>
            </div>
          )}

          {activeTab === 'sensor' && (
            <div className="log-list">
              <h3>センサー状態変更ログ</h3>
              <div className="log-entries">
                {logManager.current.logs.sensorChanges.map((log, index) => (
                  <div key={index} className="log-entry">
                    <span className="timestamp">{formatTime(log.timestamp)}</span>
                    <span className="message">{log.message}</span>
                  </div>
                ))}
                {logManager.current.logs.sensorChanges.length === 0 && (
                  <p className="no-logs">センサー状態の変更はありません</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="log-list">
              <h3>チャットログ</h3>
              <div className="log-entries">
                {logManager.current.logs.chatMessages.map((log, index) => (
                  <div key={index} className={`log-entry chat-${log.role}`}>
                    <div className="chat-header">
                      <span className="timestamp">{formatTime(log.timestamp)}</span>
                      <span className="role">{log.role === 'user' ? 'ユーザー' : 'AI'}</span>
                      <span className="sensor-state">
                        S1: {log.sensorState.s1} / S2: {log.sensorState.s2}
                      </span>
                    </div>
                    <div className="chat-text">{log.text}</div>
                  </div>
                ))}
                {logManager.current.logs.chatMessages.length === 0 && (
                  <p className="no-logs">チャットメッセージはありません</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="log-panel-footer">
          <button
            className="download-button"
            onClick={() => handleDownload('json')}
          >
            全ログをダウンロード (JSON)
          </button>
          <button
            className="download-button"
            onClick={() => handleDownload('csv-sensor')}
          >
            センサーログをダウンロード (CSV)
          </button>
          <button
            className="download-button"
            onClick={() => handleDownload('csv-chat')}
          >
            チャットログをダウンロード (CSV)
          </button>
        </div>
      </div>
    </div>
  );
}

export default LogPanel;