import { useResource } from "./api";

/** The public demo settings, or null when the server isn't in demo mode. */
export function useDemo() {
  const { data } = useResource("/demo");
  return data?.data?.enabled ? data.data : null;
}
