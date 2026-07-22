// BUILD-002 WP6 — bounded LOCAL voice transcription adapter (Windows SAPI, no paid credential).
//
// A REAL audio→text adapter using the OS-native System.Speech recognizer via PowerShell — no API key,
// no network, no cloud. `transcribeWav(path)` recognizes a WAV file; `synthWav(text,path)` generates a
// WAV from text (used to make audio fixtures for the proof, so the transcription path is exercised on
// REAL audio rather than injected text). Bounded: SAPI dictation is modest-accuracy and English-only —
// fine as the local/testable route; a higher-accuracy engine (whisper) can drop in behind the same
// interface later. Returns { ok, text } / throws with a clear message if SAPI is unavailable.
import { spawnSync } from 'node:child_process';

function runPs(script) {
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0) throw new Error(`powershell failed: ${(r.stderr || r.stdout || '').trim().split('\n').slice(-1)[0]}`);
  return (r.stdout || '').trim();
}

// Generate a WAV fixture from text (SAPI TTS). For building audio fixtures in tests.
export function synthWav(text, outPath) {
  const safe = String(text).replace(/'/g, "''");
  const out = outPath.replace(/'/g, "''");
  runPs(`Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile('${out}'); $s.Rate = -2; $s.Speak('${safe}'); $s.Dispose(); Write-Output 'ok'`);
  return outPath;
}

// Transcribe a WAV file to text via the local SAPI dictation recognizer.
export function transcribeWav(wavPath) {
  const p = wavPath.replace(/'/g, "''");
  const out = runPs(
    `Add-Type -AssemblyName System.Speech; ` +
    `try { $r = New-Object System.Speech.Recognition.SpeechRecognitionEngine; ` +
    `$r.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar)); ` +
    `$r.SetInputToWaveFile('${p}'); $res = $r.Recognize(); ` +
    `if ($res) { Write-Output ('TEXT:' + $res.Text) } else { Write-Output 'TEXT:' }; $r.Dispose() } ` +
    `catch { Write-Output ('ERR:' + $_.Exception.Message) }`);
  const line = out.split('\n').map((l) => l.trim()).find((l) => l.startsWith('TEXT:') || l.startsWith('ERR:')) || '';
  if (line.startsWith('ERR:')) throw new Error(`SAPI unavailable: ${line.slice(4)}`);
  return { ok: true, text: line.slice('TEXT:'.length).trim(), engine: 'windows-sapi-dictation' };
}

// True if the local SAPI recognizer can be constructed on this machine.
export function sapiAvailable() {
  try {
    const out = runPs(`Add-Type -AssemblyName System.Speech; try { $r = New-Object System.Speech.Recognition.SpeechRecognitionEngine; $r.Dispose(); Write-Output 'yes' } catch { Write-Output 'no' }`);
    return out.includes('yes');
  } catch { return false; }
}
