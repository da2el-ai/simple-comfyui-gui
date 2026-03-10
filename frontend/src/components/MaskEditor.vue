<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

type ToolMode = 'brush' | 'eraser'
type MaskColor = '#000000' | '#ffffff' | '#ff0000'

interface Props {
  open: boolean
  imageFile: File | null
  initialMaskDataUrl?: string
}

interface SavePayload {
  maskFile: File
  overlayDataUrl: string
}

const props = withDefaults(defineProps<Props>(), {
  initialMaskDataUrl: ''
})

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'save', payload: SavePayload): void
}>()

const dialogRef = ref<HTMLDialogElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const brushSizes = [20, 40, 80, 120]
const maskColors: MaskColor[] = ['#000000', '#ffffff', '#ff0000']
const MASK_EDITOR_SETTINGS_KEY = 'mask-editor-settings'

type MaskEditorSettings = {
  brushSize: number
  eraserSize: number
  color: MaskColor
}

/**
 * マスクエディタのブラシ設定をlocalStorageから復元する。
 * @returns 復元設定。妥当でない場合はnull。
 */
function loadSettings(): MaskEditorSettings | null {
  const raw = localStorage.getItem(MASK_EDITOR_SETTINGS_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<MaskEditorSettings>
    const isBrushSize = (value: unknown): value is number =>
      typeof value === 'number' && brushSizes.some((size) => size === value)
    const isMaskColor = (value: unknown): value is MaskColor =>
      typeof value === 'string' && maskColors.some((nextColor) => nextColor === value)

    const isValidBrush = isBrushSize(parsed.brushSize)
    const isValidEraser = isBrushSize(parsed.eraserSize)
    const isValidColor = isMaskColor(parsed.color)

    if (!isValidBrush || !isValidEraser || !isValidColor) {
      return null
    }

    const restoredBrushSize = parsed.brushSize
    const restoredEraserSize = parsed.eraserSize
    const restoredColor = parsed.color

    if (
      typeof restoredBrushSize !== 'number' ||
      typeof restoredEraserSize !== 'number' ||
      !isMaskColor(restoredColor)
    ) {
      return null
    }

    return {
      brushSize: restoredBrushSize,
      eraserSize: restoredEraserSize,
      color: restoredColor
    }
  } catch {
    return null
  }
}

/**
 * マスクエディタのブラシ設定をlocalStorageへ保存する。
 * @param settings 保存する設定。
 * @returns なし。
 */
function saveSettings(settings: MaskEditorSettings): void {
  localStorage.setItem(MASK_EDITOR_SETTINGS_KEY, JSON.stringify(settings))
}

const initialSettings = loadSettings()

const imageUrl = ref('')
const toolMode = ref<ToolMode>('brush')
const brushSize = ref(initialSettings?.brushSize ?? brushSizes[0])
const eraserSize = ref(initialSettings?.eraserSize ?? brushSizes[0])
const color = ref<MaskColor>(initialSettings?.color ?? maskColors[0])
const isDrawing = ref(false)
let previousX = 0
let previousY = 0
// const selectedSize = computed(() => (toolMode.value === 'brush' ? brushSize.value : eraserSize.value))

watch([brushSize, eraserSize, color], ([nextBrushSize, nextEraserSize, nextColor]) => {
  saveSettings({
    brushSize: nextBrushSize,
    eraserSize: nextEraserSize,
    color: nextColor
  })
})

watch(
  () => props.imageFile,
  (file) => {
    if (imageUrl.value) {
      URL.revokeObjectURL(imageUrl.value)
      imageUrl.value = ''
    }
    if (file) {
      imageUrl.value = URL.createObjectURL(file)
    }
  },
  { immediate: true }
)

watch(
  () => props.open,
  async (open) => {
    const dialog = dialogRef.value
    if (!dialog) return

    if (open && !dialog.open) {
      dialog.showModal()
      await nextTick()
      await initializeCanvas()
      return
    }

    if (!open && dialog.open) {
      dialog.close()
    }
  }
)

/**
 * ダイアログを閉じるイベントを親へ通知する。
 * @returns なし。
 */
function closeDialog(): void {
  emit('close')
}

/**
 * dialog要素の既定キャンセル動作を抑止して閉じる。
 * @param event cancelイベント。
 * @returns なし。
 */
function onDialogCancel(event: Event): void {
  event.preventDefault()
  closeDialog()
}

/**
 * ブラシモードへ切り替え、ブラシサイズを設定する。
 * @param size 設定するブラシサイズ。
 * @returns なし。
 */
function setBrush(size: number): void {
  toolMode.value = 'brush'
  brushSize.value = size
}

/**
 * 消しゴムモードへ切り替え、消しゴムサイズを設定する。
 * @param size 設定する消しゴムサイズ。
 * @returns なし。
 */
