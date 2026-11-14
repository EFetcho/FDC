import {
  demoAddProject,
  demoAddTask,
  demoCloseProject,
  demoCloseTask,
  demoDeleteDraft,
  demoDismissDraft,
  demoDoneFollowUp,
  demoReopenProject,
  demoReopenTask,
  demoRestoreDraft,
  demoUndoFollowUp,
} from "./demo";
import { UserFacingError } from "./errors";
import { deleteDraft, dismissDraft, markFollowUpDone, restoreDraft, undoFollowUp } from "./gmail";
import { addProject, closeProject, reopenProject } from "./sheets";
import { addTask, closeTask, reopenTask } from "./todoist";
import type { Session } from "./types";

function text(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value : "";
}

function rowNumber(body: Record<string, unknown>): number {
  const value = body.row;
  const row = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(row)) throw new UserFacingError("That project row is not valid.");
  return row;
}

export async function runAction(session: Session, type: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const demo = session.demo;
  const email = session.email;

  switch (type) {
    case "task.add": {
      const task = demo
        ? demoAddTask(text(body, "content"), text(body, "due"))
        : await addTask(text(body, "content"), text(body, "due"));
      return { ok: true, task };
    }
    case "task.close": {
      const id = text(body, "id");
      if (demo) demoCloseTask(id);
      else await closeTask(id);
      return { ok: true };
    }
    case "task.reopen": {
      const id = text(body, "id");
      if (demo) demoReopenTask(id);
      else await reopenTask(id);
      return { ok: true };
    }
    case "draft.dismiss": {
      const id = text(body, "id");
      if (demo) demoDismissDraft(id);
      else await dismissDraft(email, id);
      return { ok: true };
    }
    case "draft.restore": {
      const id = text(body, "id");
      if (demo) demoRestoreDraft(id);
      else await restoreDraft(email, id);
      return { ok: true };
    }
    case "draft.delete": {
      const id = text(body, "id");
      if (demo) demoDeleteDraft(id);
      else await deleteDraft(email, id);
      return { ok: true };
    }
    case "followup.done": {
      const id = text(body, "id");
      if (demo) demoDoneFollowUp(id);
      else await markFollowUpDone(email, id);
      return { ok: true };
    }
    case "followup.undo": {
      const id = text(body, "id");
      if (demo) demoUndoFollowUp(id);
      else await undoFollowUp(email, id);
      return { ok: true };
    }
    case "project.add": {
      const input = {
        name: text(body, "name"),
        dateStarted: text(body, "dateStarted"),
        chatLink: text(body, "chatLink"),
      };
      const project = demo ? demoAddProject(input) : await addProject(email, input);
      return { ok: true, project };
    }
    case "project.close": {
      const row = rowNumber(body);
      if (demo) demoCloseProject(row);
      else await closeProject(email, row);
      return { ok: true };
    }
    case "project.reopen": {
      const row = rowNumber(body);
      if (demo) demoReopenProject(row);
      else await reopenProject(email, row);
      return { ok: true };
    }
    default:
      throw new UserFacingError("That action is not available.");
  }
}
