'use client';

import { useEffect } from "react";
import type { SiteContent } from "@/content/schema";
import { createProceduralRenderer } from "@/scene/procedural/renderer";
import { startWalkthrough } from "@/walkthrough/controller";

/** Brings the server-rendered stage to life. Renders nothing itself. */
export default function Walkthrough({ content }: { content: SiteContent }) {
  useEffect(() => {
    const stage = document.getElementById('stage');
    if (!stage) return;
    return startWalkthrough(stage, content, createProceduralRenderer());
  }, [content]);
  return null;
}
