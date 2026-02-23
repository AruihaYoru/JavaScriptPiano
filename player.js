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
 * ========== CONFIGURATION & CONSTANTS SECTION ==========
 * All magic numbers are centralized here for easy tuning
 */
const PIANO_CONFIG = {
    // Audio Context
    SAMPLE_RATE: 44100,
    
    // Master Gain & Levels
    MASTER_GAIN: 0.5,
    RESONANCE_SEND_INIT: 0.0,
    REVERB_GAIN: 0.4,
    
    // Compressor Settings
    COMPRESSOR_THRESHOLD: -10,
    COMPRESSOR_KNEE: 30,
    COMPRESSOR_RATIO: 12,
    COMPRESSOR_ATTACK: 0.003,
    COMPRESSOR_RELEASE: 0.25,
    
    // Reverb & Resonance
    REVERB_DURATION: 2.5,
    REVERB_DECAY: 2.0,
    BODY_RESONANCE_DURATION: 3.0,
    BODY_RESONANCE_DECAY: 1.5,
    BODY_RESONANCE_SMOOTH: 0.6,
    REVERB_SMOOTH: 0.15,
    
    // Hand Agent Initial Positions
    LEFT_HAND_START: 40,
    RIGHT_HAND_START: 70,
    
    // WASM Configuration
    ENABLE_WASM: true,
    WORKER_COUNT: navigator.hardwareConcurrency || 4,
    WASM_WORKER_PATH: './wasm/decoder-worker.js',
    
    // Fatigue & Stress (HandAgent)
    FATIGUE_RECOVERY_RATE: 0.3,
    DISTANCE_EXPONENT: 1.2,
    LATENCY_COEFFICIENT: 0.0005,
    REPETITION_THRESHOLD: 0.08,
    REPETITION_PENALTY_BASE: 0.4,
    REPETITION_PENALTY_MULTIPLIER: 5.0,
    REPETITION_FATIGUE_ADD: 0.05,
    FORTE_THRESHOLD: 0.8,
    FORTE_STRESS: 0.05,
    LARGE_JUMP_THRESHOLD: 7,
    LARGE_JUMP_STRESS: 0.02,
    VERY_LARGE_JUMP_THRESHOLD: 12,
    VERY_LARGE_JUMP_MIS_PROB: 0.05,
    MEDIUM_JUMP_THRESHOLD: 5,
    MEDIUM_JUMP_MIS_PROB: 0.02,
    FATIGUE_VELOCITY_THRESHOLD: 0.5,
    FATIGUE_VELOCITY_FACTOR: 0.2,
    MAX_FATIGUE: 1.0,
    MISTOUCHED_VELOCITY_FACTOR: 0.85,
    
    // Hand Assignment
    TIME_TOLERANCE: 0.01,
    LEFT_HAND_HOME: 45,
    RIGHT_HAND_HOME: 75,
    CENTER_POINT: 64,
    REGION_BIAS_FACTOR: 1.2,
    CROSSING_COST: 20,
    
    // Sample Mapping
    MIDI_VELOCITY_BINS: 16,
    DETUNE_CENT: 100,
    DETUNE_OCTAVE_OFFSET: 1,
    MIDI_MIDDLE_C: 60,
    MIDI_BASE_OCTAVE: -1,
    FIRST_KEY_MIDI: 21,
    LAST_KEY_MIDI: 108,
    KEY_OFFSET_FOR_RELEASE: 20,
    MIN_KEY_INDEX: 1,
    MAX_KEY_INDEX: 88,
    MIN_HARMONICS_VELOCITY: 0.6,
    
    // Pink Noise
    PINK_NOISE_MAX_KEY: 0x1f,
    PINK_NOISE_RANGE: 128,
    PINK_NOISE_BINS: 5,
    
    // Play & Timing
    PLAY_START_OFFSET: 0.5,
    SILENCE_THRESHOLD: 2.0,
    FIRST_NOTE_TENSION_BASE: 0.005,
    FIRST_NOTE_TENSION_RANDOM: 0.025,
    FIRST_NOTE_VELOCITY_BASE: 0.9,
    FIRST_NOTE_VELOCITY_RANGE: 0.2,
    PINK_NOISE_TIMING_FACTOR: 0.0002,
    
    // Note Scheduling
    DEFAULT_VELOCITY: 0.5,
    DEFAULT_OFF_VELOCITY: 0.5,
    RESONANCE_VELOCITY_THRESHOLD: 0.3,
    SYMPATHETIC_VELOCITY_FACTOR: 0.3,
    GAIN_RAMP_TIME: 0.005,
    FILTER_LOWPASS_BASE: 800,
    FILTER_LOWPASS_VELOCITY_RANGE: 19200,
    PIANO_RANGE_FIRST_KEY: 21,
    PIANO_RANGE_KEYS: 87,
    PAN_RANGE: 1.8,
    PAN_CENTER: 0.9,
    PAN_MIN: -0.9,
    PAN_MAX: 0.9,
    PINK_NOISE_VELOCITY_FACTOR: 0.0005,
    VELOCITY_NOISE_MAX: 1.0,
    VELOCITY_NOISE_MIN: 0.01,
    CENTER_KEY_MIDI: 69,
    POSITION_FACTOR_RANGE: 0.3,
    VELOCITY_CURVE_EXPONENT: 2,
    RELEASE_TIME_BASE: 0.2,
    RELEASE_TIME_PEDAL_FACTOR: 1.8,
    RELEASE_MIN_FADED: 0.001,
    RELEASE_FADED_FROM: 0.05,
    RELEASE_GAIN_ENVELOPE: 0.5,
    OFF_VELOCITY_RANGE: 0.1,
    OFF_VELOCITY_BASE: 0.01,
    PEDAL_THRESHOLD_FOR_RELEASE: 0.2,
    NAIL_NOISE_THRESHOLD: 0.7,
    NAIL_NOISE_RANDOM_PROB: 0.1,
    NAIL_NOISE_BUFFER_TIME: 0.02,
    NAIL_NOISE_FILTER_FREQ: 2500,
    NAIL_NOISE_GAIN: 0.05,
    NAIL_NOISE_FADE_TIME: 0.01,
    NAIL_NOISE_MIN: 0.001,
    
    // Crossing Stress
    CROSSING_STRESS: 0.015,
    CROSSING_MIS_PROB_ADD: 0.15,
    
    // Chord Spreading
    CHORD_SPREAD_BASE: 0.008,
    CHORD_SPREAD_RANDOM: 0.005,
    
    // Mistouching
    GHOST_NOTE_VELOCITY_FACTOR: 0.2,
    GHOST_NOTE_VELOCITY_MIN: 0.05,
    GHOST_NOTE_DURATION: 0.08,
    GHOST_NOTE_LEAD_TIME: 0.015,
    MISTOUCHED_TIMING_DELAY: 0.005,
    
    // Sympathetic Resonance
    HARMONICS: [12, 19, 24],
    SYMPATHETIC_VELOCITY_FACTOR: 0.3,
    SYMPATHETIC_RISE_TIME: 0.1,
    SYMPATHETIC_RING_TIME: 1.5,
    SYMPATHETIC_FILTER_FREQ: 600,
    SYMPATHETIC_GAIN_FACTOR: 0.1,
    
    // Pedal
    PEDAL_GAIN_MULTIPLIER: 0.5,
    PEDAL_TIME_CONSTANT: 0.15,
    PEDAL_NOISE_GAIN: 0.2,
    PEDAL_RESONANCE_THRESHOLD: 0.3,
    PEDAL_RESONANCE_PROB: 0.4,
    FAKE_VELOCITY_MIN: 50,
    FAKE_VELOCITY_RANGE: 40,
    PEDAL_RESONANCE_GAIN: 0.01,
    PEDAL_RESONANCE_DENORM: 127,
    PEDAL_RESONANCE_RING: 1.0,
    
    // File Paths
    BASE_PATH: './44.1khz16bit',
    PEDAL_FILES: ['pedalD1.wav', 'pedalD2.wav', 'pedalU1.wav', 'pedalU2.wav']
};

