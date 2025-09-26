import { useState, useEffect, useRef } from 'react';

// Web Speech API の音声合成フック
export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [error, setError] = useState(null);
  const synthRef = useRef(window.speechSynthesis);

  useEffect(() => {
    // 音声合成がサポートされているかチェック
    if (!synthRef.current) {
      setError('お使いのブラウザは音声合成をサポートしていません');
      return;
    }

    // 利用可能な音声を取得
    const loadVoices = () => {
      const availableVoices = synthRef.current.getVoices();

      // 日本語の音声を優先的に選択
      const japaneseVoices = availableVoices.filter(voice =>
        voice.lang.startsWith('ja') || voice.lang === 'ja-JP'
      );

      setVoices(japaneseVoices.length > 0 ? japaneseVoices : availableVoices);

      // デフォルトの音声を設定（日本語優先）
      if (japaneseVoices.length > 0) {
        // Google日本語音声を優先
        const googleVoice = japaneseVoices.find(voice =>
          voice.name.includes('Google') || voice.name.includes('Chrome')
        );
        setSelectedVoice(googleVoice || japaneseVoices[0]);
      } else if (availableVoices.length > 0) {
        setSelectedVoice(availableVoices[0]);
      }
    };

    // 音声リストのロード
    loadVoices();

    // Chrome等では遅延ロードされることがある
    if (synthRef.current.onvoiceschanged !== undefined) {
      synthRef.current.onvoiceschanged = loadVoices;
    }

    // クリーンアップ
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // テキストを音声で読み上げる
  const speak = (text, options = {}) => {
    if (!synthRef.current || !text) {
      return;
    }

    // 既存の音声を停止
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // 日本語設定
    utterance.lang = 'ja-JP';

    // 音声設定
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    // オプション設定
    utterance.rate = options.rate || 1.0;        // 速度 (0.1 - 10)
    utterance.pitch = options.pitch || 1.0;      // ピッチ (0 - 2)
    utterance.volume = options.volume || 1.0;    // 音量 (0 - 1)

    // イベントハンドラー
    utterance.onstart = () => {
      setIsSpeaking(true);
      setError(null);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = (event) => {
      console.error('音声合成エラー:', event);
      setError(`音声合成エラー: ${event.error}`);
      setIsSpeaking(false);
    };

    // 音声合成を開始
    try {
      synthRef.current.speak(utterance);
    } catch (error) {
      console.error('音声合成の開始エラー:', error);
      setError('音声合成を開始できませんでした');
      setIsSpeaking(false);
    }
  };

  // 音声合成を停止
  const stop = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  // 一時停止
  const pause = () => {
    if (synthRef.current && isSpeaking) {
      synthRef.current.pause();
    }
  };

  // 再開
  const resume = () => {
    if (synthRef.current) {
      synthRef.current.resume();
    }
  };

  // 音声を変更
  const changeVoice = (voiceIndex) => {
    if (voices[voiceIndex]) {
      setSelectedVoice(voices[voiceIndex]);
    }
  };

  return {
    isSpeaking,
    voices,
    selectedVoice,
    error,
    speak,
    stop,
    pause,
    resume,
    changeVoice,
    isSupported: !!synthRef.current
  };
}