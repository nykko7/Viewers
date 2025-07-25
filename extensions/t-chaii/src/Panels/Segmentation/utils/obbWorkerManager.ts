// OBB Worker Manager
// Manages communication with the OBB calculation Web Worker

class OBBWorkerManager {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
  private requestIdCounter = 0;

  constructor() {
    this.initializeWorker();
  }

  private initializeWorker() {
    try {
      // Create worker from the worker file
      const workerPath = new URL('../workers/obbWorker.js', import.meta.url);
      this.worker = new Worker(workerPath);
      
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);
      
      console.log('[OBB Worker Manager] Worker initialized');
    } catch (error) {
      console.error('[OBB Worker Manager] Failed to initialize worker:', error);
    }
  }

  private handleWorkerMessage(e: MessageEvent) {
    const { type, id, result, error } = e.data;
    
    const request = this.pendingRequests.get(id);
    if (!request) {
      console.warn('[OBB Worker Manager] Received response for unknown request:', id);
      return;
    }

    // Clear timeout
    clearTimeout(request.timeout);
    this.pendingRequests.delete(id);

    switch (type) {
      case 'OBB_RESULT':
        console.log('[OBB Worker Manager] Received OBB result:', result);
        request.resolve(result);
        break;
        
      case 'OBB_ERROR':
        console.error('[OBB Worker Manager] Received OBB error:', error);
        request.reject(new Error(error));
        break;
        
      default:
        console.warn('[OBB Worker Manager] Unknown response type:', type);
        request.reject(new Error(`Unknown response type: ${type}`));
    }
  }

  private handleWorkerError(error: ErrorEvent) {
    console.error('[OBB Worker Manager] Worker error:', error);
    
    // Reject all pending requests
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Worker error'));
    });
    this.pendingRequests.clear();
  }

  public async calculateOBB(
    segmentVoxelData: Uint8Array,
    segmentIndex: number,
    dimensions: number[],
    spacing: number[],
    timeoutMs: number = 30000
  ): Promise<{ majorAxisMm: number; minorAxisMm: number; majorAxisSlice: number }> {
    
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    const requestId = `obb_${++this.requestIdCounter}`;
    
    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('OBB calculation timeout'));
      }, timeoutMs);

      // Store request
      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // Send message to worker
      this.worker!.postMessage({
        type: 'CALCULATE_OBB',
        id: requestId,
        data: {
          segmentVoxelData: Array.from(segmentVoxelData), // Convert to array for transfer
          segmentIndex,
          dimensions,
          spacing
        }
      });

      console.log(`[OBB Worker Manager] Sent OBB calculation request for segment ${segmentIndex}`);
    });
  }

  public terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    // Clear all pending requests
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Worker terminated'));
    });
    this.pendingRequests.clear();

    console.log('[OBB Worker Manager] Worker terminated');
  }
}

// Singleton instance
let obbWorkerManager: OBBWorkerManager | null = null;

export const getOBBWorkerManager = (): OBBWorkerManager => {
  if (!obbWorkerManager) {
    obbWorkerManager = new OBBWorkerManager();
  }
  return obbWorkerManager;
};

export const terminateOBBWorker = () => {
  if (obbWorkerManager) {
    obbWorkerManager.terminate();
    obbWorkerManager = null;
  }
};