function setEraser(size: number): void {
  toolMode.value = 'eraser'
  eraserSize.value = size
}

/**
 * マスク描画色を変更する。
 * @param nextColor 設定する色。
 * @returns なし。
 */
function setMaskColor(nextColor: MaskColor): void {
  color.value = nextColor
}

/**
 * キャンバス上の描画内容を全てクリアする。
 * @returns なし。
 */
function clearCanvas(): void {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

/**
 * 画像サイズに合わせてキャンバスを初期化し、既存マスクがあれば再描画する。
 * @returns 初期化完了時に解決されるPromise。
 */
async function initializeCanvas(): Promise<void> {
  const imageElement = imageRef.value
  const canvas = canvasRef.value
  if (!imageElement || !canvas) {
    return
  }

  if (!imageElement.complete) {
    await new Promise<void>((resolve) => {
      imageElement.onload = () => resolve()
      imageElement.onerror = () => resolve()
    })
  }

  const width = imageElement.naturalWidth || imageElement.width
  const height = imageElement.naturalHeight || imageElement.height
  if (width <= 0 || height <= 0) {
    return
  }

  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, width, height)

  if (props.initialMaskDataUrl) {
    const maskImage = new Image()
    maskImage.src = props.initialMaskDataUrl
    await new Promise<void>((resolve) => {
      maskImage.onload = () => resolve()
      maskImage.onerror = () => resolve()
    })
    ctx.drawImage(maskImage, 0, 0, width, height)
  }
}

/**
 * 描画開始位置を記録し、単一点描画を行って描画状態を開始する。
 * @param event pointerdownイベント。
 * @returns なし。
 */
function startDrawing(event: PointerEvent): void {
  const point = getCanvasPoint(event)
  if (!point) return

  isDrawing.value = true
  previousX = point.x
  previousY = point.y
  drawLine(point.x, point.y, point.x, point.y)
}

/**
 * ポインタ移動に合わせて前回点から現在点まで線を描画する。
 * @param event pointermoveイベント。
 * @returns なし。
 */
function draw(event: PointerEvent): void {
  if (!isDrawing.value) return
  const point = getCanvasPoint(event)
  if (!point) return

  drawLine(previousX, previousY, point.x, point.y)
  previousX = point.x
  previousY = point.y
}

/**
 * 描画状態を終了する。
 * @returns なし。
 */
function stopDrawing(): void {
  isDrawing.value = false
}

/**
 * 現在ツール設定に応じて指定区間へ線を描画する。
 * @param fromX 開始X座標。
 * @param fromY 開始Y座標。
 * @param toX 終了X座標。
 * @param toY 終了Y座標。
 * @returns なし。
 */
function drawLine(fromX: number, fromY: number, toX: number, toY: number): void {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (toolMode.value === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.strokeStyle = 'rgba(0,0,0,1)'
    ctx.lineWidth = eraserSize.value
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = color.value
    ctx.lineWidth = brushSize.value
  }

  ctx.beginPath()
  ctx.moveTo(fromX, fromY)
  ctx.lineTo(toX, toY)
  ctx.stroke()
}

/**
 * pointerイベント座標をキャンバス内部座標へ変換する。
 * @param event pointerイベント。
 * @returns キャンバス座標。算出不能時はnull。
 */
function getCanvasPoint(event: PointerEvent): { x: number; y: number } | null {
  const canvas = canvasRef.value
  if (!canvas) return null

  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null

  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  }
}

/**
 * オーバーレイ画像と2値マスク画像を生成して保存イベントを発火する。
 * @returns 保存処理完了時に解決されるPromise。
 */
async function saveMask(): Promise<void> {
  const canvas = canvasRef.value
  if (!canvas) return

  const overlayDataUrl = canvas.toDataURL('image/png')
  const binaryBlob = await createBinaryMaskBlob(canvas)
  const maskFile = new File([binaryBlob], `mask-${Date.now()}.png`, { type: 'image/png' })

  emit('save', {
    maskFile,
    overlayDataUrl
  })
}

/**
 * 描画キャンバスをComfyUI向けの2値マスクPNG Blobへ変換する。
 * @param sourceCanvas 変換元キャンバス。
 * @returns 変換後のPNG Blobを返すPromise。
 */
