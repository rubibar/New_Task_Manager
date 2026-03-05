import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAnthropicClient } from "@/lib/ai/client";
import { sendMessage } from "@/lib/telegram";
import { recalculateAndPersistScores } from "@/lib/scoring";
import { SYSTEM_PROMPT } from "@/lib/bot-brain";
import { Prisma } from "@prisma/client";
import type { Priority, TaskType } from "@prisma/client";
import { endOfWeek } from "date-fns";

const BOT_USERNAME = "@ReplicaStudioBot";

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
  action: "add_task" | "update_task" | "delete_task" | "consolidate_tasks" | "query" | "reply" | "ask_followup" | "proactive_nudge";
  reply: string;
  taskData?: Record<string, unknown>;
  proactiveFollowUp?: string;
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
      console.log("[Telegram Bot] Claude returned non-JSON:", raw.slice(0, 500));
      await sendMessage(message.chat.id, raw, message.message_id);
      return NextResponse.json({ ok: true });
    }

    console.log("[Telegram Bot] Action:", botResponse.action, "TaskData:", JSON.stringify(botResponse.taskData ?? null));

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
    let addedTaskOwnerId: string | null = null;
    if (botResponse.action === "add_task" && botResponse.taskData) {
      addedTaskOwnerId = await handleAddTask(botResponse.taskData, users);
    } else if (botResponse.action === "update_task" && botResponse.taskData) {
      await handleUpdateTask(botResponse.taskData, users);
    } else if (botResponse.action === "delete_task" && botResponse.taskData) {
      await handleDeleteTask(botResponse.taskData);
    } else if (botResponse.action === "consolidate_tasks" && botResponse.taskData) {
      await handleConsolidateTasks(botResponse.taskData, users);
    }

    // Send reply
    if (botResponse.reply) {
      await sendMessage(message.chat.id, botResponse.reply, message.message_id);
    }

    // Send proactive follow-up if Claude included one
    if (botResponse.proactiveFollowUp) {
      await sendMessage(message.chat.id, botResponse.proactiveFollowUp);
    }

    // Conflict detection: after adding a task, check assignee overload
    if (addedTaskOwnerId) {
      await checkAssigneeConflicts(message.chat.id, addedTaskOwnerId);
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
): Promise<string | null> {
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
  return ownerId;
}

async function findTaskByIdOrTitle(taskData: Record<string, unknown>) {
  // Try by ID first
  if (taskData.taskId) {
    const task = await prisma.task.findUnique({
      where: { id: taskData.taskId as string },
    });
    if (task) return task;
  }
  // Fallback to title search
  const title = (taskData.title as string) ?? (taskData.taskId as string);
  if (!title) return null;
  return prisma.task.findFirst({
    where: { title: { equals: title, mode: "insensitive" } },
  });
}

async function handleUpdateTask(
  taskData: Record<string, unknown>,
  users: { id: string; name: string; email: string }[]
) {
  const task = await findTaskByIdOrTitle(taskData);
  if (!task) {
    console.log("[Telegram Bot] update_task: task not found", taskData.taskId, taskData.title);
    return;
  }

  const updates = taskData.updates as Record<string, unknown> | undefined;
  if (!updates) {
    console.log("[Telegram Bot] update_task: no updates provided");
    return;
  }

  const data: Record<string, unknown> = {};
  if (updates.status) data.status = updates.status;
  if (updates.priority) {
    const key = (updates.priority as string).toLowerCase();
    data.priority = PRIORITY_MAP[key] ?? updates.priority;
  }
  if (updates.title) data.title = updates.title;
  if (updates.dueDate) data.deadline = new Date(updates.dueDate as string);
  if (updates.assignee) {
    const assigneeLower = (updates.assignee as string).toLowerCase();
    const email = ASSIGNEE_MAP[assigneeLower];
    const user = email
      ? users.find((u) => u.email === email)
      : users.find((u) => u.name?.toLowerCase().includes(assigneeLower));
    if (user) data.ownerId = user.id;
  }

  if (Object.keys(data).length === 0) {
    console.log("[Telegram Bot] update_task: no valid fields to update");
    return;
  }

  console.log("[Telegram Bot] Updating task", task.id, "with", JSON.stringify(data));
  await prisma.task.update({ where: { id: task.id }, data });
  recalculateAndPersistScores();
}

async function handleDeleteTask(taskData: Record<string, unknown>) {
  const task = await findTaskByIdOrTitle(taskData);
  if (!task) {
    console.log("[Telegram Bot] delete_task: task not found", taskData.taskId, taskData.title);
    return;
  }

  console.log("[Telegram Bot] Deleting task", task.id, task.title);
  await prisma.task.delete({ where: { id: task.id } });
  recalculateAndPersistScores();
}

async function handleConsolidateTasks(
  taskData: Record<string, unknown>,
  users: { id: string; name: string; email: string }[]
) {
  const titlesToDelete = taskData.tasksToDelete as string[] | undefined;
  const newTaskData = taskData.newTask as Record<string, unknown> | undefined;

  if (!titlesToDelete?.length) {
    console.log("[Telegram Bot] consolidate_tasks: no tasksToDelete provided");
    return;
  }

  // Delete tasks by title
  let deletedCount = 0;
  for (const title of titlesToDelete) {
    const task = await prisma.task.findFirst({
      where: { title: { equals: title, mode: "insensitive" } },
    });
    if (task) {
      await prisma.task.delete({ where: { id: task.id } });
      deletedCount++;
      console.log("[Telegram Bot] Consolidated: deleted", task.id, task.title);
    } else {
      console.log("[Telegram Bot] Consolidated: task not found for title:", title);
    }
  }

  // Create the new consolidated task if provided
  if (newTaskData) {
    await handleAddTask(newTaskData, users);
    console.log("[Telegram Bot] Consolidated: created new task", newTaskData.title);
  }

  console.log("[Telegram Bot] Consolidation done: deleted", deletedCount, "of", titlesToDelete.length);
  recalculateAndPersistScores();
}

async function checkAssigneeConflicts(chatId: number, ownerId: string) {
  try {
    const now = new Date();
    const weekEnd = endOfWeek(now, { weekStartsOn: 0 });

    const urgentThisWeek = await prisma.task.findMany({
      where: {
        ownerId,
        status: { in: ["TODO", "IN_PROGRESS"] },
        priority: { in: ["URGENT_IMPORTANT", "URGENT_NOT_IMPORTANT"] },
        deadline: { lte: weekEnd },
      },
      include: { owner: { select: { name: true } } },
    });

    if (urgentThisWeek.length >= 2) {
      const ownerName = urgentThisWeek[0].owner?.name ?? "This person";
      await sendMessage(
        chatId,
        `*${ownerName}* now has ${urgentThisWeek.length} urgent tasks due this week. Want me to suggest a priority order?`
      );
    }
  } catch {
    // Non-critical — don't block the main flow
  }
}
