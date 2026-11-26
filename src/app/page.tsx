import { Stage } from "@/components/Stage";
import { getSiteContent } from "@/server/content/repository";

export default async function Home() {
  const { content } = await getSiteContent();
  return <Stage content={content} />;
}
