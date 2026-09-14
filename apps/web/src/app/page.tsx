"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Landing } from "@/components/landing";
import { DiscoveryExperience } from "@/components/discovery-experience";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Signed-in readers land on the library (the books, with the slides above
  // them); the chat now lives at /ask, one step down in the nav. Users an
  // admin hasn't granted anything yet keep the discovery guide here instead —
  // an empty library would tell them nothing.
  const goesToLibrary = Boolean(user) && !(user?.hasAccess === false && user?.role !== "org_admin");

  useEffect(() => {
    if (!loading && goesToLibrary) {
      router.replace("/library");
    }
  }, [loading, goesToLibrary, router]);

  if (!loading && !user) {
    return <Landing />;
  }

  if (!loading && user && !goesToLibrary) {
    return <DiscoveryExperience />;
  }

  // Loading, or redirecting to the library.
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-ink/70 dark:text-white/70">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}
