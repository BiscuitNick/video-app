import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { WebSocketMessage } from '@/types';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface WebSocketState {
  // Connection state
  connectionState: ConnectionState;
  error: string | null;
  reconnectAttempts: number;

  // WebSocket instance
  ws: WebSocket | null;

  // Messages
  messages: WebSocketMessage[];
  maxMessages: number;

  // Connection methods
  connect: (url: string) => void;
  disconnect: () => void;
  reconnect: () => void;

  // Message methods
  sendMessage: (type: string, payload: unknown) => void;
  addMessage: (message: WebSocketMessage) => void;
  clearMessages: () => void;

  // Internal setters
  setConnectionState: (state: ConnectionState) => void;
  setError: (error: string | null) => void;
  setWebSocket: (ws: WebSocket | null) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

export const useWebSocketStore = create<WebSocketState>()(
  devtools(
    (set, get) => ({
      // State
      connectionState: 'disconnected',
      error: null,
      reconnectAttempts: 0,
      ws: null,
      messages: [],
      maxMessages: 100,

      // Connection methods
      connect: (url: string) => {
        const state = get();

        // Don't connect if already connected or connecting
        if (
          state.connectionState === 'connected' ||
          state.connectionState === 'connecting'
        ) {
          return;
        }

        set({ connectionState: 'connecting', error: null });

        try {
          const ws = new WebSocket(url);

          ws.onopen = () => {
            set({
              connectionState: 'connected',
              ws,
              reconnectAttempts: 0,
              error: null,
            });
          };

          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              const message: WebSocketMessage = {
                id: crypto.randomUUID(),
                type: data.type || 'unknown',
                payload: data.payload || data,
                timestamp: new Date(),
              };
              get().addMessage(message);
            } catch (error) {
              console.error('Failed to parse WebSocket message:', error);
            }
          };

          ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            set({
              connectionState: 'error',
              error: 'WebSocket connection error',
            });
          };

          ws.onclose = () => {
            set({ connectionState: 'disconnected', ws: null });

            // Auto-reconnect logic
            const currentAttempts = get().reconnectAttempts;
            if (currentAttempts < MAX_RECONNECT_ATTEMPTS) {
              get().incrementReconnectAttempts();
              setTimeout(() => {
                get().reconnect();
              }, RECONNECT_DELAY);
            } else {
              set({
                error: `Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts`,
              });
            }
          };

          set({ ws });
        } catch (error) {
          set({
            connectionState: 'error',
            error:
              error instanceof Error ? error.message : 'Failed to connect',
          });
        }
      },

      disconnect: () => {
        const { ws } = get();
        if (ws) {
          ws.close();
        }
        set({
          ws: null,
          connectionState: 'disconnected',
          reconnectAttempts: 0,
        });
      },

      reconnect: () => {
        const { ws } = get();
        if (ws && ws.url) {
          get().connect(ws.url);
        }
      },

      // Message methods
      sendMessage: (type, payload) => {
        const { ws, connectionState } = get();

        if (connectionState !== 'connected' || !ws) {
          console.error('Cannot send message: WebSocket not connected');
          return;
        }

        try {
          const message = {
            type,
            payload,
            timestamp: new Date().toISOString(),
          };
          ws.send(JSON.stringify(message));
        } catch (error) {
          console.error('Failed to send WebSocket message:', error);
          set({
            error:
              error instanceof Error
                ? error.message
                : 'Failed to send message',
          });
        }
      },

      addMessage: (message) =>
        set((state) => {
          const messages = [...state.messages, message];
          // Keep only the last maxMessages
          if (messages.length > state.maxMessages) {
            messages.shift();
          }
          return { messages };
        }),

      clearMessages: () => set({ messages: [] }),

      // Internal setters
      setConnectionState: (connectionState) => set({ connectionState }),
      setError: (error) => set({ error }),
      setWebSocket: (ws) => set({ ws }),
      incrementReconnectAttempts: () =>
        set((state) => ({
          reconnectAttempts: state.reconnectAttempts + 1,
        })),
      resetReconnectAttempts: () => set({ reconnectAttempts: 0 }),
    }),
    { name: 'WebSocketStore' }
  )
);
