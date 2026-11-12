/** Verified remote: ForHoosh-POS — NOT the local workspace folder name. */
export const DEFAULT_REPO_OWNER = 'mahdanmadivi69-droid';
export const DEFAULT_REPO_NAME = 'ForHoosh-POS';

export interface UpdateCheckResult {
  hasUpdate: boolean;
  latestVersion: string;
  releaseNotes: string;
  downloadUrl: string;
}

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubLatestReleaseResponse {
  tag_name?: string;
  body?: string;
  html_url?: string;
  assets?: GitHubReleaseAsset[];
}

function parseSemver(version: string): [number, number, number] {
  const clean = version.trim().replace(/^v/i, '').split('-')[0];
  const parts = clean.split('.').map((n) => parseInt(n, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function isNewerVersion(latest: string, current: string): boolean {
  const [lMaj, lMin, lPat] = parseSemver(latest);
  const [cMaj, cMin, cPat] = parseSemver(current);

  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPat > cPat;
}

export async function checkForKarWandUpdate(
  currentVersion: string,
  repoOwner: string = DEFAULT_REPO_OWNER,
  repoName: string = DEFAULT_REPO_NAME
): Promise<UpdateCheckResult> {
  if (!repoOwner || !repoName) {
    throw new Error('Repository owner and name are required.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const endpoint = `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/releases/latest`;
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`GitHub API responded with ${response.status}`);
    }

    const data = (await response.json()) as GitHubLatestReleaseResponse;
    const latestVersion = (data.tag_name ?? currentVersion).replace(/^v/i, '');
    const assets = Array.isArray(data.assets) ? data.assets : [];
    const installerAsset = assets.find((a) => /\.(exe|msi|zip)$/i.test(a.name));
    const downloadUrl = installerAsset?.browser_download_url || data.html_url || '';

    return {
      hasUpdate: isNewerVersion(latestVersion, currentVersion),
      latestVersion,
      releaseNotes: data.body ?? '',
      downloadUrl,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
