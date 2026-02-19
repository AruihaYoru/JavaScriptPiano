// decoder-worker.js
import createDecoder from './wav_decoder.js';

let wasm;
async function init() {
    wasm = await createDecoder();
}

self.onmessage = async (e) => {
    if (!wasm) await init();
    
    const { id, arrayBuffer } = e.data;
    const uint8 = new Uint8Array(arrayBuffer);
    
    // Wasm処理 (前述のロジック)
    const ptr = wasm._malloc(uint8.length);
    wasm.HEAPU8.set(uint8, ptr);
    const cPtr = wasm._malloc(4);
    const chPtr = wasm._malloc(4);
    
    const fPtr = wasm._decode_wav(ptr, uint8.length, cPtr, chPtr);
    
    const count = wasm.getValue(cPtr, 'i32');
    const chan = wasm.getValue(chPtr, 'i32');
    
    // Float32Arrayとして抽出（転送可能オブジェクトにするためにコピー）
    const pcm = new Float32Array(wasm.HEAPF32.buffer, fPtr, count * chan).slice();
    
    // メモリ解放
    wasm._free(ptr);
    wasm._free(cPtr);
    wasm._free(chPtr);
    
    // メインスレッドに送り返す（PCMデータを ownership transfer して高速化）
    self.postMessage({ id, pcm, count, chan }, [pcm.buffer]);
};