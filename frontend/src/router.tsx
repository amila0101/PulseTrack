import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/**
 * Singleton QueryClient — created once per application lifetime.
 * Previously this was instantiated inside getRouter(), which caused a fresh
 * client (and thus empty cache) to be created on every call.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Do not retry failed requests in development so errors surface immediately.
      retry: process.env.NODE_ENV === "production" ? 2 : false,
      // Consider data fresh for 30 seconds before re-fetching in the background.
      staleTime: 30_000,
    },
  },
});

export const getRouter = () =>
  createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });
