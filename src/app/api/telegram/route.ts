import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAnthropicClient } from "@/lib/ai/client";
import { sendMessage } from "@/lib/telegram";
import { recalculateAndPersistScores } from "@/lib/scoring";
import { SYSTEM_PROMPT } from "@/lib/bot-brain";
import { Prisma } from "@prisma/client";
import type { Priority, TaskType, ProjectStatus } from "@prisma/client";
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

const STATUS_MAP: Record<string, string> = {
  todo: "TODO",
  in_progress: "IN_PROGRESS",
  in_review: "IN_REVIEW",
  done: "DONE",
};

const PROJECT_STATUS_MAP: Record<string, ProjectStatus> = {
  not_started: "NOT_STARTED",
  active: "ACTIVE",
  in_progress: "IN_PROGRESS",
  on_hold: "ON_HOLD",
  completed: "COMPLETED",
  archived: "ARCHIVED",
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
  action: string;
  reply: string;
  taskData?: Record<string, unknown>;
  proactiveFollowUp?: string;
  mood?: "normal" | "stressed" | "urgent" | "positive";
}

// --- Helpers ---

function resolveUserId(
  name: string,
  users: { id: string; name: string; email: string }[]
): string | null {
  const lower = name.toLowerCase();
  const email = ASSIGNEE_MAP[lower];
  if (email) {
    const user = users.find((u) => u.email === email);
    if (user) return user.id;
  }
  const user = users.find((u) => u.name?.toLowerCase().includes(lower));
  return user?.id ?? null;
}

async function findTaskByIdOrTitle(taskData: Record<string, unknown>) {
  if (taskData.taskId) {
    const task = await prisma.task.findUnique({
      where: { id: taskData.taskId as string },
    });
    if (task) return task;
  }
  const title = (taskData.title as string) ?? (taskData.taskId as string);
  if (!title) return null;
  return prisma.task.findFirst({
    where: { title: { equals: title, mode: "insensitive" } },
  });
}

async function findProjectByIdOrName(
  projectId: string | null | undefined,
  projectName: string | null | undefined
) {
  if (projectId) {
    const p = await prisma.project.findUnique({ where: { id: projectId } });
    if (p) return p;
  }
  if (projectName) {
    return prisma.project.findFirst({
      where: { name: { equals: projectName, mode: "insensitive" } },
    });
  }
  return null;
}

// --- Velocity Logging ---

async function logVelocity(task: { id: string; title: string; createdAt: Date; ownerId: string; estimatedHours: number | null }) {
  const now = new Date();
  const actualDays = Math.max(1, Math.round((now.getTime() - task.createdAt.getTime()) / (1000 * 60 * 60 * 24)));
  const estimatedDays = task.estimatedHours ? Math.max(1, Math.round(task.estimatedHours / 8)) : null;

  const owner = await prisma.user.findUnique({
    where: { id: task.ownerId },
    select: { name: true },
  });

  await prisma.velocityLog.create({
    data: {
      taskId: task.id,
      taskTitle: task.title,
      estimatedDays,
      actualDays,
      assignee: owner?.name ?? "Unknown",
    },
  });
  console.log("[Telegram Bot] Velocity logged:", task.title, `actual=${actualDays}d`, estimatedDays ? `est=${estimatedDays}d` : "no estimate");
}

// --- Main webhook ---

