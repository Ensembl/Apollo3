import { Region } from '@jbrowse/core/util'
import { AnnotationFeatureI } from 'apollo-shared'
import { observer } from 'mobx-react'
import React, { useEffect, useRef } from 'react'

import { LinearApolloDisplay } from '../../LinearApolloDisplay/stateModel'

interface ApolloRenderingProps {
  features: Map<string, Map<string, Map<string, AnnotationFeatureI>>>
  assemblyName: string
  regions: Region[]
  bpPerPx: number
  displayModel: LinearApolloDisplay
  blockKey: string
}

function ApolloRendering(props: ApolloRenderingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { regions, bpPerPx, displayModel, blockKey } = props
  const [region] = regions
  const totalWidth = (region.end - region.start) / bpPerPx
  const { featureLayout, featuresForBlock } = displayModel
  const features = featuresForBlock[blockKey]
  const height = 20
  const padding = 4
  const highestRow = Math.max(...Array.from(Object.values(featureLayout)))
  const totalHeight = highestRow * (height + padding)
  useEffect(() => {
    if (!features) {
      return
    }
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    ctx.clearRect(0, 0, totalWidth, totalHeight)
    features.forEach((feature) => {
      const row = featureLayout[feature.id]
      if (row === undefined) {
        throw new Error('no layout')
      }
      const start = feature.location.start - region.start - 1
      const width = feature.location.length
      const startPx = start / bpPerPx
      const widthPx = width / bpPerPx
      ctx.fillStyle = 'black'
      ctx.fillRect(startPx, row * (height + 4), widthPx, height)
      ctx.fillStyle = '#F5CBA7'
      ctx.fillRect(
        startPx + 1,
        row * (height + padding) + 1,
        widthPx - 2,
        height - 2,
      )
    })
  }, [
    bpPerPx,
    features,
    region.start,
    totalWidth,
    featureLayout,
    highestRow,
    totalHeight,
  ])
  return <canvas ref={canvasRef} width={totalWidth} height={totalHeight} />
}

export default observer(ApolloRendering)