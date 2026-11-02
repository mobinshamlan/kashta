"use client";

import { useEffect } from "react";
import { useI18n } from "@/components/locale-provider";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { dict } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="frame flex min-h-[60svh] flex-col justify-center py-20" role="alert">
      <h1 className="head max-w-[18ch]">{dict.errors.internal}</h1>
      <button type="button" className="btn mt-8 self-start" onClick={reset}>
        {dict.common.retry}
      </button>
    </div>
  );
}
