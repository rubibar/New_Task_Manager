import { prisma } from "./prisma";
import type { NotificationType } from "@prisma/client";

export async function createNotification({
  userId,
  type,
  title,
  message,
  taskId,
}: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  taskId?: string;
}) {
  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      taskId,
    },
  });
}

export async function notifyAllUsers(
  type: NotificationType,
  title: string,
  message: string,
  taskId?: string
) {
  const users = await prisma.user.findMany({ select: { id: true } });
  return Promise.all(
    users.map((user) =>
      createNotification({ userId: user.id, type, title, message, taskId })
    )
  );
}

export async function notifyReviewRequest(
  reviewerId: string,
  taskTitle: string,
  ownerName: string,
  taskId: string
) {
  return createNotification({
    userId: reviewerId,
    type: "REVIEW_REQUEST",
    title: "Review Requested",
    message: `${ownerName} submitted "${taskTitle}" for your review.`,
    taskId,
  });
}

export async function notifyDeadlineApproaching(
  ownerId: string,
  taskTitle: string,
  taskId: string
) {
  return createNotification({
    userId: ownerId,
    type: "DEADLINE_APPROACHING",
    title: "Deadline Approaching",
    message: `"${taskTitle}" is due within 8 working hours.`,
    taskId,
  });
}

export async function notifyEmergency(taskTitle: string, taskId: string) {
  return notifyAllUsers(
    "EMERGENCY_TASK",
    "Emergency Task",
    `"${taskTitle}" has been flagged as emergency.`,
    taskId
  );
}

export async function notifyThursdayFreeze() {
  return notifyAllUsers(
    "THURSDAY_FREEZE",
    "Thursday Planning Mode",
    "Scores are frozen for the weekly review meeting."
  );
}

export async function notifyTaskAssigned(
  userId: string,
  taskTitle: string,
  role: "owner" | "reviewer",
  taskId: string
) {
  return createNotification({
    userId,
    type: "TASK_ASSIGNED",
    title: `Assigned as ${role}`,
    message: `You've been assigned as ${role} on "${taskTitle}".`,
    taskId,
  });
}
