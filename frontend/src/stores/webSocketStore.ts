import { createStore } from 'zustand/vanilla'
import { immer } from 'zustand/middleware/immer'
import { devtools } from 'zustand/middleware'
import type { WebSocketStore, JobState } from '../types/stores'
import type { ConnectionStatus, ConnectionMetrics, JobUpdateMessage } from '../types/websocket'
import { getWebSocketService } from '../services/WebSocketService'

// Initial connection metrics
const initialMetrics: ConnectionMetrics = {
  status: 'disconnected',
  reconnectAttempts: 0,
  messagesReceived: 0,
  messagesSent: 0,
}

// Initial state
const initialState = {
  connectionStatus: 'disconnected' as ConnectionStatus,
  connectionMetrics: { ...initialMetrics },
  jobs: new Map<string, JobState>(),
  activeJobIds: [],
  isConnected: false,
}

// Create the vanilla store with devtools and immer middleware
export const createWebSocketStore = () => {
  return createStore<WebSocketStore>()(
    devtools(
      immer((set, get) => ({
        ...initialState,

        // Connection management
        connect: () => {
          try {
            const wsService = getWebSocketService()
            wsService.connect()
          } catch (error) {
            console.error('Failed to connect WebSocket:', error)
          }
        },

        disconnect: () => {
          try {
            const wsService = getWebSocketService()
            wsService.disconnect()
            set((state) => {
              state.connectionStatus = 'disconnected'
              state.isConnected = false
            })
          } catch (error) {
            console.error('Failed to disconnect WebSocket:', error)
          }
        },

        updateConnectionStatus: (status) =>
          set((state) => {
            state.connectionStatus = status
            state.isConnected = status === 'connected'
            state.connectionMetrics.status = status
          }),

        updateConnectionMetrics: (metrics) =>
          set((state) => {
            state.connectionMetrics = { ...metrics }
            state.connectionStatus = metrics.status
            state.isConnected = metrics.status === 'connected'
          }),

        // Job management
        addJob: (job) =>
          set((state) => {
            state.jobs.set(job.id, job)
            if (job.status === 'running' || job.status === 'queued') {
              if (!state.activeJobIds.includes(job.id)) {
                state.activeJobIds.push(job.id)
              }
            }
          }),

        updateJob: (jobId, updates) =>
          set((state) => {
            const job = state.jobs.get(jobId)
            if (job) {
              const updatedJob = { ...job, ...updates, updatedAt: new Date() }
              state.jobs.set(jobId, updatedJob)

              // Update active jobs list
              const isActive = updatedJob.status === 'running' || updatedJob.status === 'queued'
              const isInActiveList = state.activeJobIds.includes(jobId)

              if (isActive && !isInActiveList) {
                state.activeJobIds.push(jobId)
              } else if (!isActive && isInActiveList) {
                state.activeJobIds = state.activeJobIds.filter((id) => id !== jobId)
              }
            }
          }),

        removeJob: (jobId) =>
          set((state) => {
            state.jobs.delete(jobId)
            state.activeJobIds = state.activeJobIds.filter((id) => id !== jobId)
          }),

        handleJobUpdate: (message) => {
          const { jobId, jobType, status, progress, message: msg, error, result } = message

          set((state) => {
            const existingJob = state.jobs.get(jobId)

            if (existingJob) {
              // Update existing job
              const updatedJob: JobState = {
                ...existingJob,
                status,
                progress,
                message: msg,
                error,
                result,
                updatedAt: new Date(),
              }
              state.jobs.set(jobId, updatedJob)
            } else {
              // Create new job entry
              const newJob: JobState = {
                id: jobId,
                type: jobType,
                status,
                progress,
                message: msg,
                error,
                result,
                createdAt: new Date(),
                updatedAt: new Date(),
              }
              state.jobs.set(jobId, newJob)
            }

            // Update active jobs list
            const job = state.jobs.get(jobId)
            if (job) {
              const isActive = job.status === 'running' || job.status === 'queued'
              const isInActiveList = state.activeJobIds.includes(jobId)

              if (isActive && !isInActiveList) {
                state.activeJobIds.push(jobId)
              } else if (!isActive && isInActiveList) {
                state.activeJobIds = state.activeJobIds.filter((id) => id !== jobId)
              }
            }
          })

          // Log job updates for debugging
          console.log(`[WebSocket] Job update: ${jobId} - ${status}`, {
            progress,
            message: msg,
            error,
          })
        },

        // Utility
        reset: () =>
          set((state) => {
            state.connectionStatus = 'disconnected'
            state.connectionMetrics = { ...initialMetrics }
            state.jobs.clear()
            state.activeJobIds = []
            state.isConnected = false
          }),
      })),
      { name: 'WebSocketStore' }
    )
  )
}
