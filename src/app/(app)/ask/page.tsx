import { PageHeader } from "@/components/layout/page-header";
import { GlobalAsk } from "@/components/ai/global-ask";
import { aiConfigured, transcribeConfigured, embeddingsConfigured } from "@/lib/ai/model";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";

export const metadata = { title: "问问" };

export default async function AskPage() {
  const { userId } = await verifySession();
  const [tripCount, indexed] = await Promise.all([
    db.trip.count({ where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] } }),
    db.embedding.count({ where: { userId } }),
  ]);

  return (
    <>
      <PageHeader title="问问" subtitle="Ask anything" />
      <GlobalAsk
        configured={aiConfigured()}
        voiceEnabled={transcribeConfigured()}
        semantic={embeddingsConfigured()}
        tripCount={tripCount}
        indexed={indexed}
      />
    </>
  );
}
