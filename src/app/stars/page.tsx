import { redirect } from "next/navigation";

/** Stargazing is now a mode of the shared homepage; keep old links working. */
export default function StarsPage() {
  redirect("/?mode=stars");
}
