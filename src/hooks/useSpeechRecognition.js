import { useState, useEffect, useRef } from 'react';

// Web Speech API の音声認識フック
export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    // ブラウザ互換性チェック
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError('お使いのブラウザは音声認識をサポートしていません');
      return;
    }

    // 音声認識インスタンスの作成
    const recognition = new SpeechRecognition();

    // 日本語設定
    recognition.lang = 'ja-JP';

    // 連続認識モード
    recognition.continuous = true;

    // 途中結果も取得
    recognition.interimResults = true;

    // 最大候補数
    recognition.maxAlternatives = 1;

    // 認識結果の処理
    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // 最終的な結果を設定
      if (finalTranscript) {
        setTranscript(prevTranscript => prevTranscript + finalTranscript);
      }
    };

    // エラーハンドリング
    recognition.onerror = (event) => {
      console.error('音声認識エラー:', event.error);

      switch (event.error) {
        case 'no-speech':
          setError('音声が検出されませんでした');
          break;
        case 'audio-capture':
          setError('マイクが見つかりません');
          break;
        case 'not-allowed':
          setError('マイクへのアクセスが拒否されました');
          break;
        case 'network':
          setError('ネットワークエラーが発生しました');
          break;
        default:
          setError(`エラーが発生しました: ${event.error}`);
      }

      setIsListening(false);
    };

    // 認識終了時
    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    // クリーンアップ
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // 音声認識の開始
  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setTranscript('');
      setError(null);

      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error('音声認識の開始エラー:', error);
        setError('音声認識を開始できませんでした');
      }
    }
  };

  // 音声認識の停止
  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // トランスクリプトのクリア
  const clearTranscript = () => {
    setTranscript('');
  };

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    clearTranscript,
    isSupported: !!recognitionRef.current
  };
}