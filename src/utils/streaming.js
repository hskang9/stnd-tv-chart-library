import { cache } from 'react'
import io from 'socket.io-client'

const streamingUrl = 'wss://story-odyssey-websocket2.standardweb3.com'

const createRoomString = (prefix) => ({
  1: `${prefix}Min`,
  2: `${prefix}Min`,
  5: `${prefix}Min`,
  15: `${prefix}Min`,
  30: `${prefix}Min`,
  60: `${prefix}Hour`,
  120: `${prefix}Hour`,
  240: `${prefix}Hour`,
  360: `${prefix}Hour`,
  720: `${prefix}Hour`,
  D: `${prefix}Day`,
  '1D': `${prefix}Day`,
  W: `${prefix}Week`,
  '1W': `${prefix}Week`,
  M: `${prefix}Month`,
  '1M': `${prefix}Month`,
})

export const pairRoomString = createRoomString('Pair')
export const tokenRoomString = createRoomString('Token')

export const getRelatedResolutions = (roomStringObj) => {
  const resolutionMap = new Map();
  for (const [key, value] of Object.entries(roomStringObj)) {
    if (!resolutionMap.has(value)) {
      resolutionMap.set(value, [])
    }
    resolutionMap.get(value).push(key)
  }
  return resolutionMap;
}

export const pairRelatedResolutions = getRelatedResolutions(pairRoomString)
export const tokenRelatedResolutions = getRelatedResolutions(tokenRoomString)

const interval = {
  1: 60,
  2: 120,
  5: 300,
  15: 900,
  30: 1800,
  60: 3600,
  120: 7200,
  240: 14400,
  360: 21600,
  720: 43200,
  D: 86400,
  '1D': 86400,
  W: 604800,
  '1W': 604800,
  M: 2592000,
  '1M': 2592000,
}

const socket = io(streamingUrl, {
  transports: ["websocket"],
});

// Assuming you're working in a browser environment that supports fetch and ReadableStream
const roomToSubscription = new Map()

socket.on('connect', () => {
  console.log('[socket] Connected')
})

socket.on('disconnect', (reason) => {
  console.log('[socket] Disconnected:', reason)
})

socket.on('error', (error) => {
  console.log('[socket] Error:', error)
})

socket.on('update', (data) => {
  console.log('[socket] update:', data)
  // get the room name
  const [id, room] = data.id.split('-')
  const isPair = id.includes('/')
  // get list of resolutions related to the room
  const relatedResolutions = isPair
    ? pairRelatedResolutions.get(room)
    : tokenRelatedResolutions.get(room)
  // handle bars each resolution connected to the room
  for (const resolution of relatedResolutions) {
    handleStreamingData(data, resolution)
  }
})

function handleStreamingData(data, resolution) {
  const { id, p, t, v } = data
  const roomString = id
  const cacheKey = `${id.split('-')[0]}-${resolution}`
  const tradePrice = p
  const tradeTime = t * 1000 // Multiplying by 1000 to get milliseconds
  const subscriptionItem = roomToSubscription.get(cacheKey)
  if (!subscriptionItem) {
    return
  }

  const lastBar = subscriptionItem.lastBar
  const intervalInSeconds = interval[resolution]
  const nextBarTime = getNextBarTime(lastBar.time, intervalInSeconds)

  let bar
  if (tradeTime >= nextBarTime) {
    bar = {
      time: nextBarTime * 1000,
      open: tradePrice,
      high: tradePrice,
      low: tradePrice,
      close: tradePrice,
      volume: (v ?? 0),
    }
    console.log('[stream] Generate new bar', bar)
  } else {
    bar = {
      ...lastBar,
      high: Math.max(lastBar.high, tradePrice),
      low: Math.min(lastBar.low, tradePrice),
      close: tradePrice,
      volume: lastBar.volume + (v ?? 0),
    }
    console.log(
      '[stream] Update the latest bar by price and volume',
      tradePrice,
      v
    )
  }

  subscriptionItem.lastBar = bar

  // Send data to every subscriber of that symbol
  for (const handler of subscriptionItem.handlers) {
    handler.callback(bar)
  }
  roomToSubscription.set(cacheKey, subscriptionItem)
}

function getNextBarTime(barTime, interval) {
  return barTime + interval * 1000
}

export function subscribeOnStream(
  symbolInfo,
  resolution,
  onRealtimeCallback,
  subscriberUID,
  onResetCacheNeededCallback,
  lastBar
) {
  const isPair = symbolInfo.ticker.includes('/')
  const roomString = `${symbolInfo.ticker}-${
    isPair ? pairRoomString[resolution] : tokenRoomString[resolution]
  }`
  const cacheKey = `${symbolInfo.ticker}-${resolution}`
  const handler = {
    id: subscriberUID,
    callback: onRealtimeCallback,
  }
  let subscriptionItem = roomToSubscription.get(roomString)
  subscriptionItem = {
    subscriberUID,
    resolution,
    lastBar,
    handlers: [handler],
  }
  // use socket.io to subscribe to the channel
  const subRequest = {
    action: 'SubAdd',
    subs: [roomString],
  }
  socket.emit('subscribe', subRequest)
  roomToSubscription.set(cacheKey, subscriptionItem)
  console.log('[subscribeBars]: Subscribe to streaming. Room:', roomString, roomToSubscription)
  
}

export function unsubscribeFromStream(subscriberUID) {
  // Find a subscription with id === subscriberUID
  for (const cacheKey of roomToSubscription.keys()) {
    const subscriptionItem = roomToSubscription.get(roomString)
    const handlerIndex = subscriptionItem.handlers.findIndex(
      (handler) => handler.id === subscriberUID
    )
    if (handlerIndex !== -1) {
      // Remove from handlers
      subscriptionItem.handlers.splice(handlerIndex, 1)
      if (subscriptionItem.handlers.length === 0) {
        // Unsubscribe from the room if it was the last handler
        console.log(
          '[unsubscribeBars]: Unsubscribe from streaming. CacheKey:',
          cacheKey
        )
        // get the room name on socket to unsubscribe
        const [id, resolution] = cacheKey.split('-')
        const isPair = id.includes('/')
        const roomId = isPair
          ? pairRoomString[resolution]
          : tokenRoomString[resolution]
        const roomString = `${id}-${roomId}`

        const subRequest = {
          action: 'SubRemove',
          subs: [roomString],
        }
        socket.emit('unsubscribe', subRequest)
        roomToSubscription.delete(cacheKey)
        break
      }
    }
  }
}
