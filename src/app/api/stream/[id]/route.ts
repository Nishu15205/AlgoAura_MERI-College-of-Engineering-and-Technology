// GET /api/stream/[id] — Server-Sent Events stream that replays a patient's
// wearable data one sample at a time on a 1.5-second tick, mimicking a live
// CGM + wearable feed. Optional: ?speed=<ms> (tick interval, default 1500).
//
// The frontend connects with EventSource("/api/stream/<id>?speed=1500").
import { db } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const tickMs = Math.max(300, parseInt(url.searchParams.get("speed") || "1500", 10));

  // load the last ~2 hours of samples to replay (240 samples = 20h at 5min... we use last 240)
  const rows = await db.wearableSample.findMany({
    where: { patientId: id },
    orderBy: { ts: "desc" },
    take: 240,
  });
  rows.reverse();

  const encoder = new TextEncoder();
  let intervalHandle: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      let i = 0;
      const tick = () => {
        if (i >= rows.length) {
          controller.enqueue(
            encoder.encode(`event: done\ndata: ${JSON.stringify({ count: rows.length })}\n\n`)
          );
          controller.close();
          if (intervalHandle) clearInterval(intervalHandle);
          return;
        }
        const s = rows[i];
        const payload = {
          i,
          total: rows.length,
          patientId: s.patientId,
          ts: s.ts,
          tsHuman: s.tsHuman,
          glucose: s.glucose,
          heartRate: s.heartRate,
          hrvRmssd: s.hrvRmssd,
          steps: s.steps,
          sleepStage: s.sleepStage,
          mealCarbsG: s.mealCarbsG,
          activityMin: s.activityMin,
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        i++;
      };
      tick();
      intervalHandle = setInterval(tick, tickMs);
    },
    cancel() {
      if (intervalHandle) clearInterval(intervalHandle);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
