export interface ProblemBody {
  type: string;
  title: string;
  status: number;
  code: string;
  message: string;
  requestId: string;
}

export function problemResponse(
  problem: {
    title: string;
    status: number;
    code: string;
    message: string;
    requestId: string;
  },
  extraHeaders: Record<string, string> = {},
): Response {
  return Response.json(
    { type: "about:blank", ...problem },
    {
      status: problem.status,
      headers: {
        "Content-Type": "application/problem+json",
        ...extraHeaders,
      },
    },
  );
}
