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
  Client,
  ClientStatus,
  ClientType,
  ClientSource,
  ClientContact,
  CommunicationLog,
  CommunicationLogType,
  Invoice,
  InvoiceStatus,
  AIInsightCache,
  TimeEntry,
  TimeEntryType,
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
  Client,
  ClientStatus,
  ClientType,
  ClientSource,
  ClientContact,
  CommunicationLog,
  CommunicationLogType,
  Invoice,
  InvoiceStatus,
  AIInsightCache,
  TimeEntry,
  TimeEntryType,
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
  client?: Client | null;
  _count?: { tasks: number };
};

export type DeliverableWithRelations = Deliverable & {
  assignee: Pick<User, "id" | "name" | "email" | "image"> | null;
  statusLogs?: (DeliverableStatusLog & {
    changedBy: Pick<User, "id" | "name">;
  })[];
};

export type ClientWithRelations = Client & {
  contacts: ClientContact[];
  projects: (Project & { _count?: { tasks: number } })[];
  invoices: Invoice[];
  communications: CommunicationLog[];
  _count?: {
    projects: number;
    invoices: number;
    communications: number;
  };
};

export type InvoiceWithRelations = Invoice & {
  client: Pick<Client, "id" | "name">;
  project: Pick<Project, "id" | "name"> | null;
};

export interface CreateProjectInput {
  name: string;
  description?: string;
  color?: string;
  clientName?: string;
  clientId?: string;
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
  "id" | "name" | "email" | "image" | "atCapacity" | "role" | "skills" | "weeklyCapacityHours"
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
  estimatedHours?: number;
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
  estimatedHours?: number | null;
}

export interface LineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

// --- Time Tracking ---

export type TimeEntryWithRelations = TimeEntry & {
  task: Pick<Task, "id" | "title" | "projectId"> & {
    project: Pick<Project, "id" | "name" | "color"> | null;
  };
  user: Pick<User, "id" | "name" | "email" | "image">;
};

export interface CreateTimeEntryInput {
  taskId: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  entryType?: TimeEntryType;
  billable?: boolean;
  note?: string;
}

export interface TimerState {
  isRunning: boolean;
  activeEntry: TimeEntry | null;
  taskId: string | null;
  elapsed: number;
}

// --- Health Scores ---

export interface HealthScoreFactor {
  name: string;
  score: number;       // 0-100
  weight: number;      // 0-1 (sums to 1)
  weighted: number;    // score * weight
  detail: string;
}

export interface HealthScoreResult {
  overall: number;     // 0-100
  factors: HealthScoreFactor[];
  trend: number;       // delta from previous calculation
  grade: "A" | "B" | "C" | "D" | "F";
}

export type TaskWithTimeEntries = Task & {
  timeEntries: TimeEntry[];
  owner: Pick<User, "id" | "name" | "email" | "image">;
  project: Pick<Project, "id" | "name" | "color"> | null;
};
