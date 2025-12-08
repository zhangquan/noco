/**
 * Message Functions
 * 
 * Functions for displaying messages/notifications.
 */

import type { FlowContext, MessageNodeProps } from '../../types';
import { resolveValue } from '../expressExc';

/**
 * Message handler interface
 */
export interface MessageHandler {
  success: (content: string, duration?: number) => void;
  error: (content: string, duration?: number) => void;
  warning: (content: string, duration?: number) => void;
  info: (content: string, duration?: number) => void;
}

/**
 * Default message handler (console)
 */
const defaultMessageHandler: MessageHandler = {
  success: (content, duration) => console.log(`[SUCCESS] ${content}`),
  error: (content, duration) => console.error(`[ERROR] ${content}`),
  warning: (content, duration) => console.warn(`[WARNING] ${content}`),
  info: (content, duration) => console.info(`[INFO] ${content}`),
};

/**
 * Current message handler
 */
let messageHandler: MessageHandler = defaultMessageHandler;

/**
 * Set custom message handler (e.g., Ant Design message)
 */
export function setMessageHandler(handler: MessageHandler): void {
  messageHandler = handler;
}

/**
 * Reset to default message handler
 */
export function resetMessageHandler(): void {
  messageHandler = defaultMessageHandler;
}

/**
 * Execute a message node
 */
export function executeMessageNode(
  props: MessageNodeProps,
  context: FlowContext
): void {
  const content = resolveValue(props.content, context) as string;
  const duration = props.duration;
  const type = props.messageType || 'info';

  switch (type) {
    case 'success':
      messageHandler.success(content, duration);
      break;
    case 'error':
      messageHandler.error(content, duration);
      break;
    case 'warning':
      messageHandler.warning(content, duration);
      break;
    case 'info':
    default:
      messageHandler.info(content, duration);
      break;
  }
}

/**
 * Show success message
 */
export function showSuccess(content: string, duration?: number): void {
  messageHandler.success(content, duration);
}

/**
 * Show error message
 */
export function showError(content: string, duration?: number): void {
  messageHandler.error(content, duration);
}

/**
 * Show warning message
 */
export function showWarning(content: string, duration?: number): void {
  messageHandler.warning(content, duration);
}

/**
 * Show info message
 */
export function showInfo(content: string, duration?: number): void {
  messageHandler.info(content, duration);
}
