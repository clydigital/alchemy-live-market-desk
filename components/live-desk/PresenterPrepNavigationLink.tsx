"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { presenterPrepHref } from "@/lib/presenter-prep-navigation";

export default function PresenterPrepNavigationLink({
  activePath, className,
}: { activePath: string; className: string }) {
  const searchParams = useSearchParams();
  return (
    <Link className={className}
      href={presenterPrepHref(activePath, searchParams.toString())}>
      Presenter Prep
    </Link>
  );
}
