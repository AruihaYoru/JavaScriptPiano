// main.js の window.myScore に貼り付けてください
window.myScore = [
    // --- 1小節目：ティンパニロールからの衝撃的なイ短調の和音 ---
    { note: 33, time: 0.0, duration: 2.0, velocity: 0.95 }, // A1 (超低音)
    { note: 45, time: 0.0, duration: 2.0, velocity: 0.9 },  // A2
    { note: 57, time: 0.0, duration: 2.0, velocity: 0.85 }, // A3
    { note: 60, time: 0.0, duration: 2.0, velocity: 0.85 }, // C4
    { note: 64, time: 0.0, duration: 2.0, velocity: 0.85 }, // E4
    { note: 69, time: 0.0, duration: 2.0, velocity: 0.9 },  // A4 (中央付近：共鳴MAX)

    // --- 2小節目：下降する情熱的なアルペジオ (16分音符) ---
    // 右手と左手が交差・移動しながら降りてくる様子をシミュレート
    { note: 81, time: 2.0, duration: 0.2, velocity: 0.85 }, // A5
    { note: 80, time: 2.2, duration: 0.2, velocity: 0.8 },  // G#5
    { note: 81, time: 2.4, duration: 0.2, velocity: 0.82 }, // A5
    { note: 77, time: 2.6, duration: 0.4, velocity: 0.75 }, // F5

    { note: 76, time: 3.0, duration: 0.2, velocity: 0.75 }, // E5
    { note: 74, time: 3.2, duration: 0.2, velocity: 0.7 },  // D5
    { note: 76, time: 3.4, duration: 0.2, velocity: 0.72 }, // E5
    { note: 72, time: 3.6, duration: 0.4, velocity: 0.65 }, // C5

    // --- 3小節目：さらに低域へ ---
    { note: 69, time: 4.0, duration: 0.2, velocity: 0.7 },  // A4
    { note: 68, time: 4.2, duration: 0.2, velocity: 0.65 }, // G#4
    { note: 69, time: 4.4, duration: 0.2, velocity: 0.68 }, // A4
    { note: 65, time: 4.6, duration: 0.4, velocity: 0.6 },  // F4

    { note: 64, time: 5.0, duration: 0.2, velocity: 0.65 }, // E4
    { note: 62, time: 5.2, duration: 0.2, velocity: 0.6 },  // D4
    { note: 64, time: 5.4, duration: 0.2, velocity: 0.62 }, // E4
    { note: 60, time: 5.6, duration: 0.4, velocity: 0.65 }, // C4

    // --- 4小節目：終止に向かう重厚な和音 ---
    // ここで一気にベロシティを上げ、疲労概念と爪ノイズを誘発
    { note: 45, time: 6.0, duration: 1.5, velocity: 0.9 },  // A2
    { note: 57, time: 6.0, duration: 1.5, velocity: 0.85 }, // A3
    { note: 64, time: 6.0, duration: 1.5, velocity: 0.85 }, // E4
    { note: 69, time: 6.0, duration: 1.5, velocity: 0.95 }, // A4

    { note: 40, time: 7.5, duration: 1.0, velocity: 0.88 }, // E2
    { note: 52, time: 7.5, duration: 1.0, velocity: 0.8 },  // E3
    { note: 59, time: 7.5, duration: 1.0, velocity: 0.85 }, // B3
    { note: 64, time: 7.5, duration: 1.0, velocity: 0.9 },  // E4

    // --- 5小節目：解決 (イ短調の主和音) ---
    { note: 33, time: 8.5, duration: 4.0, velocity: 0.98 }, // A1 (渾身の力で)
    { note: 45, time: 8.5, duration: 4.0, velocity: 0.9 },  // A2
    { note: 57, time: 8.5, duration: 4.0, velocity: 0.85 }, // A3
    { note: 60, time: 8.5, duration: 4.0, velocity: 0.85 }, // C4
    { note: 64, time: 8.5, duration: 4.0, velocity: 0.85 }, // E4
    { note: 69, time: 8.5, duration: 4.0, velocity: 0.9 }   // A4
];