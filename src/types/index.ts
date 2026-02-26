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
  Deliverable,
  DeliverableStatus,
  DeliverableStatusLog,
  ProjectType,
  TaskTemplate,
  TaskTemplateCategory,
  FolderTemplate,
  Milestone,
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
  Deliverable,
  DeliverableStatus,
  DeliverableStatusLog,
  ProjectType,
  TaskTemplate,
  TaskTemplateCategory,
  FolderTemplate,
  Milestone,
};

export type TaskWithRelations = Task & {
  owner: Pick<User, "id" | "name" | "email" | "image">;
  reviewer: Pick<User, "id" | "name" | "email" | "image"> | null;
  project: Pick<Project, "id" | "name" | "color"> | null;
};

export type ProjectWithTasks = Project & {
  tasks: Task[];
  deliverables?: Deliverable[];
  milestones?: Milestone[];
  projectType?: ProjectType | null;
  _count?: { tasks: number };
};

export type DeliverableWithRelations = Deliverable & {
  assignee: Pick<User, "id" | "name" | "email" | "image"> | null;
  statusLogs?: (DeliverableStatusLog & {
    changedBy: Pick<User, "id" | "name">;
  })[];
};

export interface CreateProjectInput {
  name: string;
  description?: string;
  color?: string;
  clientName?: string;
  projectTypeId?: string;
  startDate?: string;
  targetFinishDate?: string;
  budget?: number;
  shiftRate?: number;
  hourlyRate?: number;
  status?: ProjectStatus;
}

export interface CreateDeliverableInput {
  projectId: string;
  name: string;
  description?: string;
  dueDate: string;
  assigneeId?: string;
}

export interface CreateMilestoneInput {
  projectId: string;
  name: string;
  dueDate: string;
}

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
