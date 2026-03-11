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
  ChecklistItem,
  TemplateChecklistItem,
  TaskDependency,
  DeliverableTemplate,
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
  ChecklistItem,
  TemplateChecklistItem,
  TaskDependency,
  DeliverableTemplate,
};

export interface DeliverableTemplateDefaultTask {
  title: string;
  phase: TaskTemplateCategory;
  sortOrder: number;
}

export type TaskWithRelations = Task & {
  owner: Pick<User, "id" | "name" | "email" | "image">;
  reviewer: Pick<User, "id" | "name" | "email" | "image"> | null;
  project: Pick<Project, "id" | "name" | "color" | "startDate" | "targetFinishDate"> | null;
  checklistItems?: Pick<ChecklistItem, "id" | "completed">[];
  deliverable?: Pick<Deliverable, "id" | "name"> | null;
  dependencies?: (TaskDependency & { dependsOn: Pick<Task, "id" | "title" | "status"> })[];
  dependents?: (TaskDependency & { task: Pick<Task, "id" | "title" | "status"> })[];
};

export type TaskTemplateWithChecklist = TaskTemplate & {
  checklistItems: TemplateChecklistItem[];
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
  tasks?: Pick<Task, "id" | "title" | "status" | "category">[];
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
  deadlineProximity: number; // 0-35
  priority: number;          // 0-25
  taskType: number;          // 0-10
  status: number;            // 0-10
  aging: number;             // 0-10
  boosts: {
    emergency: number;       // 0 or 10
    sundayRD: number;        // 0 or 5
  };
  rawScore: number;          // 0-100
  displayScore: number;      // same as rawScore (no normalization)
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  type: TaskType;
  priority: Priority;
  ownerId: string;
  reviewerId?: string;
  projectId?: string;
  deliverableId?: string;
  startDate?: string;
  deadline?: string;
  emergency?: boolean;
  estimatedHours?: number;
  category?: TaskTemplateCategory;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  type?: TaskType;
  priority?: Priority;
  ownerId?: string;
  reviewerId?: string;
  projectId?: string | null;
  deliverableId?: string | null;
  startDate?: string | null;
  deadline?: string | null;
  emergency?: boolean;
  estimatedHours?: number | null;
  category?: TaskTemplateCategory | null;
  manualOverride?: boolean;
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
