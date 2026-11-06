/**
 * CAFE OS — Raw TCP / ESC-POS Local Hardware Gateway & Print Spooler Bridge
 * Path: src/hardware/printerBridge.ts
 * Re-exports core hardware spooler with Persian Font B ESC/POS and Raster Logo integration.
 */

export * from '../services/printerBridge';
export {
  PersianEscPosRenderer,
  FONT_B_COLUMNS,
  FONT_A_COLUMNS,
  ESC_POS_OPCODES,
} from './persianEscPos';
export type {
  PersianReceiptLine,
  ThermalTicketOptions,
} from './persianEscPos';
export { RasterLogoRenderer } from './rasterLogoRenderer';
export type {
  PixelBuffer,
  RasterOptions,
} from './rasterLogoRenderer';
export { ImageLoader } from './imageLoader';
