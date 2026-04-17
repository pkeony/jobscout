"use client";

import { useCallback, useReducer, useRef } from "react";

interface StreamState<T> {
  status: "idle" | "streaming" | "done" | "error";
  chunks: T[];
  fullText: string;
  error: string | null;
}

type StreamAction<T> =
  | { type: "START" }
  | { type: "CHUNK"; chunk: T; text?: string }
  | { type: "DONE" }
  | { type: "ERROR"; error: string }
  | { type: "RESET" };

function createReducer<T>() {
  return function reducer(
    state: StreamState<T>,
    action: StreamAction<T>,
  ): StreamState<T> {
    switch (action.type) {
      case "START":
        return { status: "streaming", chunks: [], fullText: "", error: null };
      case "CHUNK":
        return {
          ...state,
          chunks: [...state.chunks, action.chunk],
          fullText: state.fullText + (action.text ?? ""),
        };
      case "DONE":
        return { ...state, status: "done" };
      case "ERROR":
        return { ...state, status: "error", error: action.error };
      case "RESET":
        return { status: "idle", chunks: [], fullText: "", error: null };
    }
  };
}

const initialState: StreamState<never> = {
  status: "idle",
  chunks: [],
  fullText: "",
  error: null,
};

export function useStreamingResponse<T extends { type: string }>(
  url: string,
) {
  const reducer = createReducer<T>();
  const [state, dispatch] = useReducer(
    reducer,
    initialState as StreamState<T>,
  );
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (body: Record<string, unknown> | FormData) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      dispatch({ type: "START" });

      const isFormData = body instanceof FormData;

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: isFormData ? undefined : { "Content-Type": "application/json" },
          body: isFormData ? body : JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.text();
          dispatch({ type: "ERROR", error: errBody || `HTTP ${res.status}` });
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          dispatch({ type: "ERROR", error: "스트림을 읽을 수 없습니다" });
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            const match = frame.match(/data: (.*)/);
            if (!match?.[1]) continue;

            const chunk = JSON.parse(match[1]) as T;

            // SSE error 이벤트 처리 (서버에서 스트리밍 에러 발생 시)
            if (chunk.type === "error") {
              const msg = "message" in chunk && typeof chunk.message === "string"
                ? chunk.message
                : "서버 오류";
              dispatch({ type: "ERROR", error: msg });
              return;
            }

            const text =
              "text" in chunk && typeof chunk.text === "string"
                ? chunk.text
                : "";
            dispatch({ type: "CHUNK", chunk, text });
          }
        }

        dispatch({ type: "DONE" });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        dispatch({
          type: "ERROR",
          error: err instanceof Error ? err.message : "알 수 없는 오류",
        });
      }
    },
    [url],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "DONE" });
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "RESET" });
  }, []);

  return { ...state, start, stop, reset };
}
