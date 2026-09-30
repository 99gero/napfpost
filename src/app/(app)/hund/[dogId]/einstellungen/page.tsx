import { DogSettings } from "./DogSettings";

export default async function Page(props: PageProps<"/hund/[dogId]/einstellungen">) {
  const { dogId } = await props.params;
  return <DogSettings dogId={dogId} />;
}
