import useSWR from "swr";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function useClientNames() {
  const { data, error, isLoading } = useSWR<string[]>(
    "/api/client-names",
    fetcher
  );

  return {
    clientNames: data || [],
    isLoading,
    isError: !!error,
  };
}
