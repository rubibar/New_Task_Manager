import { prisma } from "./prisma";

/**
 * Check if adding a dependency (taskId depends on dependsOnId) would create a cycle.
 * Uses BFS from dependsOnId following its own dependencies to see if taskId is reachable.
 */
export async function wouldCreateCycle(
  taskId: string,
  dependsOnId: string
): Promise<boolean> {
  if (taskId === dependsOnId) return true;

  const visited = new Set<string>();
  const queue = [dependsOnId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const deps = await prisma.taskDependency.findMany({
      where: { taskId: current },
      select: { dependsOnId: true },
    });

    for (const dep of deps) {
      if (dep.dependsOnId === taskId) return true;
      queue.push(dep.dependsOnId);
    }
  }

  return false;
}

/**
 * After a task's deadline changes, cascade-shift dependent tasks forward.
 * If a dependent's startDate is before the prerequisite's new deadline,
 * push it forward while preserving task duration.
 * Recurses up to maxDepth to propagate changes.
 */
export async function cascadeDateShift(
  changedTaskId: string,
  maxDepth = 50
): Promise<void> {
  if (maxDepth <= 0) return;

  const changedTask = await prisma.task.findUnique({
    where: { id: changedTaskId },
    select: { deadline: true },
  });
  if (!changedTask?.deadline) return;

  const dependents = await prisma.taskDependency.findMany({
    where: { dependsOnId: changedTaskId },
    select: {
      task: { select: { id: true, startDate: true, deadline: true, manualOverride: true } },
    },
  });

  for (const dep of dependents) {
    const dependent = dep.task;
    if (dependent.manualOverride) continue;
    if (!dependent.startDate) continue;

    const prereqDeadline = changedTask.deadline.getTime();
    const depStart = dependent.startDate.getTime();

    if (depStart < prereqDeadline) {
      const duration =
        dependent.deadline
          ? dependent.deadline.getTime() - depStart
          : 86400000; // 1 day default

      const newStart = new Date(prereqDeadline);
      const newDeadline = new Date(prereqDeadline + duration);

      await prisma.task.update({
        where: { id: dependent.id },
        data: { startDate: newStart, deadline: newDeadline },
      });

      await cascadeDateShift(dependent.id, maxDepth - 1);
    }
  }
}

/**
 * BFS from taskId following dependents chain.
 * Returns IDs of tasks that would be affected by a cascade date shift.
 * Skips tasks with manualOverride.
 */
export async function getAffectedTasks(
  taskId: string,
  maxDepth = 50
): Promise<string[]> {
  const affected: string[] = [];
  const visited = new Set<string>();
  const queue: { id: string; depth: number }[] = [{ id: taskId, depth: 0 }];

  while (queue.length > 0) {
    const { id: current, depth } = queue.shift()!;
    if (visited.has(current) || depth > maxDepth) continue;
    visited.add(current);

    const dependents = await prisma.taskDependency.findMany({
      where: { dependsOnId: current },
      select: {
        task: { select: { id: true, manualOverride: true } },
      },
    });

    for (const dep of dependents) {
      if (dep.task.manualOverride) continue;
      if (!visited.has(dep.task.id)) {
        affected.push(dep.task.id);
        queue.push({ id: dep.task.id, depth: depth + 1 });
      }
    }
  }

  return affected;
}

// Phase ordering for auto-sequencing
const PHASE_ORDER: Record<string, number> = {
  PRE_PRODUCTION: 0,
  PRODUCTION: 1,
  POST_PRODUCTION: 2,
  ADMIN: 3,
};

/**
 * Auto-sequence tasks linked to a deliverable:
 * 1. Sort by pipeline phase, then by createdAt within phase
 * 2. Remove existing intra-deliverable dependency edges
 * 3. Create linear chain of dependencies
 * 4. Distribute dates across the deliverable's timeline
 */
export async function autoSequenceDeliverableTasks(
  deliverableId: string
): Promise<void> {
  const deliverable = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    select: {
      dueDate: true,
      project: { select: { startDate: true } },
      tasks: {
        select: {
          id: true,
          category: true,
          createdAt: true,
        },
      },
    },
  });

  if (!deliverable || deliverable.tasks.length < 2) return;

  // Sort by phase then createdAt
  const sorted = [...deliverable.tasks].sort((a, b) => {
    const phaseA = PHASE_ORDER[a.category ?? "PRODUCTION"] ?? 1;
    const phaseB = PHASE_ORDER[b.category ?? "PRODUCTION"] ?? 1;
    if (phaseA !== phaseB) return phaseA - phaseB;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const taskIds = sorted.map((t) => t.id);

  // Delete existing intra-deliverable dependency edges
  await prisma.taskDependency.deleteMany({
    where: {
      taskId: { in: taskIds },
      dependsOnId: { in: taskIds },
    },
  });

  // Create linear chain: task[1] depends on task[0], task[2] depends on task[1], etc.
  for (let i = 1; i < taskIds.length; i++) {
    await prisma.taskDependency.create({
      data: {
        taskId: taskIds[i],
        dependsOnId: taskIds[i - 1],
      },
    });
  }

  // Distribute dates across the deliverable's timeline
  const startMs = deliverable.project?.startDate
    ? deliverable.project.startDate.getTime()
    : Date.now();
  const endMs = deliverable.dueDate.getTime();
  const totalDuration = endMs - startMs;

  if (totalDuration <= 0) return;

  const count = taskIds.length;
  for (let i = 0; i < count; i++) {
    const taskStart = startMs + (i / count) * totalDuration;
    const taskEnd = startMs + ((i + 1) / count) * totalDuration;

    await prisma.task.update({
      where: { id: taskIds[i] },
      data: {
        startDate: new Date(taskStart),
        deadline: new Date(Math.min(taskEnd, endMs)),
      },
    });
  }
}