/**
 * ========== END CONFIGURATION SECTION ==========
 */



/**
 * Pink Noise Generator
 * 1/f ゆらぎを生成するためのクラス
 */
class PinkNoise {
    constructor() {
        this.maxKey = PIANO_CONFIG.PINK_NOISE_MAX_KEY;
        this.key = 0;
        this.whiteValues = new Array(PIANO_CONFIG.PINK_NOISE_BINS).fill(0);
        this.range = PIANO_CONFIG.PINK_NOISE_RANGE;
    }

    getNext() {
        const lastKey = this.key;
        this.key = (this.key + 1) & this.maxKey;
        const diff = lastKey ^ this.key;
        let sum = 0;
        for (let i = 0; i < PIANO_CONFIG.PINK_NOISE_BINS; i++) {
            if (diff & (1 << i)) {
                this.whiteValues[i] = (Math.random() * 2 - 1) * this.range;
            }
            sum += this.whiteValues[i];
        }
        return sum / PIANO_CONFIG.PINK_NOISE_BINS;
    }
}
// ピンクノイズともいう、生物的にここちよいノイズ。

/**
 * Hand Agent
 * 疲労、跳躍リスク、物理的な移動を管理する
 */
class HandAgent {
    constructor(startKey) {
        this.currentKey = startKey;
        this.fatigue = 0.0;
        this.lastTime = 0;
        // 各キーが最後に弾かれた時間を記録する
        this.keyHistory = new Map();
    }

