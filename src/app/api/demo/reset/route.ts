import {NextRequest, NextResponse} from "next/server";
import {hasRole, isSameOrigin, sessionFromRequest} from "@/lib/auth";
import {CLEARPATH_SEED_VERSION, resetClearPath} from "@/lib/clearpath";
import {acquireDemoResetLock, DEMO_RESET_ROLES, isDemoResetEnabled} from "@/lib/demo";

export async function POST(request: NextRequest) {
  const session = sessionFromRequest(request);
  if (!session) return NextResponse.json({error: "Unauthorized"}, {status: 401});
  if (!isDemoResetEnabled()) {
    return NextResponse.json({error: "Demo data restoration is disabled."}, {status: 403});
  }
  if (!hasRole(session, DEMO_RESET_ROLES) || !isSameOrigin(request)) {
    return NextResponse.json({error: "Forbidden"}, {status: 403});
  }
  const body = await request.json().catch(() => null);
  if (!body || body.confirmation !== "RESTORE_CLEARPATH_DEMO") {
    return NextResponse.json({error: "Reset confirmation is required."}, {status: 400});
  }
  const releaseResetLock = acquireDemoResetLock();
  if (!releaseResetLock) {
    return NextResponse.json({error: "A demo data restoration is already running."}, {status: 409});
  }

  const startedAt = new Date().toISOString();
  try {
    const counts = resetClearPath();
    console.info(JSON.stringify({
      event: "clearpath_demo_data_restored",
      actor: session.email,
      role: session.role,
      startedAt,
      completedAt: new Date().toISOString(),
      seedVersion: CLEARPATH_SEED_VERSION,
    }));
    return NextResponse.json({
      ok: true,
      seedVersion: CLEARPATH_SEED_VERSION,
      counts,
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "clearpath_demo_data_restore_failed",
      actor: session.email,
      role: session.role,
      startedAt,
      failedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown reset failure",
    }));
    return NextResponse.json(
      {error: "The seed dataset could not be restored. Please try again."},
      {status: 503},
    );
  } finally {
    releaseResetLock();
  }
}
