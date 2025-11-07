const CACHE_NAME = 'nelson-gpt-v1'
const STATIC_CACHE = 'nelson-gpt-static-v1'
const DYNAMIC_CACHE = 'nelson-gpt-dynamic-v1'

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...')
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => {
        console.log('Service Worker: Static assets cached')
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error('Service Worker: Error caching static assets:', error)
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...')
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Service Worker: Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        console.log('Service Worker: Activated')
        return self.clients.claim()
      })
  )
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }
  
  // Handle API requests (network first)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses
          if (response.ok) {
            const responseClone = response.clone()
            caches.open(DYNAMIC_CACHE)
              .then((cache) => {
                cache.put(request, responseClone)
              })
          }
          return response
        })
        .catch(() => {
          // Fallback to cache for API requests
          return caches.match(request)
        })
    )
    return
  }
  
  // Handle static assets (cache first)
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse
        }
        
        // Not in cache, fetch from network
        return fetch(request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response.ok) {
              return response
            }
            
            // Clone the response
            const responseClone = response.clone()
            
            // Determine which cache to use
            const cacheToUse = STATIC_ASSETS.includes(url.pathname) ? STATIC_CACHE : DYNAMIC_CACHE
            
            // Add to cache
            caches.open(cacheToUse)
              .then((cache) => {
                cache.put(request, responseClone)
              })
            
            return response
          })
          .catch(() => {
            // Network failed, try to serve index.html for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('/index.html')
            }
            
            // For other requests, return a basic offline response
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain',
              }),
            })
          })
      })
  )
})

// Background sync for offline messages
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered:', event.tag)
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncOfflineMessages())
  }
})

// Push notification handler
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received')
  
  const options = {
    body: event.data ? event.data.text() : 'New message from Nelson-GPT',
    icon: '/favicon.svg',
    badge: '/icons/badge.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open Nelson-GPT',
        icon: '/icons/action-open.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/action-close.png'
      }
    ]
  }
  
  event.waitUntil(
    self.registration.showNotification('Nelson-GPT', options)
  )
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked:', event.action)
  
  event.notification.close()
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    )
  }
})

// Helper function to sync offline messages
async function syncOfflineMessages() {
  try {
    console.log('Service Worker: Syncing offline messages...')
    
    // Get offline messages from IndexedDB
    const offlineMessages = await getOfflineMessages()
    
    if (offlineMessages.length === 0) {
      console.log('Service Worker: No offline messages to sync')
      return
    }
    
    // Send each message to the server
    for (const message of offlineMessages) {
      try {
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        })
        
        if (response.ok) {
          // Remove from offline storage
          await removeOfflineMessage(message.id)
          console.log('Service Worker: Synced message:', message.id)
        }
      } catch (error) {
        console.error('Service Worker: Failed to sync message:', message.id, error)
      }
    }
    
    console.log('Service Worker: Offline message sync completed')
  } catch (error) {
    console.error('Service Worker: Error syncing offline messages:', error)
  }
}

// IndexedDB helpers (placeholder implementations)
async function getOfflineMessages() {
  // In a real implementation, this would query IndexedDB
  return []
}

async function removeOfflineMessage(messageId) {
  // In a real implementation, this would remove from IndexedDB
  console.log('Service Worker: Would remove offline message:', messageId)
}

