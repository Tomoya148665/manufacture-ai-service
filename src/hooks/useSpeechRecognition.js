import { useState, useEffect, useRef } from 'react';

// Web Speech API の音声認識フック
export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isSilent, setIsSilent] = useState(false);
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const lastSpeechTimeRef = useRef(null);

  useEffect(() => {
    console.log('🎤 音声認識フック初期化開始');

    // ブラウザ互換性チェック
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    console.log('🎤 SpeechRecognition API:', SpeechRecognition ? '利用可能' : '利用不可');

    if (!SpeechRecognition) {
      console.error('❌ ブラウザが音声認識をサポートしていません');
      setError('お使いのブラウザは音声認識をサポートしていません');
      setIsSupported(false);
      return;
    }

    // 音声認識インスタンスの作成
    const recognition = new SpeechRecognition();
    console.log('✅ 音声認識インスタンス作成完了');

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
      console.log('🎙️ 音声認識結果イベント:', event);
      let currentFinal = '';
      let currentInterim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        console.log(`📝 認識結果[${i}]:`, transcript, '確定:', event.results[i].isFinal);

        if (event.results[i].isFinal) {
          currentFinal += transcript;
        } else {
          currentInterim += transcript;
        }
      }

      // 最終的な結果を設定
      if (currentFinal) {
        console.log('✅ 確定テキスト:', currentFinal);
        setFinalTranscript(prev => prev + currentFinal);
        setTranscript(prev => prev + currentFinal);
      }

      // 中間結果を設定
      if (currentInterim) {
        setInterimTranscript(currentInterim);
      }

      // 音声が検出されたら沈黙タイマーをリセット
      if (currentFinal || currentInterim) {
        lastSpeechTimeRef.current = Date.now();
        setIsSilent(false);

        // 沈黙タイマーをクリアして再設定
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        // 2秒間沈黙が続いたら沈黙と判定
        silenceTimerRef.current = setTimeout(() => {
          console.log('🔇 2秒間の沈黙を検出');
          setIsSilent(true);
        }, 2000);
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

    // 認識開始時
    recognition.onstart = () => {
      console.log('🟢 音声認識開始');
    };

    // 音声検出開始
    recognition.onspeechstart = () => {
      console.log('🗣️ 音声検出開始');
    };

    // 音声検出終了
    recognition.onspeechend = () => {
      console.log('🔇 音声検出終了');
    };

    // 認識終了時
    recognition.onend = () => {
      console.log('🔴 音声認識終了');
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setIsSupported(true);

    // クリーンアップ
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // 音声認識の開始
  const startListening = async () => {
    console.log('🚀 startListening呼び出し');
    console.log('recognitionRef.current:', recognitionRef.current);
    console.log('isListening:', isListening);
    console.log('isSupported:', isSupported);

    if (!isSupported) {
      console.error('❌ 音声認識がサポートされていません');
      setError('音声認識がサポートされていません');
      return;
    }

    if (recognitionRef.current && !isListening) {
      setTranscript('');
      setFinalTranscript('');
      setInterimTranscript('');
      setIsSilent(false);
      setError(null);

      try {
        // マイク権限の確認
        console.log('🎤 マイク権限を確認中...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ マイク権限取得成功');
        stream.getTracks().forEach(track => track.stop()); // ストリームを停止

        console.log('🎤 音声認識を開始します...');
        recognitionRef.current.start();
        setIsListening(true);
        lastSpeechTimeRef.current = Date.now();
        console.log('✅ 音声認識開始コマンド送信完了');
      } catch (error) {
        console.error('❌ 音声認識の開始エラー:', error);
        setError(`音声認識を開始できませんでした: ${error.message}`);
      }
    } else {
      console.warn('⚠️ 開始条件を満たしていません');
    }
  };

  // 音声認識の停止
  const stopListening = () => {
    console.log('⏹️ stopListening呼び出し');
    if (recognitionRef.current && isListening) {
      console.log('🔴 音声認識を停止します...');
      recognitionRef.current.stop();
      setIsListening(false);

      // 沈黙タイマーをクリア
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    }
  };

  // トランスクリプトのクリア
  const clearTranscript = () => {
    setTranscript('');
    setFinalTranscript('');
    setInterimTranscript('');
  };

  return {
    isListening,
    transcript,
    finalTranscript,
    interimTranscript,
    isSilent,
    error,
    startListening,
    stopListening,
    clearTranscript,
    isSupported
  };
}