    /**
     * 手を移動させ、その負荷を計算する
     */
    move(nextKey, currentTime, velocity) {
        // 時間経過による疲労回復
        const deltaTime = currentTime - this.lastTime;
        this.fatigue = Math.max(0, this.fatigue - (deltaTime * PIANO_CONFIG.FATIGUE_RECOVERY_RATE));
        this.lastTime = currentTime;
		
        const distance = Math.abs(nextKey - this.currentKey);
        this.currentKey = nextKey;

        // 距離によるレイテンシ
        let latency = Math.pow(distance, PIANO_CONFIG.DISTANCE_EXPONENT) * PIANO_CONFIG.LATENCY_COEFFICIENT * (1.0 + this.fatigue);
		
        // 同じ鍵盤、または極めて近い鍵盤を短期間で連打する場合、ハンマーが戻りきらない
        let repetitionPenalty = 1.0;
        const lastKeyTime = this.keyHistory.get(nextKey) || -10;
        const noteDelta = currentTime - lastKeyTime;
        
        // 連打のしきい値以内の連打は物理的に厳しい
        if (noteDelta < PIANO_CONFIG.REPETITION_THRESHOLD) {
            // 速度が出ず、音がスカる
            repetitionPenalty = PIANO_CONFIG.REPETITION_PENALTY_BASE + (noteDelta * PIANO_CONFIG.REPETITION_PENALTY_MULTIPLIER);
            this.fatigue += PIANO_CONFIG.REPETITION_FATIGUE_ADD;
        }
        this.keyHistory.set(nextKey, currentTime);

        // フォルテ(>0.8)の連打や、大きな跳躍(>7)で疲労が溜まる
        const stress = (velocity > PIANO_CONFIG.FORTE_THRESHOLD ? velocity * PIANO_CONFIG.FORTE_STRESS : 0) + 
                       (distance > PIANO_CONFIG.LARGE_JUMP_THRESHOLD ? PIANO_CONFIG.LARGE_JUMP_STRESS : 0);
        this.fatigue = Math.min(PIANO_CONFIG.MAX_FATIGUE, this.fatigue + stress);

        // 跳躍距離と疲労度に応じて確率上昇
        let mistouchProb = (distance > PIANO_CONFIG.MEDIUM_JUMP_THRESHOLD ? PIANO_CONFIG.MEDIUM_JUMP_MIS_PROB : 0) + 
                           (this.fatigue * 0.1);
        if (distance > PIANO_CONFIG.VERY_LARGE_JUMP_THRESHOLD) mistouchProb += PIANO_CONFIG.VERY_LARGE_JUMP_MIS_PROB;
		
        let velocityFluctuation = 1.0;
        if (this.fatigue > PIANO_CONFIG.FATIGUE_VELOCITY_THRESHOLD) {
            velocityFluctuation = 1.0 - (Math.random() * this.fatigue * PIANO_CONFIG.FATIGUE_VELOCITY_FACTOR); 
        }
		
        return {
            latency: latency,
            mistouchProb: mistouchProb,
            // 連打ペナルティ
            velocityScale: velocityFluctuation * repetitionPenalty
        };
    }
}

