import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSessionRequest } from '@/lib/security';
import { translateText } from '@/lib/translator';

export async function GET(req: NextRequest) {
  try {
    const auth = requireSessionRequest(req);
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');
    const paramVolunteerId = searchParams.get('volunteerId');

    let sessionUser: any = null;
    if ('session' in auth) {
      sessionUser = auth.session;
    } else if (paramVolunteerId) {
      const volUser = await db.getUser(paramVolunteerId);
      if (volUser && volUser.role === 'volunteer') {
        sessionUser = { userId: volUser.id, role: 'volunteer', fullName: volUser.full_name };
      }
    }

    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!chatId) {
      return NextResponse.json({ error: 'Chat ID is required' }, { status: 400 });
    }

    const messages = await db.getChatMessages(chatId);
    
    // Sort messages by creation time ascending
    messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const translateTo = searchParams.get('translateTo');
    
    if (translateTo) {
      const translatedMessages = await Promise.all(messages.map(async (msg) => {
        // Don't translate your own messages
        if (msg.sender_id === sessionUser.userId) {
          return msg;
        }
        
        try {
          const translated = await translateText(msg.text, translateTo);
          return { ...msg, translatedText: translated };
        } catch (err) {
          return msg;
        }
      }));
      return NextResponse.json(translatedMessages);
    }

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Failed to fetch chat messages:', error);
    return NextResponse.json({ error: 'Failed to fetch chat messages' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireSessionRequest(req);
    const body = await req.json();
    const { chatId, text, senderId } = body;

    let sessionUser: any = null;
    if ('session' in auth) {
      sessionUser = auth.session;
    } else if (senderId) {
      const volUser = await db.getUser(senderId);
      if (volUser && volUser.role === 'volunteer') {
        sessionUser = { userId: volUser.id, role: 'volunteer', fullName: volUser.full_name };
      }
    }

    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!chatId || !text) {
      return NextResponse.json({ error: 'Chat ID and text are required' }, { status: 400 });
    }

    const newMessage = await db.createChatMessage({
      chat_id: chatId,
      sender_id: sessionUser.userId,
      sender_name: sessionUser.fullName,
      sender_role: sessionUser.role,
      text: text.trim()
    });

    return NextResponse.json(newMessage, { status: 201 });
  } catch (error) {
    console.error('Failed to post message:', error);
    return NextResponse.json({ error: 'Failed to post message' }, { status: 500 });
  }
}
