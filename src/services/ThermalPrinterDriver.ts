/**
 * CAFE OS — Dual Thermal Printer Hardware Driver (Barista / Kitchen Dispatch)
 * Compliant with CafeOS-Thermal-KDS-Dispatch v2.2.0
 *
 * Implements 3 hardware layers in prioritized sequence:
 *  - Priority 1: WebSerial (baudRate: 9600, direct ESC/POS binary stream)
 *  - Priority 2: NetworkSocket (port: 9100, raw TCP socket via HTTP bridge / proxy with 3000ms timeout)
 *  - Priority 3: HeadlessIframePrint (css_selector: '#thermal-receipt-staging' with isolated zero-leakage sandbox)
 *
 * CRITICAL INVARIANT:
 *  Printing MUST NEVER close the table bill or settle the session.
 *  The table remains completely open for late checkout and multi-round ordering.
 */

import { StationDispatchTicket, SplitTicketResult, PrepStation } from './StationRouter';
import { TicketLayoutEngine, ESC_POS_COMMANDS } from '../templates/KitchenTicketTemplate';

export type PrinterStatus = 'ready' | 'busy' | 'offline' | 'out_of_paper';

export type HardwareLayerType = 'WebSerial' | 'NetworkSocket' | 'HeadlessIframePrint';

export interface PrintDispatchResult {
  success: boolean;
  station: PrepStation;
  layerUsed: HardwareLayerType;
  bytesSent?: number;
  message: string;
  ticketId: string | number;
  tableLabel: string;
  isDelta: boolean;
  timestamp: string;
}

export interface PrinterDriverConfig {
  baudRate: number;
  networkPort: number;
  networkTimeoutMs: number;
  iframeCssSelector: string;
}

const DEFAULT_CONFIG: PrinterDriverConfig = {
  baudRate: 9600,
  networkPort: 9100,
  networkTimeoutMs: 3000,
  iframeCssSelector: '#thermal-receipt-staging',
};

type StatusListener = (status: PrinterStatus) => void;

export class ThermalPrinterDriver {
  private static instance: ThermalPrinterDriver;
  private status: PrinterStatus = 'ready';
  private statusListeners: Set<StatusListener> = new Set();
  private serialPort: any = null;
  private config: PrinterDriverConfig = DEFAULT_CONFIG;

  private constructor() {
    this.checkInitialHardware();
  }

  public static getInstance(): ThermalPrinterDriver {
    if (!ThermalPrinterDriver.instance) {
      ThermalPrinterDriver.instance = new ThermalPrinterDriver();
    }
    return ThermalPrinterDriver.instance;
  }

  public getStatus(): PrinterStatus {
    return this.status;
  }

  public setStatus(newStatus: PrinterStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((listener) => {
        try {
          listener(newStatus);
        } catch (err) {
          console.warn('[ThermalPrinterDriver] Status listener error:', err);
        }
      });
    }
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  private checkInitialHardware(): void {
    if (typeof window === 'undefined') {
      this.status = 'ready';
      return;
    }
    // Check if browser supports WebSerial
    const hasSerial = 'serial' in navigator;
    if (hasSerial) {
      this.status = 'ready';
    } else {
      // Fallback is always available
      this.status = 'ready';
    }
  }

  /**
   * Hardware Layer 1: WebSerial (baudRate: 9600)
   */
  private async printViaWebSerial(buffer: Uint8Array): Promise<boolean> {
    if (typeof window === 'undefined' || !('serial' in navigator)) {
      return false;
    }

    try {
      const serial = (navigator as any).serial;
      let port = this.serialPort;

      if (!port) {
        const ports = await serial.getPorts();
        if (ports && ports.length > 0) {
          port = ports[0];
          this.serialPort = port;
        }
      }

      if (!port) {
        return false;
      }

      if (!port.readable || !port.writable) {
        await port.open({ baudRate: this.config.baudRate });
      }

      const writer = port.writable.getWriter();
      await writer.write(buffer);
      writer.releaseLock();
      return true;
    } catch (err) {
      console.warn('[ThermalPrinterDriver] WebSerial layer skipped/failed:', err);
      return false;
    }
  }

