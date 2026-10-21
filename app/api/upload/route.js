import { handleUpload } from '@vercel/blob/client';

export async function POST(req) {
  const body = await req.json();
  try {
    const json = await handleUpload({
      body, request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!process.env.ADMIN_PASSWORD || clientPayload !== process.env.ADMIN_PASSWORD)
          throw new Error('Unauthorized');
        return { allowedContentTypes: ['audio/*'], addRandomSuffix: true };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(json);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
