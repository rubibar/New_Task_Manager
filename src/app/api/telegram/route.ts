import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAnthropicClient } from "@/lib/ai/client";
import { sendMessage } from "@/lib/telegram";
import { recalculateAndPersistScores } from "@/lib/scoring";
import { Prisma } from "@prisma/client";
import type { Priority, TaskType } from "@prisma/client";

const BOT_USERNAME = "@ReplicaStudioBot";

const SYSTEM_PROMPT = `You are Replica Bot, the AI operations assistant for Replica Studio (a 3-person animation studio in Tel Aviv).
Team members: Rubi Barazani, Gilad Rozenkoff, Dana.

You receive Telegram messages from the team group chat.
Always respond in the same language they write in (Hebrew or English).
Be concise, warm, and direct — like a smart colleague, not a corporate bot.
Do not use excessive emojis. Max 2 per message.

Respond ONLY with valid JSON in this shape:
{
  "action": "add_task" | "update_task" | "delete_task" | "query" | "reply" | "ask_followup",
  "reply": "the message to send back to the group",
  "taskData": { ... }
}

taskData shape for add_task:
{
  "title": string,
  "projectName": string | null,
  "assignee": string | null,
  "dueDate": string | null,
  "priority": "urgent_important" | "important" | "urgent" | "low",
  "type": "client" | "rd" | "admin",
  "status": "todo"
}

taskData shape for update_task:
{
  "taskId": string,
  "updates": { "status"?: string, "priority"?: string, "assignee"?: string }
}

taskData shape for delete_task:
{
  "taskId": string
}

If critical info is missing (especially project), action = ask_followup.
Ask only ONE question at a time.`;

const PRIORITY_MAP: Record<string, Priority> = {
  urgent_important: "URGENT_IMPORTANT",
  important: "IMPORTANT_NOT_URGENT",
  urgent: "URGENT_NOT_IMPORTANT",
  low: "NEITHER",
};

const TYPE_MAP: Record<string, TaskType> = {
  client: "CLIENT",
  rd: "INTERNAL_RD",
  admin: "ADMIN",
};

const ASSIGNEE_MAP: Record<string, string> = {
  rubi: "rubi@replica.works",
  gilad: "gilad@replica.works",
  dana: "dana@replica.works",
};

interface TelegramUpdate {
  message?: {
    message_id: number;
    text?: string;
    from?: {
      first_name: string;
      is_bot: boolean;
    };
    chat: {
      id: number;
    };
  };
}

interface BotResponse {
  action: "add_task" | "update_task" | "delete_task" | "query" | "reply" | "ask_followup";
  reply: string;
  taskData?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json();
    const message = update.message;

    // No message or no text — ignore
    if (!message?.text) {
      return NextResponse.json({ ok: true });
    }

    // Ignore messages from bots
    if (message.from?.is_bot) {
      return NextResponse.json({ ok: true });
    }

    // Clean up expired conversations (fire-and-forget)
    const chatIdStr = String(message.chat.id);
    prisma.botConversation
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch(() => {});

    // Check for pending conversation
    const pendingConvo = await prisma.botConversation.findFirst({
      where: { chatId: chatIdStr, expiresAt: { gt: new Date() } },
    });

    // Only respond if the bot is mentioned OR there's a pending conversation
    if (!message.text.includes(BOT_USERNAME) && !pendingConvo) {
      return NextResponse.json({ ok: true });
    }

    const anthropic = getAnthropicClient();
    if (!anthropic) {
      await sendMessage(
        message.chat.id,
        "Bot is not configured (missing API key).",
        message.message_id
      );
      return NextResponse.json({ ok: true });
    }

