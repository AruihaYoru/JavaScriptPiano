const playBtn = document.getElementById('playBtn');
playBtn.addEventListener('click', async () => {
    if (piano.ctx.state === 'suspended') {
        await piano.ctx.resume();
    }
    console.log("Playing...");
    piano.play(myscore);
    
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
    
    // UI更新例
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