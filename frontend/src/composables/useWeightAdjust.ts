import { nextTick, type Ref } from 'vue'

const WEIGHT_PATTERN = /^\((.+):([+-]?\d+(\.\d+)?)\)$/

/**
 * テキストの重み指定を増減して返す。
 * 既に `(text:1.2)` 形式なら値を再計算し、1.0相当なら装飾を外す。
 * @param text 変換対象テキスト。
 * @param weightChange 加算する重み変化量。
 * @returns 重み調整後のテキスト。
 */
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

/**
 * 文字列の前後空白を保持したまま、中央の本体部分を分離する。
 * @param text 分割対象文字列。
 * @returns 前方空白・本体・後方空白の3要素。
 */
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

/**
 * 選択範囲テキストの重みを調整し、更新後テキストと選択範囲を返す。
 * @param text 全体テキスト。
 * @param selectionStart 選択開始位置。
 * @param selectionEnd 選択終了位置。
 * @param weightChange 加算する重み変化量。
 * @returns 更新後テキストと次の選択範囲。
 */
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

/**
 * 指定開き括弧に対応する閉じ括弧の位置を検索する。
 * @param text 探索対象テキスト。
 * @param openIndex 開き括弧のインデックス。
 * @returns 閉じ括弧のインデックス。見つからない場合は-1。
 */
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

/**
 * カーソル位置を内包する重み付き表現 `(text:1.2)` の範囲を探す。
 * @param text 探索対象テキスト。
 * @param cursorPos カーソル位置。
 * @returns 見つかった範囲。見つからない場合はnull。
 */
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

/**
 * カーソルが含まれる既存重み付き表現の重みを更新する。
 * @param text 更新対象テキスト。
 * @param cursorPos カーソル位置。
 * @param weightChange 加算する重み変化量。
 * @returns 更新後テキスト、文字数差分、処理可否。
 */
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
 * @param text 更新対象テキスト。
 * @param cursorPos カーソル位置。
 * @param weightChange 加算する重み変化量。
 * @returns 更新後テキストとカーソル位置調整用の長さ差分。
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

  // カーソルのある行の範囲を特定し、その行内だけで処理する
  const lineStart = text.lastIndexOf('\n', cursorPos - 1) + 1
  const lineEndIdx = text.indexOf('\n', cursorPos)
  const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx

  const line = text.slice(lineStart, lineEnd)
  const cursorInLine = cursorPos - lineStart

  const words = line.split(',')
  let currentPos = 0
  let lengthDiff = 0

  for (let i = 0; i < words.length; i++) {
    const wordLength = words[i].length
    const segmentLength = i < words.length - 1 ? wordLength + 1 : wordLength

    if (cursorInLine >= currentPos && cursorInLine <= currentPos + segmentLength) {
      const { leading, core, trailing } = splitTrimEdges(words[i])
      const originalLength = words[i].length
      words[i] = `${leading}${adjustWeightText(core, weightChange)}${trailing}`

      if (cursorInLine > currentPos) {
        lengthDiff = words[i].length - originalLength
      }
      break
    }

    currentPos += segmentLength
  }

  const newLine = words.join(',')
  return {
    text: text.slice(0, lineStart) + newLine + text.slice(lineEnd),
    lengthDiff
  }
}

/**
 * テキストエリア上の選択範囲またはカーソル位置単語に対して重み調整操作を提供する。
 * @param modelValue テキストモデル。
 * @param targetElement 操作対象のテキストエリア要素。
 * @returns 重み操作関数。
 */
export function useWeightAdjust(
  modelValue: Ref<string>,
  targetElement: Ref<HTMLTextAreaElement | null>
) {
  /**
   * 現在選択範囲またはカーソル位置に対して重みを増減し、選択状態を維持する。
   * @param weightChange 加算する重み変化量。
   * @returns 調整完了時に解決されるPromise。
   */
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
