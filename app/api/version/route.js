export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || 'dev',
  });
}
