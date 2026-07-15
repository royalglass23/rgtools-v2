import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PrototypeGallery } from "./PrototypeGallery";

export const dynamic = "force-dynamic";

export default function RgtoolsDesignPrototypePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <Suspense
      fallback={
        <div style={{ padding: "2rem" }}>Loading RGTools prototype...</div>
      }
    >
      <PrototypeGallery />
    </Suspense>
  );
}
