// Step 1 of Decap CMS's GitHub OAuth flow. The CMS opens a popup pointed at
// /auth; we redirect it to GitHub's own authorize page. GitHub then sends the
// browser back to /callback with a one-time code.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/callback`;

  if (!env.GITHUB_OAUTH_CLIENT_ID) {
    return new Response("Missing GITHUB_OAUTH_CLIENT_ID environment variable", { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: env.GITHUB_OAUTH_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "repo,user",
  });

  return Response.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`, 302);
}
