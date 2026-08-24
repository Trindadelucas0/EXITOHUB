"use client";

import { useState } from "react";
import { Button } from "@/src/components/ui/button";

type Props = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function ExportFileButton({ href, children, variant = "secondary" }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onClick() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(href, { credentials: "same-origin" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error?.message ?? "Não foi possível exportar.");
      }
      const blob = await res.blob();
      const fileName =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "export";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao exportar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-stretch gap-1">
      <Button type="button" variant={variant} className="w-full sm:w-auto" disabled={loading} onClick={onClick}>
        {loading ? "Gerando…" : children}
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-status-bad">
          {error}
        </span>
      ) : null}
    </span>
  );
}