    // Load context: recent tasks + projects + users
    const [tasks, projects, users] = await Promise.all([
      prisma.task.findMany({
        include: {
          owner: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: { displayScore: "desc" },
        take: 50,
      }),
      prisma.project.findMany({
        select: { id: true, name: true, clientName: true, status: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.user.findMany({
        select: { id: true, name: true, email: true },
      }),
    ]);

    const contextBlock = JSON.stringify({
      currentDate: new Date().toISOString().split("T")[0],
      sender: message.from?.first_name,
      teamMembers: users.map((u) => ({ id: u.id, name: u.name, email: u.email })),
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        client: p.clientName,
        status: p.status,
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        type: t.type,
        owner: t.owner?.name,
        project: t.project?.name,
        deadline: t.deadline?.toISOString().split("T")[0] ?? null,
      })),
    });

    const pendingContext = pendingConvo
      ? `\n\nPENDING CONVERSATION:\nAction: ${pendingConvo.pendingAction}\nPartial task data so far: ${JSON.stringify(pendingConvo.partialTask)}\nThe user is replying to your previous follow-up question. Use the partial data above and merge it with their new answer.`
      : "";

    const userMessage = `STUDIO STATE:\n${contextBlock}${pendingContext}\n\nTELEGRAM MESSAGE from ${message.from?.first_name}:\n${message.text}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      await sendMessage(message.chat.id, "Sorry, I couldn't process that.", message.message_id);
      return NextResponse.json({ ok: true });
    }

    // Parse JSON — strip markdown fences if present
    let raw = textBlock.text.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let botResponse: BotResponse;
    try {
      botResponse = JSON.parse(raw);
    } catch {
      await sendMessage(message.chat.id, raw, message.message_id);
      return NextResponse.json({ ok: true });
    }

    // Manage conversation state
    if (botResponse.action === "ask_followup") {
      // Upsert pending conversation with fresh 10-minute expiry
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      if (pendingConvo) {
        await prisma.botConversation.update({
          where: { id: pendingConvo.id },
          data: {
            partialTask: botResponse.taskData
              ? (botResponse.taskData as Prisma.InputJsonValue)
              : pendingConvo.partialTask as Prisma.InputJsonValue,
            pendingAction: botResponse.taskData
              ? String((botResponse.taskData as Record<string, unknown>).originalAction ?? pendingConvo.pendingAction)
              : pendingConvo.pendingAction,
            expiresAt,
          },
        });
      } else {
        await prisma.botConversation.create({
          data: {
            chatId: chatIdStr,
            pendingAction: "add_task",
            partialTask: botResponse.taskData
              ? (botResponse.taskData as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            expiresAt,
          },
        });
      }
    } else {
      // Action resolved — clean up any pending conversation for this chat
      if (pendingConvo) {
        await prisma.botConversation.delete({ where: { id: pendingConvo.id } });
      }
    }

    // Execute DB actions
    if (botResponse.action === "add_task" && botResponse.taskData) {
      await handleAddTask(botResponse.taskData, users);
    } else if (botResponse.action === "update_task" && botResponse.taskData) {
      await handleUpdateTask(botResponse.taskData);
    } else if (botResponse.action === "delete_task" && botResponse.taskData) {
      await handleDeleteTask(botResponse.taskData);
    }

    // Send reply
    if (botResponse.reply) {
      await sendMessage(message.chat.id, botResponse.reply, message.message_id);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    // Always return 200 to prevent Telegram retries
    return NextResponse.json({ ok: true });
  }
}

async function handleAddTask(
  taskData: Record<string, unknown>,
  users: { id: string; name: string; email: string }[]
) {
  // Resolve project by name (case-insensitive)
  let projectId: string | null = null;
  if (taskData.projectName) {
    const project = await prisma.project.findFirst({
      where: {
        name: { equals: taskData.projectName as string, mode: "insensitive" },
      },
      select: { id: true },
    });
    projectId = project?.id ?? null;
  }

  // Resolve assignee
  let ownerId: string | null = null;
  if (taskData.assignee) {
    const assigneeLower = (taskData.assignee as string).toLowerCase();
    const email = ASSIGNEE_MAP[assigneeLower];
    if (email) {
      const user = users.find((u) => u.email === email);
      ownerId = user?.id ?? null;
    } else {
      // Try matching by name
      const user = users.find(
        (u) => u.name?.toLowerCase().includes(assigneeLower)
      );
      ownerId = user?.id ?? null;
    }
  }

  // Fallback to first user if no assignee resolved
  if (!ownerId && users.length > 0) {
    ownerId = users[0].id;
  }

  const priorityKey = (taskData.priority as string) ?? "important";
  const typeKey = (taskData.type as string) ?? "client";

  await prisma.task.create({
    data: {
      title: taskData.title as string,
      projectId,
      ownerId: ownerId!,
      priority: PRIORITY_MAP[priorityKey] ?? "IMPORTANT_NOT_URGENT",
      type: TYPE_MAP[typeKey] ?? "CLIENT",
      status: "TODO",
      deadline: taskData.dueDate ? new Date(taskData.dueDate as string) : null,
      todoSince: new Date(),
    },
  });

  recalculateAndPersistScores();
}

async function handleUpdateTask(taskData: Record<string, unknown>) {
  const taskId = taskData.taskId as string;
  const updates = taskData.updates as Record<string, unknown> | undefined;
  if (!taskId || !updates) return;

  const data: Record<string, unknown> = {};
  if (updates.status) data.status = updates.status;
  if (updates.priority) {
    const key = (updates.priority as string).toLowerCase();
    data.priority = PRIORITY_MAP[key] ?? updates.priority;
  }

  await prisma.task.update({ where: { id: taskId }, data });
  recalculateAndPersistScores();
}

async function handleDeleteTask(taskData: Record<string, unknown>) {
  const taskId = taskData.taskId as string;
  if (!taskId) return;

  await prisma.task.delete({ where: { id: taskId } });
}
