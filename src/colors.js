/**
 * 픽커마다 색을 준다.
 *
 * 색을 여섯 개만 적어 두고 돌려 쓰면 일곱째 픽커가 첫째와 같은 색이 된다.
 * 그래서 픽커 수에 맞춰 그때 만든다. 픽커가 늘어도 색이 겹치지 않는다.
 *
 * 색상환(OKLCH 의 색 각도)을 픽커 수만큼 고르게 나눈다. 사람 눈에 고르게 벌어진다.
 * 색만 벌리면 이웃한 둘이 여전히 붙어 보여서 밝기도 번갈아 준다.
 * 짝수면 둘, 홀수면 셋을 돌려야 첫 색과 끝 색이 같은 밝기로 만나지 않는다.
 *
 * 여덟 픽커에서 가장 가까운 두 색의 차이가 ΔE 16.3 이다(15 가 눈으로 가리는 한계).
 * 아홉을 넘으면 그 아래로 떨어진다. 색만으로는 아홉을 가릴 수 없어서,
 * 어느 픽커인지는 범례에서 켜고 꺼 보거나 핀을 눌러 확인한다.
 */
const CHROMA = 0.15 // 더 올리면 색역 밖으로 나가 노랑 쪽만 탁해진다
const START = 15 // 첫 색이 빨강에 너무 붙지 않게 조금 돌려 둔다

const sRGB = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
const hex = (value) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0')

/** OKLCH 한 점을 화면 색으로 옮긴다. 색역 밖이면 낼 수 있을 때까지 채도를 낮춘다. */
function toHex(lightness, chroma, degree) {
  const angle = (degree * Math.PI) / 180

  for (let c = chroma; c > 0; c -= 0.002) {
    const a = c * Math.cos(angle)
    const b = c * Math.sin(angle)
    const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
    const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
    const s = (lightness - 0.0894841775 * a - 1.2914855480 * b) ** 3

    const rgb = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ]

    if (rgb.every((value) => value >= -0.001 && value <= 1.001)) {
      return `#${rgb.map((value) => hex(sRGB(value))).join('')}`
    }
  }

  return '#000000'
}

export function pickerColors(count) {
  const lights = count % 2 ? [0.55, 0.68, 0.78] : [0.6, 0.75]

  return Array.from({ length: count }, (_, index) =>
    toHex(lights[index % lights.length], CHROMA, START + (360 / count) * index))
}
