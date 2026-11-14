"use client";

import { useMemo, useState } from "react";
import { eventTimeLabel } from "../lib/time";
import type { DashboardData, DraftItem, FollowUpItem, ProjectItem, TaskItem } from "../lib/types";

type Toast = { id: number; text: string; undo?: () => Promise<void> };

async function post(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch("/api/action", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error || "That did not save.");
  return data;
}

export default function Dashboard({ initial }: { initial: DashboardData }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [taskText, setTaskText] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDate, setProjectDate] = useState(initial.todayKey);
  const [projectChat, setProjectChat] = useState("");
  const [pendingDelete, setPendingDelete] = useState<DraftItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const counts = useMemo(
    () => ({
      events: data.calendar.count,
      tasks: data.tasks.items.length,
      drafts: data.drafts.items.length,
      followups: data.followups.items.length,
      projects: data.projects.items.length,
    }),
    [data],
  );

  function toast(text: string, undo?: () => Promise<void>) {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, text, undo }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 8000);
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (!response.ok) throw new Error("Refresh failed.");
      setData((await response.json()) as DashboardData);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  async function run(key: string, work: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    try {
      await work();
    } catch (error) {
      toast(error instanceof Error ? error.message : "That did not save.");
    } finally {
      setBusy(null);
    }
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      {data.demo ? (
        <div className="demo-banner">
          Sample data only. Nothing here is connected to Google or Todoist. Turn DEMO_MODE off before real use.
        </div>
      ) : null}
      <div className="shell">
        <header className="top">
          <a className="brand" href="https://fdcav.com" aria-label="FDC Event Technology website">
            <img src="/brand/logo" alt="FDC Event Technology" />
          </a>
          <div>
            <p className="eyebrow">Operations</p>
            <h1>{data.todayLabel}</h1>
            <p className="sub">Eastern Time · Indianapolis · Updated {data.updatedLabel}</p>
          </div>
          <div className="top-actions">
            <span className="who">{data.email}</span>
            <button className="ghost" type="button" onClick={() => void refresh()} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
            {data.demo ? null : (
              <a className="ghost" href="/security">
                Security
              </a>
            )}
            <form action="/api/auth/logout" method="post">
              <button className="ghost" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </header>

        <nav className="stats" aria-label="Summary">
          <Stat n={counts.events} label="Events" onClick={() => scrollTo("calendar")} />
          <Stat n={counts.tasks} label="Tasks" onClick={() => scrollTo("tasks")} />
          <Stat n={counts.drafts} label="Drafts" onClick={() => scrollTo("drafts")} />
          <Stat n={counts.followups} label="Follow-ups" onClick={() => scrollTo("followups")} />
          <Stat n={counts.projects} label="Projects" onClick={() => scrollTo("projects")} />
        </nav>

        <div className="grid">
          <section className="card" id="calendar">
            <header>
              <h2>Calendar</h2>
              <p>Next 14 days from Google Calendar. View only — events stay on the calendar.</p>
            </header>
            {data.calendar.error ? <p className="error">{data.calendar.error}</p> : null}
            {!data.calendar.error && data.calendar.days.length === 0 ? (
              <p className="empty">Nothing on the calendar for the next 14 days.</p>
            ) : null}
            {data.calendar.days.map((day) => (
              <div className="day" key={day.date}>
                <h3>{day.label}</h3>
                {day.events.map((event) => (
                  <article className="event" key={event.id}>
                    <time>{eventTimeLabel(event.start, event.end, event.allDay)}</time>
                    <div>
                      <strong>
                        {event.link ? (
                          <a href={event.link} target="_blank" rel="noreferrer">
                            {event.title}
                          </a>
                        ) : (
                          event.title
                        )}
                        {event.calendar ? <span className="tag">{event.calendar}</span> : null}
                      </strong>
                      {event.location ? <p className="loc">{event.location}</p> : null}
                    </div>
                  </article>
                ))}
              </div>
            ))}
          </section>

          <section className="card" id="tasks">
            <header>
              <h2>Tasks</h2>
              <p>Open Todoist tasks. Checking one completes it in Todoist. A repeating task moves to the next date.</p>
            </header>
            <form
              className="composer"
              onSubmit={(event) => {
                event.preventDefault();
                const content = taskText;
                const due = taskDue;
                void run("task-add", async () => {
                  const result = await post({ type: "task.add", content, due });
                  const task = result.task as TaskItem;
                  setData((current) => ({ ...current, tasks: { ...current.tasks, items: [task, ...current.tasks.items] } }));
                  setTaskText("");
                  setTaskDue("");
                });
              }}
            >
              <input
                name="content"
                aria-label="New task"
                placeholder="Add a task"
                value={taskText}
                onChange={(event) => setTaskText(event.target.value)}
                maxLength={500}
                required
              />
              <input
                name="due"
                aria-label="Due"
                placeholder="Due, optional"
                value={taskDue}
                onChange={(event) => setTaskDue(event.target.value)}
                maxLength={80}
              />
              <button className="primary" type="submit" disabled={busy === "task-add"}>
                Add
              </button>
            </form>
            {data.tasks.error ? <p className="error">{data.tasks.error}</p> : null}
            {!data.tasks.error && data.tasks.items.length === 0 ? <p className="empty">No open tasks.</p> : null}
            {data.tasks.items.map((task) => (
              <article className="row" key={task.id}>
                <Check
                  label={`Complete ${task.content}`}
                  disabled={busy === task.id}
                  onClick={() =>
                    void run(task.id, async () => {
                      const snapshot = data.tasks.items;
                      setData((current) => ({
                        ...current,
                        tasks: { ...current.tasks, items: current.tasks.items.filter((item) => item.id !== task.id) },
                      }));
                      try {
                        await post({ type: "task.close", id: task.id });
                        toast(`Completed “${short(task.content)}”`, async () => {
                          setData((current) => ({
                            ...current,
                            tasks: {
                              ...current.tasks,
                              items: current.tasks.items.some((item) => item.id === task.id)
                                ? current.tasks.items
                                : [task, ...current.tasks.items],
                            },
                          }));
                          try {
                            await post({ type: "task.reopen", id: task.id });
                          } catch (error) {
                            setData((current) => ({
                              ...current,
                              tasks: {
                                ...current.tasks,
                                items: current.tasks.items.filter((item) => item.id !== task.id),
                              },
                            }));
                            throw error;
                          }
                        });
                      } catch (error) {
                        setData((current) => ({ ...current, tasks: { ...current.tasks, items: snapshot } }));
                        throw error;
                      }
                    })
                  }
                />
                <div className="row-main">
                  <strong>
                    {task.url ? (
                      <a href={task.url} target="_blank" rel="noreferrer">
                        {task.content}
                      </a>
                    ) : (
                      task.content
                    )}
                  </strong>
                  <p className="meta">
                    {task.dueLabel ? <span className={task.overdue ? "overdue" : undefined}>{task.dueLabel}</span> : "No date"}
                    {task.recurring ? " · Repeats" : ""}
                  </p>
                </div>
                <div className="row-side">{task.priorityLabel ? <span className={`badge ${task.priorityLabel === "P1" ? "p1" : "p2"}`}>{task.priorityLabel}</span> : null}</div>
              </article>
            ))}
          </section>

          <section className="card" id="drafts">
            <header>
              <h2>Drafts</h2>
              <p>Unsent Gmail drafts. Checking one hides it here and leaves it in Gmail. Nothing is ever sent.</p>
            </header>
            {data.drafts.error ? <p className="error">{data.drafts.error}</p> : null}
            {!data.drafts.error && data.drafts.items.length === 0 ? <p className="empty">No drafts to show.</p> : null}
            {data.drafts.items.map((draft) => (
              <article className="row" key={draft.id}>
                <Check
                  label={`Hide draft ${draft.subject}`}
                  disabled={busy === draft.id}
                  onClick={() =>
                    void run(draft.id, async () => {
                      setData((current) => ({
                        ...current,
                        drafts: { ...current.drafts, items: current.drafts.items.filter((item) => item.id !== draft.id) },
                      }));
                      try {
                        await post({ type: "draft.dismiss", id: draft.id });
                        toast(`Hid “${short(draft.subject)}”`, async () => {
                          setData((current) => ({
                            ...current,
                            drafts: {
                              ...current.drafts,
                              items: current.drafts.items.some((item) => item.id === draft.id)
                                ? current.drafts.items
                                : [draft, ...current.drafts.items],
                            },
                          }));
                          try {
                            await post({ type: "draft.restore", id: draft.id });
                          } catch (error) {
                            setData((current) => ({
                              ...current,
                              drafts: {
                                ...current.drafts,
                                items: current.drafts.items.filter((item) => item.id !== draft.id),
                              },
                            }));
                            throw error;
                          }
                        });
                      } catch (error) {
                        setData((current) => ({
                          ...current,
                          drafts: {
                            ...current.drafts,
                            items: current.drafts.items.some((item) => item.id === draft.id)
                              ? current.drafts.items
                              : [draft, ...current.drafts.items],
                          },
                        }));
                        throw error;
                      }
                    })
                  }
                />
                <div className="row-main">
                  <strong>{draft.subject}</strong>
                  <p className="meta">
                    To {draft.to} · {draft.dateLabel}
                  </p>
                </div>
                <div className="row-side">
                  {draft.link ? (
                    <a className="open-link" href={draft.link} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  ) : null}
                  <button className="text-btn danger" type="button" onClick={() => setPendingDelete(draft)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </section>

          <section className="card" id="followups">
            <header>
              <h2>Follow-ups</h2>
              <p>
                Inbox threads from the last 14 days where the last message is not from you. Newsletters, and fire or
                police department QuickBooks estimates and invoices, are left out. Checking one adds the Gmail label
                Dashboard/Done.
              </p>
            </header>
            {data.followups.error ? <p className="error">{data.followups.error}</p> : null}
            {!data.followups.error && data.followups.items.length === 0 ? (
              <p className="empty">Nothing is waiting on a reply.</p>
            ) : null}
            {data.followups.items.map((item) => (
              <FollowRow
                key={item.id}
                item={item}
                disabled={busy === item.id}
                onDone={() =>
                  void run(item.id, async () => {
                    setData((current) => ({
                      ...current,
                      followups: {
                        ...current.followups,
                        items: current.followups.items.filter((row) => row.id !== item.id),
                      },
                    }));
                    try {
                      await post({ type: "followup.done", id: item.id });
                      toast(`Labeled “${short(item.subject)}” done`, async () => {
                        setData((current) => ({
                          ...current,
                          followups: {
                            ...current.followups,
                            items: current.followups.items.some((row) => row.id === item.id)
                              ? current.followups.items
                              : [item, ...current.followups.items],
                          },
                        }));
                        try {
                          await post({ type: "followup.undo", id: item.id });
                        } catch (error) {
                          setData((current) => ({
                            ...current,
                            followups: {
                              ...current.followups,
                              items: current.followups.items.filter((row) => row.id !== item.id),
                            },
                          }));
                          throw error;
                        }
                      });
                    } catch (error) {
                      setData((current) => ({
                        ...current,
                        followups: {
                          ...current.followups,
                          items: current.followups.items.some((row) => row.id === item.id)
                            ? current.followups.items
                            : [item, ...current.followups.items],
                        },
                      }));
                      throw error;
                    }
                  })
                }
              />
            ))}
          </section>

          <section className="card span-2" id="projects">
            <header>
              <h2>Projects</h2>
              <p>Open rows on the Project Tracker sheet. Checking one sets Status to closed.</p>
            </header>
            <form
              className="project-form"
              onSubmit={(event) => {
                event.preventDefault();
                const name = projectName;
                const dateStarted = projectDate;
                const chatLink = projectChat;
                void run("project-add", async () => {
                  const result = await post({ type: "project.add", name, dateStarted, chatLink });
                  const project = result.project as ProjectItem;
                  setData((current) => ({
                    ...current,
                    projects: { ...current.projects, items: [...current.projects.items, project] },
                  }));
                  setProjectName("");
                  setProjectChat("");
                });
              }}
            >
              <input
                name="name"
                aria-label="Project name"
                placeholder="Project name"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                maxLength={200}
                required
              />
              <input
                name="dateStarted"
                aria-label="Date started"
                type="date"
                value={projectDate}
                onChange={(event) => setProjectDate(event.target.value)}
              />
              <input
                name="chatLink"
                aria-label="Chat link"
                placeholder="Chat link, optional"
                value={projectChat}
                onChange={(event) => setProjectChat(event.target.value)}
              />
              <button className="primary" type="submit" disabled={busy === "project-add"}>
                Add project
              </button>
            </form>
            {data.projects.error ? <p className="error">{data.projects.error}</p> : null}
            {!data.projects.error && data.projects.items.length === 0 ? <p className="empty">No open projects.</p> : null}
            {data.projects.items.map((project) => (
              <article className="row" key={`${project.row}-${project.name}`}>
                <Check
                  label={`Close ${project.name}`}
                  disabled={busy === `p-${project.row}` || project.row < 2}
                  onClick={() =>
                    void run(`p-${project.row}`, async () => {
                      setData((current) => ({
                        ...current,
                        projects: {
                          ...current.projects,
                          items: current.projects.items.filter((item) => item.row !== project.row),
                        },
                      }));
                      try {
                        await post({ type: "project.close", row: project.row });
                        toast(`Closed “${short(project.name)}”`, async () => {
                          setData((current) => ({
                            ...current,
                            projects: {
                              ...current.projects,
                              items: current.projects.items.some((item) => item.row === project.row)
                                ? current.projects.items
                                : [...current.projects.items, project],
                            },
                          }));
                          try {
                            await post({ type: "project.reopen", row: project.row });
                          } catch (error) {
                            setData((current) => ({
                              ...current,
                              projects: {
                                ...current.projects,
                                items: current.projects.items.filter((item) => item.row !== project.row),
                              },
                            }));
                            throw error;
                          }
                        });
                      } catch (error) {
                        setData((current) => ({
                          ...current,
                          projects: {
                            ...current.projects,
                            items: current.projects.items.some((item) => item.row === project.row)
                              ? current.projects.items
                              : [...current.projects.items, project],
                          },
                        }));
                        throw error;
                      }
                    })
                  }
                />
                <div className="row-main">
                  <strong>{project.name}</strong>
                  <p className="meta">Started {project.started || "—"} · {project.status}</p>
                </div>
                <div className="row-side">
                  {project.chatUrl ? (
                    <a className="open-link" href={project.chatUrl} target="_blank" rel="noreferrer">
                      Chat
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        </div>
        <p className="footnote">This dashboard never sends email. Times are America/Indianapolis.</p>
      </div>

      {pendingDelete ? (
        <div className="modal-back" role="presentation" onClick={() => setPendingDelete(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="delete-title">Delete this draft?</h3>
            <p>
              This permanently deletes “{pendingDelete.subject}” from Gmail. It cannot be undone from here, and the
              email will not be sent.
            </p>
            <div className="modal-actions">
              <button className="ghost" type="button" onClick={() => setPendingDelete(null)}>
                Cancel
              </button>
              <button
                className="danger-solid"
                type="button"
                onClick={() => {
                  const draft = pendingDelete;
                  setPendingDelete(null);
                  void run(draft.id, async () => {
                    await post({ type: "draft.delete", id: draft.id });
                    setData((current) => ({
                      ...current,
                      drafts: { ...current.drafts, items: current.drafts.items.filter((item) => item.id !== draft.id) },
                    }));
                    toast("Draft deleted from Gmail.");
                  });
                }}
              >
                Delete draft
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((item) => (
          <div className="toast" key={item.id}>
            <span>{item.text}</span>
            {item.undo ? (
              <button
                type="button"
                onClick={() => {
                  setToasts((current) => current.filter((toastItem) => toastItem.id !== item.id));
                  void item.undo?.().catch((error: unknown) => {
                    toast(error instanceof Error ? error.message : "Undo failed.");
                  });
                }}
              >
                Undo
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}

function Stat({ n, label, onClick }: { n: number; label: string; onClick: () => void }) {
  return (
    <button className="stat" type="button" onClick={onClick}>
      <b>{n}</b>
      <span>{label}</span>
    </button>
  );
}

function Check({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) {
  return <button type="button" className="check" aria-label={label} title={label} disabled={disabled} onClick={onClick} />;
}

function FollowRow({ item, disabled, onDone }: { item: FollowUpItem; disabled: boolean; onDone: () => void }) {
  return (
    <article className="row">
      <Check label={`Mark ${item.subject} done`} disabled={disabled} onClick={onDone} />
      <div className="row-main">
        <strong>{item.subject}</strong>
        <p className="meta">
          {item.from}
          {item.email ? ` · ${item.email}` : ""} · {item.dateLabel}
        </p>
        {item.snippet ? <p className="snippet">{item.snippet}</p> : null}
      </div>
      <div className="row-side">
        <a className="open-link" href={item.link} target="_blank" rel="noreferrer">
          Open
        </a>
      </div>
    </article>
  );
}

function short(value: string): string {
  return value.length > 60 ? `${value.slice(0, 57)}…` : value;
}
