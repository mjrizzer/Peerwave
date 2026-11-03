"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="page-head empty">
      <h1>A small pause.</h1>
      <p>
        We couldn’t load this page. Check your connection and Firebase
        configuration, then try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
