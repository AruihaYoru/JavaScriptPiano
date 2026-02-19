const playBtn = document.getElementById('playBtn');
playBtn.addEventListener('click', async () => {
    if (piano.isLoading) return;

    if (piano.ctx.state === 'suspended') {
        await piano.ctx.resume();
    }
    console.log("Loading and Playing...");
    await piano.play(myscore);
    
    playBtn.disabled = true;
    setTimeout(() => { playBtn.disabled = false; }, 16000); 
});

volumeSlider.addEventListener('input', (e) => {
    const rawValue = parseFloat(e.target.value);
    const exponentialGain = Math.pow(rawValue, 2) / 5;
    volumeValue.textContent = rawValue.toFixed(2);
    if (piano.masterGain) {
        piano.masterGain.gain.setTargetAtTime(exponentialGain, piano.ctx.currentTime, 0.05);
    }
});

piano.onProgress = (current, total, filename) => {
    const percent = Math.floor((current / total) * 100);
    console.log(`Loading: ${percent}% (${current}/${total}) - ${filename}`);
    
    const progressDiv = document.getElementById('progress');
    if(progressDiv) {
        progressDiv.textContent = `Loading... ${percent}%`;
        progressDiv.style.width = `${percent}%`;
    }
    
    if (current === total) {
        console.log("Loading Complete!");
        if(progressDiv) progressDiv.textContent = "Ready!";
    }
};

let originalMainJsContent = "";

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('main.js');
        originalMainJsContent = await response.text();
        
        const scoreInput = document.getElementById('scoreInput');
        scoreInput.value = originalMainJsContent;
    } catch (e) {
        console.error("main.jsの読み込みに失敗しました:", e);
    }
});


const scoreInput = document.getElementById('scoreInput');
const updateBtn = document.getElementById('updateBtn');

updateBtn.addEventListener('click', () => {
    const fullText = scoreInput.value;
    
    try {
        const match = fullText.match(/\[[\s\S]*\]/);
        if (!match) throw new Error("配列データ（[ ]）が見つかりません。");

        const arrayPart = match[0];
        
        const evaluatedScore = new Function(`return ${arrayPart}`)();
        
        if (Array.isArray(evaluatedScore)) {
            window.myscore = evaluatedScore;
            
            const status = document.getElementById('status');
            status.innerText = "Score Updated!";
            status.style.color = "#000";
            setTimeout(() => status.innerText = "Ready", 1500);
            
            console.log("更新完了。現在のデータ数:", window.myscore.length);
        }
    } catch (e) {
        alert("エラー: " + e.message);
        console.error(e);
    }
});