import { prisma } from "../lib/prisma";
import { Project, ProjectStatus } from "@prisma/client";

export async function listProjects() {
  return prisma.project.findMany({ orderBy: { name: "asc" } });
}

export async function getProjectById(id: string) {
  return prisma.project.findUnique({ where: { id } });
}

export async function createProject(input: {
  name: string;
  description?: string;
  category?: string;
  deadline?: Date;
}): Promise<Project> {
  return prisma.project.create({ data: input });
}

export async function editProject(
  id: string,
  input: Partial<{
    name: string;
    description: string;
    category: string;
    status: ProjectStatus;
    deadline: Date | null;
  }>
): Promise<Project> {
  return prisma.project.update({ where: { id }, data: input });
}

export async function checkDeleteProject(id: string): Promise<{ taskCount: number }> {
  const taskCount = await prisma.task.count({ where: { projectId: id } });
  return { taskCount };
}

// Two explicit paths per docs/04-workflows.md — the caller (orchestrator)
// must always know which one was chosen, never infer a default.
export async function deleteProject(id: string, cascadeTasks: boolean): Promise<Project> {
  return prisma.$transaction(async (tx) => {
    if (cascadeTasks) {
      await tx.task.deleteMany({ where: { projectId: id } });
    } else {
      await tx.task.updateMany({ where: { projectId: id }, data: { projectId: null } });
    }
    return tx.project.delete({ where: { id } });
  });
}
