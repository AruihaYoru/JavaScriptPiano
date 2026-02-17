/**
 * Advanced Piano Simulator Engine (Vanilla JS)
 * * [License & Credits]
 * - Audio Samples: Salamander Grand Piano by Alexander Holm (CC BY 3.0)
 * - Engine Logic: Developed by AruihaYoru
 * * [Features]
 * - Dual Hand-Agent Simulation (Max 5 notes / 2-octave span per hand)
 * - 1/f Pink Noise Fluctuation for Velocity, Timing, and Duration
 * - Physical Distance-based Latency & Resonance Algorithm
 * - Dynamic Silence-Recovery Noise Implementation
 *
 * This software is provided 'as-is'. Redistribution and use in source 
 * forms, with or without modification, are permitted provided that 
 * attribution to the original sample author and engine author is maintained.
 */



/**
 * Pink Noise Generator
 * 1/f ゆらぎを生成するためのクラス
 */
class PinkNoise {
    constructor() {
        this.maxKey = 0x1f;
        this.key = 0;
        this.whiteValues = [0, 0, 0, 0, 0];
        this.range = 128;
    }

    getNext() {
        const lastKey = this.key;
        this.key = (this.key + 1) & this.maxKey;
        const diff = lastKey ^ this.key;
        let sum = 0;
        for (let i = 0; i < 5; i++) {
            if (diff & (1 << i)) {
                this.whiteValues[i] = (Math.random() * 2 - 1) * this.range;
            }
            sum += this.whiteValues[i];
        }
        return sum / 5;
    }
}
// ピンクノイズともいう、生物的にここちよいノイズ。

/**
 * Hand Agent
 * 手の動きをシミュレートし、物理的な移動によるレイテンシを計算する
 */
class HandAgent {
    constructor(startKey) {
        this.currentKey = startKey;
    }

    move(nextKey) {
        const distance = Math.abs(nextKey - this.currentKey);
        this.currentKey = nextKey;
        // 距離に応じた非線形レイテンシ
        return Math.pow(distance, 1.2) * 0.0005;
    }
}

class MyJavaScriptPiano {
	constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        
        // ノード作成
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.5;

        // コンプレッサー作成
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -20; // -20dBを超えたら圧縮開始
        this.compressor.knee.value = 30;       // 滑らかに圧縮
        this.compressor.ratio.value = 12;      // 圧縮比率
        this.compressor.attack.value = 0.003;  // アタックの反応速度
        this.compressor.release.value = 0.25;  // リリース

        // リバーブ作成
        this.convolver = this.ctx.createConvolver();
        // ホールのような残響
        this.convolver.buffer = this._createReverbBuffer(2.0, 2.0); 
        
        // リバーブの混ざり具合
        this.reverbGain = this.ctx.createGain();
        this.reverbGain.gain.value = 0.4;

        // マスターからコンプへ
        this.masterGain.connect(this.compressor);

        // コンプから出力へ
        this.compressor.connect(this.ctx.destination);

        // コンプからリバーブへ
        this.compressor.connect(this.reverbGain);
        this.reverbGain.connect(this.convolver);
        this.convolver.connect(this.ctx.destination);