function createBinaryMaskBlob(sourceCanvas: HTMLCanvasElement): Promise<Blob> {
  const binaryCanvas = document.createElement('canvas')
  binaryCanvas.width = sourceCanvas.width
  binaryCanvas.height = sourceCanvas.height

  const srcCtx = sourceCanvas.getContext('2d')
  const dstCtx = binaryCanvas.getContext('2d')
  if (!srcCtx || !dstCtx) {
    throw new Error('マスク画像の変換に失敗しました')
  }

  const src = srcCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)
  const out = dstCtx.createImageData(sourceCanvas.width, sourceCanvas.height)

  let hasAnyOpaquePixel = false
  for (let index = 0; index < src.data.length; index += 4) {
    if (src.data[index + 3] > 0) {
      hasAnyOpaquePixel = true
      break
    }
  }

  if (!hasAnyOpaquePixel) {
    for (let index = 0; index < out.data.length; index += 4) {
      out.data[index] = 255
      out.data[index + 1] = 255
      out.data[index + 2] = 255
      out.data[index + 3] = 255
    }

    dstCtx.putImageData(out, 0, 0)

    return new Promise<Blob>((resolve, reject) => {
      binaryCanvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('マスク画像の出力に失敗しました'))
          return
        }
        resolve(blob)
      }, 'image/png')
    })
  }

  for (let index = 0; index < src.data.length; index += 4) {
    const alpha = src.data[index + 3]
    const isOpaque = alpha > 0
    const alphaValue = isOpaque ? 0 : 255

    out.data[index] = 255
    out.data[index + 1] = 255
    out.data[index + 2] = 255
    out.data[index + 3] = alphaValue
  }

  dstCtx.putImageData(out, 0, 0)

  return new Promise<Blob>((resolve, reject) => {
    binaryCanvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('マスク画像の出力に失敗しました'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })
}
</script>

<template>
  <dialog ref="dialogRef" class="mask-editor" @cancel="onDialogCancel">
    <div style="display: flex; justify-content: space-between;">
        <div>Mask Editor</div>
        <button type="button" class="btn-close" @click="closeDialog">&times;</button>
    </div>

    <div class="controls">
      <div class="control-group">
        <span>Brush</span>
        <button
          v-for="size in brushSizes"
          :key="`brush-${size}`"
          type="button"
          :class="{ 'active-shadow': toolMode === 'brush' && brushSize === size }"
          class="btn btn-small border rounded-md"
          @click="setBrush(size)"
        >
          {{ size }}px
        </button>
      </div>

      <div class="control-group">
        <span>Eraser</span>
        <button
          v-for="size in brushSizes"
          :key="`eraser-${size}`"
          type="button"
          :class="{ 'active-shadow': toolMode === 'eraser' && eraserSize === size }"
          class="btn btn-small border rounded-md"
          @click="setEraser(size)"
        >
          {{ size }}px
        </button>
      </div>

      <div class="control-group">
        <span>Mask Color</span>
        <button type="button" :class="{ 'active-shadow': color === '#000000' }" class="btn btn-small border rounded-md color-btn color-btn_black" @click="setMaskColor('#000000')">黒</button>
        <button type="button" :class="{ 'active-shadow': color === '#ffffff' }" class="btn btn-small border rounded-md color-btn color-btn_white" @click="setMaskColor('#ffffff')">白</button>
        <button type="button" :class="{ 'active-shadow': color === '#ff0000' }" class="btn btn-small border rounded-md color-btn color-btn_red" @click="setMaskColor('#ff0000')">赤</button>
      </div>

      <div class="control-group actions">
        <button type="button" @click="clearCanvas" class="btn btn-small border rounded-md">Clear</button>
        <button type="button" @click="saveMask" class="btn btn-small bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400">Save</button>
      </div>
    </div>

    <div v-if="imageUrl" class="canvas-wrap">
      <img ref="imageRef" :src="imageUrl" alt="mask target" class="target-image" />
      <canvas
        ref="canvasRef"
        class="mask-canvas"
        :style="{ opacity: 0.5, cursor: toolMode === 'eraser' ? 'cell' : 'crosshair' }"
        @pointerdown="startDrawing"
        @pointermove="draw"
        @pointerup="stopDrawing"
        @pointerleave="stopDrawing"
      ></canvas>
    </div>
  </dialog>
</template>

<style scoped>
.mask-editor {
  width: min(100%, 1000px);
  max-height: 90vh;
  border: none;
  border-radius: 8px;
  padding: 1rem;
}

.mask-editor::backdrop {
  background: rgba(0, 0, 0, 0.4);
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0.5rem 0 1rem;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.control-group > span {
  font-size: 0.875rem;
  min-width: 70px;
}


.control-group.actions {
  margin-left: auto;
}

.canvas-wrap {
  position: relative;
  display: inline-block;
  max-width: 100%;
}

.target-image {
  display: block;
  max-width: 100%;
  height: auto;
}

.mask-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
}

.size-label {
  margin-top: 0.6rem;
  font-size: 0.85rem;
  color: #666;
}

.color-btn_black,
.color-btn_black.active{
    background-color: #777;
}
.color-btn_white,
.color-btn_white.active{
    background-color: #fff;
}
.color-btn_red,
.color-btn_red.active{
    background-color: #f5a7a7;
}

</style>
