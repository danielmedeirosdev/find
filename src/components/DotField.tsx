import { useEffect, useRef } from 'react'

interface Props {
  className?: string
  dotSize?: number
  gap?: number
  baseColor?: string
  activeColor?: string
  proximity?: number
}

interface Point {
  x: number
  y: number
}

// Visual concept adapted from React Bits' Dot Grid.
// https://reactbits.dev/backgrounds/dot-grid
export function DotField({
  className = '',
  dotSize = 1.35,
  gap = 27,
  baseColor = 'rgba(83, 70, 47, 0.18)',
  activeColor = 'rgba(201, 162, 39, 0.72)',
  proximity = 145,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const wrapper = wrapperRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!wrapper || !canvas || !context) return

    let points: Point[] = []
    let width = 0
    let height = 0
    let pointer: Point | null = null
    let frame = 0
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const draw = () => {
      frame = 0
      context.clearRect(0, 0, width, height)

      for (const point of points) {
        let radius = dotSize
        let color = baseColor
        if (pointer && !reduceMotion) {
          const distance = Math.hypot(point.x - pointer.x, point.y - pointer.y)
          if (distance < proximity) {
            const strength = 1 - distance / proximity
            radius += strength * 1.5
            color = activeColor
          }
        }

        context.beginPath()
        context.arc(point.x, point.y, radius, 0, Math.PI * 2)
        context.fillStyle = color
        context.fill()
      }
    }

    const requestDraw = () => {
      if (!frame) frame = window.requestAnimationFrame(draw)
    }

    const build = () => {
      const bounds = wrapper.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = Math.max(1, Math.round(bounds.width))
      height = Math.max(1, Math.round(bounds.height))
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)

      points = []
      for (let y = gap / 2; y < height; y += gap) {
        for (let x = gap / 2; x < width; x += gap) points.push({ x, y })
      }
      requestDraw()
    }

    const onPointerMove = (event: PointerEvent) => {
      const bounds = wrapper.getBoundingClientRect()
      const isInside =
        event.clientX >= bounds.left && event.clientX <= bounds.right &&
        event.clientY >= bounds.top && event.clientY <= bounds.bottom
      pointer = isInside ? { x: event.clientX - bounds.left, y: event.clientY - bounds.top } : null
      requestDraw()
    }

    const resizeObserver = new ResizeObserver(build)
    resizeObserver.observe(wrapper)
    if (!reduceMotion) {
      window.addEventListener('pointermove', onPointerMove, { passive: true })
    }
    build()

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [activeColor, baseColor, dotSize, gap, proximity])

  return (
    <div ref={wrapperRef} aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}
