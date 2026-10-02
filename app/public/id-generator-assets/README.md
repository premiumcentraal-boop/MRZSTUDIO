# Pinned local image processing assets

MediaPipe Tasks Vision WASM: copied from `@mediapipe/tasks-vision` 0.10.35, pinned by app/package-lock.json (Apache-2.0).

Model: Google MediaPipe Selfie Segmenter, float16 revision **1**, from:
https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite

SHA-256: `191ac9529ae506ee0beefa6b2c945a172dab9d07d1e802a290a4e4038226658b`

The model is bundled so employee images stay local and generation works offline. The person confidence mask is scaled to the input image before compositing; the crop uses the same PNG/alpha behavior as the employee editor.

Google model description: https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Selfie%20Segmentation.pdf
