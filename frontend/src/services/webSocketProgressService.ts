import { env } from '../config/env';
import type { WebSocketProgressEvent } from '../types/replicate';

/**
 * WebSocket Progress Service
 * Handles real-time progress updates for AI generations
 */

type ProgressCallback = (event: WebSocketProgressEvent) => void;
type ConnectionCallback = (connected: boolean) => void;

export class WebSocketProgressService {
  private static instance: WebSocketProgressService;
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private maxReconnectDelay = 30000; // Max 30 seconds
  private isConnecting = false;
  private shouldReconnect = true;

  private progressCallbacks = new Map<string, Set<ProgressCallback>>();
  private connectionCallbacks = new Set<ConnectionCallback>();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): WebSocketProgressService {
    if (!WebSocketProgressService.instance) {
      WebSocketProgressService.instance = new WebSocketProgressService();
    }
    return WebSocketProgressService.instance;
  }

  /**
   * Connect to WebSocket
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    const wsUrl = this.getWebSocketUrl();

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.shouldReconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnecting = false;
    this.reconnectAttempts = 0;
  }

  /**
   * Subscribe to progress updates for a specific generation
   */
  subscribe(generationId: string, callback: ProgressCallback): () => void {
    if (!this.progressCallbacks.has(generationId)) {
      this.progressCallbacks.set(generationId, new Set());
    }

    this.progressCallbacks.get(generationId)!.add(callback);

    // Ensure we're connected
    this.connect();

    // Return unsubscribe function
    return () => {
      const callbacks = this.progressCallbacks.get(generationId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.progressCallbacks.delete(generationId);
        }
      }
    };
  }

  /**
   * Subscribe to connection status changes
   */
  onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.add(callback);

    // Immediately notify of current status
    callback(this.isConnected());

    // Return unsubscribe function
    return () => {
      this.connectionCallbacks.delete(callback);
    };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    if (env.enableDebug) {
      console.log('[WebSocket] Connected');
    }

    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;

    this.notifyConnectionChange(true);
  }

  /**
   * Handle WebSocket message
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data) as WebSocketProgressEvent;

      if (env.enableDebug) {
        console.log('[WebSocket] Progress update:', data);
      }

      // Notify subscribers for this generation
      const callbacks = this.progressCallbacks.get(data.generationId);
      if (callbacks) {
        callbacks.forEach((callback) => {
          try {
            callback(data);
          } catch (error) {
            console.error('[WebSocket] Callback error:', error);
          }
        });
      }
    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error);
    }
  }

  /**
   * Handle WebSocket error
   */
  private handleError(event: Event): void {
    console.error('[WebSocket] Error:', event);
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    if (env.enableDebug) {
      console.log('[WebSocket] Disconnected:', event.code, event.reason);
    }

    this.isConnecting = false;
    this.ws = null;

    this.notifyConnectionChange(false);

    if (this.shouldReconnect) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        '[WebSocket] Max reconnection attempts reached. Giving up.'
      );
      return;
    }

    this.reconnectAttempts++;

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    if (env.enableDebug) {
      console.log(
        `[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );
    }

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Notify connection change callbacks
   */
  private notifyConnectionChange(connected: boolean): void {
    this.connectionCallbacks.forEach((callback) => {
      try {
        callback(connected);
      } catch (error) {
        console.error('[WebSocket] Connection callback error:', error);
      }
    });
  }

  /**
   * Get WebSocket URL from environment
   */
  private getWebSocketUrl(): string {
    // Convert HTTP URL to WS URL
    const apiUrl = new URL(env.apiBaseUrl);
    const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${apiUrl.host}/api/v1/ws/generations`;
  }
}

// Export singleton instance
export const webSocketProgressService = WebSocketProgressService.getInstance();

export default webSocketProgressService;