export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json();
    const message = update.message;

    if (!message?.text) return NextResponse.json({ ok: true });
    if (message.from?.is_bot) return NextResponse.json({ ok: true });

    const chatIdStr = String(message.chat.id);

    // Clean up expired bot conversations (fire-and-forget)
    prisma.botConversation
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch(() => {});

    // Save incoming message to conversation history
    prisma.conversationHistory.create({
      data: {
        chatId: chatIdStr,
        role: "user",
        message: message.text,
        fromName: message.from?.first_name ?? null,
      },
    }).catch(() => {});

    const pendingConvo = await prisma.botConversation.findFirst({
      where: { chatId: chatIdStr, expiresAt: { gt: new Date() } },
    });

    if (!message.text.includes(BOT_USERNAME) && !pendingConvo) {
      return NextResponse.json({ ok: true });
    }

    const anthropic = getAnthropicClient();
    if (!anthropic) {
      await sendMessage(message.chat.id, "Bot is not configured (missing API key).", message.message_id);
      return NextResponse.json({ ok: true });
    }

    // Load full context in parallel
    const [tasks, projects, users, clients, deliverables, milestones, conversationHistory, recentDecisions] = await Promise.all([
      prisma.task.findMany({
        include: {
          owner: { select: { id: true, name: true, email: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: { displayScore: "desc" },
        take: 80,
      }),
      prisma.project.findMany({
        include: { _count: { select: { tasks: true, deliverables: true } } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.user.findMany({ select: { id: true, name: true, email: true } }),
      prisma.client.findMany({
        select: { id: true, name: true, status: true, _count: { select: { projects: true } } },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      prisma.deliverable.findMany({
        select: { id: true, name: true, status: true, dueDate: true, projectId: true },
        orderBy: { dueDate: "asc" },
        take: 20,
      }),
      prisma.milestone.findMany({
        select: { id: true, name: true, dueDate: true, completed: true, projectId: true },
        orderBy: { dueDate: "asc" },
        take: 20,
      }),
      prisma.conversationHistory.findMany({
        where: { chatId: chatIdStr },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { role: true, message: true, fromName: true, createdAt: true },
      }),
      prisma.decision.findMany({
        where: { chatId: chatIdStr },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { summary: true, madeBy: true, createdAt: true },
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
        color: p.color,
        startDate: p.startDate?.toISOString().split("T")[0] ?? null,
        targetFinishDate: p.targetFinishDate?.toISOString().split("T")[0] ?? null,
        budget: p.budget,
        taskCount: p._count.tasks,
        deliverableCount: p._count.deliverables,
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        type: t.type,
        owner: t.owner?.name,
        ownerId: t.owner?.id,
        project: t.project?.name,
        projectId: t.project?.id,
        deadline: t.deadline?.toISOString().split("T")[0] ?? null,
        emergency: t.emergency,
        score: t.displayScore,
      })),
      clients: clients.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        projectCount: c._count.projects,
      })),
      deliverables: deliverables.map((d) => ({
        id: d.id,
        name: d.name,
        status: d.status,
        dueDate: d.dueDate.toISOString().split("T")[0],
        projectId: d.projectId,
      })),
      milestones: milestones.map((m) => ({
        id: m.id,
        name: m.name,
        dueDate: m.dueDate.toISOString().split("T")[0],
        completed: m.completed,
        projectId: m.projectId,
      })),
      recentDecisions: recentDecisions.map((d) => ({
        summary: d.summary,
        madeBy: d.madeBy,
        date: d.createdAt.toISOString().split("T")[0],
      })),
    });

    // Build conversation history for Claude (chronological order)
    const chatHistory = conversationHistory
      .reverse()
      .map((m) => {
        const name = m.fromName ?? (m.role === "bot" ? "Replica" : "User");
        return `[${m.role}] ${name}: ${m.message}`;
      })
      .join("\n");

    const pendingContext = pendingConvo
      ? `\n\nPENDING CONVERSATION:\nAction: ${pendingConvo.pendingAction}\nPartial data so far: ${JSON.stringify(pendingConvo.partialTask)}\nThe user is replying to your previous follow-up question. Use the partial data above and merge it with their new answer.`
      : "";

    const userMessage = `STUDIO STATE:\n${contextBlock}\n\nRECENT CHAT HISTORY (last 50 messages):\n${chatHistory}${pendingContext}\n\nNEW MESSAGE from ${message.from?.first_name}:\n${message.text}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      await sendMessage(message.chat.id, "Sorry, I couldn't process that.", message.message_id);
      return NextResponse.json({ ok: true });
    }

    let raw = textBlock.text.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let botResponse: BotResponse;
    try {
      botResponse = JSON.parse(raw);
    } catch {
      console.log("[Telegram Bot] Non-JSON response:", raw.slice(0, 500));
      await sendMessage(message.chat.id, raw, message.message_id);
      return NextResponse.json({ ok: true });
    }

    console.log("[Telegram Bot] Action:", botResponse.action, "Mood:", botResponse.mood ?? "normal", "TaskData:", JSON.stringify(botResponse.taskData ?? null));

    // Manage conversation state
    if (botResponse.action === "ask_followup") {
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      if (pendingConvo) {
        await prisma.botConversation.update({
          where: { id: pendingConvo.id },
          data: {
            partialTask: botResponse.taskData
              ? (botResponse.taskData as Prisma.InputJsonValue)
              : (pendingConvo.partialTask as Prisma.InputJsonValue),
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
            pendingAction: botResponse.action,
            partialTask: botResponse.taskData
              ? (botResponse.taskData as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            expiresAt,
          },
        });
      }
    } else {
      if (pendingConvo) {
        await prisma.botConversation.delete({ where: { id: pendingConvo.id } });
      }
    }

    // Execute DB actions
    let addedTaskOwnerId: string | null = null;
    const td = botResponse.taskData;
    switch (botResponse.action) {
      case "add_task":
        if (td) addedTaskOwnerId = await handleAddTask(td, users);
        break;
      case "update_task":
        if (td) await handleUpdateTask(td, users);
        break;
      case "delete_task":
        if (td) await handleDeleteTask(td);
        break;
      case "consolidate_tasks":
        if (td) await handleConsolidateTasks(td, users);
        break;
      case "bulk_update_tasks":
        if (td) await handleBulkUpdateTasks(td, users);
        break;
      case "reassign_tasks":
        if (td) await handleReassignTasks(td, users);
        break;
      case "move_tasks_to_project":
        if (td) await handleMoveTasksToProject(td);
        break;
      case "create_project":
        if (td) await handleCreateProject(td);
        break;
      case "update_project":
        if (td) await handleUpdateProject(td);
        break;
      case "delete_project":
        if (td) await handleDeleteProject(td);
        break;
      case "record_decision":
        if (td) await handleRecordDecision(td, chatIdStr, message.from?.first_name);
        break;
    }

    // Send reply
    if (botResponse.reply) {
      await sendMessage(message.chat.id, botResponse.reply, message.message_id);

      // Save bot reply to conversation history
      prisma.conversationHistory.create({
        data: {
          chatId: chatIdStr,
          role: "bot",
          message: botResponse.reply,
          fromName: "Replica",
        },
      }).catch(() => {});
    }

    if (botResponse.proactiveFollowUp) {
      await sendMessage(message.chat.id, botResponse.proactiveFollowUp);

      prisma.conversationHistory.create({
        data: {
          chatId: chatIdStr,
          role: "bot",
          message: botResponse.proactiveFollowUp,
          fromName: "Replica",
        },
      }).catch(() => {});
    }

    if (addedTaskOwnerId) {
      await checkAssigneeConflicts(message.chat.id, addedTaskOwnerId);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}

// ==================== MEMORY HANDLERS ====================

async function handleRecordDecision(
  taskData: Record<string, unknown>,
  chatId: string,
  senderName?: string
) {
  const summary = taskData.summary as string;
  const madeBy = (taskData.madeBy as string) ?? senderName ?? "Unknown";

  if (!summary) {
    console.log("[Telegram Bot] record_decision: no summary");
    return;
  }

  await prisma.decision.create({
    data: { summary, madeBy, chatId },
  });
  console.log("[Telegram Bot] Recorded decision:", summary, "by", madeBy);
}

// ==================== TASK HANDLERS ====================

async function handleAddTask(
  taskData: Record<string, unknown>,
  users: { id: string; name: string; email: string }[]
): Promise<string | null> {
  let projectId: string | null = null;
  if (taskData.projectName) {
    const project = await prisma.project.findFirst({
      where: { name: { equals: taskData.projectName as string, mode: "insensitive" } },
      select: { id: true },
    });
    projectId = project?.id ?? null;
  }

  let ownerId: string | null = null;
  if (taskData.assignee) {
    ownerId = resolveUserId(taskData.assignee as string, users);
  }
  if (!ownerId && users.length > 0) {
    ownerId = users[0].id;
  }

  const priorityKey = (taskData.priority as string) ?? "important";
  const typeKey = (taskData.type as string) ?? "client";

  const task = await prisma.task.create({
    data: {
      title: taskData.title as string,
      description: (taskData.description as string) ?? undefined,
      projectId,
      ownerId: ownerId!,
      priority: PRIORITY_MAP[priorityKey] ?? "IMPORTANT_NOT_URGENT",
      type: TYPE_MAP[typeKey] ?? "CLIENT",
      status: "TODO",
      deadline: taskData.dueDate ? new Date(taskData.dueDate as string) : null,
      todoSince: new Date(),
    },
  });

  console.log("[Telegram Bot] Created task:", task.id, task.title);
  recalculateAndPersistScores();
  return ownerId;
}

async function handleUpdateTask(
  taskData: Record<string, unknown>,
  users: { id: string; name: string; email: string }[]
) {
  const task = await findTaskByIdOrTitle(taskData);
  if (!task) {
    console.log("[Telegram Bot] update_task: not found", taskData.taskId, taskData.title);
    return;
  }

  const updates = taskData.updates as Record<string, unknown> | undefined;
  if (!updates) {
    console.log("[Telegram Bot] update_task: no updates");
    return;
  }

  const data: Record<string, unknown> = {};

  if (updates.status) {
    const s = (updates.status as string).toLowerCase().replace(/\s+/g, "_");
    data.status = STATUS_MAP[s] ?? (updates.status as string);
  }
  if (updates.priority) {
    const key = (updates.priority as string).toLowerCase();
    data.priority = PRIORITY_MAP[key] ?? updates.priority;
  }
  if (updates.title) data.title = updates.title;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.dueDate) data.deadline = new Date(updates.dueDate as string);
  if (updates.type) {
    const key = (updates.type as string).toLowerCase();
    data.type = TYPE_MAP[key] ?? updates.type;
  }
  if (updates.emergency !== undefined) data.emergency = updates.emergency;
  if (updates.assignee) {
    const uid = resolveUserId(updates.assignee as string, users);
    if (uid) data.ownerId = uid;
  }
  if (updates.projectName) {
    const project = await prisma.project.findFirst({
      where: { name: { equals: updates.projectName as string, mode: "insensitive" } },
      select: { id: true },
    });
    if (project) data.projectId = project.id;
  }

  if (Object.keys(data).length === 0) {
    console.log("[Telegram Bot] update_task: no valid fields");
    return;
  }

  console.log("[Telegram Bot] Updating task", task.id, JSON.stringify(data));
  await prisma.task.update({ where: { id: task.id }, data });

  // Log velocity when task is marked DONE
  if (data.status === "DONE") {
    logVelocity(task).catch(() => {});
  }

  recalculateAndPersistScores();
}

async function handleDeleteTask(taskData: Record<string, unknown>) {
  const task = await findTaskByIdOrTitle(taskData);
  if (!task) {
    console.log("[Telegram Bot] delete_task: not found", taskData.taskId, taskData.title);
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
    console.log("[Telegram Bot] consolidate: no tasksToDelete");
    return;
  }

  let deletedCount = 0;
  for (const title of titlesToDelete) {
    const task = await prisma.task.findFirst({
      where: { title: { equals: title, mode: "insensitive" } },
    });
    if (task) {
      await prisma.task.delete({ where: { id: task.id } });
      deletedCount++;
      console.log("[Telegram Bot] Consolidated: deleted", task.id, task.title);
    }
  }

  if (newTaskData) {
    await handleAddTask(newTaskData, users);
  }

  console.log("[Telegram Bot] Consolidation: deleted", deletedCount, "of", titlesToDelete.length);
  recalculateAndPersistScores();
}

async function handleBulkUpdateTasks(
  taskData: Record<string, unknown>,
  users: { id: string; name: string; email: string }[]
) {
  const filter = taskData.filter as Record<string, unknown> | undefined;
  const updates = taskData.updates as Record<string, unknown> | undefined;
  if (!filter || !updates) {
    console.log("[Telegram Bot] bulk_update: missing filter or updates");
    return;
  }

  const where: Record<string, unknown> = {};
  if (filter.assignee) {
    const uid = resolveUserId(filter.assignee as string, users);
    if (uid) where.ownerId = uid;
  }
  if (filter.projectName) {
    const project = await prisma.project.findFirst({
      where: { name: { equals: filter.projectName as string, mode: "insensitive" } },
      select: { id: true },
    });
    if (project) where.projectId = project.id;
  }
  if (filter.status) {
    const s = (filter.status as string).toLowerCase().replace(/\s+/g, "_");
    where.status = STATUS_MAP[s] ?? filter.status;
  }
  if (filter.priority) {
    const key = (filter.priority as string).toLowerCase();
    where.priority = PRIORITY_MAP[key] ?? filter.priority;
  }
  if (filter.type) {
    const key = (filter.type as string).toLowerCase();
    where.type = TYPE_MAP[key] ?? filter.type;
  }

  const data: Record<string, unknown> = {};
  if (updates.status) {
    const s = (updates.status as string).toLowerCase().replace(/\s+/g, "_");
    data.status = STATUS_MAP[s] ?? updates.status;
  }
  if (updates.priority) {
    const key = (updates.priority as string).toLowerCase();
    data.priority = PRIORITY_MAP[key] ?? updates.priority;
  }
  if (updates.assignee) {
    const uid = resolveUserId(updates.assignee as string, users);
    if (uid) data.ownerId = uid;
  }
  if (updates.projectName) {
    const project = await prisma.project.findFirst({
      where: { name: { equals: updates.projectName as string, mode: "insensitive" } },
      select: { id: true },
    });
    if (project) data.projectId = project.id;
  }

  if (Object.keys(where).length === 0 || Object.keys(data).length === 0) {
    console.log("[Telegram Bot] bulk_update: empty where or data");
    return;
  }

  const result = await prisma.task.updateMany({ where, data });
  console.log("[Telegram Bot] Bulk updated", result.count, "tasks");
  recalculateAndPersistScores();
}

async function handleReassignTasks(
  taskData: Record<string, unknown>,
  users: { id: string; name: string; email: string }[]
) {
  const fromId = resolveUserId(taskData.fromAssignee as string, users);
  const toId = resolveUserId(taskData.toAssignee as string, users);

  if (!fromId || !toId) {
    console.log("[Telegram Bot] reassign: user not found", taskData.fromAssignee, taskData.toAssignee);
    return;
  }

  const where: Record<string, unknown> = { ownerId: fromId };
  const filter = taskData.filter as Record<string, unknown> | undefined;
  if (filter?.projectName) {
    const project = await prisma.project.findFirst({
      where: { name: { equals: filter.projectName as string, mode: "insensitive" } },
      select: { id: true },
    });
    if (project) where.projectId = project.id;
  }
  if (filter?.status) {
    const s = (filter.status as string).toLowerCase().replace(/\s+/g, "_");
    where.status = STATUS_MAP[s] ?? filter.status;
  }
  if (filter?.type) {
    const key = (filter.type as string).toLowerCase();
    where.type = TYPE_MAP[key] ?? filter.type;
  }

  const result = await prisma.task.updateMany({
    where,
    data: { ownerId: toId },
  });
  console.log("[Telegram Bot] Reassigned", result.count, "tasks from", taskData.fromAssignee, "to", taskData.toAssignee);
  recalculateAndPersistScores();
}

async function handleMoveTasksToProject(taskData: Record<string, unknown>) {
  const targetProject = await prisma.project.findFirst({
    where: { name: { equals: taskData.targetProjectName as string, mode: "insensitive" } },
    select: { id: true },
  });
  if (!targetProject) {
    console.log("[Telegram Bot] move_tasks: target project not found", taskData.targetProjectName);
    return;
  }

  const taskIds = taskData.taskIds as string[] | undefined;
  const taskTitles = taskData.taskTitles as string[] | undefined;

  let movedCount = 0;

  if (taskIds?.length) {
    const result = await prisma.task.updateMany({
      where: { id: { in: taskIds } },
      data: { projectId: targetProject.id },
    });
    movedCount += result.count;
  }

  if (taskTitles?.length) {
    for (const title of taskTitles) {
      const task = await prisma.task.findFirst({
        where: { title: { equals: title, mode: "insensitive" } },
      });
      if (task) {
        await prisma.task.update({
          where: { id: task.id },
          data: { projectId: targetProject.id },
        });
        movedCount++;
      }
    }
  }

  console.log("[Telegram Bot] Moved", movedCount, "tasks to project", taskData.targetProjectName);
}

// ==================== PROJECT HANDLERS ====================

async function handleCreateProject(taskData: Record<string, unknown>) {
  const statusKey = taskData.status
    ? (taskData.status as string).toLowerCase().replace(/\s+/g, "_")
    : "not_started";

  const project = await prisma.project.create({
    data: {
      name: taskData.name as string,
      description: (taskData.description as string) ?? undefined,
      clientName: (taskData.clientName as string) ?? undefined,
      color: (taskData.color as string) ?? "#C8FF00",
      status: PROJECT_STATUS_MAP[statusKey] ?? "NOT_STARTED",
      startDate: taskData.startDate ? new Date(taskData.startDate as string) : undefined,
      targetFinishDate: taskData.targetFinishDate ? new Date(taskData.targetFinishDate as string) : undefined,
      budget: taskData.budget != null ? Number(taskData.budget) : undefined,
    },
  });
  console.log("[Telegram Bot] Created project:", project.id, project.name);
}

async function handleUpdateProject(taskData: Record<string, unknown>) {
  const project = await findProjectByIdOrName(
    taskData.projectId as string | undefined,
    taskData.projectName as string | undefined
  );
  if (!project) {
    console.log("[Telegram Bot] update_project: not found", taskData.projectId, taskData.projectName);
    return;
  }

  const updates = taskData.updates as Record<string, unknown> | undefined;
  if (!updates) return;

  const data: Record<string, unknown> = {};
  if (updates.name) data.name = updates.name;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.clientName !== undefined) data.clientName = updates.clientName;
  if (updates.color) data.color = updates.color;
  if (updates.status) {
    const key = (updates.status as string).toLowerCase().replace(/\s+/g, "_");
    data.status = PROJECT_STATUS_MAP[key] ?? updates.status;
  }
  if (updates.startDate) data.startDate = new Date(updates.startDate as string);
  if (updates.targetFinishDate) data.targetFinishDate = new Date(updates.targetFinishDate as string);
  if (updates.budget != null) data.budget = Number(updates.budget);

  if (Object.keys(data).length === 0) return;

  console.log("[Telegram Bot] Updating project", project.id, JSON.stringify(data));
  await prisma.project.update({ where: { id: project.id }, data });
}

async function handleDeleteProject(taskData: Record<string, unknown>) {
  const project = await findProjectByIdOrName(
    taskData.projectId as string | undefined,
    taskData.projectName as string | undefined
  );
  if (!project) {
    console.log("[Telegram Bot] delete_project: not found", taskData.projectId, taskData.projectName);
    return;
  }

  const deleteTasks = taskData.deleteTasks as boolean | undefined;
  const moveToProjectName = taskData.moveTasksToProject as string | undefined;

  if (moveToProjectName) {
    const targetProject = await prisma.project.findFirst({
      where: { name: { equals: moveToProjectName, mode: "insensitive" } },
      select: { id: true },
    });
    if (targetProject) {
      const result = await prisma.task.updateMany({
        where: { projectId: project.id },
        data: { projectId: targetProject.id },
      });
      console.log("[Telegram Bot] Moved", result.count, "tasks to", moveToProjectName);
    }
  } else if (deleteTasks) {
    const result = await prisma.task.deleteMany({ where: { projectId: project.id } });
    console.log("[Telegram Bot] Deleted", result.count, "tasks from project");
  } else {
    await prisma.task.updateMany({
      where: { projectId: project.id },
      data: { projectId: null },
    });
  }

  await prisma.deliverable.deleteMany({ where: { projectId: project.id } });
  await prisma.milestone.deleteMany({ where: { projectId: project.id } });
  await prisma.project.delete({ where: { id: project.id } });
  console.log("[Telegram Bot] Deleted project:", project.id, project.name);
  recalculateAndPersistScores();
}

// ==================== CONFLICT DETECTION ====================

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
    // Non-critical
  }
}