        // 初期化いにっとinit
        this.basePath = './44.1khz16bit';
        this.buffers = new Map();
        this.pinkNoise = new PinkNoise();
        this.leftHand = new HandAgent(40);
        this.rightHand = new HandAgent(70);
        this.isLoading = false;
        this.onProgress = null; 
    }

    /**
     * ノートとベロシティから最適なファイル名とピッチ補正値を計算
     */
    getSampleMapping(midi, velocity) {
        // A,C,Ds,Fsのみを使用するマッピングロジック
        const noteIndex = midi % 12;
        const octave = Math.floor(midi / 12) - 1; // MIDI 60 = C4

        let targetAnchorNote = '';
        let targetOctave = octave;
        let detuneCents = 0;

        // 近くの音符をデータセットから疑似再現。
        if (noteIndex === 0) { targetAnchorNote = 'C'; detuneCents = 0; }
        else if (noteIndex === 1) { targetAnchorNote = 'C'; detuneCents = 100; }                     // C# -> C+1
        else if (noteIndex === 2) { targetAnchorNote = 'Ds'; detuneCents = -100; }                   // D -> Ds-1
        else if (noteIndex === 3) { targetAnchorNote = 'Ds'; detuneCents = 0; }
        else if (noteIndex === 4) { targetAnchorNote = 'Ds'; detuneCents = 100; }                    // E -> Ds+1
        else if (noteIndex === 5) { targetAnchorNote = 'Fs'; detuneCents = -100; }                   // F -> Fs-1
        else if (noteIndex === 6) { targetAnchorNote = 'Fs'; detuneCents = 0; }
        else if (noteIndex === 7) { targetAnchorNote = 'Fs'; detuneCents = 100; }                    // G -> Fs+1
        else if (noteIndex === 8) { targetAnchorNote = 'A'; detuneCents = -100; }                    // G# -> A-1
        else if (noteIndex === 9) { targetAnchorNote = 'A'; detuneCents = 0; }
        else if (noteIndex === 10) { targetAnchorNote = 'A'; detuneCents = 100; }                    // A# -> A+1
        else if (noteIndex === 11) { targetAnchorNote = 'C'; detuneCents = -100; targetOctave++; }   // B -> Next C-1

        // Velocity 1-16 mapping
        let velIndex = Math.floor(velocity * 16);
        if (velIndex < 1) velIndex = 1;
        if (velIndex > 16) velIndex = 16;

        const filename = `${targetAnchorNote}${targetOctave}v${velIndex}.wav`;
        
        return {
            filename: filename,
            detune: detuneCents,
            anchorNote: targetAnchorNote,
            octave: targetOctave,
            velIndex: velIndex
        };
    }

    async loadBuffer(path) {
        if (this.buffers.has(path)) return this.buffers.get(path);

        try {
            const response = await fetch(`${this.basePath}/${path}`);
            if (!response.ok) throw new Error(`404: ${path}`);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.buffers.set(path, audioBuffer);
            return audioBuffer;
        } catch (e) {
            console.warn(`Failed to load: ${path}`, e);
            return null;
        }
    }

    /**
     * 譜面解析とプリロード
     */
    async preloadScore(score) {
        console.log("Preloading samples...");
        const filesToLoad = new Set();

        // 必要なファイルをリストアップ
        score.forEach(note => {
            const map = this.getSampleMapping(note.note, note.velocity || 0.5);
            filesToLoad.add(map.filename);

            // 打鍵音ロード
            let keyIndex = note.note - 20;
            if (keyIndex < 1) keyIndex = 1;
            if (keyIndex > 88) keyIndex = 88;
            filesToLoad.add(`rel${keyIndex}.wav`);

            // ハーモニクス
            if (note.velocity > 0.6) {
                filesToLoad.add(`harmV3${map.anchorNote}${map.octave}.wav`);
            }
        });

        // ペダルふみふみ
        ['pedalD1.wav', 'pedalD2.wav', 'pedalU1.wav', 'pedalU2.wav'].forEach(f => filesToLoad.add(f));

        // ロード処理実行
        const totalFiles = filesToLoad.size;
        let loadedCount = 0;

        // 並列でロードしつつ、完了するたびにカウントアップ
        const loadPromises = Array.from(filesToLoad).map(async (filename) => {
            await this.loadBuffer(filename);
            loadedCount++;
            
            // 進捗コールバック呼び出し
            if (this.onProgress) {
                this.onProgress(loadedCount, totalFiles, filename);
            }
        });

        await Promise.all(loadPromises);
        console.log(`Loaded ${totalFiles} samples.`);
    }

	/**
     * 再生
     */
    async play(score) {
        if (!score || !Array.isArray(score)) {
            console.error("Invalid score format");
            return;
        }

        // 身体的制約チェック
        const timeGroupsForCheck = {};
        score.forEach(note => {
            const t = note.time.toFixed(3);
            if (!timeGroupsForCheck[t]) timeGroupsForCheck[t] = [];
            timeGroupsForCheck[t].push(note.note);
        });

        for (const t in timeGroupsForCheck) {
            const notes = timeGroupsForCheck[t];
            const left = notes.filter(n => n < 64);   // 64(E4)未満を左手
            const right = notes.filter(n => n >= 64); // 64(E4)以上を右手

            const validateHand = (handNotes, handName) => {
                if (handNotes.length === 0) return;

                // 5音制限
                if (handNotes.length > 5) {
                    throw new Error(`[Physical Limit Error] ${handName} attempted to play ${handNotes.length} notes at ${t}s. Max 5 fingers.`);
                }

                // 2オクターブ制限（おてて大きいね）
                if (handNotes.length > 1) {
                    const minNote = Math.min(...handNotes);
                    const maxNote = Math.max(...handNotes);
                    const span = maxNote - minNote;
                    if (span > 24) {
                        throw new Error(`[Physical Limit Error] ${handName} span is too wide (${span} semitones) at ${t}s. Max 24.`);
                    }
                }
            };

            validateHand(left, "Left Hand");
            validateHand(right, "Right Hand");
        }

        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        this.isLoading = true;
        
        if (this.onProgress) this.onProgress(0, 1, "Initializing...");

        await this.preloadScore(score);
        
        this.isLoading = false;

        const startTime = this.ctx.currentTime + 0.5;
        let lastEventTime = 0;
        let isFirstNote = true;

        score.sort((a, b) => a.time - b.time);

        const timeGroups = {};
        score.forEach(note => {
            const t = note.time.toFixed(3);
            if (!timeGroups[t]) timeGroups[t] = [];
            timeGroups[t].push(note);
        });

        Object.keys(timeGroups).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(tKey => {
            const notesInChord = timeGroups[tKey];
            notesInChord.sort((a, b) => Math.abs(a.note - 69) - Math.abs(b.note - 69));

            notesInChord.forEach((note, index) => {
                let triggerTime = startTime + note.time;
				const commonFluctuation = this.pinkNoise.getNext(); 
				// タイミングへの影響
				triggerTime += commonFluctuation * 0.00015;
				// ベロシティへの相関的影響
				const noisyVelocity = note.velocity + (commonFluctuation * 0.05);
				
                const silenceDuration = note.time - lastEventTime;
				if (silenceDuration > 2.0 || isFirstNote) {
					// 微細な遅延
					triggerTime += Math.random() * 0.02 + 0.01;
					// 空白明けのみ、打鍵の不確定要素を30%ブーストする
					note.isRecoveryNote = true; 
					isFirstNote = false;
				}
                lastEventTime = note.time + note.duration;

                let handLatency = 0;
                if (note.note < 64) {
                    handLatency = this.leftHand.move(note.note);
                } else {
                    handLatency = this.rightHand.move(note.note);
                }
                triggerTime += handLatency;

                const chordSpread = index * (0.008 + (Math.random() * 0.005));
                triggerTime += chordSpread;

                this.scheduleNote(note, triggerTime);
            });
        });

        this.schedulePedal(startTime, 'D');
    }

    scheduleNote(noteData, when) {
        const mapping = this.getSampleMapping(noteData.note, noteData.velocity || 0.5);
        const buffer = this.buffers.get(mapping.filename);
        
        if (!buffer) return;

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.detune.value = mapping.detune;

        const gainNode = this.ctx.createGain();
        
        // ベロシティノイズ
        let noisyVelocity = (noteData.velocity || 0.5) + (this.pinkNoise.getNext() * 0.0005);
        noisyVelocity = Math.max(0.01, Math.min(1.0, noisyVelocity));

        // 音量カーブ。自分に近いほど音が大きい。
        const distFromCenter = Math.abs(noteData.note - 69);
        const positionFactor = 1.0 - (distFromCenter / 88) * 0.3;
        
        const finalGain = Math.pow(noisyVelocity, 2) * positionFactor;
        
        gainNode.gain.setValueAtTime(finalGain, when);
        gainNode.gain.linearRampToValueAtTime(finalGain, when + 0.01);
        
        const releaseTime = when + noteData.duration;
        gainNode.gain.setValueAtTime(finalGain, releaseTime - 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, releaseTime + 0.2);

        source.connect(gainNode);
        gainNode.connect(this.masterGain);
        source.start(when);
        source.stop(releaseTime + 1.0);

        // 共鳴、ハーモニクス。
        const resonanceChance = (1.0 - (distFromCenter / 100)) * noisyVelocity;
        if (Math.random() < resonanceChance && mapping.velIndex > 8) {
            const harmFile = `harmV3${mapping.anchorNote}${mapping.octave}.wav`;
            const harmBuffer = this.buffers.get(harmFile);
            if (harmBuffer) {
                const harmSource = this.ctx.createBufferSource();
                harmSource.buffer = harmBuffer;
                harmSource.detune.value = mapping.detune;
                const harmGain = this.ctx.createGain();
                harmGain.gain.value = finalGain * 0.15;
                harmSource.connect(harmGain);
                harmGain.connect(this.masterGain);
                harmSource.start(when);
                harmSource.stop(releaseTime + 1.0);
            }
        }

        // リリースノイズ
        let keyIndex = noteData.note - 20;
        if (keyIndex < 1) keyIndex = 1;
        if (keyIndex > 88) keyIndex = 88;
        const relBuffer = this.buffers.get(`rel${keyIndex}.wav`);
        
        if (relBuffer) {
            const relSource = this.ctx.createBufferSource();
            relSource.buffer = relBuffer;
            const relGain = this.ctx.createGain();
            relGain.gain.value = 0.2 + (noisyVelocity * 0.3);
            relSource.connect(relGain);
            relGain.connect(this.masterGain);
            relSource.start(releaseTime);
        }
    }

    schedulePedal(when, type) {
        const rr = Math.random() > 0.5 ? '1' : '2';
        const file = `pedal${type}${rr}.wav`;
        const buffer = this.buffers.get(file);
        if (buffer) {
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            const gain = this.ctx.createGain();
            gain.gain.value = 0.1;
            source.connect(gain);
            gain.connect(this.masterGain);
            source.start(when);
			
			const resonanceChance = 0.4;
    
			if (Math.random() < resonanceChance) {
				// 共鳴用の音源
				const resSource = this.ctx.createBufferSource();
				resSource.buffer = buffer; 
				
				const resGain = this.ctx.createGain();
			
				// 中央からの距離を計算
				const distFromCenter = Math.abs(noteData.note - 64); 
				
				const resonanceDuration = 0.5 * (1.0 + (1.0 - Math.min(distFromCenter / 44, 1.0)) * 0.5);
				
				const noisyVelocity = noteData.velocity || 64; 
				resGain.gain.setValueAtTime(0.02 * (noisyVelocity / 127), when);
				
				// 自然に消えていくカーブを設定
				resGain.gain.exponentialRampToValueAtTime(0.001, when + resonanceDuration);
				
				resSource.connect(resGain);
				resGain.connect(this.masterGain);
				
				resSource.start(when);
				resSource.stop(when + resonanceDuration);
			}
        }
    }
	
	/**
     * プログラム的にリバーブ用インパルスレスポンスを生成する
     */
    _createReverbBuffer(duration, decay) {
        const sampleRate = this.ctx.sampleRate;
        const length = sampleRate * duration;
        const impulse = this.ctx.createBuffer(2, length, sampleRate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);

        for (let i = 0; i < length; i++) {
            // 指数関数減衰カーブ
            const n = i / length;
            const factor = Math.pow(1 - n, decay);

            // ホワイトノイズ * 減衰カーブ
            left[i] = (Math.random() * 2 - 1) * factor;
            right[i] = (Math.random() * 2 - 1) * factor;
        }

        return impulse;
    }
}

// インスタンスをつくるっぴ！
const piano = new MyJavaScriptPiano();
window.piano = piano;