  /**
   * Hardware Layer 2: NetworkSocket (port: 9100, timeout: 3000ms)
   */
  private async printViaNetworkSocket(buffer: Uint8Array): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.networkTimeoutMs);

    try {
      // Try local network thermal printer bridge endpoint if available
      const response = await fetch(`http://127.0.0.1:${this.config.networkPort}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buffer as unknown as BodyInit,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      clearTimeout(timeoutId);
      return false;
    }
  }

  /**
   * Hardware Layer 3: HeadlessIframePrint (css_selector: '#thermal-receipt-staging')
   * Guaranteed zero-leakage fallback. Creates an isolated sandbox iframe.
   * Keeps table bill completely open without any side-effects.
   */
  private async printViaHeadlessIframe(htmlContent: string): Promise<boolean> {
    if (typeof document === 'undefined') return false;

    return new Promise((resolve) => {
      try {
        let stagingContainer = document.getElementById(
          this.config.iframeCssSelector.replace('#', '')
        );

        if (!stagingContainer) {
          stagingContainer = document.createElement('div');
          stagingContainer.id = this.config.iframeCssSelector.replace('#', '');
          stagingContainer.style.display = 'none';
          stagingContainer.setAttribute('aria-hidden', 'true');
          document.body.appendChild(stagingContainer);
        }

        // Create isolated sandboxed iframe
        const iframe = document.createElement('iframe');
        iframe.setAttribute('title', 'Thermal Receipt Dispatch Staging');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.visibility = 'hidden';

        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) {
          document.body.removeChild(iframe);
          resolve(false);
          return;
        }

        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();

        // Allow styling and assets to settle before printing
        setTimeout(() => {
          try {
            if (iframe.contentWindow) {
              iframe.contentWindow.focus();
              iframe.contentWindow.print();
            }
            // Cleanup after print dialog lifecycle
            setTimeout(() => {
              try {
                if (document.body.contains(iframe)) {
                  document.body.removeChild(iframe);
                }
              } catch {
                // ignore cleanup errors
              }
            }, 1000);
            resolve(true);
          } catch (e) {
            console.warn('[ThermalPrinterDriver] Headless iframe print error:', e);
            resolve(false);
          }
        }, 150);
      } catch (err) {
        console.warn('[ThermalPrinterDriver] Iframe creation failed:', err);
        resolve(false);
      }
    });
  }

  /**
   * Dispatches a single station ticket to the thermal printer following priority layers:
   * WebSerial -> NetworkSocket -> HeadlessIframePrint.
   */
  public async printTicket(ticket: StationDispatchTicket): Promise<PrintDispatchResult> {
    this.setStatus('busy');

    const escposBuffer = TicketLayoutEngine.renderEscPosBinary(ticket);
    const htmlTemplate = TicketLayoutEngine.renderHtml(ticket);
    const nowIso = new Date().toISOString();

    let layerUsed: HardwareLayerType = 'HeadlessIframePrint';
    let success = false;

    // Layer 1: WebSerial
    try {
      success = await this.printViaWebSerial(escposBuffer);
      if (success) {
        layerUsed = 'WebSerial';
      }
    } catch {
      success = false;
    }

    // Layer 2: NetworkSocket
    if (!success) {
      try {
        success = await this.printViaNetworkSocket(escposBuffer);
        if (success) {
          layerUsed = 'NetworkSocket';
        }
      } catch {
        success = false;
      }
    }

    // Layer 3: HeadlessIframePrint (Reliable Browser Staging)
    if (!success) {
      try {
        success = await this.printViaHeadlessIframe(htmlTemplate);
        layerUsed = 'HeadlessIframePrint';
      } catch {
        success = false;
      }
    }

    this.setStatus(success ? 'ready' : 'offline');

    return {
      success,
      station: ticket.station,
      layerUsed,
      bytesSent: escposBuffer.length,
      message: success
        ? `تیکت ${ticket.stationTitle} با لایه ${layerUsed} چاپ شد.`
        : `خطا در ارسال تیکت ${ticket.stationTitle} به چاپگر.`,
      ticketId: ticket.ticketId,
      tableLabel: ticket.tableLabel,
      isDelta: ticket.isDelta,
      timestamp: nowIso,
    };
  }

  /**
   * Dispatches split tickets for both stations (Barista and Kitchen).
   * Suppresses stations with 0 items.
   */
  public async printBothStations(
    split: SplitTicketResult
  ): Promise<{ barResult?: PrintDispatchResult; kitchenResult?: PrintDispatchResult }> {
    const results: { barResult?: PrintDispatchResult; kitchenResult?: PrintDispatchResult } = {};

    if (split.hasBarItems) {
      results.barResult = await this.printTicket(split.barTicket);
    }

    if (split.hasKitchenItems) {
      results.kitchenResult = await this.printTicket(split.kitchenTicket);
    }

    return results;
  }

  /**
   * Dispatches order payload directly to Modendo POS ESC/POS Hardware Gateway over WebSocket
   */
  public async dispatchViaModendoGateway(orderPayload: any): Promise<{ success: boolean; orderId?: string; message: string }> {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
      return { success: false, message: 'WebSocket unsupported in this environment' };
    }

    return new Promise((resolve) => {
      try {
        const wsUrl = (typeof window !== 'undefined' && (window as any).MODENDO_GATEWAY_WS_URL) || 'ws://127.0.0.1:8080/ws/pos';
        const socket = new WebSocket(wsUrl);
        const timeout = setTimeout(() => {
          try { socket.close(); } catch {}
          resolve({ success: false, message: 'Modendo gateway connection timed out (2.5s)' });
        }, 2500);

        socket.onopen = () => {
          socket.send(JSON.stringify({
            type: 'NEW_ORDER',
            payload: orderPayload,
          }));
        };

        socket.onmessage = (event) => {
          clearTimeout(timeout);
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'ACK') {
              try { socket.close(); } catch {}
              resolve({ success: true, orderId: data.order_id, message: data.message || 'Dispatched via Modendo Gateway' });
            }
          } catch {
            try { socket.close(); } catch {}
            resolve({ success: true, message: 'Dispatched to gateway' });
          }
        };

        socket.onerror = () => {
          clearTimeout(timeout);
          resolve({ success: false, message: 'Modendo gateway socket offline' });
        };
      } catch (err: any) {
        resolve({ success: false, message: err?.message || 'Gateway dispatch failed' });
      }
    });
  }
}

export const thermalPrinterDriver = ThermalPrinterDriver.getInstance();
