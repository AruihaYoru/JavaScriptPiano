// decoder.c
#define DR_WAV_IMPLEMENTATION
#include "dr_wav.h"
#include <emscripten.h>
#include <stdint.h>

// 最大4MBのWAVまで対応できる固定バッファ（メモリ確保時間をゼロにする）
#define MAX_SAMPLES 1024 * 1024 * 4 
float decoded_buffer[MAX_SAMPLES];

EMSCRIPTEN_KEEPALIVE
float* decode_wav(const uint8_t* buffer, size_t size, int* out_sample_count, int* out_channels) {
    drwav wav;
    if (!drwav_init_memory(&wav, buffer, size, NULL)) return NULL;

    // デコード実行（あらかじめ確保された static メモリへ書き込む）
    drwav_read_pcm_frames_f32(&wav, wav.totalPCMFrameCount, decoded_buffer);

    *out_sample_count = (int)wav.totalPCMFrameCount;
    *out_channels = (int)wav.channels;

    drwav_uninit(&wav);
    return decoded_buffer; // 常に同じアドレスを返す
}