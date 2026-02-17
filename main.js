window.myScore=[];function addNote(note,start,duration,velocity){window.myScore.push({note:note,time:start,duration:duration,velocity:velocity})} let t=0;[60,62,64,65,67,69,71,72].forEach((n,i)=>{addNote(n,t,0.8,0.6);t+=0.5});t+=1.0;const chordTime=t;addNote(36,chordTime,4.0,0.7);addNote(43,chordTime,4.0,0.7);addNote(76,chordTime,4.0,0.6);addNote(79,chordTime,4.0,0.65);addNote(84,chordTime,4.0,0.7);t+=4.5;addNote(60,t,2.0,0.1);addNote(64,t+0.1,2.0,0.15);addNote(67,t+0.2,2.0,0.1);t+=2.5;addNote(36,t,3.0,1.0);addNote(48,t,3.0,0.95);t+=4.0;t+=4.0;addNote(72,t,3.0,0.5);console.log("Test Score Created with "+window.myScore.length+" notes.")
// ごめんなさいね、ドキュメントが主なので、仕方がないのです。

/*

# `window.myScore` データ構造仕様書

`MyJavaScriptPiano` は、グローバル変数 `window.myScore` に格納された配列データを読み込み、演奏を行います。  
基本的には、main.jsに記述しておくことをおすすめします。その後、script.jsから呼び出されますので。

## 1. 基本構造

`window.myScore` は **オブジェクトの配列 (Array of Objects)** です。
配列内の各オブジェクトは、1つの「音符（ノート）」を表します。

```javascript
window.myScore = [
    { note: 60, time: 0.0, duration: 1.0, velocity: 0.5 },
    { note: 64, time: 0.5, duration: 1.0, velocity: 0.6 },
    ...
];
```

## 2. オブジェクトのプロパティ

各ノートオブジェクトには、以下の4つのプロパティが必要です。

| プロパティ名 | 型 (Type) | 単位 / 範囲 | 説明 | 必須 |
| :--- | :--- | :--- | :--- | :--- |
| **`note`** | `Number` | 21 ~ 108 | MIDIノート番号（音の高さ）。<br>21=A0, 60=C4(中央ド), 108=C8 | **Yes** |
| **`time`** | `Number` | 秒 (Seconds) | 曲の開始時点を `0.0` とした**絶対時間**。<br>いつ音を鳴らすかを指定します。 | **Yes** |
| **`duration`** | `Number` | 秒 (Seconds) | 音の長さ（ゲートタイム）。<br>鍵盤を押している時間を指定します。 | **Yes** |
| **`velocity`** | `Number` | 0.0 ~ 1.0 | 打鍵の強さ。<br>音量、音色、共鳴音の有無に影響します。 | Optional<br>*(def: 0.5)* |

### プロパティ詳細

#### `note` (MIDI Note Number)
ピアノの88鍵盤に対応する整数値です。
*   **21**: A0 (最低音)
*   **60**: C4 (中央ド)
*   **108**: C8 (最高音)

#### `time` (Start Time)
「前の音からの差分（Delta Time）」ではなく、**曲の頭からの絶対時間**で指定してください。
*   例: 1拍目が `0.0`、2拍目が `0.5` ...
*   **※ エンジンの挙動メモ**: `player.js` はこの時間を「意図したタイミング」として受け取りますが、再生時に**1/fゆらぎ**や**手の移動レイテンシ**を自動加算するため、指定した時間よりもわずかに遅れて発音されることがあります（人間味の演出）。

#### `duration` (Duration)
鍵盤を離すまでの時間です。
*   この時間が経過すると、`rel` (リリースノイズ) が再生され、音が減衰し始めます。

#### `velocity` (Velocity)
*   **0.0 ~ 1.0** の小数で指定します。
*   内部で `1` ~ `16` 段階のサンプル (`v1.wav` ~ `v16.wav`) にマッピングされます。
*   **0.6 以上 (v10相当~)を指定すると**: 強い打鍵とみなされ、共鳴音 (`harmV3`) が自動的にレイヤーされます。

---

## 3. サンプルデータ作成例

以下は、Cメジャーコード（ドミソ）をアルペジオで弾き、最後に和音で終わる例です。

```javascript
window.myScore = [
    // ド (C4)
    { note: 60, time: 0.0, duration: 0.5, velocity: 0.4 },
    // ミ (E4)
    { note: 64, time: 0.5, duration: 0.5, velocity: 0.5 },
    // ソ (G4)
    { note: 67, time: 1.0, duration: 0.5, velocity: 0.6 },
    
    // ジャーン（和音）
    // timeを揃えることで和音として認識されますが、
    // エンジン側で自動的に微細なズレ（ストラミング）が付与されます。
    { note: 60, time: 2.0, duration: 2.0, velocity: 0.8 }, // C4
    { note: 64, time: 2.0, duration: 2.0, velocity: 0.7 }, // E4
    { note: 67, time: 2.0, duration: 2.0, velocity: 0.75 }, // G4
    { note: 72, time: 2.0, duration: 2.0, velocity: 0.9 }  // C5 (強い音 -> 共鳴音あり)
];
```

## 4. エンジン特有の挙動について（作成者向けメモ）

譜面データを作成する際は、以下の点に留意するとよりリアルな演奏になります。

1.  **完全な同時打鍵について**
    *   和音などで `time` を完全に一致させても問題ありません。
    *   `player.js` は同一時刻のノートを検知すると、中央（69番）から遠い鍵盤ほどわずかに発音を遅らせる処理（物理的な指のバラつき再現）を自動で行います。
    *   そのため、譜面データ側で手動で `0.005` 秒ずらす等の微調整を行う必要はありません（やっても良いですが、二重にかかる可能性があります）。

2.  **休符後の挙動**
    *   前のノートから一定時間（約2秒以上）空くと、次のノートの発音時に「迷い」や「位置合わせ」によるノイズ（タイミングの遅れ）が大きめに付与されます。これを意図的に利用して、フレーズの歌い出しを表現できます。

3.  **手のエージェント**
    *   `note < 64` は左手、`note >= 64` は右手のエージェントが担当していると仮定してレイテンシ計算されます。
    *   極端に離れた音（例: C2 から C6）へ急に飛ぶ譜面の場合、物理的な移動時間をシミュレートするため、発音が少し遅れることがあります。

*/
