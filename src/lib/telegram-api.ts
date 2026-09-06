import { db } from './db';

export interface TelegramButton {
  text: string;
  callback_data?: string;
  request_contact?: boolean;
}

export interface TelegramAttachment {
  buffer: Buffer | ArrayBuffer;
  fileName: string;
  fileType: string;
  fileId?: string; // Cached Telegram file_id after initial upload to avoid re-uploading
}

/**
 * Sends a message to a Telegram user with optional file attachment.
 * Supports auto-fallback if caption exceeds Telegram 1024-character limit,
 * caches file_id across mass-broadcast recipients, and retries on Markdown entity errors.
 */
export async function sendTelegramMessage(
  telegramId: number,
  text: string,
  keyboard?: TelegramButton[][],
  parseMode: 'Markdown' | 'HTML' = 'Markdown',
  attachment?: TelegramAttachment
): Promise<boolean> {
  const config = await db.getBotConfig();
  const token = config.bot_token || process.env.TELEGRAM_BOT_TOKEN;

  // Format reply markup for Telegram
  let replyMarkup: any = undefined;
  if (keyboard) {
    const hasContactRequest = keyboard.some(row => row.some(btn => btn.request_contact));
    
    if (hasContactRequest) {
      replyMarkup = {
        keyboard: keyboard.map(row => 
          row.map(btn => ({
            text: btn.text,
            request_contact: btn.request_contact
          }))
        ),
        one_time_keyboard: true,
        resize_keyboard: true
      };
    } else {
      replyMarkup = {
        inline_keyboard: keyboard.map(row => 
          row.map(btn => ({
            text: btn.text,
            callback_data: btn.callback_data
          }))
        )
      };
    }
  }

  // 1. Format message text for logging & simulator
  const logText = attachment
    ? `📎 [Файл: ${attachment.fileName}]\n\n${text}`
    : text;

  try {
    await db.createMockMessage(telegramId, 'bot', logText, keyboard);
  } catch (e) {
    console.error('Failed to log mock message:', e);
  }

  // 2. Send real Telegram message if token exists
  if (token && token !== 'MOCK_BOT_TOKEN' && token !== '') {
    try {
      if (attachment) {
        // TELEGRAM LIMIT: Caption cannot exceed 1024 characters!
        // If text is longer than 1024 characters, send file first, then full text message with buttons
        const isCaptionTooLong = text.length > 1024;
        const captionToSend = isCaptionTooLong
          ? (attachment.fileName ? `📎 ${attachment.fileName}` : '')
          : text;

        const success = await sendTelegramAttachmentFile(
          token,
          telegramId,
          attachment,
          captionToSend,
          isCaptionTooLong ? undefined : replyMarkup,
          parseMode
        );

        if (!success) {
          return false;
        }

        // If caption was too long, send the full text message separately with buttons
        if (isCaptionTooLong && text.trim().length > 0) {
          return await sendTelegramTextMessage(token, telegramId, text, replyMarkup, parseMode);
        }

        return true;
      } else {
        // Simple text message
        return await sendTelegramTextMessage(token, telegramId, text, replyMarkup, parseMode);
      }
    } catch (error) {
      console.error('Network error sending to Telegram:', error);
      return false;
    }
  }

  console.log(`[Mock Bot Notification] Sent to TG ID ${telegramId}: "${logText}"`);
  return true;
}

/**
 * Helper to send attachment file, utilizing cached fileId when available
 */
async function sendTelegramAttachmentFile(
  token: string,
  telegramId: number,
  attachment: TelegramAttachment,
  caption: string,
  replyMarkup?: any,
  parseMode: 'Markdown' | 'HTML' = 'Markdown'
): Promise<boolean> {
  let method = 'sendDocument';
  let fieldName = 'document';

  if (attachment.fileType.startsWith('image/')) {
    method = 'sendPhoto';
    fieldName = 'photo';
  } else if (attachment.fileType.startsWith('video/')) {
    method = 'sendVideo';
    fieldName = 'video';
  }

  async function postFile(useParseMode: boolean, forceDocumentMethod = false): Promise<{ ok: boolean; result?: any; status: number; text: string }> {
    const currentMethod = forceDocumentMethod ? 'sendDocument' : method;
    const currentField = forceDocumentMethod ? 'document' : fieldName;

    const formData = new FormData();
    formData.append('chat_id', telegramId.toString());
    if (caption) {
      formData.append('caption', caption);
    }
    if (useParseMode && parseMode) {
      formData.append('parse_mode', parseMode);
    }
    if (replyMarkup) {
      formData.append('reply_markup', JSON.stringify(replyMarkup));
    }

    if (attachment.fileId) {
      // Re-use already uploaded Telegram file_id (instantaneous, 0 bandwidth)
      formData.append(currentField, attachment.fileId);
    } else {
      // First upload: send binary Blob
      const fileBlob = new Blob([new Uint8Array(attachment.buffer)], {
        type: attachment.fileType || 'application/octet-stream'
      });
      formData.append(currentField, fileBlob, attachment.fileName);
    }

    const url = `https://api.telegram.org/bot${token}/${currentMethod}`;
    const res = await fetch(url, { method: 'POST', body: formData });
    const responseText = await res.text();
    let resJson: any = null;
    try {
      resJson = JSON.parse(responseText);
    } catch {}

    return {
      ok: res.ok && resJson?.ok === true,
      result: resJson?.result,
      status: res.status,
      text: responseText
    };
  }

  // Attempt 1: Standard send with parseMode
  let attempt = await postFile(true);

  // Attempt 2: If entity parsing error in Markdown, retry without parse_mode
  if (!attempt.ok && (attempt.text.includes("can't parse entities") || attempt.text.includes('entity'))) {
    console.warn(`[Telegram API] Retrying attachment send without parse_mode for TG ID ${telegramId}`);
    attempt = await postFile(false);
  }

  // Attempt 3: If photo/video failed (e.g. unsupported image format or dimension), fallback to sendDocument
  if (!attempt.ok && method !== 'sendDocument') {
    console.warn(`[Telegram API] Retrying attachment send via sendDocument for TG ID ${telegramId}`);
    attempt = await postFile(false, true);
  }

  if (attempt.ok && attempt.result) {
    // Cache the file_id returned by Telegram for all subsequent recipients in mass broadcast
    if (!attachment.fileId) {
      const uploadedFileId =
        attempt.result.document?.file_id ||
        (Array.isArray(attempt.result.photo) ? attempt.result.photo[attempt.result.photo.length - 1]?.file_id : undefined) ||
        attempt.result.video?.file_id;
      if (uploadedFileId) {
        attachment.fileId = uploadedFileId;
      }
    }
    return true;
  }

  console.error(`[Telegram API File Error] ${attempt.status}: ${attempt.text}`);
  return false;
}

/**
 * Helper to send pure text message with Markdown-to-plaintext auto-retry
 */
async function sendTelegramTextMessage(
  token: string,
  telegramId: number,
  text: string,
  replyMarkup?: any,
  parseMode: 'Markdown' | 'HTML' = 'Markdown'
): Promise<boolean> {
  async function postText(useParseMode: boolean): Promise<boolean> {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const body: any = {
      chat_id: telegramId,
      text
    };
    if (useParseMode && parseMode) {
      body.parse_mode = parseMode;
    }
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      if (useParseMode && (errText.includes("can't parse entities") || errText.includes('entity'))) {
        // Retry without parse_mode
        return await postText(false);
      }
      console.error(`[Telegram API Text Error] ${res.status}: ${errText}`);
      return false;
    }
    return true;
  }

  return await postText(true);
}
