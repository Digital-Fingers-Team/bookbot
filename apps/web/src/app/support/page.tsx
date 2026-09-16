"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { SupportInbox } from "@/components/support-inbox";

export default function SupportPage() {
  // SupportInbox reads ?thread= to deep-link a conversation, which Next requires
  // to sit under a Suspense boundary.
  return (
    <Suspense fallback={<Spinner />}>
      <SupportGate />
    </Suspense>
  );
}

function SupportGate() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <Spinner />;
  }

  return <SupportInbox />;
}

function Spinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-ink/70 dark:text-white/70">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}
