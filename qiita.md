# Vanilla JSとWeb Audio APIで物理モデルピアノシミュレーター

## はじめに
Web上で楽器を再現する試みは数多くありますが、その多くは単に録音された音（サンプル）を再生するに留まります。しかし、本物の楽器の魅力は、単音の美しさだけではありません。弾き手の感情、指の動き、ペダルの踏み加減、楽器本体の共鳴、そして部屋の響き... これら全てが複雑に絡み合い、「生きた音」が生まれるのです。
この記事では、私が作成した[JavaScriptPiano](https://aruihayoru.github.io/JavaScriptPiano) というプロジェクトを題材に、**Vanilla JSとWeb Audio APIだけで、いかにして「生きたピアノの音」というオーガニックな体験に近づけるか**、その具体的な実装テクニックを、設計思想のレベルから深く掘り下げていきます。
あんまりレポジトリ紹介みたいなことはしません。生楽器が持つ「不完全さ」や「物理現象」をいかにしてコードで表現し、リアリティを構築していくかという、サウンドプログラミングのドキュメントです。
<br>
ソースコードはここに！
- [AruihaYoru/JavaScriptPiano](https://github.com/AruihaYoru/JavaScriptPiano)
<br>音源サンプルはAlexander Holm氏による[Salamander Grand Piano](https://github.com/sfzinstruments/SalamanderGrandPiano/tree/master)  (CC BY 3.0)を使用しています。
## リアリティ基盤
完全に均一で正確な演奏は、機械的で冷たい印象を与えます。人間の演奏には、心拍や呼吸に由来する常に微細な「ゆらぎ」が存在し、それが独特のグルーヴや感情表現に繋がります。この心地よい不規則性を再現するために、プロジェクト全体で**1/fゆらぎ**を生命線として活用しています。
ピンクノイズは、周波数`f`に反比例するパワースペクトルを持つノイズで、川のせせらぎや風の音など、多くの自然現象に見られます。人間の脳はこれを心地よく感じるようにできており、音楽のテンポや強弱の揺れにも同様の特性が見られると言われています。
```javascript:player.js
/**
 * Pink Noise Generator
 * 1/f ゆらぎを生成するためのクラス
 */
class PinkNoise {
    constructor() {
        // (Voss-McCartneyアルゴリズムによる実装)
        this.maxKey = 0x1f; // 31 (5ビット)
        this.key = 0;
        this.whiteValues = [0, 0, 0, 0, 0]; // 5つのホワイトノイズ源
        this.range = 128;
    }

    getNext() {
        const lastKey = this.key;
        this.key = (this.key + 1) & this.maxKey; // 0から31までを巡回するカウンタ
        const diff = lastKey ^ this.key; // 前のキーとの差分（どのビットが変化したか）
        let sum = 0;
        // 5つのビットをチェック
        for (let i = 0; i < 5; i++) {
            // カウンタのi番目のビットが変化した時だけ、対応するノイズ源を更新
            if (diff & (1 << i)) {
                this.whiteValues[i] = (Math.random() * 2 - 1) * this.range;
            }
            sum += this.whiteValues[i];
        }
        return sum / 5;
    }
}
```
この`getNext()`メソッドが返す、予測不能でありながらも滑らかに変化する値を、演奏のあらゆる側面に「スパイス」として加えていきます。
-   **タイミングのゆらぎ**: 指定された発音時間`triggerTime`に、ピンクノイズ由来の微小な時間（`commonFluctuation * 0.0002`）を加算します。これにより、メトロノームのような機械的な正確さから脱却し、人間らしい有機的なグルーヴが生まれます。
-   **ベロシティ（打鍵強度）のゆらぎ**: どんなに熟練したピアニストでも、毎回全く同じ強さで鍵盤を叩くことは不可能です。楽譜上のベロシティ`velocity`にもこのノイズ（`pinkNoise.getNext() * 0.0005`）を加え、一音一音の音量と音色に微妙な変化を与え、演奏に深みをもたらします。

## 仮想ピアニスト
ピアノは両手で演奏される、極めて身体的な楽器です。鍵盤上の指の移動距離、それによる疲労、そして避けられないミスタッチは、演奏のリアリティを決定づける重要な要素です。これをシミュレートするために、`HandAgent`という仮想の「手」を導入しました。
### a. 運指
演奏を始める前に、まず楽譜全体を解析し、どの音をどちらの手で弾くべきか（運指）を決定します。`_assignHands`メソッドは、人間のピアニストが直感的に行う判断を、コスト計算によって模倣します。
```javascript:player.js
_assignHands(score) {
    // ...
    let virtualL = 45; // 左手の仮想的な初期位置
    let virtualR = 75; // 右手の仮想的な初期位置

    sortedScore.forEach(note => {
        // 1. 物理的距離コスト: 現在の手の位置から近い方が低コスト
        const distL = Math.abs(note.note - virtualL);
        const distR = Math.abs(note.note - virtualR);

        // 2. 領域バイアス: 左手は低音域、右手は高音域が自然
        const centerPoint = 64; // 鍵盤の中央付近
        const biasL = (note.note > centerPoint) ? (note.note - centerPoint) * 1.2 : 0;
        const biasR = (note.note <= centerPoint) ? (centerPoint - note.note) * 1.2 : 0;

        // 3. 交差ペナルティ: 両腕がクロスするのは弾きにくく、高コスト
        const crossingCost = 20;
        let penaltyL = (note.note > virtualR) ? crossingCost : 0;
        let penaltyR = (note.note < virtualL) ? crossingCost : 0;

        // 全てのコストを合計し、より低い方が担当する
        if ((distL + biasL + penaltyL) < (distR + biasR + penaltyR)) {
            note.hand = 'left';
            virtualL = note.note; // 手の位置を更新
        } else {
            note.hand = 'right';
            virtualR = note.note;
        }
    });
    return sortedScore;
}
```
このプロセスにより、各音符に`hand: 'left'`または`hand: 'right'`が割り当てられ、後続の`HandAgent`シミュレーションの基盤となります。

### b. 身体の動きと時間
運指が決まったら、いよいよ`HandAgent`がその音を「弾き」に行きます。この`move`メソッドが、リアリティの核となる物理計算を一手に担います。
```javascript:player.js
class HandAgent {
    constructor(startKey) {
        this.currentKey = startKey; // 現在の手の位置 (MIDIノート番号)
        this.fatigue = 0.0;         // 疲労度 (0.0 ~ 1.0)
        // ...
    }
    move(nextKey, currentTime, velocity) { /* ... */ }
}
```
-   **物理距離によるレイテンシ**: 遠くの鍵盤へ手を移動させるには時間がかかります。この「跳躍時間」を発音の遅延としてシミュレートします。
    ```javascript
    const distance = Math.abs(nextKey - this.currentKey);
    // 距離が遠いほど、指数関数的にレイテンシが増加
    let latency = Math.pow(distance, 1.2) * 0.0005 * (1.0 + this.fatigue);
    ```
    `Math.pow(distance, 1.2)`とすることで、隣の音への移動では遅延はほぼゼロですが、2オクターブ以上の大きな跳躍では、人間が「よっこいしょ」と手を動かすような、知覚可能な遅れとして現れます。疲労(`fatigue`)が溜まっていると、この遅延はさらに増加します。
-   **疲労の蓄積と回復**: 激しい演奏はピアニストを疲労させます。この疲労を`fatigue`変数で0.0から1.0の範囲で管理します。
    ```javascript
    // 強い打鍵(velocity > 0.8)や大きな跳躍(distance > 7)でストレスが溜まる
    const stress = (velocity > 0.8 ? velocity * 0.05 : 0) + (distance > 7 ? 0.02 : 0);
    this.fatigue = Math.min(1.0, this.fatigue + stress);

    // 時間経過（休符）で疲労は回復する
    const deltaTime = currentTime - this.lastTime;
    this.fatigue = Math.max(0, this.fatigue - (deltaTime * 0.3));
    ```
    疲労が蓄積すると、前述の**レイテンシが増加**するだけでなく、**ベロシティのコントロールが不安定**になり（音が意図せず強くなったり弱くなったりする）、後述の**ミスタッチ確率が上昇**します。
### c. 物理的限界の再現
-   **ハンマーの戻り（連打性能）**: ピアノは、鍵盤を叩くとハンマーが弦を打ちます。同じ鍵盤を極めて短時間に連続で叩こうとすると、ハンマーが元の位置に戻りきらず、音がスカスカになる「連打の限界」が存在します。
    ```javascript
    const noteDelta = currentTime - (this.keyHistory.get(nextKey) || -10);
    // 0.08秒以内の連打は物理的に厳しい
    if (noteDelta < 0.08) {
        // ベロシティにペナルティを課し、音が「スカる」のを再現
        repetitionPenalty = 0.4 + (noteDelta * 5.0);
    }
    ```
    これにより、物理的に不可能な高速トリルを譜面に入力しても、機械的な連射音にはならず、自然な限界がシミュレートされます。
-   **ミスタッチとゴーストノート**: 人間はミスをします。特に、疲れている時や難しい跳躍の直後には、隣の鍵盤をかすめてしまうことがあります。
    ```javascript
    // 跳躍距離と疲労度に応じてミスタッチ確率が上昇
    let mistouchProb = (distance > 5 ? 0.02 : 0) + (this.fatigue * 0.1);

    if (Math.random() < mistouchProb) {
        // 隣の鍵盤をかすめてしまう「ゴーストノート」を生成
        const ghostNoteKey = note.note + (Math.random() > 0.5 ? 1 : -1);
        const ghostNoteData = {
            note: ghostNoteKey,
            velocity: Math.max(0.05, actualVelocity * 0.2), // 弱く
            duration: 0.08                                  // 短く
        };
        // かすった音は、指が滑るため本来の音よりごくわずかに先行する
        this.scheduleNote(ghostNoteData, triggerTime - 0.015, true);

        // 動揺やエネルギー分散で、本来の音が少し弱くなる
        actualVelocity *= 0.85;
    }
    ```
    この処理により、完璧すぎない、生々しい演奏が生まれます。

## 音響空間

音のリアリティは、発音そのものだけでなく、その音がどのように響き、空間に溶け込んでいくかによって決まります。ここではWeb Audio APIの各ノードを駆使して、複雑な音響空間を構築します。
`BufferSource`から発せられた音は、`Filter`, `Gain`, `Panner`を経て`MasterGain`に集約されます。同時に`ResonanceSend`というバスに送られ、筐体鳴りや共鳴音として別の経路で処理されます。全体は`Compressor`と`Convolver`（リバーブ）を通して最終出力に至ります。

### a. 音色
ピアノは、弱く弾くと柔らかくこもった音（倍音が少ない）、強く弾くと硬く煌びやかな音（倍音が多い）がします。この打鍵の強さによる音色の変化を、`BiquadFilterNode`のローパスフィルタでダイナミックに再現します。

```javascript:player.js
const filter = this.ctx.createBiquadFilter();
filter.type = 'lowpass';
// velocityが低いとカットオフ周波数が低く（こもる）、高いと周波数が高く（開く）なる
const cutoffFreq = 800 + (19200 * Math.pow(velocity, 2));
filter.frequency.setValueAtTime(cutoffFreq, when);
```
この一行の式には、音作りの意図が凝縮されています。（気づきましたけど、マジックナンバーになりかねませんねこれ）
-   `800`: どんなに弱く弾いても、音の芯が失われないようにするための最低周波数。
-   `19200`: 最大ベロシティ時に、高音域が削られず、サンプル本来の煌びやかさが出るように、可聴域上限に近い値を設定。
-   `Math.pow(velocity, 2)`: なぜ2乗なのか。これは、人間の聴感が音量（や明るさ）の変化を対数的に捉えることに対応しています。この二次曲線により、ピアニッシモからメゾピアノへの音色変化は緩やかに、メゾフォルテからフォルティッシモへの変化はより劇的になり、演奏の表現力が格段に向上します。

### b. 響き

このエンジンでは、響きを2種類に分離してシミュレートしています。
1.  **部屋の残響（Reverb）**: ホールのような、空気を伝わる空間全体の響き。
2.  **楽器の筐体鳴り（Body Resonance）**: ピアノ本体の木材やフレームが振動して生まれる、より低く、重く、こもった響き。

これを実現するために`ConvolverNode`を2つ用意し、それぞれに特性の異なるインパルスレスポンス（IR）をその場で生成して設定します。
```javascript:player.js
// 筐体鳴り用：durationが長く、decayが緩やかで、こもっている
this.bodyResonance.buffer = this._createReverbBuffer(3.0, 1.5, true);

// 部屋の残響用：より一般的なホールリバーブ
this.convolver.buffer = this._createReverbBuffer(2.5, 2.0, false);

// IR生成メソッド
_createReverbBuffer(duration, decay, isBodyResonance = false) {
    // ...
    // isBodyResonanceがtrueの場合、平滑化係数が大きくなる
    const smoothing = isBodyResonance ? 0.6 : 0.15;
    for (let i = 0; i < length; i++) {
        // ...
        // ローパス処理。smoothingが大きいほど高周波成分が失われ、こもった音になる
        rawL = lastL + (rawL - lastL) * (1.0 - smoothing);
        // ...
    }
    return impulse;
}
```
音源からの信号の一部を、専用の`GainNode` (`resonanceSend`) を通して`bodyResonance`に送ることで、直接音に「床やピアノ本体がズーンと鳴っている」ような重厚感を加えることができます。

### c. 弦の共鳴
ピアノのダンパーペダルを踏む（あるいは鍵盤を押しっぱなしにする）と、打鍵した弦だけでなく、その倍音関係にある他の弦も共鳴し、豊かな響きが生まれます。これを「シンパセティック・レゾナンス」と呼びます（確かね！）。
```javascript:player.js
_triggerSympatheticResonance(triggerNote, when, velocity) {
    // 主要な倍音であるオクターブ(12)、12度(19)、2オクターブ(24)をチェック
    const harmonics = [12, 19, 24];

    // 現在押さえられているキー(heldKeys)をループ
    this.heldKeys.forEach(heldNote => {
        let targetHarmonicDiff = triggerNote - heldNote;

        if (harmonics.includes(targetHarmonicDiff)) {
            // 共鳴音を生成
            const src = this.ctx.createBufferSource();
            // ...
            const g = this.ctx.createGain();
            // 共鳴音は間接的なので、元の音よりかなり弱く
            const resVol = 0.1 * velocity;
            // ゆっくり立ち上がり(0.1s)、長く響く(1.5s)
            g.gain.linearRampToValueAtTime(resVol, when + 0.1);
            g.gain.exponentialRampToValueAtTime(0.001, when + 1.5);

            // ローパスで高域を削り、直接音との違いを明確にする
            const f = this.ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = 600;

            src.connect(f);
            f.connect(g);
            g.connect(this.resonanceSend); // 共鳴専用のバスへ
            src.start(when);
        }
    });
}
```
この処理により、例えばC2の鍵盤を押さえたままC3を弾くと、C2の弦がC3の周波数に共振する現象が再現され、サウンドに格段の深みとリアリティが加わります。

## ディテール
生楽器の録音には、楽音以外の様々な「ノイズ」が含まれています。これらを意図的に、かつ動的に加えることで、リアリティは飛躍的に向上します。
### a. 指先のリアリズム：爪が当たる「カチッ」音
特にフォルテで弾く際、爪が鍵盤に「カチッ」と当たる高周波のノイズが混じることがあります。これはサンプリング音源には含まれていないため、**プロシージャル（動的生成）**で作成します。
```javascript:player.js
_triggerNailNoise(when, velocity) {
    // 0.02秒の短いホワイトノイズをその場で生成
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.02, ...);
    // ...
    // ハイパスフィルタで低域をばっさりカット
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2500; // 2.5kHz以上のみ通す

    // 非常に鋭い減衰エンベロープを適用
    noiseGain.gain.setValueAtTime(0.05 * velocity, when);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, when + 0.01);
}
```
この処理は、`velocity > 0.7`の時や、ランダムな確率でトリガーされます。これにより、強い打鍵にだけ、リアルなアタック感が加わり、演奏がより生々しくなります。
### b. 和音
人間が和音を弾くとき、全ての指が寸分違わず同時に鍵盤を叩くことはありません。必ず微細な時間のズレ、いわゆる「ストローク」が生じます。このエンジンは、同一時刻に指定された音符群を検知すると、自動的にこのストロークを生成します。
```javascript:player.js
// 同一時刻の音符(notesInChord)を低音から高音へソート
notesInChord.sort((a, b) => a.note - b.note);

notesInChord.forEach((note, index) => {
    // ...
    // 疲労していると指のコントロールが効かず、バラつきが大きくなる
    const fatigueSpread = (1.0 - agentResult.velocityScale) * 0.01;
    // 和音内の音の順番(index)が遅いほど、遅延が大きくなる
    const chordSpread = index * (0.008 + (Math.random() * 0.005) + fatigueSpread);
    triggerTime += chordSpread;
    // ...
});
```
この数行のコードが、機械的な「ジャーン」という和音を、人間らしい「ジャラ〜ン」という響きに変えてくれます。ピアニストの疲労度が和音のばらけ具合に影響する点も、リアリティへのこだわりです。

## まとめ
Web Audio APIは、最高ってことがわかりますねあ～はっはっはっ<br>
ここまでピアノ全ぶりだと、理解できる人限られてくんじゃねえかな<br>
その他の実装は、`README.md`を見れば書いてあります：
```md
- 打鍵音、ペダル、ハンマーすべてを再現する。
- 連続する２つ音の高さ差を元にレイテンシを加える
- 生成アルゴリズムの細かなところに1/fゆらぎを多用
- とてつもなく微妙なほどの音量差をつくる（44から離れるほど。中央が一番大きく、っていうものになるはずだから）
- 生楽器の不確定さをすべてピンクノイズで作る。
- 音の空白期間からの復帰の際、最初の鍵に課せられるノイズは少し大きく。
- すべての音のベロシティ、長さ、開始時間にレイテンシ（ノイズ）を加す
- 同時に音を鳴らす際、レイテンシは最も中心に近い鍵を最高として更に大きく。
- 共鳴をきちんと作成する（中央付近は共鳴しやすいっていう）（実際は今抑えている音の倍音とかも）
- 「手」エージェントを2個生成する。（一つの手が鳴らせる音は最大5音で、最高音と最低音の差は12度。）
- 読み込み速度の改善のため、必要なものだけを読み込む。
<!-- しんき -->
- おてての交差や出張
- 疲労概念（フォルテの連続は疲れる、でしょ？）
- ミスタッチ（隣の鍵をかすめてしまった！）
- 跳躍後はミスタッチの確率が増え、ベロシティのレイテンシも大きくなる。
- フォルテで弾くときや、指を立てて弾くとき、鍵盤に「カチッ」という爪が当たる高周波ノイズが混じる。
- 右の鍵盤なら右からなり、左の鍵盤なら左からなる
- 弱く弾くとこもり、強く弾くと開く
- 床鳴りと空気感、木のこもった音
- 「和音のストローク」の自動生成
- 「ハンマーの戻り」の物理限界
- 身を乗り出す行為
```
[JavaScriptPiano](https://aruihayoru.github.io/JavaScriptPiano)