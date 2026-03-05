import { nextTick, type Ref } from 'vue'

/**
 * カーソル位置の単語に重みを付与または更新する。
 * `(word:1.2)` 形式の既存重みがあれば再計算し、1.0 に戻る場合は装飾を解除する。
 */
function updateWordWeight(
  text: string,
  cursorPos: number,
  weightChange: number
): { text: string; lengthDiff: number } {
  const words = text.split(',')
  let currentPos = 0
  let lengthDiff = 0

  for (let i = 0; i < words.length; i++) {
    const wordLength = words[i].length
    const segmentLength = i < words.length - 1 ? wordLength + 1 : wordLength

    if (cursorPos >= currentPos && cursorPos <= currentPos + segmentLength) {
      const word = words[i].trim()
      const originalLength = words[i].length
      const weightPattern = /^\((.+):([+-]?\d+(\.\d+)?)\)$/
      const match = word.match(weightPattern)

      if (match) {
        const originalWord = match[1]
        const newWeight = parseFloat(match[2]) + weightChange
        words[i] =
          Math.abs(newWeight - 1.0) < 0.0001
            ? originalWord
            : `(${originalWord}:${newWeight.toFixed(1)})`
      } else {
        const newWeight = 1.0 + weightChange
        words[i] =
          Math.abs(newWeight - 1.0) < 0.0001 ? word : `(${word}:${newWeight.toFixed(1)})`
      }

      if (cursorPos > currentPos) {
        lengthDiff = words[i].length - originalLength
      }
      break
    }

    currentPos += segmentLength
  }

  return { text: words.join(','), lengthDiff }
}

export function useWeightAdjust(
  modelValue: Ref<string>,
  targetElement: Ref<HTMLTextAreaElement | null>
) {
  async function setWeight(weightChange: number): Promise<void> {
    if (!targetElement.value) return

    const originalPos = targetElement.value.selectionStart
    const result = updateWordWeight(modelValue.value, originalPos, weightChange)
    modelValue.value = result.text

    await nextTick()
    const newPos = originalPos + result.lengthDiff
    targetElement.value.setSelectionRange(newPos, newPos)
    targetElement.value.focus()
  }

  return { setWeight }
}