class MyJavaScriptPiano {
	constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)({
			sampleRate: PIANO_CONFIG.SAMPLE_RATE
		});
		
		// ---------WASM-------
        this.isWasmAvailable = PIANO_CONFIG.ENABLE_WASM;
        this.wasmInstance = null;
		// ---------E_WASM-------
		
        // ノード作成
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = PIANO_CONFIG.MASTER_GAIN;
		
		// 共鳴用バスの作成
        // ピアノの筐体鳴りをシミュレートするコンボルバーへのセンド
		this.resonanceSend = this.ctx.createGain();
        this.resonanceSend.gain.value = PIANO_CONFIG.RESONANCE_SEND_INIT;
		
        // 床鳴りと空気感を意識したバッファに変更
        this.bodyResonance = this.ctx.createConvolver();
        this.bodyResonance.buffer = this._createReverbBuffer(
            PIANO_CONFIG.BODY_RESONANCE_DURATION, 
            PIANO_CONFIG.BODY_RESONANCE_DECAY, 
            true
        );
		
        // 接続: ResonanceSend -> BodyResonance -> Master
        this.resonanceSend.connect(this.bodyResonance);
        this.bodyResonance.connect(this.masterGain);
		
        // コンプレッサー作成
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = PIANO_CONFIG.COMPRESSOR_THRESHOLD;
        this.compressor.knee.value = PIANO_CONFIG.COMPRESSOR_KNEE;
        this.compressor.ratio.value = PIANO_CONFIG.COMPRESSOR_RATIO;
        this.compressor.attack.value = PIANO_CONFIG.COMPRESSOR_ATTACK;
        this.compressor.release.value = PIANO_CONFIG.COMPRESSOR_RELEASE;

        // リバーブ作成
        this.convolver = this.ctx.createConvolver();
        // ホールのような残響
		this.convolver.buffer = this._createReverbBuffer(
            PIANO_CONFIG.REVERB_DURATION, 
            PIANO_CONFIG.REVERB_DECAY, 
            false
        );
		
        // リバーブの混ざり具合
        this.reverbGain = this.ctx.createGain();
        this.reverbGain.gain.value = PIANO_CONFIG.REVERB_GAIN;

        // マスターからコンプへ
        this.masterGain.connect(this.compressor);

        // コンプから出力へ
        this.compressor.connect(this.ctx.destination);

        // コンプからリバーブへ
        this.compressor.connect(this.reverbGain);
        this.reverbGain.connect(this.convolver);
        this.convolver.connect(this.ctx.destination);

        // 初期化
        this.basePath = PIANO_CONFIG.BASE_PATH;
        this.buffers = new Map();
        this.pinkNoise = new PinkNoise();
        this.leftHand = new HandAgent(PIANO_CONFIG.LEFT_HAND_START);
        this.rightHand = new HandAgent(PIANO_CONFIG.RIGHT_HAND_START);
        this.isLoading = false;
        this.onProgress = null; 
		
		// ダルの深さと、現在ダンパーが上がっているキーの管理
        this.pedalDepth = 0.0;     // 0.0 ~ 1.0
        this.heldKeys = new Set(); // 現在指で押さえているキー番号
		
		// Worker管理
		this.workers = [];
		this.workerCount = PIANO_CONFIG.WORKER_COUNT;
		this.workerIndex = 0;
		this.pendingRequests = new Map();
    }

	// ========== WASM ENGINE SECTION ==========
	// WASM-based audio decoding via Web Workers
	// This entire section can be disabled by setting PIANO_CONFIG.ENABLE_WASM = false
	
	/**
     * Wasmの初期化
     */
	async initWasm() {
		const workerPromises = [];
		for (let i = 0; i < this.workerCount; i++) {
			const w = new Worker(PIANO_CONFIG.WASM_WORKER_PATH, { type: 'module' });
			
			// Workerが準備完了したことを知らせるPromiseを作成
			const p = new Promise((resolve) => {
				w.onmessage = (e) => {
					if (e.data.type === 'ready') {
						resolve();
					} else {
						this._onWorkerMessage(e.data);
					}
				};
			});
			
			this.workers.push(w);
			workerPromises.push(p);
		}
		await Promise.all(workerPromises);
		console.log(`✅ ${this.workerCount} Workers initialized and ready.`);
	}
	
	
    /**
     * ノートとベロシティから最適なファイル名とピッチ補正値を計算
     */
    getSampleMapping(midi, velocity) {
        // A,C,Ds,Fsのみを使用するマッピングロジック
        const noteIndex = midi % 12;
        const octave = Math.floor(midi / 12) + PIANO_CONFIG.MIDI_BASE_OCTAVE;

        let targetAnchorNote = '';
        let targetOctave = octave;
        let detuneCents = 0;

        // 近くの音符をデータセットから疑似再現。
        if (noteIndex === 0) { targetAnchorNote = 'C'; detuneCents = 0; }
        else if (noteIndex === 1) { targetAnchorNote = 'C'; detuneCents = PIANO_CONFIG.DETUNE_CENT; }
        else if (noteIndex === 2) { targetAnchorNote = 'Ds'; detuneCents = -PIANO_CONFIG.DETUNE_CENT; }
        else if (noteIndex === 3) { targetAnchorNote = 'Ds'; detuneCents = 0; }
        else if (noteIndex === 4) { targetAnchorNote = 'Ds'; detuneCents = PIANO_CONFIG.DETUNE_CENT; }
        else if (noteIndex === 5) { targetAnchorNote = 'Fs'; detuneCents = -PIANO_CONFIG.DETUNE_CENT; }
        else if (noteIndex === 6) { targetAnchorNote = 'Fs'; detuneCents = 0; }
        else if (noteIndex === 7) { targetAnchorNote = 'Fs'; detuneCents = PIANO_CONFIG.DETUNE_CENT; }
        else if (noteIndex === 8) { targetAnchorNote = 'A'; detuneCents = -PIANO_CONFIG.DETUNE_CENT; }
        else if (noteIndex === 9) { targetAnchorNote = 'A'; detuneCents = 0; }
        else if (noteIndex === 10) { targetAnchorNote = 'A'; detuneCents = PIANO_CONFIG.DETUNE_CENT; }
        else if (noteIndex === 11) { targetAnchorNote = 'C'; detuneCents = -PIANO_CONFIG.DETUNE_CENT; targetOctave++; }

        // Velocity bin mapping
        let velIndex = Math.floor(velocity * PIANO_CONFIG.MIDI_VELOCITY_BINS);
        if (velIndex < 1) velIndex = 1;
        if (velIndex > PIANO_CONFIG.MIDI_VELOCITY_BINS) velIndex = PIANO_CONFIG.MIDI_VELOCITY_BINS;

        const filename = `${targetAnchorNote}${targetOctave}v${velIndex}.wav`;
        
        return {
            filename: filename,
            detune: detuneCents,
            anchorNote: targetAnchorNote,
            octave: targetOctave,
            velIndex: velIndex
        };
    }

	/**
     * バッファ読み込みロジック（WASM対応）
     */
	async loadBuffer(path) {
		if (this.buffers.has(path)) return this.buffers.get(path);

		const res = await fetch(`${this.basePath}/${path}`);
		const arrayBuffer = await res.arrayBuffer();

		const worker = this.workers[this.workerIndex];
		
		if (!res.ok) {
            console.warn(`⚠️ Sample not found: ${path} (Status: ${res.status})`);
            return null; 
		}
		
		if (this.isWasmAvailable && worker) {
			return new Promise((resolve) => {
				const id = Math.random().toString(36).substring(2);
				
				this.pendingRequests.set(id, (audioBuffer) => {
					this.buffers.set(path, audioBuffer);
					resolve(audioBuffer);
				});

				this.workerIndex = (this.workerIndex + 1) % this.workers.length;
				worker.postMessage({ id, arrayBuffer }, [arrayBuffer]);
			});
		} else {
			const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
			this.buffers.set(path, audioBuffer);
			return audioBuffer;
		}
	}

	/**
     * WASM Worker からのメッセージハンドラ
     */
	_onWorkerMessage(data) {
		const { id, pcm, count, chan } = data;
		const callback = this.pendingRequests.get(id);
		if (!callback) return;

		const audioBuffer = this.ctx.createBuffer(chan, count, this.ctx.sampleRate);
		for (let c = 0; c < chan; c++) {
			const channelData = audioBuffer.getChannelData(c);
			for (let i = 0; i < count; i++) {
				channelData[i] = pcm[i * chan + c];
			}
		}

		this.pendingRequests.delete(id);
		callback(audioBuffer);
	}
	
	/**
     * Wasmを使用したデコード実体（内部用）
     */
	_decodeWithWasm(arrayBuffer) {
		const wasm = this.wasmInstance;
		const uint8Data = new Uint8Array(arrayBuffer);

		// データの書き込み
		const bufferPtr = wasm._malloc(uint8Data.length);
		const currentHeapU8 = new Uint8Array(wasm.instance.exports.memory.buffer);
		currentHeapU8.set(uint8Data, bufferPtr);

		const countPtr = wasm._malloc(4);
		const chanPtr = wasm._malloc(4);

		// デコード実行
		const floatPtr = wasm._decode_wav(bufferPtr, uint8Data.length, countPtr, chanPtr);

		if (floatPtr === 0) throw new Error("Wasm decoding failed");

		const liveBuffer = wasm.instance.exports.memory.buffer;

		const sampleCount = wasm.getValue(countPtr, 'i32');
		const channels = wasm.getValue(chanPtr, 'i32');
		
		// Viewを作成
		const rawData = new Float32Array(liveBuffer, floatPtr, sampleCount * channels);
		const audioBuffer = this.ctx.createBuffer(channels, sampleCount, this.ctx.sampleRate);

		for (let ch = 0; ch < channels; ch++) {
			const channelData = audioBuffer.getChannelData(ch);
			for (let i = 0; i < sampleCount; i++) {
				channelData[i] = rawData[i * channels + ch];
			}
		}

		wasm._free_ptr(bufferPtr);
		wasm._free_ptr(floatPtr);
		wasm._free_ptr(countPtr);
		wasm._free_ptr(chanPtr);

		return audioBuffer;
	}
	// ========== END WASM ENGINE SECTION ==========
	
    /**
     * 譜面解析とプリロード
     */
    async preloadScore(score) {
        console.log("Preloading samples...");
        const filesToLoad = new Set();

        // 必要なファイルをリストアップ
        score.forEach(note => {
            const map = this.getSampleMapping(note.note, note.velocity || PIANO_CONFIG.DEFAULT_VELOCITY);
            filesToLoad.add(map.filename);

            // 打鍵音ロード
            let keyIndex = note.note - PIANO_CONFIG.KEY_OFFSET_FOR_RELEASE;
            if (keyIndex < PIANO_CONFIG.MIN_KEY_INDEX) keyIndex = PIANO_CONFIG.MIN_KEY_INDEX;
            if (keyIndex > PIANO_CONFIG.MAX_KEY_INDEX) keyIndex = PIANO_CONFIG.MAX_KEY_INDEX;
            filesToLoad.add(`rel${keyIndex}.wav`);

            // ハーモニクス
            if (note.velocity > PIANO_CONFIG.MIN_HARMONICS_VELOCITY) {
                filesToLoad.add(`harmV3${map.anchorNote}${map.octave}.wav`);
            }
        });

        // ペダルふみふみ
        PIANO_CONFIG.PEDAL_FILES.forEach(f => filesToLoad.add(f));

        const files = Array.from(filesToLoad);
        const totalFiles = files.length;
        let loadedCount = 0;
        
        // 同時に処理するファイル数
        const concurrencyLimit = PIANO_CONFIG.WORKER_COUNT;

        // files配列を小さなチャンク（塊）に分割して処理する
        for (let i = 0; i < totalFiles; i += concurrencyLimit) {
            const chunk = files.slice(i, i + concurrencyLimit);
            
            const loadPromises = chunk.map(async (filename) => {
                await this.loadBuffer(filename);
                loadedCount++;
                
                // 進捗コールバック呼び出し
                if (this.onProgress) {
                    this.onProgress(loadedCount, totalFiles, filename);
                }
            });

            await Promise.all(loadPromises);
        }
        
        console.log(`Loaded ${totalFiles} samples.`);
    }

	/**
     * 運指シミュレーション
     * 譜面全体をスキャンし、物理距離と「手の交差コスト」を考慮して左右の手を割り当てる。
     */
    _assignHands(score) {
        // コピーを作成してソート
        const sortedScore = score.map(n => ({...n})).sort((a, b) => {
            if (Math.abs(a.time - b.time) < 0.01) return a.note - b.note;
            return a.time - b.time;
        });

        // 仮想的な手の位置（シミュレーション開始時のホームポジション）
        let virtualL = 45; // A2付近
        let virtualR = 75; // D#5付近

        sortedScore.forEach(note => {
            // 1. 物理的距離コスト
            const distL = Math.abs(note.note - virtualL);
            const distR = Math.abs(note.note - virtualR);

            // 2. 領域バイアス（左手は低音、右手は高音が自然）
            const centerPoint = 64; // E4
            const biasL = (note.note > centerPoint) ? (note.note - centerPoint) * 1.2 : 0;
            const biasR = (note.note <= centerPoint) ? (centerPoint - note.note) * 1.2 : 0;

            // 3. 交差ペナルティ（腕がクロスするのはしんどい）
            // 左手が右手の右側に行く、またはその逆
            const crossingCost = 20; 
            let penaltyL = (note.note > virtualR) ? crossingCost : 0;
            let penaltyR = (note.note < virtualL) ? crossingCost : 0;

            // コスト比較で手を決定
            if ((distL + biasL + penaltyL) < (distR + biasR + penaltyR)) {
                note.hand = 'left';
                virtualL = note.note;
            } else {
                note.hand = 'right';
                virtualR = note.note;
            }
        });
        
        return sortedScore;
    }

    /**
     * 再生
     */
    async play(score) {
        if (!score || !Array.isArray(score)) {
            console.error("Invalid score format");
            return;
        }

        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

		const isLoaded = score.every(note => {
			const map = this.getSampleMapping(note.note, note.velocity || 0.5);
			return this.buffers.has(map.filename);
		});

		if (!isLoaded) {
			this.isLoading = true;
			if (this.onProgress) this.onProgress(0, 1, "Initializing...");
			await this.preloadScore(score);
			this.isLoading = false;
		}

        this.isLoading = true;
        if (this.onProgress) this.onProgress(0, 1, "Initializing...");

        // 運指決定
        // ここで各ノートに .hand = 'left' ﾊﾟｲﾌﾟ 'right' が付与される
        const assignedScore = this._assignHands(score);

        const startTime = this.ctx.currentTime + 0.5;
        let lastEventTime = 0;
        let isFirstNote = true;

        // 時間ごとのグルーピング
        const timeGroups = {};
        assignedScore.forEach(note => {
            // 微細なズレを許容してまとめる
            const t = note.time.toFixed(3);
            if (!timeGroups[t]) timeGroups[t] = [];
            timeGroups[t].push(note);
        });

        // 再生ループ実行
        Object.keys(timeGroups).sort((a, b) => parseFloat(a) - parseFloat(b)).forEach(tKey => {
            const notesInChord = timeGroups[tKey];

            // 和音内の発音順序：低音から高音へ
            notesInChord.sort((a, b) => a.note - b.note);

            notesInChord.forEach((note, index) => {
                let triggerTime = startTime + note.time;

                // 精神的・時間的ゆらぎ
                
                // 1/fゆらぎによる全体的なグルーヴのズレ
                const commonFluctuation = this.pinkNoise.getNext(); 
                triggerTime += commonFluctuation * 0.0002;

                // 空白明けの緊張
                const silenceDuration = note.time - lastEventTime;
                if (silenceDuration > 2.0 || isFirstNote) {
                    triggerTime += Math.random() * 0.025 + 0.005; // 緊張による遅れ
                    note.velocity *= 0.9 + (Math.random() * 0.2); // 力みによるベロシティぶれ
                    isFirstNote = false;
                }
                lastEventTime = note.time;


                // 身体的制約・疲労シミュレーション

                let agentResult;
                const simCurrentTime = note.time; // 曲中の絶対時間

                // 決定された運指に基づいてエージェントを動かす
                if (note.hand === 'left') {
                    agentResult = this.leftHand.move(note.note, simCurrentTime, note.velocity);
                } else {
                    agentResult = this.rightHand.move(note.note, simCurrentTime, note.velocity);
                }

                // 物理移動によるレイテンシを加算
                triggerTime += agentResult.latency;


                // 手の交差・出張による追加ストレス
                
                let crossingStress = 0;
                // 左手が、現在の右手の位置より「右（高音）」にある場合
                if (note.hand === 'left' && note.note > this.rightHand.currentKey) {
                    crossingStress = 0.015;
                }
                // 右手が、現在の左手の位置より「左（低音）」にある場合
                if (note.hand === 'right' && note.note < this.leftHand.currentKey) {
                    crossingStress = 0.015;
                }
                
                triggerTime += crossingStress;
                // 交差中はミスタッチ確率が跳ね上がる
                if (crossingStress > 0) agentResult.mistouchProb += 0.15;


                // 最終的なパラメータ決定

                // 疲労度を加味したベロシティ
                let actualVelocity = note.velocity * agentResult.velocityScale;

                // 和音のストローク
                // 疲労しているとバラつきが大きくなる
                const fatigueSpread = (1.0 - agentResult.velocityScale) * 0.01; 
                const chordSpread = index * (0.008 + (Math.random() * 0.005) + fatigueSpread);
                triggerTime += chordSpread;


                // ミスタッチ  oops!

                if (Math.random() < agentResult.mistouchProb) {
                    // 隣の鍵盤をかすめてしまう処理
                    const direction = Math.random() > 0.5 ? 1 : -1;
                    const ghostNoteKey = note.note + direction;
                    
                    // ゴーストノート生成（弱く、短く、少し早く）
                    const ghostNoteData = {
                        note: ghostNoteKey,
                        velocity: Math.max(0.05, actualVelocity * 0.2), // 本来の2割程度の強さ
                        duration: 0.08
                    };
                    
                    // かすった音は、本来の音よりごくわずかに先行する（指が滑るため）
                    this.scheduleNote(ghostNoteData, triggerTime - 0.015, true); 
                    
                    // ミスタッチした動揺で、本来の音が少し弱くなる（エネルギーが分散する）
                    actualVelocity *= 0.85; 
                    
                    // 焦ってタイミングも微細にズレる
                    triggerTime += 0.005; 
                }

                const playNote = {...note, velocity: actualVelocity};
                this.scheduleNote(playNote, triggerTime, false);
            });
        });

        // ペダル
        this.schedulePedal(startTime, 'D');
    }
	
	/**
     * 共鳴とか音
     */
	scheduleNote(noteData, when, isGhost = false) {
        const velocity = noteData.velocity || 0.5;
        const offVelocity = noteData.offVelocity || 0.5; 

        // 押鍵状態の管理
        setTimeout(() => {
            this.heldKeys.add(noteData.note);
        }, (when - this.ctx.currentTime) * 1000);

        const mapping = this.getSampleMapping(noteData.note, velocity);
        const buffer = this.buffers.get(mapping.filename);
        
        if (!buffer) return;

        // シンパセティック・レゾナンス
        if (!isGhost && velocity > 0.3) {
            this._triggerSympatheticResonance(noteData.note, when, velocity);
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.detune.value = mapping.detune;
		
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        const cutoffFreq = 800 + (19200 * Math.pow(velocity, 2)); 
        filter.frequency.setValueAtTime(cutoffFreq, when);

		// 右のは右から聞こえる　左なら左
        const panner = this.ctx.createStereoPanner();
        const panValue = ((noteData.note - 21) / 87) * 1.8 - 0.9;
        panner.pan.value = Math.max(-0.9, Math.min(0.9, panValue));

        const gainNode = this.ctx.createGain();
        let noisyVelocity = isGhost ? velocity : velocity + (this.pinkNoise.getNext() * 0.0005);
        noisyVelocity = Math.max(0.01, Math.min(1.0, noisyVelocity));

        const distFromCenter = Math.abs(noteData.note - 69);
        const positionFactor = 1.0 - (distFromCenter / 88) * 0.3;
        const finalGain = Math.pow(noisyVelocity, 2) * positionFactor;
        
        // エンベロープ
        gainNode.gain.setValueAtTime(0, when);
        gainNode.gain.linearRampToValueAtTime(finalGain, when + 0.005);
        
        const releaseTime = when + noteData.duration;
        
        // ペダルが深く踏まれているほど、リリース後の減衰が長くなる
        const currentPedal = this.pedalDepth || 0;
        // 通常は0.2秒程度で消えるが、ペダルがあれば最大2.0秒くらい伸びる
        const releaseTail = 0.2 + (currentPedal * 1.8);

        // 離鍵時の処理をスケジュール
        gainNode.gain.setValueAtTime(finalGain, releaseTime - 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, releaseTime + releaseTail);

        // リリース時にSetから削除
        setTimeout(() => {
            this.heldKeys.delete(noteData.note);
        }, ((releaseTime + releaseTail) - this.ctx.currentTime) * 1000);


        source.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(panner);
        panner.connect(this.masterGain);

        const sendGain = this.ctx.createGain();
        sendGain.gain.value = finalGain * 0.5; 
        gainNode.connect(sendGain);
        sendGain.connect(this.resonanceSend);

        source.start(when);
        // バッファ再生停止もテールの長さを考慮
        source.stop(releaseTime + releaseTail + 0.5);
		
		// 爪が当たってしまった！
        if (!isGhost && (noisyVelocity > 0.7 || Math.random() < 0.1)) {
            this._triggerNailNoise(when, noisyVelocity);
        }
		// 12度も手が開くなら爪切っとけっていう話ではあるな

        // ペダルを踏みっぱなしの時は、ダンパーが落ちないのでリリース音は鳴らない
        if (currentPedal < 0.2) {
            let keyIndex = noteData.note - 20;
            if (keyIndex < 1) keyIndex = 1;
            if (keyIndex > 88) keyIndex = 88;
            const relBuffer = this.buffers.get(`rel${keyIndex}.wav`);
            
            if (relBuffer) {
                const relSource = this.ctx.createBufferSource();
                relSource.buffer = relBuffer;
                const relGain = this.ctx.createGain();
                const relVolume = 0.01 + (offVelocity * 0.1); 
				// 0.01の意味は？（ほぼ）ない！（調整にいるから、まあ多少はね？）
                relGain.gain.value = relVolume;
                
                const relPanner = this.ctx.createStereoPanner();
                relPanner.pan.value = panValue;

                relSource.connect(relGain);
                relGain.connect(relPanner);
                relPanner.connect(this.masterGain);
                
                relSource.start(releaseTime);
            }
        }
    }
	
	/**
     * ペダル
     */
	schedulePedal(when, type, depth = null) {
        const isDown = type === 'D';
        // 指定がなければペダル全開/全閉、あればその値
        let targetDepth = isDown ? 1.0 : 0.0;
        if (depth !== null) targetDepth = depth;

        this.pedalDepth = targetDepth;

        const rr = Math.random() > 0.5 ? '1' : '2';
        const file = `pedal${type}${rr}.wav`;
        const buffer = this.buffers.get(file);
        
        // 共鳴センド量を滑らかに変化させる（ハーフペダル表現）
        // 完全に踏むと0.5、半分なら0.2くらい
        const targetGain = targetDepth * 0.5;
        this.resonanceSend.gain.setTargetAtTime(targetGain, when, 0.15);
		
        // ペダル機構音の再生
        if (buffer) {
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            const gain = this.ctx.createGain();
            // 踏む深さに応じてノイズ音量も変える
            gain.gain.value = 0.2 * (Math.abs(this.pedalDepth - (isDown ? 0 : 1)) + 0.5);
            source.connect(gain);
            gain.connect(this.masterGain);
            source.start(when);

            // ダンパーが一斉に開放される共鳴
			if (isDown && this.pedalDepth > 0.3 && Math.random() < 0.4) {
				const resSource = this.ctx.createBufferSource();
				resSource.buffer = buffer; 
				const resGain = this.ctx.createGain();
				const fakeVelocity = 50 + (Math.random() * 40); 
				resGain.gain.setValueAtTime(0.01 * (fakeVelocity / 127) * this.pedalDepth, when);
				resGain.gain.exponentialRampToValueAtTime(0.001, when + 1.0);
				resSource.connect(resGain);
				resGain.connect(this.masterGain);
				resSource.start(when);
			}
        }
    }
	
	/**
     * 空気感と床鳴りのシミュレーション
     * isBodyResonance: trueなら「重く、こもった」木の響きにする
     */
    _createReverbBuffer(duration, decay, isBodyResonance = false) {
        const sampleRate = this.ctx.sampleRate;
        const length = sampleRate * duration;
        const impulse = this.ctx.createBuffer(2, length, sampleRate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);

        // 簡易ローパスフィルタ用の変数
        let lastL = 0;
        let lastR = 0;
        // フィルタ係数（高いほど高音が削れる＝木や床っぽい）
        const smoothing = isBodyResonance ? 0.6 : 0.15; 

        for (let i = 0; i < length; i++) {
            const n = i / length;
            // 指数関数減衰カーブ
            const factor = Math.pow(1 - n, decay);

            // ホワイトノイズ生成
            let rawL = (Math.random() * 2 - 1);
            let rawR = (Math.random() * 2 - 1);

            // ローパス処理
            rawL = lastL + (rawL - lastL) * (1.0 - smoothing);
            rawR = lastR + (rawR - lastR) * (1.0 - smoothing);
            lastL = rawL;
            lastR = rawR;

            left[i] = rawL * factor;
            right[i] = rawR * factor;
        }

        return impulse;
    }
	
    /**
     * 爪が鍵盤に当たる「カチッ」という接触音を合成する
     */
    _triggerNailNoise(when, velocity) {
        // ノイズバッファの動的生成
        const bufferSize = this.ctx.sampleRate * 0.02;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        // ホワイトノイズ生成
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1);
        }

        const noiseSrc = this.ctx.createBufferSource();
        noiseSrc.buffer = buffer;

        // ハイパスフィルタで低域をカット
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 2500; // 2.5kHz以上のみ通す

        const noiseGain = this.ctx.createGain();
        // ベロシティに応じて音量変化。ただし微細に。
        noiseGain.gain.value = 0.05 * velocity; 
        
        // 瞬時に減衰させる
        noiseGain.gain.setValueAtTime(0.05 * velocity, when);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, when + 0.01);

        noiseSrc.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        noiseSrc.start(when);
    }
	
	/**
     * 倍音共鳴
     */
    _triggerSympatheticResonance(triggerNote, when, velocity) {
        // オクターブ上、12度上、2オクターブ上
        const harmonics = [12, 19, 24]; 

        this.heldKeys.forEach(heldNote => {
            if (heldNote === triggerNote) return;

            // 低音弦の共鳴：弾いた音が、押さえている低音の「倍音」である場合
            // 例: C2を押さえたまま、C3を弾いた -> C2の弦がC3の高さで鳴る
            let isHarmonic = false;
            let targetHarmonicDiff = triggerNote - heldNote;
            
            if (harmonics.includes(targetHarmonicDiff)) {
                // 共鳴音を生成
                const mapping = this.getSampleMapping(triggerNote, velocity * 0.3);
                const buffer = this.buffers.get(mapping.filename);
                if (buffer) {
                    const src = this.ctx.createBufferSource();
                    src.buffer = buffer;
                    src.detune.value = mapping.detune;

                    const g = this.ctx.createGain();
                    const resVol = 0.1 * velocity; 
                    g.gain.setValueAtTime(0, when);
                    g.gain.linearRampToValueAtTime(resVol, when + 0.1);     // ゆっくり立ち上がる
                    g.gain.exponentialRampToValueAtTime(0.001, when + 1.5); // 長く響く

                    // ローパスで高域を削り「他人の空似」感を出す
                    const f = this.ctx.createBiquadFilter();
                    f.type = 'lowpass';
                    f.frequency.value = 600;

                    src.connect(f);
                    f.connect(g);
                    g.connect(this.resonanceSend); // 共鳴バスへ送る
                    src.start(when);
                }
            }
        });
	}
}

// インスタンスをつくるっぴ！
const piano = new MyJavaScriptPiano();
window.piano = piano;

async function startPianoSystem() {
    try {
        await piano.initWasm(); 
        console.log("✅ WASM Workers are ready.");
    } catch (e) {
        console.error("WASM initialization failed:", e);
    }
}

// 初期化実行
startPianoSystem();

/*WASMじゃないやつ

const piano = new MyJavaScriptPiano();
window.piano = piano;

*/