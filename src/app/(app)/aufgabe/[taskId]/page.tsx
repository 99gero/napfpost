import { TaskScreen } from "./TaskScreen";

export default async function TaskPage(props: PageProps<"/aufgabe/[taskId]">) {
  const { taskId } = await props.params;
  const { via } = await props.searchParams;
  return <TaskScreen taskId={taskId} viaTag={via === "tag"} />;
}
