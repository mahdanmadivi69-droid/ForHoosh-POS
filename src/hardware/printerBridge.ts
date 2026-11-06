/**
 * CAFE OS ?" Raw TCP / ESC-POS Local Hardware Gateway & Print Spooler Bridge
 * Path: src/hardware/printerBridge.ts
 * Re-exports core hardware spooler with Persian Font B ESC/POS integration.
 */

export * from '../services/printerBridge';
export { PersianEscPosRenderer, FONT_B_COLUMNS, ESC_POS_OPCODES } from './persianEscPos';
