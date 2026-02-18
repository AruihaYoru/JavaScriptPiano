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
 * 疲労、跳躍リスク、物理的な移動を管理する
 */
class HandAgent {
    constructor(startKey) {
        this.currentKey = startKey;
        this.fatigue = 0.0;
        this.lastTime = 0;
    }

    /**
     * 手を移動させ、その負荷を計算する
     * @param {number} nextKey - 次のノート番号
     * @param {number} currentTime - 現在の絶対時間
     * @param {number} velocity - 次の打鍵の強さ
     */
    move(nextKey, currentTime, velocity) {
        // 時間経過による疲労回復 (1秒で0.3回復)
        const deltaTime = currentTime - this.lastTime;
        this.fatigue = Math.max(0, this.fatigue - (deltaTime * 0.3));
        this.lastTime = currentTime;
		
        const distance = Math.abs(nextKey - this.currentKey);
        this.currentKey = nextKey;

        // 距離の1.2乗に、疲労度を加算。疲れていると遠くへの移動が遅れる。
        let latency = Math.pow(distance, 1.2) * 0.0005 * (1.0 + this.fatigue);

        // フォルテ(>0.8)の連打や、大きな跳躍(>7)で疲労が溜まる
        const stress = (velocity > 0.8 ? velocity * 0.05 : 0) + (distance > 7 ? 0.02 : 0);
        this.fatigue = Math.min(1.0, this.fatigue + stress);

        // 跳躍距離と疲労度に応じて確率上昇。最大15%程度。
        let mistouchProb = (distance > 5 ? 0.02 : 0) + (this.fatigue * 0.1);
        if (distance > 12) mistouchProb += 0.05; 
		
        // 疲れていると意図したより弱くなる、または制御が効かず強くなる(ばらつき)
        let velocityFluctuation = 1.0;
        if (this.fatigue > 0.5) {
            velocityFluctuation = 1.0 - (Math.random() * this.fatigue * 0.2); 
        }
		
		// 1オクターブ半こと12度も引けるやつがこんなミスり方するかといわれるとうーん		
		
        return {
            latency: latency,
            mistouchProb: mistouchProb,
            velocityScale: velocityFluctuation
        };
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
        this.compressor.threshold.value = -10; // -20dBを超えたら圧縮開始
        this.compressor.knee.value = 30;       // 滑らかに圧縮
        this.compressor.ratio.value = 4;       // 圧縮比率
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
     * 運指シミュレーション（脳）
     * 譜面全体をスキャンし、物理的な移動距離と「手の交差コスト」を考慮して
     * 左右どちらの手で弾くかを決定する。
     */
    _assignHands(score) {
        // 仮想的な手の位置
        let virtualL = 40; // E2付近
        let virtualR = 70; // A#4付近

        // 時間順、かつ同時刻なら音程順にソート
        // これにより、和音の構成音を下から順に判定できる
        const sortedScore = [...score].sort((a, b) => {
            if (Math.abs(a.time - b.time) < 0.01) {
                return a.note - b.note;
            }
            return a.time - b.time;
        });

        sortedScore.forEach(note => {
            // 基本的な物理距離
            const distL = Math.abs(note.note - virtualL);
            const distR = Math.abs(note.note - virtualR);

            // 領域バイアス
            // 左手は低音(<=64)が好き、右手は高音(>64)が好き。
            // 自分の領土から離れるほどコストが高くなる。
            // これがないと、右手が暇な時に平気で最低音を取りに行ったりしてしまう。
            const centerPoint = 64; // E4付近
            const biasL = (note.note > centerPoint) ? (note.note - centerPoint) * 1.5 : 0;
            const biasR = (note.note <= centerPoint) ? (centerPoint - note.note) * 1.5 : 0;

            // 交差ペナルティ
            // 「左手が右手の右側に行く」または「右手が左手の左側に行く」のは物理的に窮屈。
            // 強い動機（距離が極端に近いなど）がない限り避ける。
            const crossingCost = 15; // かなり重いコスト
            let penaltyL = 0;
            let penaltyR = 0;

            // もしこのノートを左手で取ると、右手の現在位置を超えてしまうか？
            if (note.note > virtualR) penaltyL += crossingCost;
            
            // もしこのノートを右手で取ると、左手の現在位置を超えてしまうか？
            if (note.note < virtualL) penaltyR += crossingCost;

            // 総合コスト計算
            const totalCostL = distL + biasL + penaltyL;
            const totalCostR = distR + biasR + penaltyR;

            // コストが低い方の手を割り当てる
            if (totalCostL < totalCostR) {
                note.hand = 'left';
                virtualL = note.note; // 仮想手を移動
            } else {
                note.hand = 'right';
                virtualR = note.note; // 仮想手を移動
            }
        });
        
        return sortedScore;
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
     * [New] 運指シミュレーション（脳内での事前の計画）
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

        this.isLoading = true;
        if (this.onProgress) this.onProgress(0, 1, "Initializing...");

        // サンプルロード
        await this.preloadScore(score);
        this.isLoading = false;

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

                // 本番のノートをスケジュール
                const playNote = {...note, velocity: actualVelocity};
                // scheduleNote内で「爪ノイズ」や「共鳴」の判定を行う
                this.scheduleNote(playNote, triggerTime, false);
            });
        });

        // ペダル
        this.schedulePedal(startTime, 'D');
    }
	
    scheduleNote(noteData, when, isGhost = false) {
        const velocity = noteData.velocity || 0.5;
        const mapping = this.getSampleMapping(noteData.note, velocity);
        const buffer = this.buffers.get(mapping.filename);
        
        if (!buffer) return;

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.detune.value = mapping.detune;

        const gainNode = this.ctx.createGain();
        
        // ベロシティノイズ (Ghostの場合はノイズを減らす)
        let noisyVelocity = isGhost ? velocity : velocity + (this.pinkNoise.getNext() * 0.0005);
        noisyVelocity = Math.max(0.01, Math.min(1.0, noisyVelocity));

        // 音量カーブ
        const distFromCenter = Math.abs(noteData.note - 69);
        const positionFactor = 1.0 - (distFromCenter / 88) * 0.3;
        const finalGain = Math.pow(noisyVelocity, 2) * positionFactor; // カーブ変更なし
        
        // エンベロープ
        gainNode.gain.setValueAtTime(0, when); // クリックノイズ防止のため0から
        gainNode.gain.linearRampToValueAtTime(finalGain, when + 0.005);
        
        const releaseTime = when + noteData.duration;
        gainNode.gain.setValueAtTime(finalGain, releaseTime - 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, releaseTime + 0.2);

        source.connect(gainNode);
        gainNode.connect(this.masterGain);
        source.start(when);
        source.stop(releaseTime + 1.0);

        // 爪が当たる高周波ノイズ
        // 強い打鍵(>0.7) または ランダムな確率、かつゴーストノートでない場合
        if (!isGhost && (noisyVelocity > 0.7 || Math.random() < 0.3)) {
            this._triggerNailNoise(when, noisyVelocity);
        }
		// 余談だけど、ゴーストノートってMIDIを派手にするための音量0ノートって意味もありましたね。ごめんなさい。
		
        // 共鳴、ハーモニクス。
        const resonanceChance = (1.0 - (distFromCenter / 100)) * noisyVelocity;

        if (!isGhost && Math.random() < (1.0 - (distFromCenter / 100)) * noisyVelocity && mapping.velIndex > 8) {
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
            relGain.gain.value = 0.1 + (noisyVelocity * 0.05);
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
            gain.gain.value = 0.2;
            source.connect(gain);
            gain.connect(this.masterGain);
            source.start(when);
			
			const resonanceChance = 0.4;
    
			if (Math.random() < resonanceChance) {
				// 共鳴用の音源
				const resSource = this.ctx.createBufferSource();
				resSource.buffer = buffer; 
				
				const resGain = this.ctx.createGain();
			
                // 共鳴のばらつきをランダム生成
				const fakeDistFromCenter = Math.random() * 30; 
				
				const resonanceDuration = 0.5 * (1.0 + (1.0 - Math.min(fakeDistFromCenter / 44, 1.0)) * 0.5);
				
                // ペダルを踏む強さをランダムにシミュレート
				const fakeVelocity = 50 + (Math.random() * 40); 

				resGain.gain.setValueAtTime(0.01 * (fakeVelocity / 127), when);
				
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
	
	
}

// インスタンスをつくるっぴ！
const piano = new MyJavaScriptPiano();
window.piano = piano;