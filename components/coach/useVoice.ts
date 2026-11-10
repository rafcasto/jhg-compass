"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The voice conversation (docs/UX_COACH.md §4, decision 2: a conversation, not push-to-talk).
//
//   listening  the mic stays open (SpeechRecognition, continuous, interim results); interim words
//              show as they are recognised; ~1.2 s of silence after a final result sends the turn
//   speaking   the coach's reply is spoken sentence by sentence as it streams (speechSynthesis);
//              the mic is muted meanwhile — the browser would hear the coach — and reopens after
//   interrupt  stop the speech, reopen the mic
//
// Browser-first: Chrome, Edge, Safari (whose continuous mode ends itself every ~60 s and is
// restarted here). Firefox has no SpeechRecognition — `supported` is false and the switch is absent.
// No audio leaves the browser. A provider swap (v2) lives behind this same hook.

export const SILENCE_MS = 1200;

type Recognition = {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type RecognitionCtor = new () => Recognition;

const recognitionCtor = (): RecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
export const voiceSupported = (): boolean => !!recognitionCtor() && typeof window !== "undefined" && "speechSynthesis" in window;

/** Markdown → something a voice can say: no emphasis marks, headings, bullets or table rules. */
export function speakable(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*\|.*\|\s*$/gm, (line) => line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim()).filter((c) => c && !/^:?-+:?$/.test(c)).join(", "))
    .replace(/^#+\s*/gm, "")
    .replace(/[*_`>]+/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** The complete sentences in `text` after `from` — ends at the last sentence boundary; the rest waits for more text. */
export function completeSentences(text: string, from: number): { chunk: string; upTo: number } {
  const rest = text.slice(from);
  let last = -1;
  const re = /[.!?]["')\]]*(?=\s)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest))) last = m.index + m[0].length;
  if (last < 0) return { chunk: "", upTo: from };
  return { chunk: rest.slice(0, last), upTo: from + last };
}

export interface VoiceState {
  supported: boolean;
  on: boolean;
  listening: boolean;
  speaking: boolean;
  /** Words recognised so far in this turn — interim in the strip. */
  interim: string;
  error: string | null;
}

export interface VoiceApi extends VoiceState {
  toggle(): void;
  /** Speak the coach's text as it streams; `done` speaks whatever is left. */
  speakStream(text: string, done: boolean): void;
  /** Stop the coach mid-sentence and listen. */
  interrupt(): void;
  /** Forget the streamed text (a new turn starts). */
  resetSpeech(): void;
}

export function useVoice({ onSend }: { onSend: (text: string) => void }): VoiceApi {
  const [supported] = useState(() => voiceSupported());
  const [on, setOn] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const rec = useRef<Recognition | null>(null);
  const onRef = useRef(false);
  const speakingRef = useRef(false);
  const finals = useRef("");
  const silence = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spokenUpTo = useRef(0);
  const sendRef = useRef(onSend);
  sendRef.current = onSend;

  const stopRecognition = useCallback(() => {
    if (silence.current) { clearTimeout(silence.current); silence.current = null; }
    try { rec.current?.abort(); } catch { /* already stopped */ }
    rec.current = null;
    setListening(false);
  }, []);

  const flush = useCallback(() => {
    const text = finals.current.trim();
    finals.current = ""; setInterim("");
    if (text) sendRef.current(text);
  }, []);

  const startRecognition = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor || rec.current || speakingRef.current || !onRef.current) return;
    const r = new Ctor();
    r.continuous = true; r.interimResults = true; r.lang = typeof navigator !== "undefined" ? navigator.language || "en" : "en";
    r.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finals.current = `${finals.current} ${res[0].transcript}`.trim();
        else interimText += res[0].transcript;
      }
      setInterim([finals.current, interimText].filter(Boolean).join(" "));
      if (silence.current) clearTimeout(silence.current);
      if (finals.current) silence.current = setTimeout(flush, SILENCE_MS);
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { setError("The browser blocked the microphone — allow it in the address bar."); onRef.current = false; setOn(false); stopRecognition(); return; }
      setError(`Voice stopped: ${e.error}`);
    };
    // Safari ends a continuous session every minute or so; while the switch is on and the coach is quiet, start again.
    r.onend = () => { rec.current = null; setListening(false); if (onRef.current && !speakingRef.current) setTimeout(() => startRecognition(), 150); };
    rec.current = r;
    try { r.start(); setListening(true); setError(null); } catch { rec.current = null; }
  }, [flush, stopRecognition]);

  const speakQueue = useCallback((text: string) => {
    if (!text.trim() || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = typeof navigator !== "undefined" ? navigator.language || "en" : "en";
    u.onstart = () => { speakingRef.current = true; setSpeaking(true); stopRecognition(); };
    u.onend = () => {
      if (!window.speechSynthesis.pending && !window.speechSynthesis.speaking) { speakingRef.current = false; setSpeaking(false); if (onRef.current) startRecognition(); }
    };
    u.onerror = u.onend;
    window.speechSynthesis.speak(u);
  }, [startRecognition, stopRecognition]);

  const speakStream = useCallback((text: string, done: boolean) => {
    if (!onRef.current) return;
    const plain = speakable(text);
    if (done) { const rest = plain.slice(spokenUpTo.current).trim(); spokenUpTo.current = plain.length; if (rest) speakQueue(rest); return; }
    const { chunk, upTo } = completeSentences(plain, spokenUpTo.current);
    if (chunk.trim()) { spokenUpTo.current = upTo; speakQueue(chunk.trim()); }
  }, [speakQueue]);

  const resetSpeech = useCallback(() => { spokenUpTo.current = 0; }, []);

  const interrupt = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    speakingRef.current = false; setSpeaking(false);
    if (onRef.current) startRecognition();
  }, [startRecognition]);

  const toggle = useCallback(() => {
    if (!supported) return;
    const next = !onRef.current;
    onRef.current = next; setOn(next);
    if (next) startRecognition();
    else { if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); speakingRef.current = false; setSpeaking(false); stopRecognition(); finals.current = ""; setInterim(""); }
  }, [supported, startRecognition, stopRecognition]);

  // Off when the panel unmounts.
  useEffect(() => () => { onRef.current = false; stopRecognition(); if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); }, [stopRecognition]);

  return { supported, on, listening, speaking, interim, error, toggle, speakStream, interrupt, resetSpeech };
}
