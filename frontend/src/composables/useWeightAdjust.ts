import { nextTick, type Ref } from 'vue'

const WEIGHT_PATTERN = /^\((.+):([+-]?\d+(\.\d+)?)\)$/

function adjustWeightText(text: string, weightChange: number): string {
  const match = text.match(WEIGHT_PATTERN)

  if (match) {
    const originalText = match[1]
    const newWeight = parseFloat(match[2]) + weightChange
    return Math.abs(newWeight - 1.0) < 0.0001
      ? originalText
      : `(${originalText}:${newWeight.toFixed(1)})`
  }

  const newWeight = 1.0 + weightChange
  return Math.abs(newWeight - 1.0) < 0.0001 ? text : `(${text}:${newWeight.toFixed(1)})`
}

function splitTrimEdges(text: string): { leading: string; core: string; trailing: string } {
  const leadingMatch = text.match(/^\s*/)
  const trailingMatch = text.match(/\s*$/)
  const leading = leadingMatch?.[0] ?? ''
  const trailing = trailingMatch?.[0] ?? ''
  return {
    leading,
    core: text.slice(leading.length, text.length - trailing.length),
    trailing
  }
}

function updateSelectionWeight(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  weightChange: number
): { text: string; selectionStart: number; selectionEnd: number } {
  const selectedText = text.slice(selectionStart, selectionEnd)
  const { leading, core, trailing } = splitTrimEdges(selectedText)
  if (core === '') {
    return { text, selectionStart, selectionEnd }
  }

  const adjusted = adjustWeightText(core, weightChange)
  const replacedSelection = `${leading}${adjusted}${trailing}`
  const nextText =
    text.slice(0, selectionStart) +
    replacedSelection +
    text.slice(selectionEnd)

  return {
    text: nextText,
    selectionStart,
    selectionEnd: selectionStart + replacedSelection.length
  }
}

function findMatchingParen(text: string, openIndex: number): number {
  let depth = 0

  for (let index = openIndex; index < text.length; index += 1) {
    if (text[index] === '(') {
      depth += 1
    } else if (text[index] === ')') {
      depth -= 1
      if (depth === 0) {
        return index
      }
    }
  }

  return -1
}

function findEnclosingWeightedRange(
  text: string,
  cursorPos: number
): { start: number; end: number } | null {
  for (let start = cursorPos; start >= 0; start -= 1) {
    if (text[start] !== '(') {
      continue
    }

    const end = findMatchingParen(text, start)
    if (end === -1) {
      continue
    }

    if (cursorPos < start || cursorPos > end) {
      continue
    }

    const candidate = text.slice(start, end + 1)
    if (WEIGHT_PATTERN.test(candidate)) {
      return { start, end }
    }
  }

  return null
}

function updateEnclosingWeight(
  text: string,
  cursorPos: number,
  weightChange: number
): { text: string; lengthDiff: number; handled: boolean } {
  const range = findEnclosingWeightedRange(text, cursorPos)
  if (!range) {
    return { text, lengthDiff: 0, handled: false }
  }

  const original = text.slice(range.start, range.end + 1)
  const adjusted = adjustWeightText(original, weightChange)
  const nextText = text.slice(0, range.start) + adjusted + text.slice(range.end + 1)

  return {
    text: nextText,
    lengthDiff: adjusted.length - original.length,
    handled: true
  }
}

/**
 * カーソル位置の単語に重みを付与または更新する。
 * `(word:1.2)` 形式の既存重みがあれば再計算し、1.0 に戻る場合は装飾を解除する。
 */
function updateWordWeight(
  text: string,
  cursorPos: number,
  weightChange: number
): { text: string; lengthDiff: number } {
  const enclosingResult = updateEnclosingWeight(text, cursorPos, weightChange)
  if (enclosingResult.handled) {
    return { text: enclosingResult.text, lengthDiff: enclosingResult.lengthDiff }
  }

  const words = text.split(',')
  let currentPos = 0
  let lengthDiff = 0

  for (let i = 0; i < words.length; i++) {
    const wordLength = words[i].length
    const segmentLength = i < words.length - 1 ? wordLength + 1 : wordLength

    if (cursorPos >= currentPos && cursorPos <= currentPos + segmentLength) {
      const word = words[i].trim()
      const originalLength = words[i].length
      words[i] = adjustWeightText(word, weightChange)

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

    const selectionStart = targetElement.value.selectionStart
    const selectionEnd = targetElement.value.selectionEnd

    if (selectionStart !== selectionEnd) {
      const result = updateSelectionWeight(
        modelValue.value,
        selectionStart,
        selectionEnd,
        weightChange
      )
      modelValue.value = result.text

      await nextTick()
      targetElement.value.setSelectionRange(result.selectionStart, result.selectionEnd)
      targetElement.value.focus()
      return
    }

    const result = updateWordWeight(modelValue.value, selectionStart, weightChange)
    modelValue.value = result.text

    await nextTick()
    const newPos = selectionStart + result.lengthDiff
    targetElement.value.setSelectionRange(newPos, newPos)
    targetElement.value.focus()
  }

  return { setWeight }
}
