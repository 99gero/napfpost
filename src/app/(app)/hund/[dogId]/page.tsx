import { DogScreen } from "./DogScreen";

export default async function DogPage(props: PageProps<"/hund/[dogId]">) {
  const { dogId } = await props.params;
  return <DogScreen dogId={dogId} />;
}
