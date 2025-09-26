// ログマネージャー - センサー状態とチャットログの管理

class LogManager {
  constructor() {
    this.logs = {
      sensorChanges: [],
      chatMessages: [],
      sessionInfo: {
        startTime: new Date().toISOString(),
        sessionId: this.generateSessionId()
      }
    };
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // センサー状態変更をログに記録
  logSensorChange(sensorKey, previousStatus, newStatus) {
    const log = {
      timestamp: new Date().toISOString(),
      type: 'sensor_change',
      sensorKey,
      previousStatus,
      newStatus,
      message: `センサー${sensorKey === 's1' ? '1' : '2'}の状態が「${previousStatus}」から「${newStatus}」に変更されました`
    };

    this.logs.sensorChanges.push(log);
    return log;
  }

  // チャットメッセージをログに記録
  logChatMessage(role, text, sensorState) {
    const log = {
      timestamp: new Date().toISOString(),
      type: 'chat_message',
      role,
      text,
      sensorState: { ...sensorState }
    };

    this.logs.chatMessages.push(log);
    return log;
  }

  // 全ログデータを取得
  getAllLogs() {
    return {
      ...this.logs,
      exportTime: new Date().toISOString()
    };
  }

  // ログをJSON形式でエクスポート
  exportLogsAsJSON() {
    const data = this.getAllLogs();
    return JSON.stringify(data, null, 2);
  }

  // ログをCSV形式でエクスポート（センサーログ）
  exportSensorLogsAsCSV() {
    const headers = ['Timestamp', 'Sensor', 'Previous Status', 'New Status', 'Message'];
    const rows = this.logs.sensorChanges.map(log => [
      log.timestamp,
      log.sensorKey === 's1' ? 'センサー1' : 'センサー2',
      log.previousStatus,
      log.newStatus,
      log.message
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  // ログをCSV形式でエクスポート（チャットログ）
  exportChatLogsAsCSV() {
    const headers = ['Timestamp', 'Role', 'Message', 'Sensor1 Status', 'Sensor2 Status'];
    const rows = this.logs.chatMessages.map(log => [
      log.timestamp,
      log.role,
      log.text.replace(/"/g, '""'), // CSVエスケープ
      log.sensorState.s1,
      log.sensorState.s2
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  // ファイルダウンロード機能
  downloadLogs(format = 'json', type = 'all') {
    let content, filename, mimeType;

    switch (format) {
      case 'json':
        content = this.exportLogsAsJSON();
        filename = `logs_${this.logs.sessionInfo.sessionId}_${new Date().getTime()}.json`;
        mimeType = 'application/json';
        break;
      case 'csv-sensor':
        content = this.exportSensorLogsAsCSV();
        filename = `sensor_logs_${this.logs.sessionInfo.sessionId}_${new Date().getTime()}.csv`;
        mimeType = 'text/csv';
        break;
      case 'csv-chat':
        content = this.exportChatLogsAsCSV();
        filename = `chat_logs_${this.logs.sessionInfo.sessionId}_${new Date().getTime()}.csv`;
        mimeType = 'text/csv';
        break;
      default:
        content = this.exportLogsAsJSON();
        filename = `logs_${this.logs.sessionInfo.sessionId}_${new Date().getTime()}.json`;
        mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ログをクリア
  clearLogs() {
    this.logs.sensorChanges = [];
    this.logs.chatMessages = [];
  }

  // ログのサマリーを取得
  getLogSummary() {
    return {
      sessionId: this.logs.sessionInfo.sessionId,
      startTime: this.logs.sessionInfo.startTime,
      sensorChangeCount: this.logs.sensorChanges.length,
      chatMessageCount: this.logs.chatMessages.length,
      lastActivity: this.getLastActivityTime()
    };
  }

  getLastActivityTime() {
    const allLogs = [...this.logs.sensorChanges, ...this.logs.chatMessages];
    if (allLogs.length === 0) return null;

    const sortedLogs = allLogs.sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    return sortedLogs[0].timestamp;
  }
}

export default LogManager;