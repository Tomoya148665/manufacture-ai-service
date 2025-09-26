import React, { useState, useEffect } from 'react';
import './LogPanel.css';
import { generateLogReport } from '../api/openai';

function LogPanel({ logManager, isVisible, onClose }) {
  const [logSummary, setLogSummary] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [report, setReport] = useState(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

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
          <button
            className={`tab ${activeTab === 'report' ? 'active' : ''}`}
            onClick={() => setActiveTab('report')}
          >
            レポート
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

          {activeTab === 'report' && (
            <div className="log-report">
              <h3>AIログ分析レポート</h3>
              {!report && !isGeneratingReport && (
                <div className="report-container">
                  <p className="report-description">
                    GPT-4o-miniを使用して、現在のセッションのログを分析し、
                    センサー状態の傾向やチャット内容の概要レポートを生成します。
                  </p>
                  <button
                    className="generate-report-button"
                    onClick={async () => {
                      setIsGeneratingReport(true);
                      try {
                        const allLogs = [
                          ...logManager.current.logs.sensorChanges.map(log => ({
                            type: 'sensor',
                            timestamp: log.timestamp,
                            sensorKey: log.sensorKey,
                            previousState: log.previousState,
                            newState: log.newState
                          })),
                          ...logManager.current.logs.chatMessages.map(log => ({
                            type: 'chat',
                            timestamp: log.timestamp,
                            role: log.role,
                            message: log.text,
                            sensorState: log.sensorState
                          }))
                        ];
                        const reportText = await generateLogReport(allLogs);
                        setReport(reportText);
                      } catch (error) {
                        console.error('レポート生成エラー:', error);
                        setReport('レポート生成中にエラーが発生しました。');
                      } finally {
                        setIsGeneratingReport(false);
                      }
                    }}
                  >
                    レポートを生成
                  </button>
                </div>
              )}
              {isGeneratingReport && (
                <div className="report-loading">
                  <p>レポートを生成中...</p>
                  <div className="spinner"></div>
                </div>
              )}
              {report && (
                <div className="report-content">
                  <pre>{report}</pre>
                  <div className="report-actions">
                    <button
                      className="download-button"
                      onClick={() => {
                        const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `log_report_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                    >
                      レポートをダウンロード
                    </button>
                    <button
                      className="regenerate-button"
                      onClick={() => setReport(null)}
                    >
                      再生成
                    </button>
                  </div>
                </div>
              )}
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