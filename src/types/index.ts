import type {
  Task,
  Project,
  User,
  Notification,
  TaskType,
  Priority,
  TaskStatus,
  ProjectStatus,
  NotificationType,
} from "@prisma/client";

export type {
  Task,
  Project,
  User,
  Notification,
  TaskType,
  Priority,
  TaskStatus,
  ProjectStatus,
  NotificationType,
};

export type TaskWithRelations = Task & {
  owner: Pick<User, "id" | "name" | "email" | "image">;
  reviewer: Pick<User, "id" | "name" | "email" | "image"> | null;
  project: Pick<Project, "id" | "name" | "color"> | null;
};

export type ProjectWithTasks = Project & {
  tasks: Task[];
  _count?: { tasks: number };
};

export type UserWithCapacity = Pick<
  User,
  "id" | "name" | "email" | "image" | "atCapacity"
>;

export interface ScoreBreakdown {
  baseWeight: number;
  userPriority: number;
  aging: number;
  urgencyMultiplier: number;
  subtotal: number;
  boosts: {
    inReview: number;
    emergency: number;
    sundayRD: number;
  };
  rawScore: number;
  displayScore: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  type: TaskType;
  priority: Priority;
  ownerId: string;
  reviewerId?: string;
  projectId?: string;
  startDate: string;
  deadline: string;
  emergency?: boolean;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  type?: TaskType;
  priority?: Priority;
  ownerId?: string;
  reviewerId?: string;
  projectId?: string | null;
  startDate?: string;
  deadline?: string;
  emergency?: boolean;
}
